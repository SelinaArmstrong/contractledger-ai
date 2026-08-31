CREATE TABLE `ai_evaluation_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`model` text NOT NULL,
	`case_count` integer NOT NULL,
	`total_fields` integer NOT NULL,
	`correct_fields` integer NOT NULL,
	`source_backed_fields` integer NOT NULL,
	`accuracy_percent` real NOT NULL,
	`source_coverage_percent` real NOT NULL,
	`average_confidence` real NOT NULL,
	`details_json` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_ai_evaluation_runs_created_at` ON `ai_evaluation_runs` (`created_at`);