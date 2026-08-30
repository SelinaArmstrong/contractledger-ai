import { env } from 'cloudflare:workers';

const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS suppliers (
    id TEXT PRIMARY KEY NOT NULL,
    legal_name TEXT NOT NULL,
    normalized_name TEXT NOT NULL,
    dba_name TEXT,
    category TEXT NOT NULL,
    status TEXT DEFAULT 'pending' NOT NULL,
    primary_contact TEXT,
    email TEXT,
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
    signed_date TEXT NOT NULL,
    value_change_cents INTEGER DEFAULT 0 NOT NULL,
    new_expiration_date TEXT,
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
    completed_at TEXT,
    decision TEXT,
    notes TEXT,
    source_clause TEXT,
    source_page INTEGER,
    FOREIGN KEY (contract_id) REFERENCES contracts(id),
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
  )`,
  `CREATE TABLE IF NOT EXISTS review_findings (
    id TEXT PRIMARY KEY NOT NULL,
    intake_id TEXT NOT NULL,
    field TEXT NOT NULL,
    rule_name TEXT NOT NULL,
    standard_text TEXT NOT NULL,
    observed_text TEXT NOT NULL,
    severity TEXT NOT NULL,
    source_page INTEGER,
    status TEXT DEFAULT 'open' NOT NULL,
    FOREIGN KEY (intake_id) REFERENCES contract_intakes(id)
  )`,
  `CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    action TEXT NOT NULL,
    actor TEXT NOT NULL,
    details TEXT,
    created_at TEXT NOT NULL
  )`,
  'CREATE UNIQUE INDEX IF NOT EXISTS idx_suppliers_normalized_name ON suppliers(normalized_name)',
  'CREATE INDEX IF NOT EXISTS idx_suppliers_status ON suppliers(status)',
  'CREATE INDEX IF NOT EXISTS idx_suppliers_insurance_expiration ON suppliers(insurance_expiration)',
  'CREATE UNIQUE INDEX IF NOT EXISTS idx_contract_intakes_number ON contract_intakes(intake_number)',
  'CREATE INDEX IF NOT EXISTS idx_contract_intakes_status ON contract_intakes(status)',
  'CREATE INDEX IF NOT EXISTS idx_contract_intakes_supplier_id ON contract_intakes(supplier_id)',
  'CREATE UNIQUE INDEX IF NOT EXISTS idx_contracts_number ON contracts(contract_number)',
  'CREATE INDEX IF NOT EXISTS idx_contracts_supplier_id ON contracts(supplier_id)',
  'CREATE INDEX IF NOT EXISTS idx_contracts_status_expiration ON contracts(status, expiration_date)',
  'CREATE INDEX IF NOT EXISTS idx_contracts_notice_deadline ON contracts(notice_deadline)',
  'CREATE INDEX IF NOT EXISTS idx_documents_contract_id ON documents(contract_id)',
  'CREATE INDEX IF NOT EXISTS idx_documents_intake_id ON documents(intake_id)',
  'CREATE INDEX IF NOT EXISTS idx_documents_supplier_id ON documents(supplier_id)',
  'CREATE INDEX IF NOT EXISTS idx_amendments_contract_id ON amendments(contract_id)',
  'CREATE INDEX IF NOT EXISTS idx_key_dates_due_status ON key_dates(due_date, status)',
  'CREATE INDEX IF NOT EXISTS idx_key_dates_contract_id ON key_dates(contract_id)',
  'CREATE INDEX IF NOT EXISTS idx_review_findings_intake_id ON review_findings(intake_id)',
  'CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id)',
];

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
    'sup-westline',
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
    'sup-apex',
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
        `UPDATE contract_intakes SET proposed_supplier_name = ?, title = ?, proposed_value_cents = ?, updated_at = ? WHERE id = ?`,
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
      .prepare(`INSERT OR IGNORE INTO documents
      (id, supplier_id, contract_id, file_name, file_type, lifecycle_stage, storage_key, mime_type, page_count, ai_status, uploaded_at)
      VALUES (?, ?, ?, ?, ?, 'executed', ?, 'application/pdf', 4, 'verified', ?)`)
      .bind(
        'doc-demo-contract-harbor',
        'sup-harbor',
        'con-001',
        '03_Executed_Technology_Support_Services_Agreement.pdf',
        'executed_agreement',
        'public:/demo-documents/03_Executed_Technology_Support_Services_Agreement.pdf',
        now,
      ),
    db
      .prepare(`INSERT OR IGNORE INTO documents
      (id, supplier_id, file_name, file_type, lifecycle_stage, storage_key, mime_type, page_count, ai_status, uploaded_at)
      VALUES (?, ?, ?, 'w9', 'supplier_record', ?, 'application/pdf', 1, 'verified', ?)`)
      .bind(
        'doc-demo-w9-harbor',
        'sup-harbor',
        '04_Harbor_Technology_Demo_W9.pdf',
        'public:/demo-documents/04_Harbor_Technology_Demo_W9.pdf',
        now,
      ),
    db
      .prepare(`INSERT OR IGNORE INTO documents
      (id, supplier_id, file_name, file_type, lifecycle_stage, storage_key, mime_type, page_count, ai_status, uploaded_at)
      VALUES (?, ?, ?, 'insurance_certificate', 'supplier_record', ?, 'application/pdf', 1, 'verified', ?)`)
      .bind(
        'doc-demo-coi-harbor',
        'sup-harbor',
        '05_Harbor_Technology_Demo_Insurance_Certificate.pdf',
        'public:/demo-documents/05_Harbor_Technology_Demo_Insurance_Certificate.pdf',
        now,
      ),
  ]);
}

async function ensureKeyDateColumns(db: D1Database) {
  const info = await db
    .prepare('PRAGMA table_info(key_dates)')
    .all<{ name: string }>();
  const columns = new Set(info.results.map((column) => column.name));
  const additions = [
    ['owner', 'TEXT'],
    ['completed_at', 'TEXT'],
    ['decision', 'TEXT'],
    ['notes', 'TEXT'],
  ] as const;
  for (const [name, type] of additions) {
    if (!columns.has(name))
      await db
        .prepare(`ALTER TABLE key_dates ADD COLUMN ${name} ${type}`)
        .run();
  }
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
      .prepare(`INSERT INTO key_dates (id, contract_id, supplier_id, type, title, due_date, internal_review_date, status, owner, decision, source_clause, source_page)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
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
        'under_review',
        'Either party may provide written notice at least sixty (60) days before expiration.',
        8,
      ),
    db
      .prepare(`INSERT INTO key_dates (id, contract_id, supplier_id, type, title, due_date, internal_review_date, status, owner, source_clause, source_page)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
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
        'Certificate of Insurance',
        1,
      ),
    db
      .prepare(`INSERT INTO key_dates (id, contract_id, supplier_id, type, title, due_date, internal_review_date, status, owner, source_clause, source_page)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
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
        'The term expires on September 30, 2026.',
        6,
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

export async function ensureWorkspaceDatabase() {
  const db = env.DB;
  if (!db) throw new Error('D1 database binding is unavailable.');

  await db.batch(schemaStatements.map((statement) => db.prepare(statement)));
  await ensureKeyDateColumns(db);

  const supplierCount = await db
    .prepare('SELECT COUNT(*) AS count FROM suppliers')
    .first<{ count: number }>();
  if ((supplierCount?.count ?? 0) > 0) {
    await syncEnhancedDemoScenario(db, isoNow());
    return;
  }

  await seedWorkspaceDatabase(db, isoNow());
}

export async function resetWorkspaceDatabase() {
  const db = env.DB;
  if (!db) throw new Error('D1 database binding is unavailable.');
  await db.batch(schemaStatements.map((statement) => db.prepare(statement)));
  await ensureKeyDateColumns(db);
  for (const prefix of [
    'uploads/draft/',
    'uploads/executed/',
    'supplier-documents/',
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
      'audit_logs',
      'review_findings',
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
