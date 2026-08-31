ALTER TABLE `contract_intakes` ADD `owner` text;--> statement-breakpoint
ALTER TABLE `contract_intakes` ADD `target_review_date` text;--> statement-breakpoint
ALTER TABLE `contract_intakes` ADD `internal_notes` text;--> statement-breakpoint
ALTER TABLE `contract_intakes` ADD `approval_status` text DEFAULT 'not_required' NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_contract_intakes_status_owner` ON `contract_intakes` (`status`,`owner`);--> statement-breakpoint
ALTER TABLE `review_findings` ADD `suggested_revision` text;