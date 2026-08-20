export const PDM_READONLY_SOURCE = Object.freeze({
  owner: "dutuanan96",
  repository: "bom-viewer-sync",
  branch: "main",
  shardRoot: "bom-viewer-sync/data",
  accessMode: "READ_ONLY" as const,
});

interface LocalizedValue {
  zh?: string;
  vi?: string;
}

interface PdmMaterialLine {
  mat_code?: string;
  name_zh?: string;
  name_vi?: string;
  spec?: string;
  spec_vi?: string;
  qty?: string | number;
  materials?: PdmMaterialLine[];
}

interface PdmVariant {
  sku?: string;
  name_zh?: string;
  name_vi?: string;
  materials?: PdmMaterialLine[];
}

interface PdmProductShard {
  code?: string;
  revision?: string;
  color_info?: Record<string, PdmVariant>;
}

interface PdmManifest {
  version?: number;
  updatedAt?: string;
  products?: string[];
  productRevisions?: Record<string, {
    effectiveRevision?: string;
  }>;
}

interface PdmMaterialsShard {
  materialDb?: {
    materials?: Record<string, {
      id?: string;
      code?: string;
      name?: LocalizedValue;
      spec?: LocalizedValue;
    }>;
  };
}

export interface SyncedItem {
  id: string;
  code: string;
  itemType: "PRODUCT" | "MATERIAL";
  nameZh: string;
  nameVi: string;
  specification: string;
  sourceRevision: string | null;
}

export interface SyncedBomLine {
  id: string;
  productSku: string;
  productRevision: string;
  materialCode: string;
  parentMaterialCode: string | null;
  level: number;
  quantityExpression: string;
  normalizedQuantity: number;
  sourcePath: string;
}

export interface PdmReadOnlySnapshot {
  sourceCommitSha: string;
  sourceUpdatedAt: string | null;
  shardCount: number;
  products: SyncedItem[];
  materials: SyncedItem[];
  bomLines: SyncedBomLine[];
}

type Fetcher = typeof fetch;

function assertNonEmpty(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`PDM_INVALID_${field.toUpperCase()}`);
  }
  return value.trim();
}

export function parsePdmQuantity(value: string | number | undefined): number {
  const expression = String(value ?? "").trim();
  if (!expression || !/^\d+(?:\.\d+)?(?:\s*\+\s*\d+(?:\.\d+)?)*$/.test(expression)) {
    throw new Error("PDM_INVALID_QUANTITY_EXPRESSION");
  }
  const quantity = expression.split("+").reduce((total, part) => total + Number(part.trim()), 0);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error("PDM_INVALID_QUANTITY");
  }
  return quantity;
}

async function fetchJson<T>(fetcher: Fetcher, url: string): Promise<T> {
  const response = await fetcher(url, {
    method: "GET",
    headers: {
      Accept: "application/vnd.github+json, application/json",
      "User-Agent": "JinTai-FactoryOps-PDM-ReadOnly",
    },
  });
  if (!response.ok) {
    throw new Error(`PDM_READ_FAILED_${response.status}`);
  }
  return response.json() as Promise<T>;
}

async function resolveCommit(fetcher: Fetcher): Promise<string> {
  const url = `https://api.github.com/repos/${PDM_READONLY_SOURCE.owner}/${PDM_READONLY_SOURCE.repository}/commits/${PDM_READONLY_SOURCE.branch}`;
  const payload = await fetchJson<{ sha?: string }>(fetcher, url);
  const sha = assertNonEmpty(payload.sha, "commit_sha");
  if (!/^[0-9a-f]{40}$/i.test(sha)) {
    throw new Error("PDM_INVALID_COMMIT_SHA");
  }
  return sha;
}

function rawShardUrl(commitSha: string, path: string): string {
  return `https://raw.githubusercontent.com/${PDM_READONLY_SOURCE.owner}/${PDM_READONLY_SOURCE.repository}/${commitSha}/${PDM_READONLY_SOURCE.shardRoot}/${path}`;
}

function stableId(parts: string[]): string {
  let hash = 2166136261;
  for (const character of parts.join("|")) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `pdm_${(hash >>> 0).toString(36)}`;
}

