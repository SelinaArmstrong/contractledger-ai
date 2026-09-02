CREATE TABLE `approval_decision_history` (
	`id` text PRIMARY KEY NOT NULL,
	`request_id` text NOT NULL,
	`step_id` text NOT NULL,
	`action` text NOT NULL,
	`from_status` text NOT NULL,
	`to_status` text NOT NULL,
	`actor` text NOT NULL,
	`actor_role` text NOT NULL,
	`reason` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`request_id`) REFERENCES `approval_requests`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`step_id`) REFERENCES `approval_steps`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_approval_history_request_created` ON `approval_decision_history` (`request_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `approval_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`intake_id` text NOT NULL,
	`rule_id` text NOT NULL,
	`source_finding_id` text,
	`source_document_id` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`reason` text NOT NULL,
	`rule_snapshot_json` text NOT NULL,
	`generated_at` text NOT NULL,
	`due_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`completed_at` text,
	FOREIGN KEY (`intake_id`) REFERENCES `contract_intakes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`rule_id`) REFERENCES `approval_rules`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`source_finding_id`) REFERENCES `review_findings`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`source_document_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_approval_requests_intake_rule` ON `approval_requests` (`intake_id`,`rule_id`);--> statement-breakpoint
CREATE INDEX `idx_approval_requests_status_due` ON `approval_requests` (`status`,`due_at`);--> statement-breakpoint
CREATE INDEX `idx_approval_requests_intake` ON `approval_requests` (`intake_id`);--> statement-breakpoint
CREATE TABLE `approval_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`rule_key` text NOT NULL,
	`version` integer NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`trigger_type` text NOT NULL,
	`trigger_config_json` text NOT NULL,
	`owner_role` text NOT NULL,
	`due_days` integer NOT NULL,
	`mandatory` integer DEFAULT true NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_approval_rules_key_version` ON `approval_rules` (`rule_key`,`version`);--> statement-breakpoint
CREATE INDEX `idx_approval_rules_active` ON `approval_rules` (`active`,`rule_key`);--> statement-breakpoint
CREATE TABLE `approval_steps` (
	`id` text PRIMARY KEY NOT NULL,
	`request_id` text NOT NULL,
	`sequence` integer DEFAULT 1 NOT NULL,
	`owner_role` text NOT NULL,
	`assigned_reviewer` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`due_at` text NOT NULL,
	`started_at` text,
	`decided_at` text,
	`escalated_at` text,
	`escalation_level` integer DEFAULT 0 NOT NULL,
	`decision_reason` text,
	`source_page` integer,
	`source_quote` text,
	FOREIGN KEY (`request_id`) REFERENCES `approval_requests`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_approval_steps_request_sequence` ON `approval_steps` (`request_id`,`sequence`);--> statement-breakpoint
CREATE INDEX `idx_approval_steps_status_due` ON `approval_steps` (`status`,`due_at`);