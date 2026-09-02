CREATE TABLE `integration_outbox` (
	`id` text PRIMARY KEY NOT NULL,
	`event_type` text NOT NULL,
	`aggregate_type` text NOT NULL,
	`aggregate_id` text NOT NULL,
	`payload_json` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempt_count` integer DEFAULT 0 NOT NULL,
	`last_error` text,
	`occurred_at` text NOT NULL,
	`dispatched_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_integration_outbox_status_occurred` ON `integration_outbox` (`status`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `idx_integration_outbox_aggregate` ON `integration_outbox` (`aggregate_type`,`aggregate_id`);