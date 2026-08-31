CREATE TABLE `api_rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`window_start` integer NOT NULL,
	`request_count` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_ai_analysis_runs_status_stage_reviewed` ON `ai_analysis_runs` (`status`,`stage`,`reviewed_at`);--> statement-breakpoint
CREATE INDEX `idx_audit_logs_created_at` ON `audit_logs` (`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_contracts_intake_id_unique` ON `contracts` (`intake_id`) WHERE "contracts"."intake_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_documents_supplier_lifecycle_expiration` ON `documents` (`supplier_id`,`lifecycle_stage`,`expiration_date`);