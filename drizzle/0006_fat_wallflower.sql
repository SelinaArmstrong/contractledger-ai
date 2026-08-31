CREATE TABLE `management_insight_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`record_ids_json` text NOT NULL,
	`metrics_json` text NOT NULL,
	`attention_json` text NOT NULL,
	`model` text NOT NULL,
	`prompt_version` text NOT NULL,
	`response_json` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_management_insight_runs_scope_created_at` ON `management_insight_runs` (`scope`,`created_at`);