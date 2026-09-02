import { env } from 'cloudflare:workers';

import { APPROVAL_RULES_V1, addApprovalDueDays } from '@/lib/approval-workflow';

const approvalSchemaStatements = [
  `CREATE TABLE IF NOT EXISTS approval_rules (
    id TEXT PRIMARY KEY NOT NULL,
    rule_key TEXT NOT NULL,
    version INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    trigger_type TEXT NOT NULL,
    trigger_config_json TEXT NOT NULL,
    owner_role TEXT NOT NULL,
    due_days INTEGER NOT NULL,
    mandatory INTEGER DEFAULT 1 NOT NULL,
    active INTEGER DEFAULT 1 NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS approval_requests (
    id TEXT PRIMARY KEY NOT NULL,
    intake_id TEXT NOT NULL,
    rule_id TEXT NOT NULL,
    source_finding_id TEXT,
    source_document_id TEXT,
    status TEXT DEFAULT 'pending' NOT NULL,
    reason TEXT NOT NULL,
    rule_snapshot_json TEXT NOT NULL,
    generated_at TEXT NOT NULL,
    due_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    completed_at TEXT,
    FOREIGN KEY (intake_id) REFERENCES contract_intakes(id),
    FOREIGN KEY (rule_id) REFERENCES approval_rules(id),
    FOREIGN KEY (source_finding_id) REFERENCES review_findings(id),
    FOREIGN KEY (source_document_id) REFERENCES documents(id)
  )`,
  `CREATE TABLE IF NOT EXISTS approval_steps (
    id TEXT PRIMARY KEY NOT NULL,
    request_id TEXT NOT NULL,
    sequence INTEGER DEFAULT 1 NOT NULL,
    owner_role TEXT NOT NULL,
    assigned_reviewer TEXT,
    status TEXT DEFAULT 'pending' NOT NULL,
    due_at TEXT NOT NULL,
    started_at TEXT,
    decided_at TEXT,
    escalated_at TEXT,
    escalation_level INTEGER DEFAULT 0 NOT NULL,
    decision_reason TEXT,
    source_page INTEGER,
    source_quote TEXT,
    FOREIGN KEY (request_id) REFERENCES approval_requests(id)
  )`,
  `CREATE TABLE IF NOT EXISTS approval_decision_history (
    id TEXT PRIMARY KEY NOT NULL,
    request_id TEXT NOT NULL,
    step_id TEXT NOT NULL,
    action TEXT NOT NULL,
    from_status TEXT NOT NULL,
    to_status TEXT NOT NULL,
    actor TEXT NOT NULL,
    actor_role TEXT NOT NULL,
    reason TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (request_id) REFERENCES approval_requests(id),
    FOREIGN KEY (step_id) REFERENCES approval_steps(id)
  )`,
  'CREATE UNIQUE INDEX IF NOT EXISTS idx_approval_rules_key_version ON approval_rules(rule_key, version)',
  'CREATE INDEX IF NOT EXISTS idx_approval_rules_active ON approval_rules(active, rule_key)',
  'CREATE UNIQUE INDEX IF NOT EXISTS idx_approval_requests_intake_rule ON approval_requests(intake_id, rule_id)',
  'CREATE INDEX IF NOT EXISTS idx_approval_requests_status_due ON approval_requests(status, due_at)',
  'CREATE INDEX IF NOT EXISTS idx_approval_requests_intake ON approval_requests(intake_id)',
  'CREATE UNIQUE INDEX IF NOT EXISTS idx_approval_steps_request_sequence ON approval_steps(request_id, sequence)',
  'CREATE INDEX IF NOT EXISTS idx_approval_steps_status_due ON approval_steps(status, due_at)',
  'CREATE INDEX IF NOT EXISTS idx_approval_history_request_created ON approval_decision_history(request_id, created_at)',
] as const;

const importSchemaStatements = [
  `CREATE TABLE IF NOT EXISTS import_batches (
    id TEXT PRIMARY KEY NOT NULL,
    entity_type TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size_bytes INTEGER NOT NULL,
    source_hash TEXT NOT NULL,
    status TEXT DEFAULT 'preview' NOT NULL,
    headers_json TEXT NOT NULL,
    mapping_json TEXT NOT NULL,
    mapping_version TEXT NOT NULL,
    total_rows INTEGER NOT NULL,
    ready_rows INTEGER NOT NULL,
    warning_rows INTEGER NOT NULL,
    duplicate_rows INTEGER NOT NULL,
    invalid_rows INTEGER NOT NULL,
    accepted_rows INTEGER DEFAULT 0 NOT NULL,
    rejected_rows INTEGER DEFAULT 0 NOT NULL,
    normalization_issue_count INTEGER DEFAULT 0 NOT NULL,
    started_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    committed_by TEXT,
    committed_at TEXT,
    rolled_back_by TEXT,
    rolled_back_at TEXT,
    rollback_reason TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS import_rows (
    id TEXT PRIMARY KEY NOT NULL,
    batch_id TEXT NOT NULL,
    row_number INTEGER NOT NULL,
    raw_data_json TEXT NOT NULL,
    normalized_data_json TEXT NOT NULL,
    status TEXT NOT NULL,
    decision TEXT DEFAULT 'pending' NOT NULL,
    issues_json TEXT NOT NULL,
    duplicate_record_id TEXT,
    duplicate_type TEXT,
    created_record_id TEXT,
    created_record_type TEXT,
    committed_at TEXT,
    rolled_back_at TEXT,
    FOREIGN KEY (batch_id) REFERENCES import_batches(id)
  )`,
  'CREATE INDEX IF NOT EXISTS idx_import_batches_created ON import_batches(created_at)',
  'CREATE INDEX IF NOT EXISTS idx_import_batches_status ON import_batches(status, entity_type)',
  'CREATE INDEX IF NOT EXISTS idx_import_batches_source_hash ON import_batches(source_hash, entity_type)',
  'CREATE UNIQUE INDEX IF NOT EXISTS idx_import_rows_batch_number ON import_rows(batch_id, row_number)',
  'CREATE INDEX IF NOT EXISTS idx_import_rows_batch_status ON import_rows(batch_id, status, decision)',
] as const;

const obligationSchemaStatements = [
  `CREATE TABLE IF NOT EXISTS obligation_events (
    id TEXT PRIMARY KEY NOT NULL,
    key_date_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    from_status TEXT,
    to_status TEXT,
    actor TEXT NOT NULL,
    note TEXT,
    evidence_document_id TEXT,
    metadata_json TEXT DEFAULT '{}' NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (key_date_id) REFERENCES key_dates(id),
    FOREIGN KEY (evidence_document_id) REFERENCES documents(id)
  )`,
  'CREATE INDEX IF NOT EXISTS idx_obligation_events_key_date_created ON obligation_events(key_date_id, created_at)',
  'CREATE INDEX IF NOT EXISTS idx_key_dates_owner_status ON key_dates(owner, status)',
  'CREATE INDEX IF NOT EXISTS idx_key_dates_supplier_id ON key_dates(supplier_id)',
] as const;

const evaluationSchemaStatements = [
  `CREATE TABLE IF NOT EXISTS ai_evaluation_case_results (
    id TEXT PRIMARY KEY NOT NULL,
    run_id TEXT NOT NULL,
    case_id TEXT NOT NULL,
    title TEXT NOT NULL,
    file_name TEXT NOT NULL,
    document_type TEXT NOT NULL,
    difficulty TEXT NOT NULL,
    fixture_version TEXT NOT NULL,
    model TEXT NOT NULL,
    prompt_version TEXT NOT NULL,
    extraction_version TEXT NOT NULL,
    status TEXT NOT NULL,
    duration_ms INTEGER NOT NULL,
    failure_reason TEXT,
    total_fields INTEGER NOT NULL,
    correct_fields INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (run_id) REFERENCES ai_evaluation_runs(id)
  )`,
  `CREATE TABLE IF NOT EXISTS ai_evaluation_field_results (
    id TEXT PRIMARY KEY NOT NULL,
    run_id TEXT NOT NULL,
    case_id TEXT NOT NULL,
    document_type TEXT NOT NULL,
    field_name TEXT NOT NULL,
    label TEXT NOT NULL,
    expected_json TEXT NOT NULL,
    actual_json TEXT NOT NULL,
    critical INTEGER NOT NULL,
    correct INTEGER NOT NULL,
    confidence REAL NOT NULL,
    source_backed INTEGER NOT NULL,
    unsupported INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (run_id) REFERENCES ai_evaluation_runs(id)
  )`,
  'CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_evaluation_case_run_case ON ai_evaluation_case_results(run_id, case_id)',
  'CREATE INDEX IF NOT EXISTS idx_ai_evaluation_case_type ON ai_evaluation_case_results(document_type)',
  'CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_evaluation_field_run_case_field ON ai_evaluation_field_results(run_id, case_id, field_name)',
  'CREATE INDEX IF NOT EXISTS idx_ai_evaluation_field_name ON ai_evaluation_field_results(field_name)',
] as const;

const integrationSchemaStatements = [
  `CREATE TABLE IF NOT EXISTS integration_outbox (
    id TEXT PRIMARY KEY NOT NULL,
    event_type TEXT NOT NULL,
    aggregate_type TEXT NOT NULL,
    aggregate_id TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    status TEXT DEFAULT 'pending' NOT NULL,
    attempt_count INTEGER DEFAULT 0 NOT NULL,
    last_error TEXT,
    occurred_at TEXT NOT NULL,
    dispatched_at TEXT
  )`,
  'CREATE INDEX IF NOT EXISTS idx_integration_outbox_status_occurred ON integration_outbox(status, occurred_at)',
  'CREATE INDEX IF NOT EXISTS idx_integration_outbox_aggregate ON integration_outbox(aggregate_type, aggregate_id)',
] as const;

