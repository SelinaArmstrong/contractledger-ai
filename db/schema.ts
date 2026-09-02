import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const suppliers = sqliteTable(
  'suppliers',
  {
    id: text('id').primaryKey(),
    legalName: text('legal_name').notNull(),
    normalizedName: text('normalized_name').notNull(),
    dbaName: text('dba_name'),
    vendorNumber: text('vendor_number'),
    category: text('category').notNull(),
    status: text('status', {
      enum: ['pending', 'active', 'inactive', 'suspended', 'archived'],
    })
      .notNull()
      .default('pending'),
    primaryContact: text('primary_contact'),
    email: text('email'),
    phone: text('phone'),
    website: text('website'),
    addressLine1: text('address_line1'),
    addressLine2: text('address_line2'),
    city: text('city'),
    state: text('state'),
    postalCode: text('postal_code'),
    country: text('country'),
    taxClassification: text('tax_classification'),
    riskTier: text('risk_tier', { enum: ['low', 'medium', 'high'] }),
    qualificationStatus: text('qualification_status', {
      enum: [
        'complete',
        'incomplete',
        'needs_follow_up',
        'expired',
        'under_review',
      ],
    }),
    qualificationReviewDate: text('qualification_review_date'),
    w9Status: text('w9_status', {
      enum: ['missing', 'received', 'expired', 'not_required'],
    })
      .notNull()
      .default('missing'),
    insuranceStatus: text('insurance_status', {
      enum: ['missing', 'current', 'expired', 'not_required'],
    })
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
      enum: [
        'draft',
        'under_review',
        'waiting_on_business',
        'waiting_on_legal',
        'revision_requested',
        'approved_for_signature',
        'not_awarded',
        'executed',
      ],
    })
      .notNull()
      .default('draft'),
    reviewStatus: text('review_status', {
      enum: ['pending', 'in_progress', 'ready', 'complete'],
    })
      .notNull()
      .default('pending'),
    owner: text('owner'),
    targetReviewDate: text('target_review_date'),
    internalNotes: text('internal_notes'),
    approvalStatus: text('approval_status', {
      enum: ['not_required', 'pending', 'approved', 'declined'],
    })
      .notNull()
      .default('not_required'),
    receivedAt: text('received_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    uniqueIndex('idx_contract_intakes_number').on(table.intakeNumber),
    index('idx_contract_intakes_status').on(table.status),
    index('idx_contract_intakes_status_owner').on(table.status, table.owner),
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
    renewalType: text('renewal_type', {
      enum: ['automatic', 'optional', 'none'],
    })
      .notNull()
      .default('none'),
    noticeDays: integer('notice_days'),
    noticeDeadline: text('notice_deadline'),
    paymentTerms: text('payment_terms'),
    governingLaw: text('governing_law'),
    status: text('status', {
      enum: ['executed', 'active', 'expired', 'terminated', 'closed'],
    })
      .notNull()
      .default('executed'),
    lastUpdated: text('last_updated').notNull(),
  },
  (table) => [
    uniqueIndex('idx_contracts_number').on(table.contractNumber),
    uniqueIndex('idx_contracts_intake_id_unique')
      .on(table.intakeId)
      .where(sql`${table.intakeId} IS NOT NULL`),
    index('idx_contracts_supplier_id').on(table.supplierId),
    index('idx_contracts_status_expiration').on(
      table.status,
      table.expirationDate,
    ),
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
    lifecycleStage: text('lifecycle_stage', {
      enum: [
        'draft',
        'executed',
        'amendment',
        'supplier_record',
        'obligation_evidence',
      ],
    }).notNull(),
    storageKey: text('storage_key').notNull(),
    mimeType: text('mime_type').notNull(),
    pageCount: integer('page_count'),
    issuer: text('issuer'),
    documentNumber: text('document_number'),
    effectiveDate: text('effective_date'),
    expirationDate: text('expiration_date'),
    coverageSummary: text('coverage_summary'),
    reviewStatus: text('review_status', {
      enum: ['pending', 'approved', 'rejected', 'expired', 'not_applicable'],
    }),
    aiStatus: text('ai_status', {
      enum: ['queued', 'processing', 'needs_review', 'verified', 'failed'],
    })
      .notNull()
      .default('queued'),
    uploadedAt: text('uploaded_at').notNull(),
  },
  (table) => [
    index('idx_documents_contract_id').on(table.contractId),
    index('idx_documents_intake_id').on(table.intakeId),
    index('idx_documents_supplier_id').on(table.supplierId),
    index('idx_documents_supplier_lifecycle_expiration').on(
      table.supplierId,
      table.lifecycleStage,
      table.expirationDate,
    ),
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
    amendmentType: text('amendment_type', {
      enum: [
        'amendment',
        'change_order',
        'extension',
        'renewal',
        'termination',
        'price_adjustment',
        'sow_replacement',
      ],
    })
      .notNull()
      .default('amendment'),
    versionNumber: integer('version_number').notNull().default(1),
    versionStatus: text('version_status', {
      enum: ['current', 'superseded'],
    })
      .notNull()
      .default('current'),
    signedDate: text('signed_date').notNull(),
    effectiveDate: text('effective_date'),
    previousValueCents: integer('previous_value_cents').notNull().default(0),
    valueChangeCents: integer('value_change_cents').notNull().default(0),
    resultingValueCents: integer('resulting_value_cents').notNull().default(0),
    previousExpirationDate: text('previous_expiration_date'),
    newExpirationDate: text('new_expiration_date'),
    previousPaymentTerms: text('previous_payment_terms'),
    newPaymentTerms: text('new_payment_terms'),
    previousRenewalType: text('previous_renewal_type'),
    newRenewalType: text('new_renewal_type'),
    previousNoticeDays: integer('previous_notice_days'),
    newNoticeDays: integer('new_notice_days'),
    scopeSummary: text('scope_summary'),
    createdBy: text('created_by').notNull().default('System migration'),
    createdAt: text('created_at').notNull().default('2026-01-01T00:00:00.000Z'),
  },
  (table) => [
    index('idx_amendments_contract_id').on(table.contractId),
    uniqueIndex('idx_amendments_contract_version').on(
      table.contractId,
      table.versionNumber,
    ),
  ],
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
    status: text('status', {
      enum: ['upcoming', 'in_progress', 'evidence_required', 'completed'],
    })
      .notNull()
      .default('upcoming'),
    owner: text('owner'),
    backupOwner: text('backup_owner'),
    priority: text('priority', {
      enum: ['low', 'medium', 'high', 'critical'],
    })
      .notNull()
      .default('medium'),
    material: integer('material').notNull().default(1),
    assignedAt: text('assigned_at'),
    completedAt: text('completed_at'),
    completedBy: text('completed_by'),
    completionNote: text('completion_note'),
    evidenceDocumentId: text('evidence_document_id').references(
      () => documents.id,
    ),
    evidenceReference: text('evidence_reference'),
    escalationLevel: integer('escalation_level').notNull().default(0),
    escalatedAt: text('escalated_at'),
    decision: text('decision', {
      enum: ['under_review', 'renew', 'do_not_renew', 'not_applicable'],
    }),
    notes: text('notes'),
    sourceDocumentId: text('source_document_id').references(() => documents.id),
    sourceClause: text('source_clause'),
    sourcePage: integer('source_page'),
    createdAt: text('created_at').notNull().default('2026-01-01T00:00:00.000Z'),
    updatedAt: text('updated_at').notNull().default('2026-01-01T00:00:00.000Z'),
  },
  (table) => [
    index('idx_key_dates_due_status').on(table.dueDate, table.status),
    index('idx_key_dates_contract_id').on(table.contractId),
    index('idx_key_dates_owner_status').on(table.owner, table.status),
    index('idx_key_dates_supplier_id').on(table.supplierId),
  ],
);

