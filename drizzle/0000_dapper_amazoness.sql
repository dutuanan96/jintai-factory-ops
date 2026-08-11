CREATE TABLE `audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text NOT NULL,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`previous_status` text,
	`next_status` text,
	`correlation_id` text NOT NULL,
	`metadata_json` text DEFAULT '{}' NOT NULL,
	`occurred_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_audit_entity` ON `audit_events` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE INDEX `idx_audit_occurred` ON `audit_events` (`occurred_at`);--> statement-breakpoint
CREATE TABLE `delivery_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`delivery_number` text NOT NULL,
	`customer_code` text NOT NULL,
	`product_sku` text NOT NULL,
	`planned_quantity` real NOT NULL,
	`shipped_quantity` real DEFAULT 0 NOT NULL,
	`due_date` text NOT NULL,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_delivery_orders_number` ON `delivery_orders` (`delivery_number`);--> statement-breakpoint
CREATE TABLE `integration_state` (
	`integration` text PRIMARY KEY NOT NULL,
	`active_source_commit_sha` text NOT NULL,
	`activated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`activated_by` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `inventory_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`transaction_number` text NOT NULL,
	`transaction_type` text NOT NULL,
	`item_code` text NOT NULL,
	`warehouse_code` text NOT NULL,
	`location_code` text,
	`quantity_delta` real NOT NULL,
	`source_document_type` text NOT NULL,
	`source_document_id` text NOT NULL,
	`reversal_of_id` text,
	`posted_by` text NOT NULL,
	`posted_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_inventory_transaction_number` ON `inventory_transactions` (`transaction_number`);--> statement-breakpoint
CREATE INDEX `idx_inventory_item_warehouse` ON `inventory_transactions` (`item_code`,`warehouse_code`);--> statement-breakpoint
CREATE INDEX `idx_inventory_source` ON `inventory_transactions` (`source_document_type`,`source_document_id`);--> statement-breakpoint
CREATE TABLE `items` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`item_type` text NOT NULL,
	`name_zh` text DEFAULT '' NOT NULL,
	`name_vi` text DEFAULT '' NOT NULL,
	`specification` text DEFAULT '' NOT NULL,
	`base_uom` text DEFAULT 'PCS' NOT NULL,
	`source_system` text DEFAULT 'PDM' NOT NULL,
	`source_revision` text,
	`source_commit_sha` text,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_items_code_commit` ON `items` (`code`,`source_commit_sha`);--> statement-breakpoint
CREATE INDEX `idx_items_type_active` ON `items` (`item_type`,`active`);--> statement-breakpoint
CREATE TABLE `pdm_bom_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`product_sku` text NOT NULL,
	`product_revision` text NOT NULL,
	`material_code` text NOT NULL,
	`parent_material_code` text,
	`level` integer DEFAULT 0 NOT NULL,
	`quantity_expression` text NOT NULL,
	`normalized_quantity` real NOT NULL,
	`source_commit_sha` text NOT NULL,
	`source_path` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_pdm_bom_source_line` ON `pdm_bom_lines` (`product_sku`,`product_revision`,`source_commit_sha`,`source_path`);--> statement-breakpoint
CREATE INDEX `idx_pdm_bom_product_revision` ON `pdm_bom_lines` (`product_sku`,`product_revision`);--> statement-breakpoint
CREATE INDEX `idx_pdm_bom_material` ON `pdm_bom_lines` (`material_code`);--> statement-breakpoint
CREATE TABLE `pdm_sync_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`source_commit_sha` text NOT NULL,
	`source_updated_at` text,
	`status` text NOT NULL,
	`product_count` integer DEFAULT 0 NOT NULL,
	`shard_count` integer DEFAULT 0 NOT NULL,
	`bom_line_count` integer DEFAULT 0 NOT NULL,
	`actor_id` text NOT NULL,
	`error_code` text,
	`started_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`completed_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_pdm_sync_started` ON `pdm_sync_runs` (`started_at`);--> statement-breakpoint
CREATE TABLE `production_order_bom_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`production_order_id` text NOT NULL,
	`material_code` text NOT NULL,
	`parent_material_code` text,
	`level` integer NOT NULL,
	`quantity_per_product` real NOT NULL,
	`required_quantity` real NOT NULL,
	`source_bom_line_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`production_order_id`) REFERENCES `production_orders`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `idx_order_bom_order` ON `production_order_bom_lines` (`production_order_id`);--> statement-breakpoint
CREATE TABLE `production_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`order_number` text NOT NULL,
	`product_sku` text NOT NULL,
	`planned_quantity` real NOT NULL,
	`completed_quantity` real DEFAULT 0 NOT NULL,
	`due_date` text NOT NULL,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`bom_revision` text,
	`bom_source_commit_sha` text,
	`version` integer DEFAULT 1 NOT NULL,
	`created_by` text NOT NULL,
	`released_by` text,
	`released_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_production_orders_number` ON `production_orders` (`order_number`);--> statement-breakpoint
CREATE INDEX `idx_production_orders_status_due` ON `production_orders` (`status`,`due_date`);--> statement-breakpoint
CREATE INDEX `idx_production_orders_sku` ON `production_orders` (`product_sku`);--> statement-breakpoint
CREATE TABLE `purchase_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`order_number` text NOT NULL,
	`supplier_code` text NOT NULL,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`expected_date` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_purchase_orders_number` ON `purchase_orders` (`order_number`);--> statement-breakpoint
CREATE TABLE `purchase_requisition_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`requisition_id` text NOT NULL,
	`material_code` text NOT NULL,
	`requested_quantity` real NOT NULL,
	`source_production_order_id` text NOT NULL,
	`source_order_bom_line_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`requisition_id`) REFERENCES `purchase_requisitions`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`source_production_order_id`) REFERENCES `production_orders`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`source_order_bom_line_id`) REFERENCES `production_order_bom_lines`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `idx_pr_lines_requisition` ON `purchase_requisition_lines` (`requisition_id`);--> statement-breakpoint
CREATE TABLE `purchase_requisitions` (
	`id` text PRIMARY KEY NOT NULL,
	`requisition_number` text NOT NULL,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`required_date` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_purchase_requisitions_number` ON `purchase_requisitions` (`requisition_number`);