const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS suppliers (
    id TEXT PRIMARY KEY NOT NULL,
    legal_name TEXT NOT NULL,
    normalized_name TEXT NOT NULL,
    dba_name TEXT,
    vendor_number TEXT,
    category TEXT NOT NULL,
    status TEXT DEFAULT 'pending' NOT NULL,
    primary_contact TEXT,
    email TEXT,
    phone TEXT,
    website TEXT,
    address_line1 TEXT,
    address_line2 TEXT,
    city TEXT,
    state TEXT,
    postal_code TEXT,
    country TEXT,
    tax_classification TEXT,
    risk_tier TEXT,
    qualification_status TEXT,
    qualification_review_date TEXT,
    w9_status TEXT DEFAULT 'missing' NOT NULL,
    insurance_status TEXT DEFAULT 'missing' NOT NULL,
    insurance_expiration TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS contract_intakes (
    id TEXT PRIMARY KEY NOT NULL,
    intake_number TEXT NOT NULL,
    supplier_id TEXT,
    proposed_supplier_name TEXT NOT NULL,
    title TEXT NOT NULL,
    contract_type TEXT NOT NULL,
    proposed_value_cents INTEGER,
    status TEXT DEFAULT 'draft' NOT NULL,
    review_status TEXT DEFAULT 'pending' NOT NULL,
    owner TEXT,
    target_review_date TEXT,
    internal_notes TEXT,
    approval_status TEXT DEFAULT 'not_required' NOT NULL,
    received_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
  )`,
  `CREATE TABLE IF NOT EXISTS contracts (
    id TEXT PRIMARY KEY NOT NULL,
    contract_number TEXT NOT NULL,
    intake_id TEXT,
    supplier_id TEXT NOT NULL,
    title TEXT NOT NULL,
    contract_type TEXT NOT NULL,
    department TEXT NOT NULL,
    owner TEXT NOT NULL,
    original_value_cents INTEGER NOT NULL,
    amendment_value_cents INTEGER DEFAULT 0 NOT NULL,
    current_value_cents INTEGER NOT NULL,
    effective_date TEXT NOT NULL,
    expiration_date TEXT,
    renewal_type TEXT DEFAULT 'none' NOT NULL,
    notice_days INTEGER,
    notice_deadline TEXT,
    payment_terms TEXT,
    governing_law TEXT,
    status TEXT DEFAULT 'executed' NOT NULL,
    last_updated TEXT NOT NULL,
    FOREIGN KEY (intake_id) REFERENCES contract_intakes(id),
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
  )`,
  `CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY NOT NULL,
    supplier_id TEXT,
    intake_id TEXT,
    contract_id TEXT,
    parent_document_id TEXT,
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL,
    lifecycle_stage TEXT NOT NULL,
    storage_key TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    page_count INTEGER,
    issuer TEXT,
    document_number TEXT,
    effective_date TEXT,
    expiration_date TEXT,
    coverage_summary TEXT,
    review_status TEXT,
    ai_status TEXT DEFAULT 'queued' NOT NULL,
    uploaded_at TEXT NOT NULL,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
    FOREIGN KEY (intake_id) REFERENCES contract_intakes(id),
    FOREIGN KEY (contract_id) REFERENCES contracts(id)
  )`,
  `CREATE TABLE IF NOT EXISTS amendments (
    id TEXT PRIMARY KEY NOT NULL,
    contract_id TEXT NOT NULL,
    document_id TEXT,
    amendment_number TEXT NOT NULL,
    amendment_type TEXT DEFAULT 'amendment' NOT NULL,
    version_number INTEGER NOT NULL,
    version_status TEXT DEFAULT 'current' NOT NULL,
    signed_date TEXT NOT NULL,
    effective_date TEXT,
    previous_value_cents INTEGER NOT NULL,
    value_change_cents INTEGER DEFAULT 0 NOT NULL,
    resulting_value_cents INTEGER NOT NULL,
    previous_expiration_date TEXT,
    new_expiration_date TEXT,
    previous_payment_terms TEXT,
    new_payment_terms TEXT,
    previous_renewal_type TEXT,
    new_renewal_type TEXT,
    previous_notice_days INTEGER,
    new_notice_days INTEGER,
    scope_summary TEXT,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (contract_id) REFERENCES contracts(id),
    FOREIGN KEY (document_id) REFERENCES documents(id)
  )`,
  `CREATE TABLE IF NOT EXISTS key_dates (
    id TEXT PRIMARY KEY NOT NULL,
    contract_id TEXT,
    supplier_id TEXT,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    due_date TEXT NOT NULL,
    internal_review_date TEXT,
    status TEXT DEFAULT 'upcoming' NOT NULL,
    owner TEXT,
    backup_owner TEXT,
    priority TEXT DEFAULT 'medium' NOT NULL,
    material INTEGER DEFAULT 1 NOT NULL,
    assigned_at TEXT,
    completed_at TEXT,
    completed_by TEXT,
    completion_note TEXT,
    evidence_document_id TEXT,
    evidence_reference TEXT,
    escalation_level INTEGER DEFAULT 0 NOT NULL,
    escalated_at TEXT,
    decision TEXT,
    notes TEXT,
    source_document_id TEXT,
    source_clause TEXT,
    source_page INTEGER,
    created_at TEXT DEFAULT '2026-01-01T00:00:00.000Z' NOT NULL,
    updated_at TEXT DEFAULT '2026-01-01T00:00:00.000Z' NOT NULL,
    FOREIGN KEY (contract_id) REFERENCES contracts(id),
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
    FOREIGN KEY (evidence_document_id) REFERENCES documents(id),
    FOREIGN KEY (source_document_id) REFERENCES documents(id)
  )`,
  ...obligationSchemaStatements,
  `CREATE TABLE IF NOT EXISTS review_findings (
    id TEXT PRIMARY KEY NOT NULL,
    intake_id TEXT NOT NULL,
    field TEXT NOT NULL,
    rule_name TEXT NOT NULL,
    standard_text TEXT NOT NULL,
    observed_text TEXT NOT NULL,
    severity TEXT NOT NULL,
    source_page INTEGER,
    suggested_revision TEXT,
    status TEXT DEFAULT 'open' NOT NULL,
    FOREIGN KEY (intake_id) REFERENCES contract_intakes(id)
  )`,
  ...approvalSchemaStatements,
  `CREATE TABLE IF NOT EXISTS ai_analysis_runs (
    id TEXT PRIMARY KEY NOT NULL,
    stage TEXT NOT NULL,
    intake_id TEXT,
    contract_id TEXT,
    supplier_id TEXT,
    document_id TEXT,
    file_name TEXT NOT NULL,
    storage_key TEXT NOT NULL,
    model TEXT NOT NULL,
    prompt_version TEXT NOT NULL,
    original_result_json TEXT NOT NULL,
    quality_report_json TEXT,
    verified_result_json TEXT,
    correction_count INTEGER DEFAULT 0 NOT NULL,
    status TEXT DEFAULT 'pending_review' NOT NULL,
    reviewed_by TEXT,
    reviewed_at TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (intake_id) REFERENCES contract_intakes(id),
    FOREIGN KEY (contract_id) REFERENCES contracts(id),
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
    FOREIGN KEY (document_id) REFERENCES documents(id)
  )`,
  `CREATE TABLE IF NOT EXISTS ai_field_reviews (
    id TEXT PRIMARY KEY NOT NULL,
    analysis_run_id TEXT NOT NULL,
    field_name TEXT NOT NULL,
    original_value_json TEXT NOT NULL,
    verified_value_json TEXT NOT NULL,
    confidence REAL NOT NULL,
    source_page INTEGER,
    source_quote TEXT,
    override_reason TEXT,
    review_status TEXT NOT NULL,
    reviewed_by TEXT NOT NULL,
    reviewed_at TEXT NOT NULL,
    FOREIGN KEY (analysis_run_id) REFERENCES ai_analysis_runs(id)
  )`,
  `CREATE TABLE IF NOT EXISTS ai_evaluation_runs (
    id TEXT PRIMARY KEY NOT NULL,
    model TEXT NOT NULL,
    case_count INTEGER NOT NULL,
    total_fields INTEGER NOT NULL,
    correct_fields INTEGER NOT NULL,
    source_backed_fields INTEGER NOT NULL,
    accuracy_percent REAL NOT NULL,
    source_coverage_percent REAL NOT NULL,
    average_confidence REAL NOT NULL,
    dataset_version TEXT DEFAULT 'legacy-3' NOT NULL,
    fixture_version TEXT DEFAULT 'legacy' NOT NULL,
    prompt_version TEXT DEFAULT 'legacy' NOT NULL,
    extraction_version TEXT DEFAULT 'legacy' NOT NULL,
    critical_fields INTEGER DEFAULT 0 NOT NULL,
    correct_critical_fields INTEGER DEFAULT 0 NOT NULL,
    critical_accuracy_percent REAL DEFAULT 0 NOT NULL,
    unsupported_fields INTEGER DEFAULT 0 NOT NULL,
    unsupported_value_percent REAL DEFAULT 0 NOT NULL,
    successful_cases INTEGER DEFAULT 0 NOT NULL,
    failed_cases INTEGER DEFAULT 0 NOT NULL,
    processing_success_percent REAL DEFAULT 0 NOT NULL,
    median_duration_ms INTEGER DEFAULT 0 NOT NULL,
    baseline_run_id TEXT,
    regression_delta REAL,
    regression_threshold REAL DEFAULT -2 NOT NULL,
    promotion_status TEXT DEFAULT 'baseline_required' NOT NULL,
    is_approved_baseline INTEGER DEFAULT 0 NOT NULL,
    details_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  ...evaluationSchemaStatements,
  `CREATE TABLE IF NOT EXISTS management_insight_runs (
    id TEXT PRIMARY KEY NOT NULL,
    scope TEXT NOT NULL,
    record_ids_json TEXT NOT NULL,
    metrics_json TEXT NOT NULL,
    attention_json TEXT NOT NULL,
    model TEXT NOT NULL,
    prompt_version TEXT NOT NULL,
    response_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  ...importSchemaStatements,
  ...integrationSchemaStatements,
  `CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    action TEXT NOT NULL,
    actor TEXT NOT NULL,
    details TEXT,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS api_rate_limits (
    key TEXT PRIMARY KEY NOT NULL,
    window_start INTEGER NOT NULL,
    request_count INTEGER DEFAULT 1 NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY NOT NULL,
    applied_at TEXT NOT NULL
  )`,
  'CREATE UNIQUE INDEX IF NOT EXISTS idx_suppliers_normalized_name ON suppliers(normalized_name)',
  'CREATE INDEX IF NOT EXISTS idx_suppliers_status ON suppliers(status)',
  'CREATE INDEX IF NOT EXISTS idx_suppliers_insurance_expiration ON suppliers(insurance_expiration)',
  'CREATE UNIQUE INDEX IF NOT EXISTS idx_contract_intakes_number ON contract_intakes(intake_number)',
  'CREATE INDEX IF NOT EXISTS idx_contract_intakes_status ON contract_intakes(status)',
  'CREATE INDEX IF NOT EXISTS idx_contract_intakes_status_owner ON contract_intakes(status, owner)',
  'CREATE INDEX IF NOT EXISTS idx_contract_intakes_supplier_id ON contract_intakes(supplier_id)',
  'CREATE UNIQUE INDEX IF NOT EXISTS idx_contracts_number ON contracts(contract_number)',
  'CREATE INDEX IF NOT EXISTS idx_contracts_supplier_id ON contracts(supplier_id)',
  'CREATE INDEX IF NOT EXISTS idx_contracts_status_expiration ON contracts(status, expiration_date)',
  'CREATE INDEX IF NOT EXISTS idx_contracts_notice_deadline ON contracts(notice_deadline)',
  'CREATE INDEX IF NOT EXISTS idx_documents_contract_id ON documents(contract_id)',
  'CREATE INDEX IF NOT EXISTS idx_documents_intake_id ON documents(intake_id)',
  'CREATE INDEX IF NOT EXISTS idx_documents_supplier_id ON documents(supplier_id)',
  'CREATE INDEX IF NOT EXISTS idx_amendments_contract_id ON amendments(contract_id)',
  'CREATE UNIQUE INDEX IF NOT EXISTS idx_amendments_contract_version ON amendments(contract_id, version_number)',
  'CREATE INDEX IF NOT EXISTS idx_key_dates_due_status ON key_dates(due_date, status)',
  'CREATE INDEX IF NOT EXISTS idx_key_dates_contract_id ON key_dates(contract_id)',
  'CREATE INDEX IF NOT EXISTS idx_review_findings_intake_id ON review_findings(intake_id)',
  'CREATE INDEX IF NOT EXISTS idx_ai_analysis_runs_contract_id ON ai_analysis_runs(contract_id)',
  'CREATE INDEX IF NOT EXISTS idx_ai_analysis_runs_intake_id ON ai_analysis_runs(intake_id)',
  'CREATE INDEX IF NOT EXISTS idx_ai_analysis_runs_supplier_id ON ai_analysis_runs(supplier_id)',
  'CREATE INDEX IF NOT EXISTS idx_ai_field_reviews_analysis_run_id ON ai_field_reviews(analysis_run_id)',
  'CREATE INDEX IF NOT EXISTS idx_ai_evaluation_runs_created_at ON ai_evaluation_runs(created_at)',
  'CREATE INDEX IF NOT EXISTS idx_management_insight_runs_scope_created_at ON management_insight_runs(scope, created_at)',
  'CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id)',
  'CREATE INDEX IF NOT EXISTS idx_documents_supplier_lifecycle_expiration ON documents(supplier_id, lifecycle_stage, expiration_date)',
  'CREATE INDEX IF NOT EXISTS idx_ai_analysis_runs_status_stage_reviewed ON ai_analysis_runs(status, stage, reviewed_at)',
  'CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at)',
  'CREATE UNIQUE INDEX IF NOT EXISTS idx_contracts_intake_id_unique ON contracts(intake_id) WHERE intake_id IS NOT NULL',
];

const CURRENT_SCHEMA_VERSION = 20;

const runtimeMigrationStatements = [
  ...approvalSchemaStatements,
  ...importSchemaStatements,
  ...obligationSchemaStatements,
  ...evaluationSchemaStatements,
  ...integrationSchemaStatements,
  `CREATE TABLE IF NOT EXISTS api_rate_limits (
    key TEXT PRIMARY KEY NOT NULL,
    window_start INTEGER NOT NULL,
    request_count INTEGER DEFAULT 1 NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY NOT NULL,
    applied_at TEXT NOT NULL
  )`,
  'CREATE INDEX IF NOT EXISTS idx_documents_supplier_lifecycle_expiration ON documents(supplier_id, lifecycle_stage, expiration_date)',
  'CREATE INDEX IF NOT EXISTS idx_ai_analysis_runs_status_stage_reviewed ON ai_analysis_runs(status, stage, reviewed_at)',
  'CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at)',
  'CREATE INDEX IF NOT EXISTS idx_contract_intakes_status_owner ON contract_intakes(status, owner)',
  'CREATE UNIQUE INDEX IF NOT EXISTS idx_contracts_intake_id_unique ON contracts(intake_id) WHERE intake_id IS NOT NULL',
  `WITH ranked AS (
    SELECT rowid AS amendment_rowid,
      ROW_NUMBER() OVER (
        PARTITION BY contract_id ORDER BY signed_date, rowid
      ) + 1 AS lifecycle_version
    FROM amendments
  )
  UPDATE amendments SET version_number = (
    SELECT lifecycle_version FROM ranked
    WHERE amendment_rowid = amendments.rowid
  )`,
  'CREATE UNIQUE INDEX IF NOT EXISTS idx_amendments_contract_version ON amendments(contract_id, version_number)',
  `UPDATE suppliers SET qualification_status = CASE qualification_status
    WHEN 'approved' THEN 'complete'
    WHEN 'in_review' THEN 'under_review'
    WHEN 'pending' THEN 'under_review'
    WHEN 'rejected' THEN 'needs_follow_up'
    ELSE qualification_status
  END`,
  `UPDATE suppliers SET status = 'inactive' WHERE status = 'rejected'`,
  `UPDATE contract_intakes SET supplier_id = NULL
    WHERE status != 'executed'`,
  `UPDATE documents SET supplier_id = NULL
    WHERE lifecycle_stage = 'draft'`,
  `UPDATE ai_analysis_runs SET supplier_id = NULL
    WHERE stage = 'draft'`,
  `UPDATE key_dates SET status = 'in_progress'
    WHERE status = 'due'`,
] as const;

const suppliersSeed = [
  [
    'sup-apex',
    'Apex Equipment LLC',
    'apex equipment',
    'Industrial Equipment',
    'active',
    'Rachel Kim',
    'rachel.kim@example.com',
    'received',
    'current',
    '2027-02-15',
  ],
  [
    'sup-westline',
    'Westline Engineering Group LLC',
    'westline engineering group',
    'Professional Services',
    'pending',
    'Daniel Ortiz',
    'daniel.ortiz@example.com',
    'received',
    'current',
    '2027-10-10',
  ],
  [
    'sup-pacific',
    'Pacific Safety Consulting Inc.',
    'pacific safety consulting',
    'Safety Consulting',
    'active',
    'Morgan Lee',
    'morgan.lee@example.com',
    'received',
    'current',
    '2027-04-30',
  ],
  [
    'sup-golden',
    'Golden State Logistics LLC',
    'golden state logistics',
    'Logistics',
    'active',
    'Taylor Brooks',
    'taylor.brooks@example.com',
    'received',
    'current',
    '2026-09-23',
  ],
  [
    'sup-harbor',
    'Harbor Technology Solutions Inc.',
    'harbor technology solutions',
    'Technology',
    'active',
    'Chris Allen',
    'chris.allen@example.com',
    'received',
    'current',
    '2027-01-31',
  ],
  [
    'sup-redwood',
    'Redwood Facilities Services LLC',
    'redwood facilities services',
    'Facilities',
    'active',
    'Jordan Bell',
    'jordan.bell@example.com',
    'missing',
    'current',
    '2026-11-15',
  ],
  [
    'sup-sierra',
    'Sierra Environmental Partners Inc.',
    'sierra environmental partners',
    'Environmental Services',
    'active',
    'Alex Nguyen',
    'alex.nguyen@example.com',
    'received',
    'missing',
    null,
  ],
  [
    'sup-northbay',
    'North Bay Industrial Supply Co.',
    'north bay industrial supply',
    'Industrial Supply',
    'active',
    'Jamie Chen',
    'jamie.chen@example.com',
    'received',
    'current',
    '2027-06-30',
  ],
] as const;

const contractsSeed = [
  [
    'con-001',
    'CT-2025-018',
    'sup-harbor',
    'Technology Support Services Agreement',
    'Master Services Agreement',
    'Operations',
    'Selina Armstrong',
    72000000,
    0,
    72000000,
    '2025-01-01',
    '2026-12-31',
    'automatic',
    60,
    '2026-11-01',
    'active',
  ],
  [
    'con-002',
    'CT-2026-004',
    'sup-apex',
    'Equipment Supply Agreement',
    'Equipment Purchase Agreement',
    'Procurement',
    'Selina Armstrong',
    40000000,
    7500000,
    47500000,
    '2026-02-01',
    '2027-01-31',
    'none',
    null,
    null,
    'active',
  ],
  [
    'con-003',
    'CT-2026-009',
    'sup-pacific',
    'Workplace Safety Consulting',
    'Professional Services Agreement',
    'Risk & Safety',
    'Selina Armstrong',
    41000000,
    0,
    41000000,
    '2026-03-15',
    '2027-03-14',
    'optional',
    30,
    '2027-02-12',
    'active',
  ],
  [
    'con-004',
    'CT-2026-012',
    'sup-golden',
    'Regional Logistics Services',
    'Master Services Agreement',
    'Operations',
    'Selina Armstrong',
    98000000,
    0,
    98000000,
    '2026-04-01',
    '2027-03-31',
    'automatic',
    90,
    '2026-12-31',
    'active',
  ],
  [
    'con-005',
    'CT-2026-016',
    'sup-redwood',
    'Facilities Maintenance Services',
    'Services Agreement',
    'Facilities',
    'Selina Armstrong',
    36500000,
    0,
    36500000,
    '2026-06-01',
    '2027-05-31',
    'optional',
    45,
    '2027-04-16',
    'active',
  ],
  [
    'con-006',
    'CT-2026-019',
    'sup-sierra',
    'Environmental Compliance Support',
    'Professional Services Agreement',
    'Compliance',
    'Selina Armstrong',
    52500000,
    0,
    52500000,
    '2026-07-01',
    '2027-06-30',
    'none',
    null,
    null,
    'active',
  ],
  [
    'con-007',
    'CT-2025-027',
    'sup-northbay',
    'Industrial Consumables Supply',
    'Supply Agreement',
    'Procurement',
    'Selina Armstrong',
    63000000,
    -5000000,
    58000000,
    '2025-09-01',
    '2026-09-30',
    'none',
    null,
    null,
    'active',
  ],
] as const;

const intakeSeed = [
  [
    'int-001',
    'INT-2026-041',
    null,
    'Westline Engineering Group LLC',
    'Plant Modernization Engineering Support',
    'Professional Services Agreement',
    58500000,
    'under_review',
    'in_progress',
    '2026-08-29',
  ],
  [
    'int-002',
    'INT-2026-042',
    null,
    'Apex Equipment LLC',
    'Amendment No. 1 — Equipment Supply',
    'Amendment',
    7500000,
    'approved_for_signature',
    'complete',
    '2026-08-28',
  ],
  [
    'int-003',
    'INT-2026-043',
    'sup-pacific',
    'Pacific Safety Consulting Inc.',
    'Master Services Agreement',
    'Master Services Agreement',
    41000000,
    'executed',
    'ready',
    '2026-08-27',
  ],
] as const;

const demoDraftAnalysis = {
  documentTitle: {
    value: 'Plant Modernization Engineering Support',
    confidence: 0.98,
    sourcePage: 1,
    sourceQuote: 'Professional Services Agreement',
  },
  supplierLegalName: {
    value: 'Westline Engineering Group LLC',
    confidence: 0.99,
    sourcePage: 1,
    sourceQuote: 'Westline Engineering Group LLC',
  },
  contractType: {
    value: 'Professional Services Agreement',
    confidence: 0.97,
    sourcePage: 1,
    sourceQuote: 'Professional Services Agreement',
  },
  contractNumber: {
    value: null,
    confidence: 0.35,
    sourcePage: null,
    sourceQuote: null,
  },
  contractValue: {
    value: 585000,
    confidence: 0.96,
    sourcePage: 3,
    sourceQuote: 'not-to-exceed amount of $585,000',
  },
  effectiveDate: {
    value: '2026-09-15',
    confidence: 0.96,
    sourcePage: 1,
    sourceQuote: 'effective as of September 15, 2026',
  },
  expirationDate: {
    value: '2027-09-14',
    confidence: 0.94,
    sourcePage: 7,
    sourceQuote: 'continue for an initial term of one year',
  },
  renewalType: {
    value: 'automatic',
    confidence: 0.95,
    sourcePage: 7,
    sourceQuote: 'automatically renew for successive one-year terms',
  },
  noticeDays: {
    value: 60,
    confidence: 0.96,
    sourcePage: 7,
    sourceQuote: 'at least sixty (60) days written notice',
  },
  governingLaw: {
    value: 'New York',
    confidence: 0.96,
    sourcePage: 9,
    sourceQuote: 'laws of the State of New York',
  },
  paymentTerms: {
    value: 'Net 60',
    confidence: 0.97,
    sourcePage: 4,
    sourceQuote: 'within sixty (60) days after receipt',
  },
  findings: [
    {
      rule: 'Payment terms',
      observed: 'Net 60',
      standard: 'Net 30 preferred',
      suggestedRevision:
        'Customer will pay each undisputed invoice within thirty (30) days after receipt of a correct invoice.',
      severity: 'medium',
      sourcePage: 4,
    },
    {
      rule: 'Governing law',
      observed: 'New York',
      standard: 'California preferred',
      suggestedRevision:
        'This Agreement is governed by and construed under the laws of the State of California, without regard to conflict-of-laws principles.',
      severity: 'medium',
      sourcePage: 9,
    },
  ],
  keyDates: [
    {
      type: 'non_renewal_notice',
      title: 'Non-renewal notice deadline',
      dueDate: '2027-07-16',
      sourcePage: 7,
      sourceQuote: 'at least sixty (60) days written notice',
    },
  ],
  warnings: ['No contract number was found in the draft.'],
};

const supplierProfileSeed = [
  [
    'sup-apex',
    'VND-1001',
    '2900 Industrial Way',
    null,
    'Fremont',
    'CA',
    '94538',
    'United States',
    '510-555-0142',
    'https://example.com/apex-equipment',
    'LLC - Partnership',
    'medium',
    'complete',
    '2026-02-01',
  ],
  [
    'sup-westline',
    'VND-1002',
    '1800 Broadway, Suite 650',
    null,
    'Oakland',
    'CA',
    '94612',
    'United States',
    '510-555-0168',
    'https://example.com/westline-engineering',
    'C Corporation',
    'high',
    'under_review',
    '2026-08-29',
  ],
  [
    'sup-pacific',
    'VND-1003',
    '525 Capitol Mall, Suite 900',
    null,
    'Sacramento',
    'CA',
    '95814',
    'United States',
    '916-555-0136',
    'https://example.com/pacific-safety',
    'S Corporation',
    'high',
    'complete',
    '2026-03-10',
  ],
  [
    'sup-golden',
    'VND-1004',
    '760 Harbor Boulevard',
    null,
    'West Sacramento',
    'CA',
    '95691',
    'United States',
    '916-555-0181',
    'https://example.com/golden-state-logistics',
    'LLC - Partnership',
    'high',
    'complete',
    '2026-04-01',
  ],
  [
    'sup-harbor',
    'VND-1005',
    '455 Market Plaza',
    null,
    'San Francisco',
    'CA',
    '94105',
    'United States',
    '415-555-0118',
    'https://example.com/harbor-technology',
    'C Corporation',
    'high',
    'complete',
    '2026-01-20',
  ],
  [
    'sup-redwood',
    'VND-1006',
    '8140 Redwood Commerce Drive',
    null,
    'Santa Rosa',
    'CA',
    '95403',
    'United States',
    '707-555-0154',
    'https://example.com/redwood-facilities',
    'LLC - Partnership',
    'high',
    'under_review',
    '2026-06-01',
  ],
  [
    'sup-sierra',
    'VND-1007',
    '3400 Sierra College Boulevard',
    'Suite 210',
    'Rocklin',
    'CA',
    '95677',
    'United States',
    '916-555-0196',
    'https://example.com/sierra-environmental',
    'S Corporation',
    'high',
    'under_review',
    '2026-07-01',
  ],
  [
    'sup-northbay',
    'VND-1008',
    '1550 Commerce Lane',
    null,
    'Vallejo',
    'CA',
    '94591',
    'United States',
    '707-555-0177',
    'https://example.com/north-bay-supply',
    'C Corporation',
    'low',
    'complete',
    '2025-09-01',
  ],
] as const;

const contractTermsSeed = [
  ['con-001', 'Net 30', 'California'],
  ['con-002', 'Net 45', 'California'],
  ['con-003', 'Net 30', 'California'],
  ['con-004', 'Net 30', 'California'],
  ['con-005', 'Net 30', 'California'],
  ['con-006', 'Net 30', 'California'],
  ['con-007', 'Net 45', 'California'],
] as const;

function isoNow() {
  return new Date().toISOString();
}

async function syncEnhancedDemoScenario(db: D1Database, now: string) {
  await db.batch([
    db
      .prepare(
        `UPDATE suppliers SET legal_name = ?, updated_at = ? WHERE id = ?`,
      )
      .bind('Westline Engineering Group LLC', now, 'sup-westline'),
    db
      .prepare(
        `UPDATE contract_intakes SET proposed_supplier_name = ?, title = ?, proposed_value_cents = ?,
          owner = COALESCE(owner, 'Selina Armstrong'),
          target_review_date = COALESCE(target_review_date, '2026-09-05'),
          internal_notes = COALESCE(internal_notes, 'Confirm business acceptance of payment timing and governing-law position before releasing the next draft.'),
          approval_status = CASE WHEN approval_status = 'not_required' THEN 'pending' ELSE approval_status END,
          updated_at = ? WHERE id = ?`,
      )
      .bind(
        'Westline Engineering Group LLC',
        'Plant Modernization Engineering Support',
        58500000,
        now,
        'int-001',
      ),
    db
      .prepare(`UPDATE review_findings SET source_page = ? WHERE id = ?`)
      .bind(4, 'finding-001'),
    db
      .prepare(`UPDATE review_findings SET source_page = ? WHERE id = ?`)
      .bind(9, 'finding-002'),
    db
      .prepare(
        `UPDATE review_findings SET suggested_revision = COALESCE(suggested_revision, ?) WHERE id = ?`,
      )
      .bind(
        'Customer will pay each undisputed invoice within thirty (30) days after receipt of a correct invoice.',
        'finding-001',
      ),
    db
      .prepare(
        `UPDATE review_findings SET suggested_revision = COALESCE(suggested_revision, ?) WHERE id = ?`,
      )
      .bind(
        'This Agreement is governed by and construed under the laws of the State of California, without regard to conflict-of-laws principles.',
        'finding-002',
      ),
    db.prepare(`UPDATE contract_intakes SET owner = COALESCE(owner, 'Selina Armstrong'),
        target_review_date = COALESCE(target_review_date, '2026-08-30'),
        approval_status = COALESCE(approval_status, 'not_required') WHERE id = 'int-002'`),
    db.prepare(`UPDATE contract_intakes SET owner = COALESCE(owner, 'Selina Armstrong'),
        target_review_date = COALESCE(target_review_date, '2026-08-29'),
        approval_status = COALESCE(approval_status, 'not_required') WHERE id = 'int-003'`),
    db.prepare(`UPDATE contracts SET intake_id = 'int-003'
      WHERE id = 'con-003' AND intake_id IS NULL`),
    db
      .prepare(`INSERT OR IGNORE INTO amendments
        (id, contract_id, document_id, amendment_number, amendment_type,
         version_number, version_status, signed_date, effective_date,
         previous_value_cents, value_change_cents, resulting_value_cents,
         previous_expiration_date, new_expiration_date,
         previous_payment_terms, new_payment_terms,
         previous_renewal_type, new_renewal_type,
         previous_notice_days, new_notice_days, scope_summary,
         created_by, created_at)
        VALUES (?, ?, NULL, ?, 'amendment', 2, 'current', ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(
        'amd-demo-apex-001',
        'con-002',
        'Amendment No. 1',
        '2026-04-15',
        '2026-04-15',
        40000000,
        7500000,
        47500000,
        '2027-01-31',
        '2027-01-31',
        'Net 45',
        'Net 45',
        'none',
        'none',
        30,
        30,
        'Added an auxiliary equipment package and related commissioning services.',
        'Selina Armstrong',
        '2026-04-15T17:30:00.000Z',
      ),
    db
      .prepare(`INSERT OR IGNORE INTO audit_logs
        (id, entity_type, entity_id, action, actor, details, created_at)
        VALUES (?, 'contract', ?, 'amendment_applied', ?, ?, ?)`)
      .bind(
        'audit-demo-apex-amendment-001',
        'con-002',
        'Selina Armstrong',
        JSON.stringify({
          amendmentId: 'amd-demo-apex-001',
          amendmentNumber: 'Amendment No. 1',
          amendmentType: 'amendment',
          versionNumber: 2,
          source: 'Historical register migration',
          correctionCount: 0,
          before: {
            currentValueCents: 40000000,
            expirationDate: '2027-01-31',
            paymentTerms: 'Net 45',
          },
          after: {
            currentValueCents: 47500000,
            expirationDate: '2027-01-31',
            paymentTerms: 'Net 45',
          },
        }),
        '2026-04-15T17:30:00.000Z',
      ),
    db
      .prepare(`INSERT OR IGNORE INTO documents
      (id, supplier_id, intake_id, file_name, file_type, lifecycle_stage, storage_key, mime_type, page_count, review_status, ai_status, uploaded_at)
      VALUES (?, ?, ?, ?, ?, 'draft', ?, 'application/pdf', 10, 'approved', 'verified', ?)`)
      .bind(
        'doc-demo-draft-westline',
        null,
        'int-001',
        '01_Draft_Professional_Services_Agreement.pdf',
        'Professional Services Agreement',
        'public:/demo-documents/01_Draft_Professional_Services_Agreement.pdf',
        now,
      ),
    db
      .prepare(`INSERT OR IGNORE INTO ai_analysis_runs
      (id, stage, intake_id, supplier_id, document_id, file_name, storage_key, model,
       prompt_version, original_result_json, verified_result_json, correction_count,
       status, reviewed_by, reviewed_at, created_at)
      VALUES (?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'verified', ?, ?, ?)`)
      .bind(
        'airun-demo-draft-westline',
        'int-001',
        null,
        'doc-demo-draft-westline',
        '01_Draft_Professional_Services_Agreement.pdf',
        'public:/demo-documents/01_Draft_Professional_Services_Agreement.pdf',
        'deepseek-chat',
        'contract-analysis-v3',
        JSON.stringify(demoDraftAnalysis),
        JSON.stringify(demoDraftAnalysis),
        'Selina Armstrong',
        now,
        now,
      ),
    db
      .prepare(`INSERT OR IGNORE INTO documents
      (id, supplier_id, contract_id, file_name, file_type, lifecycle_stage, storage_key, mime_type, page_count, review_status, ai_status, uploaded_at)
      VALUES (?, ?, ?, ?, ?, 'executed', ?, 'application/pdf', 4, 'approved', 'verified', ?)`)
      .bind(
        'doc-demo-contract-harbor',
        'sup-harbor',
        'con-001',
        '03_Executed_Technology_Support_Services_Agreement.pdf',
        'executed_agreement',
        'public:/demo-documents/03_Executed_Technology_Support_Services_Agreement.pdf',
        now,
      ),
    ...supplierProfileSeed.map((row) =>
      db
        .prepare(`UPDATE suppliers SET
        vendor_number = COALESCE(vendor_number, ?), address_line1 = COALESCE(address_line1, ?),
        address_line2 = COALESCE(address_line2, ?), city = COALESCE(city, ?), state = COALESCE(state, ?),
        postal_code = COALESCE(postal_code, ?), country = COALESCE(country, ?), phone = COALESCE(phone, ?),
        website = COALESCE(website, ?), tax_classification = COALESCE(tax_classification, ?),
        risk_tier = COALESCE(risk_tier, ?), qualification_status = COALESCE(qualification_status, ?),
        qualification_review_date = COALESCE(qualification_review_date, ?)
        WHERE id = ?`)
        .bind(...row.slice(1), row[0]),
    ),
    ...contractTermsSeed.map((row) =>
      db
        .prepare(
          `UPDATE contracts SET payment_terms = COALESCE(payment_terms, ?), governing_law = COALESCE(governing_law, ?) WHERE id = ?`,
        )
        .bind(row[1], row[2], row[0]),
    ),
    db
      .prepare(`INSERT OR IGNORE INTO documents
      (id, supplier_id, file_name, file_type, lifecycle_stage, storage_key, mime_type, page_count, issuer, document_number, review_status, ai_status, uploaded_at)
      VALUES (?, ?, ?, 'w9', 'supplier_record', ?, 'application/pdf', 1, 'Internal Revenue Service', 'W-9 (03/2024)', 'approved', 'verified', ?)`)
      .bind(
        'doc-demo-w9-harbor',
        'sup-harbor',
        '04_Harbor_Technology_Demo_W9.pdf',
        'public:/demo-documents/04_Harbor_Technology_Demo_W9.pdf',
        now,
      ),
    db
      .prepare(`INSERT OR IGNORE INTO documents
      (id, supplier_id, file_name, file_type, lifecycle_stage, storage_key, mime_type, page_count, issuer, document_number, expiration_date, review_status, ai_status, uploaded_at)
      VALUES (?, ?, ?, 'insurance_certificate', 'supplier_record', ?, 'application/pdf', 1, 'Bayview Risk Services (fictional)', 'COI-DEMO-2026-1005', '2027-01-31', 'approved', 'verified', ?)`)
      .bind(
        'doc-demo-coi-harbor',
        'sup-harbor',
        '05_Harbor_Technology_Demo_Insurance_Certificate.pdf',
        'public:/demo-documents/05_Harbor_Technology_Demo_Insurance_Certificate.pdf',
        now,
      ),
    ...[
      [
        'doc-demo-license-harbor',
        'sup-harbor',
        '06_Harbor_Technology_Demo_Business_License.pdf',
        'business_license',
        'public:/demo-documents/06_Harbor_Technology_Demo_Business_License.pdf',
        'City and County Business Tax Office (fictional)',
        'BL-DEMO-2026-0148',
        '2026-12-31',
      ],
      [
        'doc-demo-standing-harbor',
        'sup-harbor',
        '07_Harbor_Technology_Demo_Good_Standing_Record.pdf',
        'good_standing',
        'public:/demo-documents/07_Harbor_Technology_Demo_Good_Standing_Record.pdf',
        'California Secretary of State verification (fictional)',
        'C-DEMO-482019',
        null,
      ],
      [
        'doc-demo-cyber-harbor',
        'sup-harbor',
        '08_Harbor_Technology_Demo_Cybersecurity_Assessment.pdf',
        'cybersecurity_assessment',
        'public:/demo-documents/08_Harbor_Technology_Demo_Cybersecurity_Assessment.pdf',
        'Northstar Information Security (fictional)',
        'SEC-DEMO-2026-1005',
        '2027-01-19',
      ],
      [
        'doc-demo-sam-harbor',
        'sup-harbor',
        '09_Harbor_Technology_Demo_SAM_Exclusion_Screening.pdf',
        'sanctions_debarment_check',
        'public:/demo-documents/09_Harbor_Technology_Demo_SAM_Exclusion_Screening.pdf',
        'Northstar Procurement (fictional)',
        'SAM-DEMO-2026-1005',
        null,
      ],
      [
        'doc-demo-license-westline',
        'sup-westline',
        '10_Westline_Engineering_Demo_Professional_License.pdf',
        'professional_license',
        'public:/demo-documents/10_Westline_Engineering_Demo_Professional_License.pdf',
        'California licensing authority (fictional)',
        'PEF-DEMO-28417',
        '2027-10-10',
      ],
    ].map((row) =>
      db
        .prepare(`INSERT OR IGNORE INTO documents
      (id, supplier_id, file_name, file_type, lifecycle_stage, storage_key, mime_type, page_count, issuer, document_number, expiration_date, review_status, ai_status, uploaded_at)
      VALUES (?, ?, ?, ?, 'supplier_record', ?, 'application/pdf', 1, ?, ?, ?, 'approved', 'verified', ?)`)
        .bind(...row, now),
    ),
  ]);
  await syncObligationDemoScenario(db);
  await syncApprovalDemoScenario(db);
  await seedBulkImportDemo(db, now);
}

