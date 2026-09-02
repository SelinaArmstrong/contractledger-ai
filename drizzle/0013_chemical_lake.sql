CREATE TABLE `obligation_events` (
	`id` text PRIMARY KEY NOT NULL,
	`key_date_id` text NOT NULL,
	`event_type` text NOT NULL,
	`from_status` text,
	`to_status` text,
	`actor` text NOT NULL,
	`note` text,
	`evidence_document_id` text,
	`metadata_json` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`key_date_id`) REFERENCES `key_dates`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`evidence_document_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_obligation_events_key_date_created` ON `obligation_events` (`key_date_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `key_dates` ADD `backup_owner` text;--> statement-breakpoint
ALTER TABLE `key_dates` ADD `priority` text DEFAULT 'medium' NOT NULL;--> statement-breakpoint
ALTER TABLE `key_dates` ADD `material` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `key_dates` ADD `assigned_at` text;--> statement-breakpoint
ALTER TABLE `key_dates` ADD `completed_by` text;--> statement-breakpoint
ALTER TABLE `key_dates` ADD `completion_note` text;--> statement-breakpoint
ALTER TABLE `key_dates` ADD `evidence_document_id` text REFERENCES documents(id);--> statement-breakpoint
ALTER TABLE `key_dates` ADD `evidence_reference` text;--> statement-breakpoint
ALTER TABLE `key_dates` ADD `escalation_level` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `key_dates` ADD `escalated_at` text;--> statement-breakpoint
ALTER TABLE `key_dates` ADD `source_document_id` text REFERENCES documents(id);--> statement-breakpoint
ALTER TABLE `key_dates` ADD `created_at` text DEFAULT '2026-01-01T00:00:00.000Z' NOT NULL;--> statement-breakpoint
ALTER TABLE `key_dates` ADD `updated_at` text DEFAULT '2026-01-01T00:00:00.000Z' NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_key_dates_owner_status` ON `key_dates` (`owner`,`status`);--> statement-breakpoint
CREATE INDEX `idx_key_dates_supplier_id` ON `key_dates` (`supplier_id`);