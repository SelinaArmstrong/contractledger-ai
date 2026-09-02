ALTER TABLE `amendments` ADD `amendment_type` text DEFAULT 'amendment' NOT NULL;--> statement-breakpoint
ALTER TABLE `amendments` ADD `version_number` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `amendments` ADD `version_status` text DEFAULT 'current' NOT NULL;--> statement-breakpoint
ALTER TABLE `amendments` ADD `effective_date` text;--> statement-breakpoint
ALTER TABLE `amendments` ADD `previous_value_cents` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `amendments` ADD `resulting_value_cents` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `amendments` ADD `previous_expiration_date` text;--> statement-breakpoint
ALTER TABLE `amendments` ADD `previous_payment_terms` text;--> statement-breakpoint
ALTER TABLE `amendments` ADD `new_payment_terms` text;--> statement-breakpoint
ALTER TABLE `amendments` ADD `previous_renewal_type` text;--> statement-breakpoint
ALTER TABLE `amendments` ADD `new_renewal_type` text;--> statement-breakpoint
ALTER TABLE `amendments` ADD `previous_notice_days` integer;--> statement-breakpoint
ALTER TABLE `amendments` ADD `new_notice_days` integer;--> statement-breakpoint
ALTER TABLE `amendments` ADD `scope_summary` text;--> statement-breakpoint
ALTER TABLE `amendments` ADD `created_by` text DEFAULT 'System migration' NOT NULL;--> statement-breakpoint
ALTER TABLE `amendments` ADD `created_at` text DEFAULT '2026-01-01T00:00:00.000Z' NOT NULL;--> statement-breakpoint
WITH ranked AS (
  SELECT rowid AS amendment_rowid,
    ROW_NUMBER() OVER (
      PARTITION BY contract_id ORDER BY signed_date, rowid
    ) + 1 AS lifecycle_version
  FROM amendments
)
UPDATE amendments SET version_number = (
  SELECT lifecycle_version FROM ranked
  WHERE amendment_rowid = amendments.rowid
);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_amendments_contract_version` ON `amendments` (`contract_id`,`version_number`);
