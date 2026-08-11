import { getD1 } from "../../../db";
import { canTransitionProductionOrder, type ProductionOrderStatus } from "../../../lib/workflow";

function actorFrom(request: Request): string | null {
  const userId = request.headers.get("oai-authenticated-user-id")?.trim();
  if (userId) return userId;
  const hostname = new URL(request.url).hostname;
  return hostname === "localhost" || hostname === "127.0.0.1" ? "local-admin" : null;
}

function exactKeys(value: Record<string, unknown>, allowed: string[]): boolean {
  const allowedSet = new Set(allowed);
  return Object.keys(value).every((key) => allowedSet.has(key));
}

function orderNumber(): string {
  const now = new Date();
  const date = `${String(now.getUTCFullYear()).slice(-2)}${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  return `MO-${date}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
}

export async function GET() {
  try {
    const db = getD1();
    const [activeIntegration, orders, syncRuns, stockBalances] = await Promise.all([
      db.prepare(`SELECT active_source_commit_sha, activated_at FROM integration_state WHERE integration = 'PDM'`).first(),
      db.prepare(`
        SELECT id, order_number, product_sku, planned_quantity, completed_quantity,
               due_date, status, bom_revision, bom_source_commit_sha, version
        FROM production_orders
        ORDER BY due_date ASC, created_at DESC
        LIMIT 100
      `).all(),
      db.prepare(`
        SELECT id, source_commit_sha, status, product_count, shard_count, bom_line_count,
               actor_id, started_at, completed_at
        FROM pdm_sync_runs
        ORDER BY started_at DESC
        LIMIT 10
      `).all(),
      db.prepare(`
        SELECT item_code, warehouse_code, SUM(quantity_delta) AS on_hand
        FROM inventory_transactions
        GROUP BY item_code, warehouse_code
        ORDER BY item_code
        LIMIT 200
      `).all(),
    ]);
    return Response.json({
      activePdm: activeIntegration ?? null,
      productionOrders: orders.results,
      syncRuns: syncRuns.results,
      stockBalances: stockBalances.results,
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "OPERATIONS_READ_FAILED" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const actorId = actorFrom(request);
  if (!actorId) {
    return Response.json({ error: "AUTHENTICATION_REQUIRED" }, { status: 401 });
  }

  try {
    const body = await request.json() as Record<string, unknown>;
    if (body.action === "create_production_order") {
      if (!exactKeys(body, ["action", "sku", "plannedQuantity", "dueDate"])) {
        return Response.json({ error: "UNKNOWN_FIELD" }, { status: 400 });
      }
      const sku = typeof body.sku === "string" ? body.sku.trim().toUpperCase() : "";
      const plannedQuantity = typeof body.plannedQuantity === "number" ? body.plannedQuantity : Number.NaN;
      const dueDate = typeof body.dueDate === "string" ? body.dueDate.trim() : "";
      if (!/^[A-Z0-9-]{4,40}$/.test(sku) || !Number.isFinite(plannedQuantity) || plannedQuantity <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
        return Response.json({ error: "INVALID_PRODUCTION_ORDER" }, { status: 400 });
      }

      const db = getD1();
      const product = await db.prepare(`
        SELECT i.source_revision, i.source_commit_sha
        FROM items i
        JOIN integration_state s
          ON s.integration = 'PDM' AND s.active_source_commit_sha = i.source_commit_sha
        WHERE i.code = ? AND i.item_type = 'PRODUCT' AND i.active = 1
        LIMIT 1
      `).bind(sku).first<{ source_revision: string; source_commit_sha: string }>();
      if (!product) {
        return Response.json({ error: "SKU_NOT_IN_ACTIVE_PDM_SNAPSHOT" }, { status: 409 });
      }

      const id = crypto.randomUUID();
      const number = orderNumber();
      const correlationId = crypto.randomUUID();
      await db.batch([
        db.prepare(`
          INSERT INTO production_orders (
            id, order_number, product_sku, planned_quantity, due_date, status,
            bom_revision, bom_source_commit_sha, created_by
          ) VALUES (?, ?, ?, ?, ?, 'DRAFT', ?, ?, ?)
        `).bind(id, number, sku, plannedQuantity, dueDate, product.source_revision, product.source_commit_sha, actorId),
        db.prepare(`
          INSERT INTO audit_events (id, actor_id, action, entity_type, entity_id, next_status, correlation_id, metadata_json)
          VALUES (?, ?, 'CREATE', 'PRODUCTION_ORDER', ?, 'DRAFT', ?, ?)
        `).bind(crypto.randomUUID(), actorId, id, correlationId, JSON.stringify({ orderNumber: number, sku, plannedQuantity, dueDate })),
      ]);
      return Response.json({ id, orderNumber: number, status: "DRAFT", version: 1 }, { status: 201 });
    }

    if (body.action === "transition_production_order") {
      if (!exactKeys(body, ["action", "orderId", "nextStatus", "expectedVersion"])) {
        return Response.json({ error: "UNKNOWN_FIELD" }, { status: 400 });
      }
      const orderId = typeof body.orderId === "string" ? body.orderId.trim() : "";
      const nextStatus = typeof body.nextStatus === "string" ? body.nextStatus as ProductionOrderStatus : "" as ProductionOrderStatus;
      const expectedVersion = typeof body.expectedVersion === "number" ? body.expectedVersion : -1;
      const db = getD1();
      const order = await db.prepare(`
        SELECT id, product_sku, planned_quantity, status, bom_revision, bom_source_commit_sha, version
        FROM production_orders WHERE id = ? LIMIT 1
      `).bind(orderId).first<{
        id: string;
        product_sku: string;
        planned_quantity: number;
        status: ProductionOrderStatus;
        bom_revision: string;
        bom_source_commit_sha: string;
        version: number;
      }>();
      if (!order) return Response.json({ error: "PRODUCTION_ORDER_NOT_FOUND" }, { status: 404 });
      if (order.version !== expectedVersion) return Response.json({ error: "STALE_PRODUCTION_ORDER" }, { status: 409 });
      if (!canTransitionProductionOrder(order.status, nextStatus)) return Response.json({ error: "INVALID_STATUS_TRANSITION" }, { status: 409 });

      const statements: D1PreparedStatement[] = [];
      if (nextStatus === "RELEASED") {
        const bom = await db.prepare(`
          SELECT id, material_code, parent_material_code, level, normalized_quantity
          FROM pdm_bom_lines
          WHERE product_sku = ? AND product_revision = ? AND source_commit_sha = ?
          ORDER BY source_path
        `).bind(order.product_sku, order.bom_revision, order.bom_source_commit_sha).all<{
          id: string;
          material_code: string;
          parent_material_code: string | null;
          level: number;
          normalized_quantity: number;
        }>();
        if (bom.results.length === 0) return Response.json({ error: "PDM_BOM_NOT_AVAILABLE" }, { status: 409 });
        for (const line of bom.results) {
          statements.push(db.prepare(`
            INSERT INTO production_order_bom_lines (
              id, production_order_id, material_code, parent_material_code, level,
              quantity_per_product, required_quantity, source_bom_line_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            crypto.randomUUID(), order.id, line.material_code, line.parent_material_code,
            line.level, line.normalized_quantity, line.normalized_quantity * order.planned_quantity, line.id,
          ));
        }
      }

      const correlationId = crypto.randomUUID();
      statements.push(
        db.prepare(`
          UPDATE production_orders
          SET status = ?, version = version + 1, updated_at = CURRENT_TIMESTAMP,
              released_by = CASE WHEN ? = 'RELEASED' THEN ? ELSE released_by END,
              released_at = CASE WHEN ? = 'RELEASED' THEN CURRENT_TIMESTAMP ELSE released_at END
          WHERE id = ? AND version = ?
        `).bind(nextStatus, nextStatus, actorId, nextStatus, order.id, expectedVersion),
        db.prepare(`
          INSERT INTO audit_events (
            id, actor_id, action, entity_type, entity_id, previous_status,
            next_status, correlation_id, metadata_json
          ) VALUES (?, ?, 'TRANSITION', 'PRODUCTION_ORDER', ?, ?, ?, ?, '{}')
        `).bind(crypto.randomUUID(), actorId, order.id, order.status, nextStatus, correlationId),
      );
      await db.batch(statements);
      return Response.json({ id: order.id, previousStatus: order.status, status: nextStatus, version: expectedVersion + 1 });
    }

    return Response.json({ error: "UNKNOWN_ACTION" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "OPERATIONS_WRITE_FAILED" }, { status: 500 });
  }
}