export const obligationEvents = sqliteTable(
  'obligation_events',
  {
    id: text('id').primaryKey(),
    keyDateId: text('key_date_id')
      .notNull()
      .references(() => keyDates.id),
    eventType: text('event_type', {
      enum: [
        'assigned',
        'details_updated',
        'status_changed',
        'evidence_linked',
        'escalated',
        'due_date_changed',
      ],
    }).notNull(),
    fromStatus: text('from_status'),
    toStatus: text('to_status'),
    actor: text('actor').notNull(),
    note: text('note'),
    evidenceDocumentId: text('evidence_document_id').references(
      () => documents.id,
    ),
    metadataJson: text('metadata_json').notNull().default('{}'),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    index('idx_obligation_events_key_date_created').on(
      table.keyDateId,
      table.createdAt,
    ),
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
    severity: text('severity', {
      enum: ['info', 'low', 'medium', 'high'],
    }).notNull(),
    sourcePage: integer('source_page'),
    suggestedRevision: text('suggested_revision'),
    status: text('status', {
      enum: ['open', 'accepted', 'resolved', 'dismissed'],
    })
      .notNull()
      .default('open'),
  },
  (table) => [index('idx_review_findings_intake_id').on(table.intakeId)],
);

export const approvalRules = sqliteTable(
  'approval_rules',
  {
    id: text('id').primaryKey(),
    ruleKey: text('rule_key').notNull(),
    version: integer('version').notNull(),
    name: text('name').notNull(),
    description: text('description').notNull(),
    triggerType: text('trigger_type', {
      enum: [
        'value_above',
        'governing_law_not_allowed',
        'automatic_renewal',
        'insurance_status_in',
        'supplier_risk_tier_in',
      ],
    }).notNull(),
    triggerConfigJson: text('trigger_config_json').notNull(),
    ownerRole: text('owner_role').notNull(),
    dueDays: integer('due_days').notNull(),
    mandatory: integer('mandatory', { mode: 'boolean' })
      .notNull()
      .default(true),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    uniqueIndex('idx_approval_rules_key_version').on(
      table.ruleKey,
      table.version,
    ),
    index('idx_approval_rules_active').on(table.active, table.ruleKey),
  ],
);

