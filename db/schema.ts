import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const suppliers = sqliteTable(
  'suppliers',
  {
    id: text('id').primaryKey(),
    legalName: text('legal_name').notNull(),
    normalizedName: text('normalized_name').notNull(),
    dbaName: text('dba_name'),
    category: text('category').notNull(),
    status: text('status', { enum: ['pending', 'active', 'inactive', 'rejected', 'archived'] })
      .notNull()
      .default('pending'),
    primaryContact: text('primary_contact'),
    email: text('email'),
    w9Status: text('w9_status', { enum: ['missing', 'received', 'expired', 'not_required'] })
      .notNull()
      .default('missing'),
    insuranceStatus: text('insurance_status', { enum: ['missing', 'current', 'expired', 'not_required'] })
      .notNull()
      .default('missing'),
    insuranceExpiration: text('insurance_expiration'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    uniqueIndex('idx_suppliers_normalized_name').on(table.normalizedName),
    index('idx_suppliers_status').on(table.status),
    index('idx_suppliers_insurance_expiration').on(table.insuranceExpiration),
  ],
);

export const contractIntakes = sqliteTable(
  'contract_intakes',
  {
    id: text('id').primaryKey(),
    intakeNumber: text('intake_number').notNull(),
    supplierId: text('supplier_id').references(() => suppliers.id),
    proposedSupplierName: text('proposed_supplier_name').notNull(),
    title: text('title').notNull(),
    contractType: text('contract_type').notNull(),
    proposedValueCents: integer('proposed_value_cents'),
    status: text('status', {
      enum: ['draft', 'under_review', 'revision_requested', 'approved_for_signature', 'not_awarded', 'executed'],
    })
      .notNull()
      .default('draft'),
    reviewStatus: text('review_status', { enum: ['pending', 'in_progress', 'ready', 'complete'] })
      .notNull()
      .default('pending'),
    receivedAt: text('received_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    uniqueIndex('idx_contract_intakes_number').on(table.intakeNumber),
    index('idx_contract_intakes_status').on(table.status),
    index('idx_contract_intakes_supplier_id').on(table.supplierId),
  ],
);

export const contracts = sqliteTable(
  'contracts',
  {
    id: text('id').primaryKey(),
    contractNumber: text('contract_number').notNull(),
    intakeId: text('intake_id').references(() => contractIntakes.id),
    supplierId: text('supplier_id')
      .notNull()
      .references(() => suppliers.id),
    title: text('title').notNull(),
    contractType: text('contract_type').notNull(),
    department: text('department').notNull(),
    owner: text('owner').notNull(),
    originalValueCents: integer('original_value_cents').notNull(),
    amendmentValueCents: integer('amendment_value_cents').notNull().default(0),
    currentValueCents: integer('current_value_cents').notNull(),
    effectiveDate: text('effective_date').notNull(),
    expirationDate: text('expiration_date'),
    renewalType: text('renewal_type', { enum: ['automatic', 'optional', 'none'] })
      .notNull()
      .default('none'),
    noticeDays: integer('notice_days'),
    noticeDeadline: text('notice_deadline'),
    status: text('status', { enum: ['executed', 'active', 'expired', 'terminated', 'closed'] })
      .notNull()
      .default('executed'),
    lastUpdated: text('last_updated').notNull(),
  },
  (table) => [
    uniqueIndex('idx_contracts_number').on(table.contractNumber),
    index('idx_contracts_supplier_id').on(table.supplierId),
    index('idx_contracts_status_expiration').on(table.status, table.expirationDate),
    index('idx_contracts_notice_deadline').on(table.noticeDeadline),
  ],
);

export const documents = sqliteTable(
  'documents',
  {
    id: text('id').primaryKey(),
    supplierId: text('supplier_id').references(() => suppliers.id),
    intakeId: text('intake_id').references(() => contractIntakes.id),
    contractId: text('contract_id').references(() => contracts.id),
    parentDocumentId: text('parent_document_id'),
    fileName: text('file_name').notNull(),
    fileType: text('file_type').notNull(),
    lifecycleStage: text('lifecycle_stage', { enum: ['draft', 'executed', 'supplier_document'] }).notNull(),
    storageKey: text('storage_key').notNull(),
    mimeType: text('mime_type').notNull(),
    pageCount: integer('page_count'),
    aiStatus: text('ai_status', { enum: ['queued', 'processing', 'needs_review', 'verified', 'failed'] })
      .notNull()
      .default('queued'),
    uploadedAt: text('uploaded_at').notNull(),
  },
  (table) => [
    index('idx_documents_contract_id').on(table.contractId),
    index('idx_documents_intake_id').on(table.intakeId),
    index('idx_documents_supplier_id').on(table.supplierId),
  ],
);

export const amendments = sqliteTable(
  'amendments',
  {
    id: text('id').primaryKey(),
    contractId: text('contract_id')
      .notNull()
      .references(() => contracts.id),
    documentId: text('document_id').references(() => documents.id),
    amendmentNumber: text('amendment_number').notNull(),
    signedDate: text('signed_date').notNull(),
    valueChangeCents: integer('value_change_cents').notNull().default(0),
    newExpirationDate: text('new_expiration_date'),
  },
  (table) => [index('idx_amendments_contract_id').on(table.contractId)],
);

export const keyDates = sqliteTable(
  'key_dates',
  {
    id: text('id').primaryKey(),
    contractId: text('contract_id').references(() => contracts.id),
    supplierId: text('supplier_id').references(() => suppliers.id),
    type: text('type').notNull(),
    title: text('title').notNull(),
    dueDate: text('due_date').notNull(),
    internalReviewDate: text('internal_review_date'),
    status: text('status', { enum: ['upcoming', 'due', 'complete', 'dismissed'] })
      .notNull()
      .default('upcoming'),
    sourceClause: text('source_clause'),
    sourcePage: integer('source_page'),
  },
  (table) => [
    index('idx_key_dates_due_status').on(table.dueDate, table.status),
    index('idx_key_dates_contract_id').on(table.contractId),
  ],
);

export const reviewFindings = sqliteTable(
  'review_findings',
  {
    id: text('id').primaryKey(),
    intakeId: text('intake_id')
      .notNull()
      .references(() => contractIntakes.id),
    field: text('field').notNull(),
    ruleName: text('rule_name').notNull(),
    standardText: text('standard_text').notNull(),
    observedText: text('observed_text').notNull(),
    severity: text('severity', { enum: ['info', 'low', 'medium', 'high'] }).notNull(),
    sourcePage: integer('source_page'),
    status: text('status', { enum: ['open', 'accepted', 'resolved', 'dismissed'] })
      .notNull()
      .default('open'),
  },
  (table) => [index('idx_review_findings_intake_id').on(table.intakeId)],
);

export const auditLogs = sqliteTable(
  'audit_logs',
  {
    id: text('id').primaryKey(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    action: text('action').notNull(),
    actor: text('actor').notNull(),
    details: text('details'),
    createdAt: text('created_at').notNull(),
  },
  (table) => [index('idx_audit_logs_entity').on(table.entityType, table.entityId)],
);

export type Supplier = typeof suppliers.$inferSelect;
export type ContractIntake = typeof contractIntakes.$inferSelect;
export type Contract = typeof contracts.$inferSelect;
export type KeyDate = typeof keyDates.$inferSelect;
