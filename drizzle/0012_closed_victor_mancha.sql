CREATE TABLE `import_batches` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_type` text NOT NULL,
	`file_name` text NOT NULL,
	`file_type` text NOT NULL,
	`file_size_bytes` integer NOT NULL,
	`source_hash` text NOT NULL,
	`status` text DEFAULT 'preview' NOT NULL,
	`headers_json` text NOT NULL,
	`mapping_json` text NOT NULL,
	`mapping_version` text NOT NULL,
	`total_rows` integer NOT NULL,
	`ready_rows` integer NOT NULL,
	`warning_rows` integer NOT NULL,
	`duplicate_rows` integer NOT NULL,
	`invalid_rows` integer NOT NULL,
	`accepted_rows` integer DEFAULT 0 NOT NULL,
	`rejected_rows` integer DEFAULT 0 NOT NULL,
	`normalization_issue_count` integer DEFAULT 0 NOT NULL,
	`started_by` text NOT NULL,
	`created_at` text NOT NULL,
	`committed_by` text,
	`committed_at` text,
	`rolled_back_by` text,
	`rolled_back_at` text,
	`rollback_reason` text
);
--> statement-breakpoint
CREATE INDEX `idx_import_batches_created` ON `import_batches` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_import_batches_status` ON `import_batches` (`status`,`entity_type`);--> statement-breakpoint
CREATE INDEX `idx_import_batches_source_hash` ON `import_batches` (`source_hash`,`entity_type`);--> statement-breakpoint
CREATE TABLE `import_rows` (
	`id` text PRIMARY KEY NOT NULL,
	`batch_id` text NOT NULL,
	`row_number` integer NOT NULL,
	`raw_data_json` text NOT NULL,
	`normalized_data_json` text NOT NULL,
	`status` text NOT NULL,
	`decision` text DEFAULT 'pending' NOT NULL,
	`issues_json` text NOT NULL,
	`duplicate_record_id` text,
	`duplicate_type` text,
	`created_record_id` text,
	`created_record_type` text,
	`committed_at` text,
	`rolled_back_at` text,
	FOREIGN KEY (`batch_id`) REFERENCES `import_batches`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_import_rows_batch_number` ON `import_rows` (`batch_id`,`row_number`);--> statement-breakpoint
CREATE INDEX `idx_import_rows_batch_status` ON `import_rows` (`batch_id`,`status`,`decision`);