export const approvalRequests = sqliteTable(
  'approval_requests',
  {
    id: text('id').primaryKey(),
    intakeId: text('intake_id')
      .notNull()
      .references(() => contractIntakes.id),
    ruleId: text('rule_id')
      .notNull()
      .references(() => approvalRules.id),
    sourceFindingId: text('source_finding_id').references(
      () => reviewFindings.id,
    ),
    sourceDocumentId: text('source_document_id').references(() => documents.id),
    status: text('status', {
      enum: [
        'pending',
        'in_review',
        'approved',
        'declined',
        'revision_requested',
        'cancelled',
      ],
    })
      .notNull()
      .default('pending'),
    reason: text('reason').notNull(),
    ruleSnapshotJson: text('rule_snapshot_json').notNull(),
    generatedAt: text('generated_at').notNull(),
    dueAt: text('due_at').notNull(),
    updatedAt: text('updated_at').notNull(),
    completedAt: text('completed_at'),
  },
  (table) => [
    uniqueIndex('idx_approval_requests_intake_rule').on(
      table.intakeId,
      table.ruleId,
    ),
    index('idx_approval_requests_status_due').on(table.status, table.dueAt),
    index('idx_approval_requests_intake').on(table.intakeId),
  ],
);

export const approvalSteps = sqliteTable(
  'approval_steps',
  {
    id: text('id').primaryKey(),
    requestId: text('request_id')
      .notNull()
      .references(() => approvalRequests.id),
    sequence: integer('sequence').notNull().default(1),
    ownerRole: text('owner_role').notNull(),
    assignedReviewer: text('assigned_reviewer'),
    status: text('status', {
      enum: [
        'pending',
        'in_review',
        'approved',
        'declined',
        'revision_requested',
        'cancelled',
      ],
    })
      .notNull()
      .default('pending'),
    dueAt: text('due_at').notNull(),
    startedAt: text('started_at'),
    decidedAt: text('decided_at'),
    escalatedAt: text('escalated_at'),
    escalationLevel: integer('escalation_level').notNull().default(0),
    decisionReason: text('decision_reason'),
    sourcePage: integer('source_page'),
    sourceQuote: text('source_quote'),
  },
  (table) => [
    uniqueIndex('idx_approval_steps_request_sequence').on(
      table.requestId,
      table.sequence,
    ),
    index('idx_approval_steps_status_due').on(table.status, table.dueAt),
  ],
);

export const approvalDecisionHistory = sqliteTable(
  'approval_decision_history',
  {
    id: text('id').primaryKey(),
    requestId: text('request_id')
      .notNull()
      .references(() => approvalRequests.id),
    stepId: text('step_id')
      .notNull()
      .references(() => approvalSteps.id),
    action: text('action', {
      enum: [
        'generated',
        'start_review',
        'approve',
        'decline',
        'request_revision',
        'approve_exception',
        'escalate',
        'cancel',
      ],
    }).notNull(),
    fromStatus: text('from_status').notNull(),
    toStatus: text('to_status').notNull(),
    actor: text('actor').notNull(),
    actorRole: text('actor_role').notNull(),
    reason: text('reason'),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    index('idx_approval_history_request_created').on(
      table.requestId,
      table.createdAt,
    ),
  ],
);

