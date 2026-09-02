CREATE TABLE `ai_evaluation_case_results` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`case_id` text NOT NULL,
	`title` text NOT NULL,
	`file_name` text NOT NULL,
	`document_type` text NOT NULL,
	`difficulty` text NOT NULL,
	`fixture_version` text NOT NULL,
	`model` text NOT NULL,
	`prompt_version` text NOT NULL,
	`extraction_version` text NOT NULL,
	`status` text NOT NULL,
	`duration_ms` integer NOT NULL,
	`failure_reason` text,
	`total_fields` integer NOT NULL,
	`correct_fields` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `ai_evaluation_runs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_ai_evaluation_case_run_case` ON `ai_evaluation_case_results` (`run_id`,`case_id`);--> statement-breakpoint
CREATE INDEX `idx_ai_evaluation_case_type` ON `ai_evaluation_case_results` (`document_type`);--> statement-breakpoint
CREATE TABLE `ai_evaluation_field_results` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`case_id` text NOT NULL,
	`document_type` text NOT NULL,
	`field_name` text NOT NULL,
	`label` text NOT NULL,
	`expected_json` text NOT NULL,
	`actual_json` text NOT NULL,
	`critical` integer NOT NULL,
	`correct` integer NOT NULL,
	`confidence` real NOT NULL,
	`source_backed` integer NOT NULL,
	`unsupported` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `ai_evaluation_runs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_ai_evaluation_field_run_case_field` ON `ai_evaluation_field_results` (`run_id`,`case_id`,`field_name`);--> statement-breakpoint
CREATE INDEX `idx_ai_evaluation_field_name` ON `ai_evaluation_field_results` (`field_name`);--> statement-breakpoint
ALTER TABLE `ai_evaluation_runs` ADD `dataset_version` text DEFAULT 'legacy-3' NOT NULL;--> statement-breakpoint
ALTER TABLE `ai_evaluation_runs` ADD `fixture_version` text DEFAULT 'legacy' NOT NULL;--> statement-breakpoint
ALTER TABLE `ai_evaluation_runs` ADD `prompt_version` text DEFAULT 'legacy' NOT NULL;--> statement-breakpoint
ALTER TABLE `ai_evaluation_runs` ADD `extraction_version` text DEFAULT 'legacy' NOT NULL;--> statement-breakpoint
ALTER TABLE `ai_evaluation_runs` ADD `critical_fields` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `ai_evaluation_runs` ADD `correct_critical_fields` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `ai_evaluation_runs` ADD `critical_accuracy_percent` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `ai_evaluation_runs` ADD `unsupported_fields` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `ai_evaluation_runs` ADD `unsupported_value_percent` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `ai_evaluation_runs` ADD `successful_cases` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `ai_evaluation_runs` ADD `failed_cases` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `ai_evaluation_runs` ADD `processing_success_percent` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `ai_evaluation_runs` ADD `median_duration_ms` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `ai_evaluation_runs` ADD `baseline_run_id` text;--> statement-breakpoint
ALTER TABLE `ai_evaluation_runs` ADD `regression_delta` real;--> statement-breakpoint
ALTER TABLE `ai_evaluation_runs` ADD `regression_threshold` real DEFAULT -2 NOT NULL;--> statement-breakpoint
ALTER TABLE `ai_evaluation_runs` ADD `promotion_status` text DEFAULT 'baseline_required' NOT NULL;--> statement-breakpoint
ALTER TABLE `ai_evaluation_runs` ADD `is_approved_baseline` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `ai_field_reviews` ADD `override_reason` text;