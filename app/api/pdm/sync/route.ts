import { getD1 } from "../../../../db";
import { loadPdmReadOnlySnapshot, PDM_READONLY_SOURCE } from "../../../../lib/pdm-readonly";

function actorFrom(request: Request): string | null {
  const userId = request.headers.get("oai-authenticated-user-id")?.trim();
  if (userId) return userId;
  const hostname = new URL(request.url).hostname;
  return hostname === "localhost" || hostname === "127.0.0.1" ? "local-admin" : null;
}

async function executeInChunks(db: D1Database, statements: D1PreparedStatement[], chunkSize = 80): Promise<void> {
  for (let index = 0; index < statements.length; index += chunkSize) {
    await db.batch(statements.slice(index, index + chunkSize));
  }
}

export async function GET() {
  return Response.json({
    source: PDM_READONLY_SOURCE,
    allowedHttpMethods: ["GET"],
    writeBackEnabled: false,
    operationalDatabase: "FactoryOps D1",
  });
}

export async function POST(request: Request) {
  const actorId = actorFrom(request);
  if (!actorId) {
    return Response.json({ error: "AUTHENTICATION_REQUIRED" }, { status: 401 });
  }

  const runId = crypto.randomUUID();
  let db: D1Database | null = null;
  try {
    const snapshot = await loadPdmReadOnlySnapshot();
    db = getD1();
    await db.prepare(`
      INSERT INTO pdm_sync_runs (
        id, source_commit_sha, source_updated_at, status, product_count,
        shard_count, bom_line_count, actor_id
      ) VALUES (?, ?, ?, 'VALIDATED', ?, ?, ?, ?)
    `).bind(
      runId,
      snapshot.sourceCommitSha,
      snapshot.sourceUpdatedAt,
      snapshot.products.length,
      snapshot.shardCount,
      snapshot.bomLines.length,
      actorId,
    ).run();

    const bomStatements = snapshot.bomLines.map((line) => db!.prepare(`
      INSERT OR IGNORE INTO pdm_bom_lines (
        id, product_sku, product_revision, material_code, parent_material_code,
        level, quantity_expression, normalized_quantity, source_commit_sha, source_path
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      `${snapshot.sourceCommitSha.slice(0, 12)}_${line.id}`,
      line.productSku,
      line.productRevision,
      line.materialCode,
      line.parentMaterialCode,
      line.level,
      line.quantityExpression,
      line.normalizedQuantity,
      snapshot.sourceCommitSha,
      line.sourcePath,
    ));
    await executeInChunks(db, bomStatements);

    const itemStatements = [...snapshot.products, ...snapshot.materials].map((item) => db!.prepare(`
      INSERT OR IGNORE INTO items (
        id, code, item_type, name_zh, name_vi, specification, base_uom,
        source_system, source_revision, source_commit_sha, active
      ) VALUES (?, ?, ?, ?, ?, ?, 'PCS', 'PDM', ?, ?, 1)
    `).bind(
      `${snapshot.sourceCommitSha.slice(0, 12)}_${item.id}`,
      item.code,
      item.itemType,
      item.nameZh,
      item.nameVi,
      item.specification,
      item.sourceRevision,
      snapshot.sourceCommitSha,
    ));
    await executeInChunks(db, itemStatements);

    await db.batch([
      db.prepare(`
        INSERT INTO integration_state (integration, active_source_commit_sha, activated_by)
        VALUES ('PDM', ?, ?)
        ON CONFLICT(integration) DO UPDATE SET
          active_source_commit_sha = excluded.active_source_commit_sha,
          activated_at = CURRENT_TIMESTAMP,
          activated_by = excluded.activated_by
      `).bind(snapshot.sourceCommitSha, actorId),
      db.prepare(`
        UPDATE pdm_sync_runs SET status = 'APPLIED', completed_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(runId),
    ]);

    return Response.json({
      runId,
      status: "APPLIED",
      sourceCommitSha: snapshot.sourceCommitSha,
      sourceUpdatedAt: snapshot.sourceUpdatedAt,
      shardCount: snapshot.shardCount,
      productCount: snapshot.products.length,
      materialCount: snapshot.materials.length,
      bomLineCount: snapshot.bomLines.length,
      writeBackPerformed: false,
    });
  } catch (error) {
    if (db) {
      try {
        await db.prepare(`
          UPDATE pdm_sync_runs SET status = 'FAILED', error_code = ?, completed_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).bind(error instanceof Error ? error.message.slice(0, 80) : "UNKNOWN", runId).run();
      } catch {
        // The schema may not be migrated yet; the response below remains safe.
      }
    }
    return Response.json({
      error: error instanceof Error ? error.message : "PDM_SYNC_FAILED",
      writeBackPerformed: false,
    }, { status: 500 });
  }
}