export const aiAnalysisRuns = sqliteTable(
  'ai_analysis_runs',
  {
    id: text('id').primaryKey(),
    stage: text('stage', {
      enum: ['draft', 'executed', 'amendment', 'supplier_document'],
    }).notNull(),
    intakeId: text('intake_id').references(() => contractIntakes.id),
    contractId: text('contract_id').references(() => contracts.id),
    supplierId: text('supplier_id').references(() => suppliers.id),
    documentId: text('document_id').references(() => documents.id),
    fileName: text('file_name').notNull(),
    storageKey: text('storage_key').notNull(),
    model: text('model').notNull(),
    promptVersion: text('prompt_version').notNull(),
    originalResultJson: text('original_result_json').notNull(),
    qualityReportJson: text('quality_report_json'),
    verifiedResultJson: text('verified_result_json'),
    correctionCount: integer('correction_count').notNull().default(0),
    status: text('status', {
      enum: ['pending_review', 'verified'],
    })
      .notNull()
      .default('pending_review'),
    reviewedBy: text('reviewed_by'),
    reviewedAt: text('reviewed_at'),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    index('idx_ai_analysis_runs_contract_id').on(table.contractId),
    index('idx_ai_analysis_runs_intake_id').on(table.intakeId),
    index('idx_ai_analysis_runs_supplier_id').on(table.supplierId),
    index('idx_ai_analysis_runs_status_stage_reviewed').on(
      table.status,
      table.stage,
      table.reviewedAt,
    ),
  ],
);

export const aiFieldReviews = sqliteTable(
  'ai_field_reviews',
  {
    id: text('id').primaryKey(),
    analysisRunId: text('analysis_run_id')
      .notNull()
      .references(() => aiAnalysisRuns.id),
    fieldName: text('field_name').notNull(),
    originalValueJson: text('original_value_json').notNull(),
    verifiedValueJson: text('verified_value_json').notNull(),
    confidence: real('confidence').notNull(),
    sourcePage: integer('source_page'),
    sourceQuote: text('source_quote'),
    overrideReason: text('override_reason'),
    reviewStatus: text('review_status', {
      enum: ['accepted', 'corrected'],
    }).notNull(),
    reviewedBy: text('reviewed_by').notNull(),
    reviewedAt: text('reviewed_at').notNull(),
  },
  (table) => [
    index('idx_ai_field_reviews_analysis_run_id').on(table.analysisRunId),
  ],
);

