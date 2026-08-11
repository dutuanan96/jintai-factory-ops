import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
};

export const items = sqliteTable("items", {
  id: text("id").primaryKey(),
  code: text("code").notNull(),
  itemType: text("item_type", { enum: ["PRODUCT", "MATERIAL"] }).notNull(),
  nameZh: text("name_zh").notNull().default(""),
  nameVi: text("name_vi").notNull().default(""),
  specification: text("specification").notNull().default(""),
  baseUom: text("base_uom").notNull().default("PCS"),
  sourceSystem: text("source_system").notNull().default("PDM"),
  sourceRevision: text("source_revision"),
  sourceCommitSha: text("source_commit_sha"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  ...timestamps,
}, (table) => [
  uniqueIndex("uq_items_code_commit").on(table.code, table.sourceCommitSha),
  index("idx_items_type_active").on(table.itemType, table.active),
]);

export const pdmBomLines = sqliteTable("pdm_bom_lines", {
  id: text("id").primaryKey(),
  productSku: text("product_sku").notNull(),
  productRevision: text("product_revision").notNull(),
  materialCode: text("material_code").notNull(),
  parentMaterialCode: text("parent_material_code"),
  level: integer("level").notNull().default(0),
  quantityExpression: text("quantity_expression").notNull(),
  normalizedQuantity: real("normalized_quantity").notNull(),
  sourceCommitSha: text("source_commit_sha").notNull(),
  sourcePath: text("source_path").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("uq_pdm_bom_source_line").on(table.productSku, table.productRevision, table.sourceCommitSha, table.sourcePath),
  index("idx_pdm_bom_product_revision").on(table.productSku, table.productRevision),
  index("idx_pdm_bom_material").on(table.materialCode),
]);

export const pdmSyncRuns = sqliteTable("pdm_sync_runs", {
  id: text("id").primaryKey(),
  sourceCommitSha: text("source_commit_sha").notNull(),
  sourceUpdatedAt: text("source_updated_at"),
  status: text("status", { enum: ["STARTED", "VALIDATED", "APPLIED", "FAILED"] }).notNull(),
  productCount: integer("product_count").notNull().default(0),
  shardCount: integer("shard_count").notNull().default(0),
  bomLineCount: integer("bom_line_count").notNull().default(0),
  actorId: text("actor_id").notNull(),
  errorCode: text("error_code"),
  startedAt: text("started_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  completedAt: text("completed_at"),
}, (table) => [index("idx_pdm_sync_started").on(table.startedAt)]);

export const integrationState = sqliteTable("integration_state", {
  integration: text("integration").primaryKey(),
  activeSourceCommitSha: text("active_source_commit_sha").notNull(),
  activatedAt: text("activated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  activatedBy: text("activated_by").notNull(),
});

export const productionOrders = sqliteTable("production_orders", {
  id: text("id").primaryKey(),
  orderNumber: text("order_number").notNull(),
  productSku: text("product_sku").notNull(),
  plannedQuantity: real("planned_quantity").notNull(),
  completedQuantity: real("completed_quantity").notNull().default(0),
  dueDate: text("due_date").notNull(),
  status: text("status", { enum: ["DRAFT", "PLANNED", "RELEASED", "IN_PROGRESS", "PARTIALLY_COMPLETED", "COMPLETED", "CLOSED", "CANCELLED"] }).notNull().default("DRAFT"),
  bomRevision: text("bom_revision"),
  bomSourceCommitSha: text("bom_source_commit_sha"),
  version: integer("version").notNull().default(1),
  createdBy: text("created_by").notNull(),
  releasedBy: text("released_by"),
  releasedAt: text("released_at"),
  ...timestamps,
}, (table) => [
  uniqueIndex("uq_production_orders_number").on(table.orderNumber),
  index("idx_production_orders_status_due").on(table.status, table.dueDate),
  index("idx_production_orders_sku").on(table.productSku),
]);

export const productionOrderBomLines = sqliteTable("production_order_bom_lines", {
  id: text("id").primaryKey(),
  productionOrderId: text("production_order_id").notNull().references(() => productionOrders.id, { onDelete: "restrict" }),
  materialCode: text("material_code").notNull(),
  parentMaterialCode: text("parent_material_code"),
  level: integer("level").notNull(),
  quantityPerProduct: real("quantity_per_product").notNull(),
  requiredQuantity: real("required_quantity").notNull(),
  sourceBomLineId: text("source_bom_line_id").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_order_bom_order").on(table.productionOrderId)]);

export const purchaseRequisitions = sqliteTable("purchase_requisitions", {
  id: text("id").primaryKey(),
  requisitionNumber: text("requisition_number").notNull(),
  status: text("status", { enum: ["DRAFT", "SUBMITTED", "APPROVED", "CONVERTED", "CLOSED", "CANCELLED"] }).notNull().default("DRAFT"),
  requiredDate: text("required_date").notNull(),
  createdBy: text("created_by").notNull(),
  ...timestamps,
}, (table) => [uniqueIndex("uq_purchase_requisitions_number").on(table.requisitionNumber)]);

export const purchaseRequisitionLines = sqliteTable("purchase_requisition_lines", {
  id: text("id").primaryKey(),
  requisitionId: text("requisition_id").notNull().references(() => purchaseRequisitions.id, { onDelete: "restrict" }),
  materialCode: text("material_code").notNull(),
  requestedQuantity: real("requested_quantity").notNull(),
  sourceProductionOrderId: text("source_production_order_id").notNull().references(() => productionOrders.id, { onDelete: "restrict" }),
  sourceOrderBomLineId: text("source_order_bom_line_id").notNull().references(() => productionOrderBomLines.id, { onDelete: "restrict" }),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_pr_lines_requisition").on(table.requisitionId)]);

export const purchaseOrders = sqliteTable("purchase_orders", {
  id: text("id").primaryKey(),
  orderNumber: text("order_number").notNull(),
  supplierCode: text("supplier_code").notNull(),
  status: text("status", { enum: ["DRAFT", "ISSUED", "PARTIALLY_RECEIVED", "RECEIVED", "CLOSED", "CANCELLED"] }).notNull().default("DRAFT"),
  expectedDate: text("expected_date").notNull(),
  createdBy: text("created_by").notNull(),
  ...timestamps,
}, (table) => [uniqueIndex("uq_purchase_orders_number").on(table.orderNumber)]);

export const inventoryTransactions = sqliteTable("inventory_transactions", {
  id: text("id").primaryKey(),
  transactionNumber: text("transaction_number").notNull(),
  transactionType: text("transaction_type", { enum: ["PURCHASE_RECEIPT", "MATERIAL_ISSUE", "MATERIAL_RETURN", "FINISHED_GOODS_RECEIPT", "SHIPMENT", "ADJUSTMENT", "REVERSAL"] }).notNull(),
  itemCode: text("item_code").notNull(),
  warehouseCode: text("warehouse_code").notNull(),
  locationCode: text("location_code"),
  quantityDelta: real("quantity_delta").notNull(),
  sourceDocumentType: text("source_document_type").notNull(),
  sourceDocumentId: text("source_document_id").notNull(),
  reversalOfId: text("reversal_of_id"),
  postedBy: text("posted_by").notNull(),
  postedAt: text("posted_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("uq_inventory_transaction_number").on(table.transactionNumber),
  index("idx_inventory_item_warehouse").on(table.itemCode, table.warehouseCode),
  index("idx_inventory_source").on(table.sourceDocumentType, table.sourceDocumentId),
]);

export const deliveryOrders = sqliteTable("delivery_orders", {
  id: text("id").primaryKey(),
  deliveryNumber: text("delivery_number").notNull(),
  customerCode: text("customer_code").notNull(),
  productSku: text("product_sku").notNull(),
  plannedQuantity: real("planned_quantity").notNull(),
  shippedQuantity: real("shipped_quantity").notNull().default(0),
  dueDate: text("due_date").notNull(),
  status: text("status", { enum: ["DRAFT", "APPROVED", "PICKING", "PARTIALLY_SHIPPED", "SHIPPED", "CLOSED", "CANCELLED"] }).notNull().default("DRAFT"),
  createdBy: text("created_by").notNull(),
  ...timestamps,
}, (table) => [uniqueIndex("uq_delivery_orders_number").on(table.deliveryNumber)]);

export const auditEvents = sqliteTable("audit_events", {
  id: text("id").primaryKey(),
  actorId: text("actor_id").notNull(),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  previousStatus: text("previous_status"),
  nextStatus: text("next_status"),
  correlationId: text("correlation_id").notNull(),
  metadataJson: text("metadata_json").notNull().default("{}"),
  occurredAt: text("occurred_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("idx_audit_entity").on(table.entityType, table.entityId),
  index("idx_audit_occurred").on(table.occurredAt),
]);