function flattenBomLines(input: {
  lines: PdmMaterialLine[];
  productSku: string;
  productRevision: string;
  parentMaterialCode: string | null;
  level: number;
  pathPrefix: string;
}): SyncedBomLine[] {
  const result: SyncedBomLine[] = [];
  input.lines.forEach((line, index) => {
    const materialCode = assertNonEmpty(line.mat_code, "material_code");
    const quantityExpression = String(line.qty ?? "").trim();
    const sourcePath = `${input.pathPrefix}.${index}`;
    result.push({
      id: stableId([input.productSku, input.productRevision, sourcePath, materialCode]),
      productSku: input.productSku,
      productRevision: input.productRevision,
      materialCode,
      parentMaterialCode: input.parentMaterialCode,
      level: input.level,
      quantityExpression,
      normalizedQuantity: parsePdmQuantity(line.qty),
      sourcePath,
    });
    if (Array.isArray(line.materials) && line.materials.length > 0) {
      result.push(...flattenBomLines({
        lines: line.materials,
        productSku: input.productSku,
        productRevision: input.productRevision,
        parentMaterialCode: materialCode,
        level: input.level + 1,
        pathPrefix: `${sourcePath}.children`,
      }));
    }
  });
  return result;
}

export async function loadPdmReadOnlySnapshot(fetcher: Fetcher = fetch): Promise<PdmReadOnlySnapshot> {
  const sourceCommitSha = await resolveCommit(fetcher);
  const manifest = await fetchJson<PdmManifest>(fetcher, rawShardUrl(sourceCommitSha, "manifest.json"));
  if (manifest.version !== 2 || !Array.isArray(manifest.products) || manifest.products.length === 0) {
    throw new Error("PDM_INVALID_MANIFEST");
  }
  const productCodes = [...new Set(manifest.products.map((code) => assertNonEmpty(code, "product_code")))];
  if (productCodes.length !== manifest.products.length) {
    throw new Error("PDM_DUPLICATE_PRODUCT_SHARD");
  }

  const [materialsShard, ...productShards] = await Promise.all([
    fetchJson<PdmMaterialsShard>(fetcher, rawShardUrl(sourceCommitSha, "materials.json")),
    ...productCodes.map((code) => fetchJson<PdmProductShard>(fetcher, rawShardUrl(sourceCommitSha, `products/${code}.json`))),
  ]);

  const products: SyncedItem[] = [];
  const bomLines: SyncedBomLine[] = [];
  productShards.forEach((product, productIndex) => {
    const expectedCode = productCodes[productIndex];
    if (assertNonEmpty(product.code, "product_code") !== expectedCode) {
      throw new Error("PDM_PRODUCT_SHARD_MISMATCH");
    }
    const revision = assertNonEmpty(
      manifest.productRevisions?.[expectedCode]?.effectiveRevision ?? product.revision,
      "product_revision",
    );
    const variants = Object.values(product.color_info ?? {});
    if (variants.length === 0) {
      throw new Error("PDM_PRODUCT_WITHOUT_VARIANTS");
    }
    variants.forEach((variant) => {
      const sku = assertNonEmpty(variant.sku, "sku");
      products.push({
        id: stableId(["PRODUCT", sku]),
        code: sku,
        itemType: "PRODUCT",
        nameZh: variant.name_zh?.trim() ?? "",
        nameVi: variant.name_vi?.trim() ?? "",
        specification: "",
        sourceRevision: revision,
      });
      bomLines.push(...flattenBomLines({
        lines: variant.materials ?? [],
        productSku: sku,
        productRevision: revision,
        parentMaterialCode: null,
        level: 0,
        pathPrefix: `${expectedCode}.${sku}.materials`,
      }));
    });
  });

  const materialRecords = Object.values(materialsShard.materialDb?.materials ?? {});
  const materials = materialRecords.map((material) => {
    const code = assertNonEmpty(material.code, "material_code");
    return {
      id: material.id?.trim() || stableId(["MATERIAL", code]),
      code,
      itemType: "MATERIAL" as const,
      nameZh: material.name?.zh?.trim() ?? "",
      nameVi: material.name?.vi?.trim() ?? "",
      specification: material.spec?.zh?.trim() || material.spec?.vi?.trim() || "",
      sourceRevision: null,
    };
  });

  const expectedShardCount = 2 + productCodes.length;
  return {
    sourceCommitSha,
    sourceUpdatedAt: manifest.updatedAt ?? null,
    shardCount: expectedShardCount,
    products,
    materials,
    bomLines,
  };
}
