CREATE TABLE `ai_analysis_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`stage` text NOT NULL,
	`intake_id` text,
	`contract_id` text,
	`supplier_id` text,
	`document_id` text,
	`file_name` text NOT NULL,
	`storage_key` text NOT NULL,
	`model` text NOT NULL,
	`prompt_version` text NOT NULL,
	`original_result_json` text NOT NULL,
	`verified_result_json` text,
	`correction_count` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'pending_review' NOT NULL,
	`reviewed_by` text,
	`reviewed_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`intake_id`) REFERENCES `contract_intakes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`contract_id`) REFERENCES `contracts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_ai_analysis_runs_contract_id` ON `ai_analysis_runs` (`contract_id`);--> statement-breakpoint
CREATE INDEX `idx_ai_analysis_runs_intake_id` ON `ai_analysis_runs` (`intake_id`);--> statement-breakpoint
CREATE INDEX `idx_ai_analysis_runs_supplier_id` ON `ai_analysis_runs` (`supplier_id`);--> statement-breakpoint
CREATE TABLE `ai_field_reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`analysis_run_id` text NOT NULL,
	`field_name` text NOT NULL,
	`original_value_json` text NOT NULL,
	`verified_value_json` text NOT NULL,
	`confidence` real NOT NULL,
	`source_page` integer,
	`source_quote` text,
	`review_status` text NOT NULL,
	`reviewed_by` text NOT NULL,
	`reviewed_at` text NOT NULL,
	FOREIGN KEY (`analysis_run_id`) REFERENCES `ai_analysis_runs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_ai_field_reviews_analysis_run_id` ON `ai_field_reviews` (`analysis_run_id`);