async function syncObligationDemoScenario(db: D1Database) {
  await db.batch([
    db.prepare(`UPDATE key_dates SET
      backup_owner = COALESCE(backup_owner, 'Jordan Ellis'),
      priority = CASE WHEN type IN ('non_renewal_notice', 'expiration')
        THEN 'high' ELSE COALESCE(priority, 'medium') END,
      assigned_at = COALESCE(assigned_at, created_at),
      updated_at = CASE WHEN updated_at = '2026-01-01T00:00:00.000Z'
        THEN COALESCE(assigned_at, created_at) ELSE updated_at END
      WHERE id IN ('date-001', 'date-002', 'date-003')`),
    db
      .prepare(`INSERT OR IGNORE INTO key_dates
      (id, contract_id, supplier_id, type, title, due_date,
       internal_review_date, status, owner, backup_owner, priority, assigned_at,
       completed_at, completed_by, completion_note, evidence_reference,
       source_clause, source_page, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'completed', ?, ?, 'medium', ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(
        'date-004',
        'con-001',
        'sup-harbor',
        'service_review',
        'Quarterly service review sign-off',
        '2026-08-15',
        '2026-08-08',
        'Selina Armstrong',
        'Jordan Ellis',
        '2026-08-01T17:00:00.000Z',
        '2026-08-14T21:00:00.000Z',
        'Selina Armstrong',
        'Reviewed the fictional Q3 service summary and confirmed that all follow-up items were closed.',
        'Closeout record CL-DEMO-2026-014',
        'Customer and Supplier will review service levels quarterly.',
        6,
        '2026-08-01T16:00:00.000Z',
        '2026-08-14T21:00:00.000Z',
      ),
    db
      .prepare(`INSERT OR IGNORE INTO key_dates
      (id, contract_id, supplier_id, type, title, due_date,
       internal_review_date, status, owner, backup_owner, priority, assigned_at,
       source_clause, source_page, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'evidence_required', ?, ?, 'critical', ?, ?, ?, ?, ?)`)
      .bind(
        'date-005',
        'con-001',
        'sup-harbor',
        'service_report',
        'Monthly service report evidence',
        '2026-08-28',
        '2026-08-25',
        'Selina Armstrong',
        'Jordan Ellis',
        '2026-08-20T17:00:00.000Z',
        'Supplier will provide a monthly service performance report.',
        6,
        '2026-08-20T16:00:00.000Z',
        '2026-08-29T17:00:00.000Z',
      ),
    db
      .prepare(`INSERT OR IGNORE INTO obligation_events
      (id, key_date_id, event_type, from_status, to_status, actor, note,
       metadata_json, created_at)
      VALUES (?, ?, 'status_changed', 'evidence_required', 'completed', ?, ?, '{}', ?)`)
      .bind(
        'obligation-event-demo-completed',
        'date-004',
        'Selina Armstrong',
        'Completed with closeout reference CL-DEMO-2026-014.',
        '2026-08-14T21:00:00.000Z',
      ),
    db
      .prepare(`INSERT OR IGNORE INTO obligation_events
      (id, key_date_id, event_type, from_status, to_status, actor, note,
       metadata_json, created_at)
      VALUES (?, ?, 'status_changed', 'in_progress', 'evidence_required', ?, ?, '{}', ?)`)
      .bind(
        'obligation-event-demo-evidence-required',
        'date-005',
        'Selina Armstrong',
        'Report received; supporting review evidence is still required.',
        '2026-08-29T17:00:00.000Z',
      ),
  ]);
}

async function syncApprovalRules(db: D1Database) {
  await db.batch(
    APPROVAL_RULES_V1.map((rule) =>
      db
        .prepare(`INSERT OR IGNORE INTO approval_rules
          (id, rule_key, version, name, description, trigger_type,
           trigger_config_json, owner_role, due_days, mandatory, active, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(
          rule.id,
          rule.ruleKey,
          rule.version,
          rule.name,
          rule.description,
          rule.triggerType,
          JSON.stringify(rule.triggerConfig),
          rule.ownerRole,
          rule.dueDays,
          rule.mandatory ? 1 : 0,
          rule.active ? 1 : 0,
          '2026-09-01T00:00:00.000Z',
        ),
    ),
  );
}

async function syncApprovalDemoScenario(db: D1Database) {
  await syncApprovalRules(db);
  const generatedAt = '2026-08-29T16:00:00.000Z';
  const scenarios = [
    {
      suffix: 'renewal',
      ruleKey: 'automatic_renewal_control',
      status: 'pending',
      reason:
        'The verified agreement renews automatically and requires an accountable owner decision.',
      sourceFindingId: null,
      sourcePage: 7,
      sourceQuote: 'automatically renew for successive one-year terms',
      assignedReviewer: null,
    },
    {
      suffix: 'finance',
      ruleKey: 'financial_value_threshold',
      status: 'pending',
      reason:
        'Verified value $585,000 exceeds the $500,000 approval threshold.',
      sourceFindingId: null,
      sourcePage: 3,
      sourceQuote: 'not-to-exceed amount of $585,000',
      assignedReviewer: null,
    },
    {
      suffix: 'supplier-risk',
      ruleKey: 'high_risk_supplier',
      status: 'pending',
      reason: 'Supplier risk tier is high; enhanced due diligence is required.',
      sourceFindingId: null,
      sourcePage: null,
      sourceQuote: null,
      assignedReviewer: null,
    },
    {
      suffix: 'law',
      ruleKey: 'non_california_governing_law',
      status: 'in_review',
      reason:
        'Verified governing law is New York; the playbook position is California.',
      sourceFindingId: 'finding-002',
      sourcePage: 9,
      sourceQuote: 'laws of the State of New York',
      assignedReviewer: 'Selina Armstrong',
    },
  ] as const;
  const rules = new Map(APPROVAL_RULES_V1.map((rule) => [rule.ruleKey, rule]));
  const statements: D1PreparedStatement[] = [];
  for (const scenario of scenarios) {
    const rule = rules.get(scenario.ruleKey);
    if (!rule) continue;
    const requestId = `approval-demo-int-001-${scenario.suffix}`;
    const stepId = `approval-step-demo-int-001-${scenario.suffix}`;
    const dueAt = addApprovalDueDays(generatedAt, rule.dueDays);
    statements.push(
      db
        .prepare(`INSERT OR IGNORE INTO approval_requests
          (id, intake_id, rule_id, source_finding_id, source_document_id,
           status, reason, rule_snapshot_json, generated_at, due_at, updated_at)
          VALUES (?, 'int-001', ?, ?, 'doc-demo-draft-westline', ?, ?, ?, ?, ?, ?)`)
        .bind(
          requestId,
          rule.id,
          scenario.sourceFindingId,
          scenario.status,
          scenario.reason,
          JSON.stringify(rule),
          generatedAt,
          dueAt,
          generatedAt,
        ),
      db
        .prepare(`INSERT OR IGNORE INTO approval_steps
          (id, request_id, sequence, owner_role, assigned_reviewer, status,
           due_at, started_at, source_page, source_quote)
          VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(
          stepId,
          requestId,
          rule.ownerRole,
          scenario.assignedReviewer,
          scenario.status,
          dueAt,
          scenario.status === 'in_review' ? generatedAt : null,
          scenario.sourcePage,
          scenario.sourceQuote,
        ),
      db
        .prepare(`INSERT OR IGNORE INTO approval_decision_history
          (id, request_id, step_id, action, from_status, to_status,
           actor, actor_role, reason, created_at)
          VALUES (?, ?, ?, 'generated', 'pending', 'pending',
            'Rules engine', 'System', ?, ?)`)
        .bind(
          `approval-history-demo-int-001-${scenario.suffix}-generated`,
          requestId,
          stepId,
          scenario.reason,
          generatedAt,
        ),
    );
    if (scenario.status === 'in_review') {
      statements.push(
        db
          .prepare(`INSERT OR IGNORE INTO approval_decision_history
            (id, request_id, step_id, action, from_status, to_status,
             actor, actor_role, reason, created_at)
            VALUES (?, ?, ?, 'start_review', 'pending', 'in_review',
              'Selina Armstrong', ?, 'Legal review accepted for decision.', ?)`)
          .bind(
            `approval-history-demo-int-001-${scenario.suffix}-started`,
            requestId,
            stepId,
            rule.ownerRole,
            '2026-08-30T17:00:00.000Z',
          ),
      );
    }
  }
  statements.push(
    db.prepare(`UPDATE contract_intakes SET approval_status = 'pending'
      WHERE id = 'int-001' AND approval_status != 'approved'`),
  );
  const completedRule = rules.get('high_risk_supplier');
  if (completedRule) {
    const completedRequestId = 'approval-demo-int-003-supplier-risk';
    const completedStepId = 'approval-step-demo-int-003-supplier-risk';
    const completedGeneratedAt = '2026-08-27T15:00:00.000Z';
    const completedAt = '2026-08-28T17:00:00.000Z';
    statements.push(
      db
        .prepare(`INSERT OR IGNORE INTO approval_requests
          (id, intake_id, rule_id, status, reason, rule_snapshot_json,
           generated_at, due_at, updated_at, completed_at)
          VALUES (?, 'int-003', ?, 'approved', ?, ?, ?, ?, ?, ?)`)
        .bind(
          completedRequestId,
          completedRule.id,
          'Supplier risk tier is high; enhanced due diligence is required.',
          JSON.stringify(completedRule),
          completedGeneratedAt,
          addApprovalDueDays(completedGeneratedAt, completedRule.dueDays),
          completedAt,
          completedAt,
        ),
      db
        .prepare(`INSERT OR IGNORE INTO approval_steps
          (id, request_id, sequence, owner_role, assigned_reviewer, status,
           due_at, started_at, decided_at, decision_reason)
          VALUES (?, ?, 1, ?, 'Morgan Lee', 'approved', ?, ?, ?, ?)`)
        .bind(
          completedStepId,
          completedRequestId,
          completedRule.ownerRole,
          addApprovalDueDays(completedGeneratedAt, completedRule.dueDays),
          '2026-08-27T18:00:00.000Z',
          completedAt,
          'Enhanced due-diligence package reviewed; qualification evidence is sufficient for this fictional transaction.',
        ),
      db
        .prepare(`INSERT OR IGNORE INTO approval_decision_history
          (id, request_id, step_id, action, from_status, to_status,
           actor, actor_role, reason, created_at)
          VALUES (?, ?, ?, 'generated', 'pending', 'pending',
            'Rules engine', 'System', ?, ?)`)
        .bind(
          'approval-history-demo-int-003-generated',
          completedRequestId,
          completedStepId,
          'Supplier risk tier is high; enhanced due diligence is required.',
          completedGeneratedAt,
        ),
      db
        .prepare(`INSERT OR IGNORE INTO approval_decision_history
          (id, request_id, step_id, action, from_status, to_status,
           actor, actor_role, reason, created_at)
          VALUES (?, ?, ?, 'start_review', 'pending', 'in_review',
            'Morgan Lee', ?, 'Assigned for enhanced due-diligence review.', ?)`)
        .bind(
          'approval-history-demo-int-003-started',
          completedRequestId,
          completedStepId,
          completedRule.ownerRole,
          '2026-08-27T18:00:00.000Z',
        ),
      db
        .prepare(`INSERT OR IGNORE INTO approval_decision_history
          (id, request_id, step_id, action, from_status, to_status,
           actor, actor_role, reason, created_at)
          VALUES (?, ?, ?, 'approve', 'in_review', 'approved',
            'Morgan Lee', ?, ?, ?)`)
        .bind(
          'approval-history-demo-int-003-approved',
          completedRequestId,
          completedStepId,
          completedRule.ownerRole,
          'Enhanced due-diligence package reviewed; qualification evidence is sufficient for this fictional transaction.',
          completedAt,
        ),
      db.prepare(`UPDATE contract_intakes SET approval_status = 'approved'
        WHERE id = 'int-003'`),
    );
  }
  await db.batch(statements);
}

async function seedBulkImportDemo(db: D1Database, now: string) {
  const batchId = 'import-demo-supplier-migration';
  const headers = [
    'Vendor Name',
    'Vendor ID',
    'Commodity',
    'Status',
    'State',
    'Risk',
    'W-9',
    'Insurance',
    'Insurance Expiry',
  ];
  const mapping = {
    legal_name: 'Vendor Name',
    vendor_number: 'Vendor ID',
    category: 'Commodity',
    status: 'Status',
    state: 'State',
    risk_tier: 'Risk',
    w9_status: 'W-9',
    insurance_status: 'Insurance',
    insurance_expiration: 'Insurance Expiry',
  };
  const rows = [
    {
      id: 'import-row-demo-ready',
      rowNumber: 2,
      raw: {
        'Vendor Name': 'Cascade Office Products LLC',
        'Vendor ID': 'VND-LEG-101',
        Commodity: 'Office Supplies',
        Status: 'Active',
        State: 'Oregon',
        Risk: 'Low',
        'W-9': 'Received',
        Insurance: 'Current',
        'Insurance Expiry': '12/31/2027',
      },
      normalized: {
        legal_name: 'Cascade Office Products LLC',
        normalized_name: 'cascade office products',
        vendor_number: 'VND-LEG-101',
        category: 'Office Supplies',
        status: 'active',
        state: 'OR',
        risk_tier: 'low',
        w9_status: 'received',
        insurance_status: 'current',
        insurance_expiration: '2027-12-31',
      },
      status: 'ready',
      issues: [],
      duplicateRecordId: null,
      duplicateType: null,
    },
    {
      id: 'import-row-demo-warning',
      rowNumber: 3,
      raw: {
        'Vendor Name': 'Redwood Facilities Services West LLC',
        'Vendor ID': 'VND-LEG-102',
        Commodity: 'Facilities',
        Status: 'Active',
        State: 'California',
        Risk: 'Medium',
        'W-9': 'Missing',
        Insurance: 'Current',
        'Insurance Expiry': '11/15/2026',
      },
      normalized: {
        legal_name: 'Redwood Facilities Services West LLC',
        normalized_name: 'redwood facilities services west',
        vendor_number: 'VND-LEG-102',
        category: 'Facilities',
        status: 'active',
        state: 'CA',
        risk_tier: 'medium',
        w9_status: 'missing',
        insurance_status: 'current',
        insurance_expiration: '2026-11-15',
      },
      status: 'warning',
      issues: [
        {
          code: 'possible_match',
          severity: 'warning',
          message:
            'Possible supplier match: Redwood Facilities Services LLC. Review before accepting.',
        },
      ],
      duplicateRecordId: 'sup-redwood',
      duplicateType: 'possible',
    },
    {
      id: 'import-row-demo-duplicate',
      rowNumber: 4,
      raw: {
        'Vendor Name': 'Apex Equipment LLC',
        'Vendor ID': 'VND-1001',
        Commodity: 'Industrial Equipment',
        Status: 'Active',
        State: 'California',
        Risk: 'Medium',
        'W-9': 'Received',
        Insurance: 'Current',
        'Insurance Expiry': '02/15/2027',
      },
      normalized: {
        legal_name: 'Apex Equipment LLC',
        normalized_name: 'apex equipment',
        vendor_number: 'VND-1001',
        category: 'Industrial Equipment',
        status: 'active',
        state: 'CA',
        risk_tier: 'medium',
        w9_status: 'received',
        insurance_status: 'current',
        insurance_expiration: '2027-02-15',
      },
      status: 'duplicate',
      issues: [
        {
          code: 'exact_duplicate',
          severity: 'warning',
          message: 'Exact supplier duplicate: Apex Equipment LLC.',
        },
      ],
      duplicateRecordId: 'sup-apex',
      duplicateType: 'exact',
    },
    {
      id: 'import-row-demo-invalid',
      rowNumber: 5,
      raw: {
        'Vendor Name': '',
        'Vendor ID': 'VND-LEG-104',
        Commodity: '=HYPERLINK("unsafe")',
        Status: 'Enabled',
        State: 'California',
        Risk: 'Low',
        'W-9': 'Missing',
        Insurance: 'Missing',
        'Insurance Expiry': '',
      },
      normalized: {
        legal_name: '',
        normalized_name: '',
        vendor_number: 'VND-LEG-104',
        category: '=HYPERLINK("unsafe")',
        status: null,
        state: 'CA',
        risk_tier: 'low',
        w9_status: 'missing',
        insurance_status: 'missing',
        insurance_expiration: null,
      },
      status: 'invalid',
      issues: [
        {
          code: 'required',
          severity: 'error',
          message: 'Supplier Legal Name is required.',
        },
        {
          code: 'invalid_status',
          severity: 'error',
          message: 'Unsupported supplier status: Enabled.',
        },
        {
          code: 'formula_injection',
          severity: 'error',
          message: 'Commodity begins with a spreadsheet formula character.',
        },
      ],
      duplicateRecordId: null,
      duplicateType: null,
    },
  ] as const;
  await db.batch([
    db
      .prepare(`INSERT OR IGNORE INTO import_batches
        (id, entity_type, file_name, file_type, file_size_bytes, source_hash,
         status, headers_json, mapping_json, mapping_version, total_rows,
         ready_rows, warning_rows, duplicate_rows, invalid_rows, accepted_rows,
         rejected_rows, normalization_issue_count, started_by, created_at)
        VALUES (?, 'suppliers', 'fictional_legacy_supplier_master.csv', 'csv',
          892, 'fictional-supplier-import-fixture-2026-1', 'preview', ?, ?,
          '2026.1', 4, 1, 1, 1, 1, 0, 0, 4, 'Selina Armstrong', ?)`)
      .bind(batchId, JSON.stringify(headers), JSON.stringify(mapping), now),
    ...rows.map((row) =>
      db
        .prepare(`INSERT OR IGNORE INTO import_rows
          (id, batch_id, row_number, raw_data_json, normalized_data_json,
           status, decision, issues_json, duplicate_record_id, duplicate_type)
          VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`)
        .bind(
          row.id,
          batchId,
          row.rowNumber,
          JSON.stringify(row.raw),
          JSON.stringify(row.normalized),
          row.status,
          JSON.stringify(row.issues),
          row.duplicateRecordId,
          row.duplicateType,
        ),
    ),
    db
      .prepare(`INSERT OR IGNORE INTO audit_logs
        (id, entity_type, entity_id, action, actor, details, created_at)
        VALUES ('audit-import-demo-preview', 'import_batch', ?,
          'import_preview_created', 'Selina Armstrong', ?, ?)`)
      .bind(
        batchId,
        JSON.stringify({
          target: 'suppliers',
          fileName: 'fictional_legacy_supplier_master.csv',
          total: 4,
          ready: 1,
          warning: 1,
          duplicate: 1,
          invalid: 1,
        }),
        now,
      ),
  ]);
}

async function ensureTableColumns(
  db: D1Database,
  table: string,
  additions: ReadonlyArray<readonly [string, string]>,
) {
  const info = await db
    .prepare(`PRAGMA table_info(${table})`)
    .all<{ name: string }>();
  const columns = new Set(info.results.map((column) => column.name));
  for (const [name, type] of additions) {
    if (columns.has(name)) continue;
    try {
      await db.prepare(`ALTER TABLE ${table} ADD COLUMN ${name} ${type}`).run();
    } catch (error) {
      if (
        !(error instanceof Error) ||
        !error.message.toLowerCase().includes('duplicate column name')
      ) {
        throw error;
      }
    }
  }
}

async function ensureWorkspaceColumns(db: D1Database) {
  await ensureTableColumns(db, 'contract_intakes', [
    ['owner', 'TEXT'],
    ['target_review_date', 'TEXT'],
    ['internal_notes', 'TEXT'],
    ['approval_status', "TEXT DEFAULT 'not_required' NOT NULL"],
  ]);
  await ensureTableColumns(db, 'review_findings', [
    ['suggested_revision', 'TEXT'],
  ]);
  await ensureTableColumns(db, 'key_dates', [
    ['owner', 'TEXT'],
    ['backup_owner', 'TEXT'],
    ['priority', "TEXT DEFAULT 'medium' NOT NULL"],
    ['material', 'INTEGER DEFAULT 1 NOT NULL'],
    ['assigned_at', 'TEXT'],
    ['completed_at', 'TEXT'],
    ['completed_by', 'TEXT'],
    ['completion_note', 'TEXT'],
    ['evidence_document_id', 'TEXT'],
    ['evidence_reference', 'TEXT'],
    ['escalation_level', 'INTEGER DEFAULT 0 NOT NULL'],
    ['escalated_at', 'TEXT'],
    ['decision', 'TEXT'],
    ['notes', 'TEXT'],
    ['source_document_id', 'TEXT'],
    ['created_at', "TEXT DEFAULT '2026-01-01T00:00:00.000Z' NOT NULL"],
    ['updated_at', "TEXT DEFAULT '2026-01-01T00:00:00.000Z' NOT NULL"],
  ]);
  await ensureTableColumns(db, 'contracts', [
    ['payment_terms', 'TEXT'],
    ['governing_law', 'TEXT'],
  ]);
  await ensureTableColumns(db, 'suppliers', [
    ['vendor_number', 'TEXT'],
    ['phone', 'TEXT'],
    ['website', 'TEXT'],
    ['address_line1', 'TEXT'],
    ['address_line2', 'TEXT'],
    ['city', 'TEXT'],
    ['state', 'TEXT'],
    ['postal_code', 'TEXT'],
    ['country', 'TEXT'],
    ['tax_classification', 'TEXT'],
    ['risk_tier', 'TEXT'],
    ['qualification_status', 'TEXT'],
    ['qualification_review_date', 'TEXT'],
  ]);
  await ensureTableColumns(db, 'documents', [
    ['issuer', 'TEXT'],
    ['document_number', 'TEXT'],
    ['effective_date', 'TEXT'],
    ['expiration_date', 'TEXT'],
    ['coverage_summary', 'TEXT'],
    ['review_status', 'TEXT'],
  ]);
  await ensureTableColumns(db, 'amendments', [
    ['amendment_type', "TEXT DEFAULT 'amendment' NOT NULL"],
    ['version_number', 'INTEGER DEFAULT 1 NOT NULL'],
    ['version_status', "TEXT DEFAULT 'current' NOT NULL"],
    ['effective_date', 'TEXT'],
    ['previous_value_cents', 'INTEGER DEFAULT 0 NOT NULL'],
    ['resulting_value_cents', 'INTEGER DEFAULT 0 NOT NULL'],
    ['previous_expiration_date', 'TEXT'],
    ['previous_payment_terms', 'TEXT'],
    ['new_payment_terms', 'TEXT'],
    ['previous_renewal_type', 'TEXT'],
    ['new_renewal_type', 'TEXT'],
    ['previous_notice_days', 'INTEGER'],
    ['new_notice_days', 'INTEGER'],
    ['scope_summary', 'TEXT'],
    ['created_by', "TEXT DEFAULT 'System migration' NOT NULL"],
    ['created_at', "TEXT DEFAULT '2026-01-01T00:00:00.000Z' NOT NULL"],
  ]);
  await ensureTableColumns(db, 'ai_field_reviews', [
    ['override_reason', 'TEXT'],
  ]);
  await ensureTableColumns(db, 'ai_analysis_runs', [
    ['quality_report_json', 'TEXT'],
  ]);
  await ensureTableColumns(db, 'ai_evaluation_runs', [
    ['dataset_version', "TEXT DEFAULT 'legacy-3' NOT NULL"],
    ['fixture_version', "TEXT DEFAULT 'legacy' NOT NULL"],
    ['prompt_version', "TEXT DEFAULT 'legacy' NOT NULL"],
    ['extraction_version', "TEXT DEFAULT 'legacy' NOT NULL"],
    ['critical_fields', 'INTEGER DEFAULT 0 NOT NULL'],
    ['correct_critical_fields', 'INTEGER DEFAULT 0 NOT NULL'],
    ['critical_accuracy_percent', 'REAL DEFAULT 0 NOT NULL'],
    ['unsupported_fields', 'INTEGER DEFAULT 0 NOT NULL'],
    ['unsupported_value_percent', 'REAL DEFAULT 0 NOT NULL'],
    ['successful_cases', 'INTEGER DEFAULT 0 NOT NULL'],
    ['failed_cases', 'INTEGER DEFAULT 0 NOT NULL'],
    ['processing_success_percent', 'REAL DEFAULT 0 NOT NULL'],
    ['median_duration_ms', 'INTEGER DEFAULT 0 NOT NULL'],
    ['baseline_run_id', 'TEXT'],
    ['regression_delta', 'REAL'],
    ['regression_threshold', 'REAL DEFAULT -2 NOT NULL'],
    ['promotion_status', "TEXT DEFAULT 'baseline_required' NOT NULL"],
    ['is_approved_baseline', 'INTEGER DEFAULT 0 NOT NULL'],
  ]);
}

async function seedWorkspaceDatabase(db: D1Database, now: string) {
  const supplierStatements = suppliersSeed.map((row) =>
    db
      .prepare(`INSERT INTO suppliers
        (id, legal_name, normalized_name, category, status, primary_contact, email, w9_status, insurance_status, insurance_expiration, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(...row, now, now),
  );
  await db.batch(supplierStatements);

  const intakeStatements = intakeSeed.map((row) =>
    db
      .prepare(`INSERT INTO contract_intakes
        (id, intake_number, supplier_id, proposed_supplier_name, title, contract_type, proposed_value_cents, status, review_status, received_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(...row, now),
  );
  await db.batch(intakeStatements);

  const contractStatements = contractsSeed.map((row) =>
    db
      .prepare(`INSERT INTO contracts
        (id, contract_number, supplier_id, title, contract_type, department, owner, original_value_cents, amendment_value_cents, current_value_cents, effective_date, expiration_date, renewal_type, notice_days, notice_deadline, status, last_updated)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(...row, now),
  );
  await db.batch(contractStatements);

  await db.batch([
    db
      .prepare(`INSERT INTO key_dates
      (id, contract_id, supplier_id, type, title, due_date,
       internal_review_date, status, owner, backup_owner, priority, assigned_at,
       decision, source_clause, source_page, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(
        'date-001',
        'con-001',
        'sup-harbor',
        'non_renewal_notice',
        'Non-renewal notice deadline',
        '2026-11-01',
        '2026-10-01',
        'upcoming',
        'Selina Armstrong',
        'Jordan Ellis',
        'high',
        '2026-08-20T16:00:00.000Z',
        'under_review',
        'Either party may provide written notice at least sixty (60) days before expiration.',
        8,
        '2026-08-20T15:30:00.000Z',
        '2026-08-20T16:00:00.000Z',
      ),
    db
      .prepare(`INSERT INTO key_dates
      (id, contract_id, supplier_id, type, title, due_date,
       internal_review_date, status, owner, backup_owner, priority, assigned_at,
       source_clause, source_page, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(
        'date-002',
        null,
        'sup-golden',
        'insurance_expiration',
        'Certificate of Insurance expires',
        '2026-09-23',
        '2026-09-09',
        'upcoming',
        'Selina Armstrong',
        'Morgan Lee',
        'high',
        '2026-08-25T17:00:00.000Z',
        'Certificate of Insurance',
        1,
        '2026-08-25T16:30:00.000Z',
        '2026-08-25T17:00:00.000Z',
      ),
    db
      .prepare(`INSERT INTO key_dates
      (id, contract_id, supplier_id, type, title, due_date,
       internal_review_date, status, owner, backup_owner, priority, assigned_at,
       source_clause, source_page, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(
        'date-003',
        'con-007',
        'sup-northbay',
        'expiration',
        'Contract expiration',
        '2026-09-30',
        '2026-09-01',
        'upcoming',
        'Selina Armstrong',
        'Jordan Ellis',
        'critical',
        '2026-08-01T17:00:00.000Z',
        'The term expires on September 30, 2026.',
        6,
        '2026-08-01T16:00:00.000Z',
        '2026-08-01T17:00:00.000Z',
      ),
    db
      .prepare(`INSERT INTO key_dates
      (id, contract_id, supplier_id, type, title, due_date,
       internal_review_date, status, owner, backup_owner, priority, assigned_at,
       completed_at, completed_by, completion_note, evidence_reference,
       source_clause, source_page, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'completed', ?, ?, 'medium', ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(
        'date-004',
        'con-001',
        'sup-harbor',
        'service_review',
        'Quarterly service review sign-off',
        '2026-08-15',
        '2026-08-08',
        'Selina Armstrong',
        'Jordan Ellis',
        '2026-08-01T17:00:00.000Z',
        '2026-08-14T21:00:00.000Z',
        'Selina Armstrong',
        'Reviewed the fictional Q3 service summary and confirmed that all follow-up items were closed.',
        'Closeout record CL-DEMO-2026-014',
        'Customer and Supplier will review service levels quarterly.',
        6,
        '2026-08-01T16:00:00.000Z',
        '2026-08-14T21:00:00.000Z',
      ),
    db
      .prepare(`INSERT INTO key_dates
      (id, contract_id, supplier_id, type, title, due_date,
       internal_review_date, status, owner, backup_owner, priority, assigned_at,
       source_clause, source_page, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'evidence_required', ?, ?, 'critical', ?, ?, ?, ?, ?)`)
      .bind(
        'date-005',
        'con-001',
        'sup-harbor',
        'service_report',
        'Monthly service report evidence',
        '2026-08-28',
        '2026-08-25',
        'Selina Armstrong',
        'Jordan Ellis',
        '2026-08-20T17:00:00.000Z',
        'Supplier will provide a monthly service performance report.',
        6,
        '2026-08-20T16:00:00.000Z',
        '2026-08-29T17:00:00.000Z',
      ),
    db
      .prepare(`INSERT INTO obligation_events
      (id, key_date_id, event_type, from_status, to_status, actor, note,
       metadata_json, created_at)
      VALUES (?, ?, 'status_changed', 'evidence_required', 'completed', ?, ?, '{}', ?)`)
      .bind(
        'obligation-event-demo-completed',
        'date-004',
        'Selina Armstrong',
        'Completed with closeout reference CL-DEMO-2026-014.',
        '2026-08-14T21:00:00.000Z',
      ),
    db
      .prepare(`INSERT INTO integration_outbox
      (id, event_type, aggregate_type, aggregate_id, payload_json, status,
       attempt_count, occurred_at)
      VALUES (?, 'obligation.completed', 'obligation', ?, ?, 'pending', 0, ?)`)
      .bind(
        'outbox-demo-obligation-completed',
        'date-004',
        JSON.stringify({
          version: 'integration-outbox-2026.1',
          actor: 'Selina Armstrong',
          occurredAt: '2026-08-14T21:00:00.000Z',
          contractId: 'con-001',
          supplierId: 'sup-harbor',
          status: 'completed',
        }),
        '2026-08-14T21:00:00.000Z',
      ),
    db
      .prepare(`INSERT INTO obligation_events
      (id, key_date_id, event_type, from_status, to_status, actor, note,
       metadata_json, created_at)
      VALUES (?, ?, 'status_changed', 'in_progress', 'evidence_required', ?, ?, '{}', ?)`)
      .bind(
        'obligation-event-demo-evidence-required',
        'date-005',
        'Selina Armstrong',
        'Report received; supporting review evidence is still required.',
        '2026-08-29T17:00:00.000Z',
      ),
    db
      .prepare(`INSERT INTO review_findings (id, intake_id, field, rule_name, standard_text, observed_text, severity, source_page, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(
        'finding-001',
        'int-001',
        'payment_terms',
        'Payment terms',
        'Net 30 preferred',
        'Net 60',
        'medium',
        5,
        'open',
      ),
    db
      .prepare(`INSERT INTO review_findings (id, intake_id, field, rule_name, standard_text, observed_text, severity, source_page, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(
        'finding-002',
        'int-001',
        'governing_law',
        'Governing law',
        'California preferred',
        'New York',
        'medium',
        12,
        'open',
      ),
  ]);

  await syncEnhancedDemoScenario(db, now);
  await db.prepare('PRAGMA optimize').run();
}

let workspaceInitialization: Promise<void> | undefined;

async function initializeWorkspaceDatabase() {
  const db = env.DB;
  if (!db) throw new Error('D1 database binding is unavailable.');

  const migrationTable = await db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations'",
    )
    .first<{ name: string }>();
  const version = migrationTable
    ? await db
        .prepare('SELECT MAX(version) AS version FROM schema_migrations')
        .first<{ version: number | null }>()
    : null;
  if ((version?.version ?? 0) >= CURRENT_SCHEMA_VERSION) return;

  const supplierTable = await db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'suppliers'",
    )
    .first<{ name: string }>();

  if (!supplierTable) {
    await db.batch(schemaStatements.map((statement) => db.prepare(statement)));
    await seedWorkspaceDatabase(db, isoNow());
  } else {
    await ensureWorkspaceColumns(db);
    await db.batch(
      runtimeMigrationStatements.map((statement) => db.prepare(statement)),
    );
    await syncEnhancedDemoScenario(db, isoNow());
  }

  await db
    .prepare(
      'INSERT OR REPLACE INTO schema_migrations (version, applied_at) VALUES (?, ?)',
    )
    .bind(CURRENT_SCHEMA_VERSION, isoNow())
    .run();
}

export async function ensureWorkspaceDatabase() {
  workspaceInitialization ??= initializeWorkspaceDatabase().catch((error) => {
    workspaceInitialization = undefined;
    throw error;
  });
  await workspaceInitialization;
}

export async function resetWorkspaceDatabase() {
  const db = env.DB;
  if (!db) throw new Error('D1 database binding is unavailable.');
  await db.batch(schemaStatements.map((statement) => db.prepare(statement)));
  await ensureWorkspaceColumns(db);
  for (const prefix of [
    'uploads/draft/',
    'uploads/executed/',
    'uploads/amendment/',
    'uploads/supplier-document/',
    'supplier-documents/',
    'obligation-evidence/',
  ]) {
    let cursor: string | undefined;
    do {
      const page = await env.FILES.list({ prefix, cursor });
      if (page.objects.length)
        await env.FILES.delete(page.objects.map((object) => object.key));
      cursor = page.truncated ? page.cursor : undefined;
    } while (cursor);
  }
  await db.batch(
    [
      'ai_evaluation_field_results',
      'ai_evaluation_case_results',
      'ai_field_reviews',
      'ai_analysis_runs',
      'ai_evaluation_runs',
      'audit_logs',
      'integration_outbox',
      'api_rate_limits',
      'approval_decision_history',
      'approval_steps',
      'approval_requests',
      'approval_rules',
      'import_rows',
      'import_batches',
      'review_findings',
      'obligation_events',
      'key_dates',
      'amendments',
      'documents',
      'contracts',
      'contract_intakes',
      'suppliers',
    ].map((table) => db.prepare(`DELETE FROM ${table}`)),
  );
  await seedWorkspaceDatabase(db, isoNow());
}