export const aiEvaluationRuns = sqliteTable(
  'ai_evaluation_runs',
  {
    id: text('id').primaryKey(),
    model: text('model').notNull(),
    caseCount: integer('case_count').notNull(),
    totalFields: integer('total_fields').notNull(),
    correctFields: integer('correct_fields').notNull(),
    sourceBackedFields: integer('source_backed_fields').notNull(),
    accuracyPercent: real('accuracy_percent').notNull(),
    sourceCoveragePercent: real('source_coverage_percent').notNull(),
    averageConfidence: real('average_confidence').notNull(),
    datasetVersion: text('dataset_version').notNull().default('legacy-3'),
    fixtureVersion: text('fixture_version').notNull().default('legacy'),
    promptVersion: text('prompt_version').notNull().default('legacy'),
    extractionVersion: text('extraction_version').notNull().default('legacy'),
    criticalFields: integer('critical_fields').notNull().default(0),
    correctCriticalFields: integer('correct_critical_fields')
      .notNull()
      .default(0),
    criticalAccuracyPercent: real('critical_accuracy_percent')
      .notNull()
      .default(0),
    unsupportedFields: integer('unsupported_fields').notNull().default(0),
    unsupportedValuePercent: real('unsupported_value_percent')
      .notNull()
      .default(0),
    successfulCases: integer('successful_cases').notNull().default(0),
    failedCases: integer('failed_cases').notNull().default(0),
    processingSuccessPercent: real('processing_success_percent')
      .notNull()
      .default(0),
    medianDurationMs: integer('median_duration_ms').notNull().default(0),
    baselineRunId: text('baseline_run_id'),
    regressionDelta: real('regression_delta'),
    regressionThreshold: real('regression_threshold').notNull().default(-2),
    promotionStatus: text('promotion_status', {
      enum: ['baseline_required', 'eligible', 'blocked'],
    })
      .notNull()
      .default('baseline_required'),
    isApprovedBaseline: integer('is_approved_baseline', { mode: 'boolean' })
      .notNull()
      .default(false),
    detailsJson: text('details_json').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [index('idx_ai_evaluation_runs_created_at').on(table.createdAt)],
);

export const aiEvaluationCaseResults = sqliteTable(
  'ai_evaluation_case_results',
  {
    id: text('id').primaryKey(),
    runId: text('run_id')
      .notNull()
      .references(() => aiEvaluationRuns.id),
    caseId: text('case_id').notNull(),
    title: text('title').notNull(),
    fileName: text('file_name').notNull(),
    documentType: text('document_type').notNull(),
    difficulty: text('difficulty').notNull(),
    fixtureVersion: text('fixture_version').notNull(),
    model: text('model').notNull(),
    promptVersion: text('prompt_version').notNull(),
    extractionVersion: text('extraction_version').notNull(),
    status: text('status', { enum: ['success', 'failed'] }).notNull(),
    durationMs: integer('duration_ms').notNull(),
    failureReason: text('failure_reason'),
    totalFields: integer('total_fields').notNull(),
    correctFields: integer('correct_fields').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    uniqueIndex('idx_ai_evaluation_case_run_case').on(
      table.runId,
      table.caseId,
    ),
    index('idx_ai_evaluation_case_type').on(table.documentType),
  ],
);

export const aiEvaluationFieldResults = sqliteTable(
  'ai_evaluation_field_results',
  {
    id: text('id').primaryKey(),
    runId: text('run_id')
      .notNull()
      .references(() => aiEvaluationRuns.id),
    caseId: text('case_id').notNull(),
    documentType: text('document_type').notNull(),
    fieldName: text('field_name').notNull(),
    label: text('label').notNull(),
    expectedJson: text('expected_json').notNull(),
    actualJson: text('actual_json').notNull(),
    critical: integer('critical', { mode: 'boolean' }).notNull(),
    correct: integer('correct', { mode: 'boolean' }).notNull(),
    confidence: real('confidence').notNull(),
    sourceBacked: integer('source_backed', { mode: 'boolean' }).notNull(),
    unsupported: integer('unsupported', { mode: 'boolean' }).notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    uniqueIndex('idx_ai_evaluation_field_run_case_field').on(
      table.runId,
      table.caseId,
      table.fieldName,
    ),
    index('idx_ai_evaluation_field_name').on(table.fieldName),
  ],
);

export const managementInsightRuns = sqliteTable(
  'management_insight_runs',
  {
    id: text('id').primaryKey(),
    scope: text('scope', { enum: ['contracts', 'suppliers'] }).notNull(),
    recordIdsJson: text('record_ids_json').notNull(),
    metricsJson: text('metrics_json').notNull(),
    attentionJson: text('attention_json').notNull(),
    model: text('model').notNull(),
    promptVersion: text('prompt_version').notNull(),
    responseJson: text('response_json').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    index('idx_management_insight_runs_scope_created_at').on(
      table.scope,
      table.createdAt,
    ),
  ],
);

export const importBatches = sqliteTable(
  'import_batches',
  {
    id: text('id').primaryKey(),
    entityType: text('entity_type', {
      enum: ['suppliers', 'contracts'],
    }).notNull(),
    fileName: text('file_name').notNull(),
    fileType: text('file_type').notNull(),
    fileSizeBytes: integer('file_size_bytes').notNull(),
    sourceHash: text('source_hash').notNull(),
    status: text('status', {
      enum: ['preview', 'committed', 'rolled_back'],
    })
      .notNull()
      .default('preview'),
    headersJson: text('headers_json').notNull(),
    mappingJson: text('mapping_json').notNull(),
    mappingVersion: text('mapping_version').notNull(),
    totalRows: integer('total_rows').notNull(),
    readyRows: integer('ready_rows').notNull(),
    warningRows: integer('warning_rows').notNull(),
    duplicateRows: integer('duplicate_rows').notNull(),
    invalidRows: integer('invalid_rows').notNull(),
    acceptedRows: integer('accepted_rows').notNull().default(0),
    rejectedRows: integer('rejected_rows').notNull().default(0),
    normalizationIssueCount: integer('normalization_issue_count')
      .notNull()
      .default(0),
    startedBy: text('started_by').notNull(),
    createdAt: text('created_at').notNull(),
    committedBy: text('committed_by'),
    committedAt: text('committed_at'),
    rolledBackBy: text('rolled_back_by'),
    rolledBackAt: text('rolled_back_at'),
    rollbackReason: text('rollback_reason'),
  },
  (table) => [
    index('idx_import_batches_created').on(table.createdAt),
    index('idx_import_batches_status').on(table.status, table.entityType),
    index('idx_import_batches_source_hash').on(
      table.sourceHash,
      table.entityType,
    ),
  ],
);

export const importRows = sqliteTable(
  'import_rows',
  {
    id: text('id').primaryKey(),
    batchId: text('batch_id')
      .notNull()
      .references(() => importBatches.id),
    rowNumber: integer('row_number').notNull(),
    rawDataJson: text('raw_data_json').notNull(),
    normalizedDataJson: text('normalized_data_json').notNull(),
    status: text('status', {
      enum: ['ready', 'warning', 'duplicate', 'invalid'],
    }).notNull(),
    decision: text('decision', {
      enum: ['pending', 'accept', 'skip'],
    })
      .notNull()
      .default('pending'),
    issuesJson: text('issues_json').notNull(),
    duplicateRecordId: text('duplicate_record_id'),
    duplicateType: text('duplicate_type', {
      enum: ['exact', 'possible'],
    }),
    createdRecordId: text('created_record_id'),
    createdRecordType: text('created_record_type'),
    committedAt: text('committed_at'),
    rolledBackAt: text('rolled_back_at'),
  },
  (table) => [
    uniqueIndex('idx_import_rows_batch_number').on(
      table.batchId,
      table.rowNumber,
    ),
    index('idx_import_rows_batch_status').on(
      table.batchId,
      table.status,
      table.decision,
    ),
  ],
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
  (table) => [
    index('idx_audit_logs_entity').on(table.entityType, table.entityId),
    index('idx_audit_logs_created_at').on(table.createdAt),
  ],
);

export const integrationOutbox = sqliteTable(
  'integration_outbox',
  {
    id: text('id').primaryKey(),
    eventType: text('event_type').notNull(),
    aggregateType: text('aggregate_type', {
      enum: ['approval_request', 'contract', 'obligation', 'supplier'],
    }).notNull(),
    aggregateId: text('aggregate_id').notNull(),
    payloadJson: text('payload_json').notNull(),
    status: text('status', { enum: ['pending', 'dispatched', 'failed'] })
      .notNull()
      .default('pending'),
    attemptCount: integer('attempt_count').notNull().default(0),
    lastError: text('last_error'),
    occurredAt: text('occurred_at').notNull(),
    dispatchedAt: text('dispatched_at'),
  },
  (table) => [
    index('idx_integration_outbox_status_occurred').on(
      table.status,
      table.occurredAt,
    ),
    index('idx_integration_outbox_aggregate').on(
      table.aggregateType,
      table.aggregateId,
    ),
  ],
);

export const apiRateLimits = sqliteTable('api_rate_limits', {
  key: text('key').primaryKey(),
  windowStart: integer('window_start').notNull(),
  requestCount: integer('request_count').notNull().default(1),
});

export const schemaMigrations = sqliteTable('schema_migrations', {
  version: integer('version').primaryKey(),
  appliedAt: text('applied_at').notNull(),
});

export type Supplier = typeof suppliers.$inferSelect;
export type ContractIntake = typeof contractIntakes.$inferSelect;
export type Contract = typeof contracts.$inferSelect;
export type KeyDate = typeof keyDates.$inferSelect;
export type ObligationEvent = typeof obligationEvents.$inferSelect;
export type ApprovalRule = typeof approvalRules.$inferSelect;
export type ApprovalRequest = typeof approvalRequests.$inferSelect;
export type ApprovalStep = typeof approvalSteps.$inferSelect;
export type ImportBatch = typeof importBatches.$inferSelect;
export type ImportRow = typeof importRows.$inferSelect;
