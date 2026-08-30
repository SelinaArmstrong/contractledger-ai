CREATE TABLE `amendments` (
	`id` text PRIMARY KEY NOT NULL,
	`contract_id` text NOT NULL,
	`document_id` text,
	`amendment_number` text NOT NULL,
	`signed_date` text NOT NULL,
	`value_change_cents` integer DEFAULT 0 NOT NULL,
	`new_expiration_date` text,
	FOREIGN KEY (`contract_id`) REFERENCES `contracts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_amendments_contract_id` ON `amendments` (`contract_id`);--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`action` text NOT NULL,
	`actor` text NOT NULL,
	`details` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_audit_logs_entity` ON `audit_logs` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE TABLE `contract_intakes` (
	`id` text PRIMARY KEY NOT NULL,
	`intake_number` text NOT NULL,
	`supplier_id` text,
	`proposed_supplier_name` text NOT NULL,
	`title` text NOT NULL,
	`contract_type` text NOT NULL,
	`proposed_value_cents` integer,
	`status` text DEFAULT 'draft' NOT NULL,
	`review_status` text DEFAULT 'pending' NOT NULL,
	`received_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_contract_intakes_number` ON `contract_intakes` (`intake_number`);--> statement-breakpoint
CREATE INDEX `idx_contract_intakes_status` ON `contract_intakes` (`status`);--> statement-breakpoint
CREATE INDEX `idx_contract_intakes_supplier_id` ON `contract_intakes` (`supplier_id`);--> statement-breakpoint
CREATE TABLE `contracts` (
	`id` text PRIMARY KEY NOT NULL,
	`contract_number` text NOT NULL,
	`intake_id` text,
	`supplier_id` text NOT NULL,
	`title` text NOT NULL,
	`contract_type` text NOT NULL,
	`department` text NOT NULL,
	`owner` text NOT NULL,
	`original_value_cents` integer NOT NULL,
	`amendment_value_cents` integer DEFAULT 0 NOT NULL,
	`current_value_cents` integer NOT NULL,
	`effective_date` text NOT NULL,
	`expiration_date` text,
	`renewal_type` text DEFAULT 'none' NOT NULL,
	`notice_days` integer,
	`notice_deadline` text,
	`status` text DEFAULT 'executed' NOT NULL,
	`last_updated` text NOT NULL,
	FOREIGN KEY (`intake_id`) REFERENCES `contract_intakes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_contracts_number` ON `contracts` (`contract_number`);--> statement-breakpoint
CREATE INDEX `idx_contracts_supplier_id` ON `contracts` (`supplier_id`);--> statement-breakpoint
CREATE INDEX `idx_contracts_status_expiration` ON `contracts` (`status`,`expiration_date`);--> statement-breakpoint
CREATE INDEX `idx_contracts_notice_deadline` ON `contracts` (`notice_deadline`);--> statement-breakpoint
CREATE TABLE `documents` (
	`id` text PRIMARY KEY NOT NULL,
	`supplier_id` text,
	`intake_id` text,
	`contract_id` text,
	`parent_document_id` text,
	`file_name` text NOT NULL,
	`file_type` text NOT NULL,
	`lifecycle_stage` text NOT NULL,
	`storage_key` text NOT NULL,
	`mime_type` text NOT NULL,
	`page_count` integer,
	`ai_status` text DEFAULT 'queued' NOT NULL,
	`uploaded_at` text NOT NULL,
	FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`intake_id`) REFERENCES `contract_intakes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`contract_id`) REFERENCES `contracts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_documents_contract_id` ON `documents` (`contract_id`);--> statement-breakpoint
CREATE INDEX `idx_documents_intake_id` ON `documents` (`intake_id`);--> statement-breakpoint
CREATE INDEX `idx_documents_supplier_id` ON `documents` (`supplier_id`);--> statement-breakpoint
CREATE TABLE `key_dates` (
	`id` text PRIMARY KEY NOT NULL,
	`contract_id` text,
	`supplier_id` text,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`due_date` text NOT NULL,
	`internal_review_date` text,
	`status` text DEFAULT 'upcoming' NOT NULL,
	`source_clause` text,
	`source_page` integer,
	FOREIGN KEY (`contract_id`) REFERENCES `contracts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_key_dates_due_status` ON `key_dates` (`due_date`,`status`);--> statement-breakpoint
CREATE INDEX `idx_key_dates_contract_id` ON `key_dates` (`contract_id`);--> statement-breakpoint
CREATE TABLE `review_findings` (
	`id` text PRIMARY KEY NOT NULL,
	`intake_id` text NOT NULL,
	`field` text NOT NULL,
	`rule_name` text NOT NULL,
	`standard_text` text NOT NULL,
	`observed_text` text NOT NULL,
	`severity` text NOT NULL,
	`source_page` integer,
	`status` text DEFAULT 'open' NOT NULL,
	FOREIGN KEY (`intake_id`) REFERENCES `contract_intakes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_review_findings_intake_id` ON `review_findings` (`intake_id`);--> statement-breakpoint
CREATE TABLE `suppliers` (
	`id` text PRIMARY KEY NOT NULL,
	`legal_name` text NOT NULL,
	`normalized_name` text NOT NULL,
	`dba_name` text,
	`category` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`primary_contact` text,
	`email` text,
	`w9_status` text DEFAULT 'missing' NOT NULL,
	`insurance_status` text DEFAULT 'missing' NOT NULL,
	`insurance_expiration` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_suppliers_normalized_name` ON `suppliers` (`normalized_name`);--> statement-breakpoint
CREATE INDEX `idx_suppliers_status` ON `suppliers` (`status`);--> statement-breakpoint
CREATE INDEX `idx_suppliers_insurance_expiration` ON `suppliers` (`insurance_expiration`);