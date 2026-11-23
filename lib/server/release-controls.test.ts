import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import type {
  ContractAnalysis,
  RecordDetails,
  Workspace,
} from '@/lib/contract-ledger-types';
import {
  buildRegisterWorkbook,
  type RegisterExportData,
} from '@/lib/export-registers';
import type {
  RegisterDetail,
  RegisterOptions,
  RegisterPage,
} from '@/lib/registers';
import { roleCanApproveStep, type WorkspaceRole } from '@/lib/workspace-roles';

vi.mock('cloudflare:workers', () => ({ env: {} }));
const { env } = await import('cloudflare:workers');
const { ensureWorkspaceDatabase, resetWorkspaceDatabase } =
  await import('@/db/bootstrap');
const workspaceRoute = await import('@/app/api/workspace/route');
const intakesRoute = await import('@/app/api/intakes/route');
const approvalsRoute = await import('@/app/api/approvals/route');
const supplierRoute = await import('@/app/api/supplier-documents/route');
const documentRoute = await import('@/app/api/document/route');
const recordDetailsRoute = await import('@/app/api/record-details/route');
const registerRoute = await import('@/app/api/registers/route');
const registerExportRoute = await import('@/app/api/exports/registers/route');
const { createDemoSessionToken } = await import('@/lib/workspace-auth');

// Real SQLite statements and atomic batches, with only platform bindings
// adapted. Tests exercise route validation, authorization, SQL and audit writes.
const sqlite = new DatabaseSync(':memory:');
sqlite.exec('PRAGMA foreign_keys = ON');
class Statement {
  constructor(
    readonly database: DatabaseSync,
    readonly sql: string,
    readonly values: SQLInputValue[] = [],
  ) {}
  bind(...values: SQLInputValue[]) {
    return new Statement(this.database, this.sql, values);
  }
  async first(column?: string) {
    const row = this.database.prepare(this.sql).get(...this.values);
    return row ? (column ? row[column] : row) : null;
  }
  async all() {
    return {
      results: this.database.prepare(this.sql).all(...this.values),
      success: true,
    };
  }
  async run() {
    return {
      meta: this.database.prepare(this.sql).run(...this.values),
      success: true,
    };
  }
}
function databaseBinding(database: DatabaseSync) {
  return {
    prepare: (sql: string) => new Statement(database, sql),
    batch: async (statements: Statement[]) => {
      database.exec('BEGIN');
      try {
        const results = [];
        for (const statement of statements) results.push(await statement.all());
        database.exec('COMMIT');
        return results;
      } catch (error) {
        database.exec('ROLLBACK');
        throw error;
      }
    },
  };
}
const files = new Map<string, ArrayBuffer>();
const pdf = readFileSync(
  new URL(
    '../../public/demo-documents/05_Harbor_Technology_Demo_Insurance_Certificate.pdf',
    import.meta.url,
  ),
);
const testEnvironment = {
  ALLOW_LOCAL_MAINTAINER: 'true',
  DEMO_GUEST_ACCESS: 'true',
  WORKSPACE_SESSION_SECRET: 'test-only-local-session-secret-long-enough',
  DEMO_AUTH_USERNAME: 'reviewer',
  DEMO_AUTH_PASSWORD: 'test-only-password',
  DEMO_AUTH_ROLE: 'legal_reviewer',
};
const originalEnvironment = Object.fromEntries(
  Object.keys(testEnvironment).map((k) => [k, process.env[k]]),
);

beforeAll(async () => {
  Object.assign(process.env, testEnvironment);
  Object.assign(env, {
    DB: databaseBinding(sqlite),
    FILES: {
      put: async (key: string, bytes: ArrayBuffer) => {
        files.set(key, bytes);
      },
      get: async (key: string) =>
        files.has(key) ? { body: files.get(key) } : null,
      list: async () => ({ objects: [], truncated: false }),
      delete: async (key: string) => {
        files.delete(key);
      },
    },
  });
  await ensureWorkspaceDatabase();
});
beforeEach(async () => {
  vi.restoreAllMocks();
  await resetWorkspaceDatabase();
  files.clear();
});
afterAll(() => {
  sqlite.close();
  for (const [key, value] of Object.entries(originalEnvironment)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

const field = (value: string | number | null) => ({
  value,
  confidence: 0.99,
  sourcePage: 1,
  sourceQuote: 'Fictional reviewed source text.',
});
function analysis(value = 585_000): ContractAnalysis {
  return {
    documentTitle: field('Fictional review agreement'),
    supplierLegalName: field('North Bay Industrial Supply Co.'),
    contractType: field('Services Agreement'),
    contractNumber: field('TEST-AGREEMENT'),
    contractValue: field(value),
    effectiveDate: field('2026-01-01'),
    expirationDate: field('2027-12-31'),
    renewalType: field('none'),
    noticeDays: field(30),
    governingLaw: field('California'),
    paymentTerms: field('Net 30'),
    liabilityCap: field('capped'),
    findings: [],
    keyDates: [],
    warnings: [],
  };
}
function seedAnalysis(stage: string, result: object, name = 'test.pdf') {
  const id = `test-${crypto.randomUUID()}`;
  sqlite
    .prepare(`INSERT INTO ai_analysis_runs (id,stage,file_name,storage_key,model,prompt_version,original_result_json,created_at)
    VALUES (?,?,?,?,?,?,?,?)`)
    .run(
      id,
      stage,
      name,
      `uploads/${id}`,
      'fixture',
      'fixture',
      JSON.stringify(result),
      new Date().toISOString(),
    );
  return {
    id,
    document: {
      fileName: name,
      totalPages: 1,
      storageKey: `uploads/${id}`,
      mimeType: 'application/pdf',
    },
  };
}
function request(
  path: string,
  body: object | FormData,
  method: 'POST' | 'PATCH' = 'POST',
  cookie = '',
) {
  const headers: Record<string, string> = {
    Origin: 'http://localhost',
    Cookie: cookie,
  };
  if (!(body instanceof FormData)) headers['Content-Type'] = 'application/json';
  return new Request(`http://localhost${path}`, {
    method,
    headers,
    body: body instanceof FormData ? body : JSON.stringify(body),
  });
}
async function save(
  stage: 'draft' | 'executed',
  result: ContractAnalysis,
  intakeId?: string,
) {
  const run = seedAnalysis(stage, result);
  return workspaceRoute.POST(
    request('/api/workspace', {
      analysisRunId: run.id,
      stage,
      intakeId,
      analysis: result,
      document: run.document,
      review: {
        fields: Object.keys(result)
          .filter((k) => !['findings', 'keyDates', 'warnings'].includes(k))
          .map((fieldName) => ({ fieldName, status: 'accepted' })),
      },
    }),
  );
}
async function approvedDraft(result: ContractAnalysis) {
  const response = await save('draft', result);
  expect(response.status, await response.clone().text()).toBe(200);
  const row = sqlite
    .prepare(
      "SELECT id FROM contract_intakes WHERE title='Fictional review agreement' ORDER BY rowid DESC LIMIT 1",
    )
    .get()!;
  const steps = sqlite
    .prepare(
      'SELECT s.id FROM approval_steps s JOIN approval_requests r ON r.id=s.request_id WHERE r.intake_id=?',
    )
    .all(row.id);
  for (const step of steps) {
    const decision = await approvalsRoute.PATCH(
      request(
        '/api/approvals',
        { stepId: step.id, action: 'approve' },
        'PATCH',
      ),
    );
    expect(decision.status, await decision.clone().text()).toBe(200);
  }
  return String(row.id);
}

describe('release approval boundaries through real routes', () => {
  it.each([
    ['legal_reviewer', 'Legal Reviewer', true],
    ['legal_reviewer', 'Finance / CFO', false],
    ['procurement_compliance_reviewer', 'Legal Reviewer', false],
    ['procurement_compliance_reviewer', 'Compliance Reviewer', true],
    ['approver', 'Chief Executive Officer', true],
    ['approver', 'Legal Reviewer', false],
    ['contract_administrator', 'Finance / CFO', false],
    ['demo_operator', 'Finance / CFO', true],
  ] as const)('maps %s to %s: %s', (role, owner, allowed) => {
    expect(roleCanApproveStep(role, owner)).toBe(allowed);
  });
  it('denies Legal deciding Finance without audit or status writes, allows Legal deciding Legal', async () => {
    process.env.DEMO_AUTH_ROLE = 'legal_reviewer' satisfies WorkspaceRole;
    const cookie = `contractledger_demo_session=${await createDemoSessionToken('reviewer')}`;
    const count = sqlite
      .prepare('SELECT COUNT(*) AS n FROM approval_decision_history')
      .get()!.n;
    const denied = await approvalsRoute.PATCH(
      request(
        '/api/approvals',
        { stepId: 'approval-step-demo-int-001-finance', action: 'approve' },
        'PATCH',
        cookie,
      ),
    );
    expect(denied.status).toBe(403);
    expect(
      sqlite
        .prepare('SELECT COUNT(*) AS n FROM approval_decision_history')
        .get()!.n,
    ).toBe(count);
    expect(
      sqlite
        .prepare(
          "SELECT status FROM approval_steps WHERE id='approval-step-demo-int-001-finance'",
        )
        .get()!.status,
    ).toBe('pending');
    const allowed = await approvalsRoute.PATCH(
      request(
        '/api/approvals',
        { stepId: 'approval-step-demo-int-001-law', action: 'approve' },
        'PATCH',
        cookie,
      ),
    );
    expect(allowed.status).toBe(200);
  });
  it('blocks same-band monetary changes and preserves source approval', async () => {
    const intake = await approvedDraft(analysis());
    const count = sqlite
      .prepare('SELECT COUNT(*) AS n FROM contracts')
      .get()!.n;
    const denied = await save('executed', analysis(1_500_000), intake);
    expect(denied.status).toBe(400);
    expect(((await denied.json()) as { error: string }).error).toContain(
      'new draft review',
    );
    expect(sqlite.prepare('SELECT COUNT(*) AS n FROM contracts').get()!.n).toBe(
      count,
    );
    const allowed = await save('executed', analysis(), intake);
    expect(allowed.status, await allowed.clone().text()).toBe(200);
  });
  it('registers changed terms only after a fresh draft and its approvals', async () => {
    const previous = await approvedDraft(analysis());
    expect((await save('executed', analysis(1_500_000), previous)).status).toBe(
      400,
    );
    const fresh = await approvedDraft(analysis(1_500_000));
    expect(fresh).not.toBe(previous);
    const allowed = await save('executed', analysis(1_500_000), fresh);
    expect(allowed.status, await allowed.clone().text()).toBe(200);
  });
  it.each([
    'governingLaw',
    'paymentTerms',
    'expirationDate',
    'renewalType',
    'contractNumber',
  ] as const)('rejects changed %s under an old approval', async (key) => {
    const a = analysis();
    const intake = await approvedDraft(a);
    a[key].value =
      key === 'expirationDate'
        ? '2028-12-31'
        : key === 'renewalType'
          ? 'automatic'
          : 'Changed value';
    const r = await save('executed', a, intake);
    expect(r.status).toBe(400);
    expect(((await r.json()) as { error: string }).error).toContain(
      'new draft review',
    );
  });
  it('requires explicit intake selection and rejects an unrelated supplier', async () => {
    await approvedDraft(analysis());
    expect((await save('executed', analysis())).status).toBe(400);
    expect((await save('executed', analysis(), 'int-001')).status).toBe(400);
  });
  it('fails closed for historical approvals without a verified terms snapshot', async () => {
    const intake = await approvedDraft(analysis());
    sqlite
      .prepare(
        "UPDATE approval_requests SET rule_snapshot_json='{}' WHERE intake_id=?",
      )
      .run(intake);
    expect((await save('executed', analysis(), intake)).status).toBe(400);
  });
  it('generates an insurance exception after natural expiry, and permits current low-value coverage', async () => {
    const yesterday = new Date(Date.now() - 86400000)
      .toISOString()
      .slice(0, 10);
    sqlite
      .prepare(
        "UPDATE suppliers SET insurance_status='current',insurance_expiration=? WHERE id='sup-northbay'",
      )
      .run(yesterday);
    const w = await workspaceRoute.getWorkspace();
    expect(
      w.suppliers.find((s) => s.id === 'sup-northbay')!.insurance_status,
    ).toBe('expired');
    expect((await save('executed', analysis(1000))).status).toBe(400);
    const draft = await save('draft', analysis(1000));
    expect(draft.status).toBe(200);
    expect(
      sqlite
        .prepare(
          "SELECT COUNT(*) AS n FROM approval_requests WHERE rule_id='approval-rule-insurance-v1'",
        )
        .get()!.n,
    ).toBe(1);
    sqlite
      .prepare(
        "UPDATE suppliers SET insurance_status='current',insurance_expiration='2099-12-31' WHERE id='sup-northbay'",
      )
      .run();
    const allowed = await save('executed', analysis(1000));
    expect(allowed.status, await allowed.clone().text()).toBe(200);
  });
});

async function upload(
  expiration: string,
  options: {
    replaces?: string;
    verified?: boolean;
    effective?: string;
    supplier?: string;
    type?: string;
    issues?: boolean;
  } = {},
) {
  const form = new FormData();
  const documentType = options.type ?? 'insurance_certificate';
  const metadata = {
    supplierLegalName: field('Apex Equipment LLC'),
    documentType: field(documentType),
    issuer: field('Fictional Insurance'),
    documentNumber: field('POL-1'),
    effectiveDate: field(options.effective ?? '2026-01-01'),
    expirationDate: field(expiration),
    coverageSummary: field('Fictional coverage'),
    findings: options.issues ? ['Unresolved issue'] : [],
    warnings: [],
  };
  if (options.verified)
    form.set('analysisRunId', seedAnalysis('supplier_document', metadata).id);
  form.set('file', new File([pdf], 'test.pdf', { type: 'application/pdf' }));
  for (const [key, value] of Object.entries({
    supplierId: options.supplier ?? 'sup-apex',
    documentType,
    issuer: 'Fictional Insurance',
    documentNumber: 'POL-1',
    effectiveDate: options.effective ?? '2026-01-01',
    expirationDate: expiration,
    coverageSummary: 'Fictional coverage',
    replacesDocumentId: options.replaces ?? '',
  }))
    form.set(key, value);
  const response = await supplierRoute.POST(
    request('/api/supplier-documents', form),
  );
  const body = (await response.json()) as {
    documentId: string;
    workspace: Workspace;
    error?: string;
  };
  return { response, body };
}
describe('supplier upload failure cleanup', () => {
  it('retains the committed document and file when refreshing the workspace fails', async () => {
    vi.spyOn(workspaceRoute, 'getWorkspace').mockRejectedValueOnce(
      new Error('Workspace refresh unavailable'),
    );
    const deletion = vi.spyOn(env.FILES, 'delete');
    const result = await upload('2099-01-01');
    expect(result.response.ok).toBe(false);
    expect(result.body.error).toContain('Workspace refresh unavailable');
    const document = sqlite
      .prepare(
        "SELECT id, storage_key FROM documents WHERE file_name = 'test.pdf'",
      )
      .get()!;
    expect(document).toBeDefined();
    expect(deletion).not.toHaveBeenCalled();
    expect(files.has(String(document.storage_key))).toBe(true);
    const response = await documentRoute.GET(
      new Request(`http://localhost/api/document?id=${String(document.id)}`),
    );
    expect(response.status).toBe(200);
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(
      new Uint8Array(pdf),
    );
  });

  it('removes the newly uploaded file when the database commit fails', async () => {
    vi.spyOn(env.DB, 'batch').mockRejectedValueOnce(
      new Error('Database commit unavailable'),
    );
    const deletion = vi.spyOn(env.FILES, 'delete');
    const result = await upload('2099-01-01');
    expect(result.response.ok).toBe(false);
    expect(result.body.error).toContain('Database commit unavailable');
    expect(
      sqlite
        .prepare("SELECT id FROM documents WHERE file_name = 'test.pdf'")
        .get(),
    ).toBeUndefined();
    expect(deletion).toHaveBeenCalledTimes(1);
    expect(files.size).toBe(0);
  });
});

describe('supplier renewal lifecycle', () => {
  it('keeps old evidence and retires it only for a verified effective replacement', async () => {
    const old = await upload('2020-01-01');
    expect(old.response.status, old.body.error).toBe(200);
    const fresh = await upload('2099-01-01', {
      verified: true,
      replaces: old.body.documentId,
    });
    expect(fresh.response.status, fresh.body.error).toBe(200);
    const supplier = fresh.body.workspace.suppliers.find(
      (s) => s.id === 'sup-apex',
    )!;
    expect(supplier.insurance_status).toBe('current');
    expect(supplier.qualification_status).toBe('complete');
    expect(supplier.has_expired_compliance).toBe(0);
    expect(
      sqlite
        .prepare('SELECT review_status FROM documents WHERE id=?')
        .get(old.body.documentId)!.review_status,
    ).toBe('superseded');
    expect(
      sqlite
        .prepare('SELECT parent_document_id FROM documents WHERE id=?')
        .get(fresh.body.documentId)!.parent_document_id,
    ).toBe(old.body.documentId);
    expect(JSON.stringify(fresh.body.workspace.supplierAlerts)).not.toContain(
      old.body.documentId,
    );
  });
  it.each([
    { verified: false },
    { verified: true, effective: '2098-01-01' },
    { verified: true, issues: true },
  ])(
    'keeps expired evidence active when replacement is not ready: %j',
    async (options) => {
      const old = await upload('2020-01-01');
      const fresh = await upload('2099-01-01', {
        ...options,
        replaces: old.body.documentId,
      });
      expect(fresh.response.status, fresh.body.error).toBe(200);
      expect(
        fresh.body.workspace.suppliers.find((s) => s.id === 'sup-apex')!
          .qualification_status,
      ).toBe('expired');
      expect(
        sqlite
          .prepare('SELECT review_status FROM documents WHERE id=?')
          .get(old.body.documentId)!.review_status,
      ).toBe('expired');
    },
  );
  it('does not silently replace a separate certificate and refuses cross-supplier/type replacements', async () => {
    const old = await upload('2020-01-01');
    const separate = await upload('2099-01-01', { verified: true });
    expect(
      separate.body.workspace.suppliers.find((s) => s.id === 'sup-apex')!
        .qualification_status,
    ).toBe('expired');
    expect(
      (
        await upload('2099-01-01', {
          verified: true,
          replaces: old.body.documentId,
          supplier: 'sup-harbor',
        })
      ).response.status,
    ).toBe(400);
    expect(
      (
        await upload('2099-01-01', {
          verified: true,
          replaces: old.body.documentId,
          type: 'business_license',
        })
      ).response.status,
    ).toBe(400);
  });
});

describe('stored document framing', () => {
  it('allows same-origin PDF readers without allowing external framing', async () => {
    const uploaded = await upload('2099-01-01');
    const response = await documentRoute.GET(
      new Request(
        `http://localhost/api/document?id=${uploaded.body.documentId}`,
      ),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('x-frame-options')).toBe('SAMEORIGIN');
    expect(response.headers.get('content-security-policy')).toContain(
      "frame-ancestors 'self'",
    );
    expect(response.headers.get('content-security-policy')).not.toContain(
      'sandbox',
    );
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(
      new Uint8Array(pdf),
    );
  });
  it.each(['image/png', 'text/plain', 'text/html'])(
    'keeps %s uploads sandboxed and rejects executable MIME types',
    async (mime) => {
      const uploaded = await upload('2099-01-01');
      sqlite
        .prepare('UPDATE documents SET mime_type = ? WHERE id = ?')
        .run(mime, uploaded.body.documentId);
      const response = await documentRoute.GET(
        new Request(
          `http://localhost/api/document?id=${uploaded.body.documentId}`,
        ),
      );
      expect(response.headers.get('content-security-policy')).toContain(
        'sandbox',
      );
      expect(response.headers.get('x-frame-options')).toBe('SAMEORIGIN');
      expect(response.headers.get('content-type')).toBe(
        mime === 'text/html' ? 'application/octet-stream' : mime,
      );
      expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    },
  );
});

describe('workspace approval-rule migration', () => {
  it.each([24, 25])(
    'preserves a recorded decline when upgrading from v%i and retrying',
    async (version) => {
      const decline = await approvalsRoute.PATCH(
        request(
          '/api/approvals',
          {
            stepId: 'approval-step-demo-int-001-law',
            action: 'decline',
            reason: 'The governing-law exception was declined.',
          },
          'PATCH',
        ),
      );
      expect(decline.status, await decline.clone().text()).toBe(200);
      const decisions = () =>
        sqlite
          .prepare(`SELECT i.approval_status, ar.status, ast.status AS step_status, h.reason
      FROM contract_intakes i
      JOIN approval_requests ar ON ar.intake_id = i.id
      JOIN approval_steps ast ON ast.request_id = ar.id
      JOIN approval_decision_history h ON h.step_id = ast.id
      WHERE i.id = 'int-001' AND h.action = 'decline'`)
          .all();
      const recorded = decisions();
      expect(recorded).toEqual([
        {
          approval_status: 'declined',
          status: 'declined',
          step_status: 'declined',
          reason: 'The governing-law exception was declined.',
        },
      ]);
      sqlite.prepare('DELETE FROM schema_migrations').run();
      sqlite
        .prepare('INSERT INTO schema_migrations VALUES (?, ?)')
        .run(version, '2026-09-01');
      const retired = [
        'approval-rule-financial-v1',
        'approval-rule-financial-director-v1',
      ];
      for (const id of retired) {
        sqlite
          .prepare(`INSERT INTO approval_rules
        SELECT ?, ?, version, name, description, trigger_type, trigger_config_json,
          owner_role, due_days, mandatory, 1, created_at
        FROM approval_rules WHERE id = 'approval-rule-financial-v2'`)
          .run(id, id);
      }
      sqlite
        .prepare(
          "UPDATE suppliers SET legal_name = 'Saved supplier name' WHERE id = 'sup-westline'",
        )
        .run();

      const binding = env.DB;
      const batch = binding.batch.bind(binding);
      const migration = vi
        .spyOn(binding, 'batch')
        .mockImplementation(async (statements) => {
          if (
            (statements[0] as unknown as Statement).sql.includes(
              'WHERE active = 1 AND id IN',
            )
          )
            throw new Error('Temporary D1 failure');
          return batch(statements);
        });
      vi.resetModules();
      const { ensureWorkspaceDatabase: initialize } =
        await import('@/db/bootstrap');
      await expect(initialize()).rejects.toThrow('Temporary D1 failure');
      expect(
        sqlite
          .prepare('SELECT MAX(version) AS version FROM schema_migrations')
          .get()?.version,
      ).toBe(25);
      migration.mockRestore();
      await initialize();
      await initialize();

      expect(
        sqlite
          .prepare('SELECT MAX(version) AS version FROM schema_migrations')
          .get()?.version,
      ).toBe(26);
      expect(decisions()).toEqual(recorded);
      expect(
        sqlite
          .prepare('SELECT active FROM approval_rules WHERE id = ?')
          .get(retired[0])?.active,
      ).toBe(0);
      expect(
        sqlite
          .prepare('SELECT active FROM approval_rules WHERE id = ?')
          .get(retired[1])?.active,
      ).toBe(0);
      expect(
        sqlite
          .prepare(
            "SELECT active FROM approval_rules WHERE id = 'approval-rule-financial-v2'",
          )
          .get()?.active,
      ).toBe(1);
      if (version === 25) {
        expect(
          sqlite
            .prepare(
              "SELECT legal_name FROM suppliers WHERE id = 'sup-westline'",
            )
            .get()?.legal_name,
        ).toBe('Saved supplier name');
      }
    },
  );

  it('resumes a partially seeded new database', async () => {
    const fresh = new DatabaseSync(':memory:');
    fresh.exec('PRAGMA foreign_keys = ON');
    const previous = env.DB;
    const binding = databaseBinding(fresh);
    const batch = binding.batch.bind(binding);
    let failOnce = true;
    binding.batch = async (statements) => {
      if (
        failOnce &&
        statements[0].sql.includes('INSERT OR IGNORE INTO contract_intakes')
      ) {
        failOnce = false;
        throw new Error('Interrupted initial seed');
      }
      return batch(statements);
    };
    Object.assign(env, { DB: binding });
    try {
      vi.resetModules();
      const { ensureWorkspaceDatabase: initialize } =
        await import('@/db/bootstrap');
      await expect(initialize()).rejects.toThrow('Interrupted initial seed');
      expect(
        fresh.prepare('SELECT COUNT(*) AS n FROM suppliers').get()?.n,
      ).toBeGreaterThan(0);
      expect(
        fresh.prepare('SELECT COUNT(*) AS n FROM contract_intakes').get()?.n,
      ).toBe(0);
      await initialize();
      expect(
        fresh
          .prepare('SELECT MAX(version) AS version FROM schema_migrations')
          .get()?.version,
      ).toBe(26);
      expect(
        fresh
          .prepare(
            "SELECT approval_status FROM contract_intakes WHERE id = 'int-001'",
          )
          .get()?.approval_status,
      ).toBe('pending');
      expect(
        fresh
          .prepare(
            "SELECT COUNT(*) AS n FROM approval_rules WHERE active = 1 AND id IN ('approval-rule-financial-v1', 'approval-rule-financial-director-v1')",
          )
          .get()?.n,
      ).toBe(0);
    } finally {
      Object.assign(env, { DB: previous });
      fresh.close();
    }
  });
});

describe('registers beyond the workspace snapshot', () => {
  beforeEach(() => {
    sqlite.exec(`
      WITH RECURSIVE fixture(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM fixture WHERE n < 501)
      INSERT INTO suppliers (
        id, legal_name, normalized_name, vendor_number, category, status,
        risk_tier, qualification_status, w9_status, insurance_status,
        created_at, updated_at
      )
      SELECT 'supplier-' || n, PRINTF('Zulu Supplier %03d', n),
        'zulu supplier ' || n, PRINTF('TEST-VENDOR-%03d', n),
        CASE WHEN n = 501 THEN 'Late category' ELSE 'Fixture' END,
        'active', CASE WHEN n = 501 THEN 'high' ELSE 'low' END,
        CASE WHEN n = 501 THEN 'under_review' ELSE 'complete' END,
        'received', 'current', '2026-09-01', '2026-09-01'
      FROM fixture;

      WITH RECURSIVE fixture(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM fixture WHERE n < 501)
      INSERT INTO contracts (
        id, contract_number, supplier_id, title, contract_type, department,
        owner, original_value_cents, current_value_cents, effective_date,
        expiration_date, status, last_updated
      )
      SELECT 'contract-' || n, PRINTF('TEST-CONTRACT-%03d', n), 'supplier-' || n,
        CASE WHEN n = 501 THEN 'Énergie agreement 100%' ELSE 'Fixture agreement' END,
        'Services', CASE WHEN n = 501 THEN 'Late department' ELSE 'Fixture' END,
        'Case owner', 1234567, 1234567, '2026-09-01', '2030-09-01', 'executed',
        CASE WHEN n = 501 THEN '2000-01-01' ELSE '2026-09-01' END
      FROM fixture;

      WITH RECURSIVE fixture(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM fixture WHERE n < 501)
      INSERT INTO documents (
        id, supplier_id, file_name, file_type, lifecycle_stage, storage_key,
        mime_type, review_status, uploaded_at
      )
      SELECT 'qual-' || n, 'supplier-' || n, PRINTF('Qualification %03d.pdf', n),
        'w9', 'supplier_record', 'fixture/qualification-' || n,
        'application/pdf', 'approved', '2026-09-01'
      FROM fixture;
    `);
  });

  const readPage = async (query: string) => {
    const response = await registerRoute.GET(
      new Request(`http://localhost/api/registers?${query}`),
    );
    expect(response.status, await response.clone().text()).toBe(200);
    return response.json() as Promise<RegisterPage>;
  };

  it('includes older pending reviews even when the snapshot contains only completed intakes', async () => {
    sqlite.exec(`
      UPDATE contract_intakes SET review_status = 'complete';
      UPDATE contract_intakes SET review_status = 'pending', received_at = '2000-01-01' WHERE id = 'int-001';
      WITH RECURSIVE n(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM n WHERE x<501)
      INSERT INTO contract_intakes(id, intake_number, proposed_supplier_name, title, contract_type, review_status, received_at, updated_at)
      SELECT 'completed-' || x, 'TEST-' || x, 'Example supplier', 'Completed draft', 'Service', 'complete', '2026-01-01', '2026-01-01' FROM n;
    `);
    const workspace = await workspaceRoute.getWorkspace();
    expect(workspace.intakes.some((row) => row.id === 'int-001')).toBe(false);
    expect(workspace.metrics?.records_to_verify).toBe(1);
    expect(workspace.pendingReviews.map((row) => row.id)).toEqual(['int-001']);
    const last = workspace.intakes.at(-1)!;
    const params = new URLSearchParams({
      beforeDate: String(last.received_at),
      afterId: String(last.id),
    });
    const response = await intakesRoute.GET(
      new Request('http://localhost/api/intakes?' + params),
    );
    expect(response.ok).toBe(true);
    const history = (await response.json()) as {
      rows: Workspace['intakes'];
      hasMore: boolean;
    };
    expect(history.rows.map((row) => row.id)).toContain('int-001');
    expect(history.rows.some((row) => row.id === last.id)).toBe(false);
    expect(history.hasMore).toBe(false);
  });

  it('searches, filters, paginates, and opens records excluded from the initial snapshot', async () => {
    const workspace = (await (
      await workspaceRoute.GET(new Request('http://localhost/api/workspace'))
    ).json()) as Workspace;
    expect(workspace.contracts).toHaveLength(500);
    expect(workspace.suppliers).toHaveLength(500);
    expect(workspace.metrics.total_contracts).toBeGreaterThan(501);
    expect(workspace.metrics.total_suppliers).toBeGreaterThan(501);
    expect(workspace.metrics.supplier_documentation_follow_up).toBeGreaterThan(
      workspace.suppliers.filter(
        (row) => row.qualification_status !== 'complete',
      ).length,
    );
    expect(workspace.contracts.some((row) => row.id === 'contract-501')).toBe(
      false,
    );
    expect(workspace.suppliers.some((row) => row.id === 'supplier-501')).toBe(
      false,
    );

    const contracts = await readPage(
      'scope=contracts&search=test-contract-501&department=Late+department&amountComparison=greater&amountValue=12000&expirationCondition=on_or_after&expirationDate=2029-01-01',
    );
    expect(contracts.matchCount).toBe(1);
    expect(contracts.totalCount).toBe(workspace.metrics.total_contracts);
    expect(contracts.rows[0]).toMatchObject({
      id: 'contract-501',
      supplier_name: 'Zulu Supplier 501',
    });
    expect(
      (await readPage('scope=contracts&search=%C3%A9NERGIE+AGREEMENT+100%25'))
        .rows[0]?.id,
    ).toBe('contract-501');
    expect(
      (await readPage('scope=contracts&search=TEST-CONTRACT-501&status=active'))
        .matchCount,
    ).toBe(0);

    const suppliers = await readPage(
      'scope=suppliers&search=test-contract-501&category=Late+category&risk=high&documentExpiry=no_expiration',
    );
    expect(suppliers.rows[0]?.id).toBe('supplier-501');
    expect(suppliers.matchCount).toBe(1);
    expect(suppliers.totalCount).toBe(workspace.metrics.total_suppliers);
    expect(suppliers.riskProfiles['supplier-501'].level).toBe('high');
    const page = await readPage('scope=suppliers&page=6&pageSize=100');
    expect(page.page).toBe(6);
    expect(page.rows.some((row) => row.id === 'supplier-501')).toBe(true);
    expect(page.matchCount).toBe(workspace.metrics.total_suppliers);
    const options = (await (
      await registerRoute.GET(
        new Request(
          'http://localhost/api/registers?scope=suppliers&options=true',
        ),
      )
    ).json()) as RegisterOptions;
    expect(options.category).toContain('Late category');

    const readDetail = async (scope: string, id: string) => {
      const response = await registerRoute.GET(
        new Request(`http://localhost/api/registers?scope=${scope}&id=${id}`),
      );
      expect(response.status, await response.clone().text()).toBe(200);
      return response.json() as Promise<RegisterDetail>;
    };
    expect(await readDetail('contracts', 'contract-501')).toMatchObject({
      contract: { id: 'contract-501' },
      supplier: { id: 'supplier-501' },
    });
    expect(await readDetail('suppliers', 'supplier-501')).toMatchObject({
      supplier: { id: 'supplier-501' },
      supplierRiskProfile: { level: 'high' },
    });
    const details = (await (
      await recordDetailsRoute.GET(
        new Request(
          'http://localhost/api/record-details?type=supplier&id=supplier-501',
        ),
      )
    ).json()) as RecordDetails;
    expect(details.documents).toEqual([
      expect.objectContaining({ file_name: 'Qualification 501.pdf' }),
    ]);
  });

  it('includes every supplier and document in Excel while enforcing the export role', async () => {
    const cookie = `contractledger_demo_session=${await createDemoSessionToken('reviewer')}`;
    const path = '/api/exports/registers?scope=suppliers';
    const denied = await registerExportRoute.POST(
      request(path, {}, 'POST', cookie),
    );
    expect(denied.status).toBe(403);

    const response = await registerExportRoute.POST(request(path, {}));
    expect(response.status, await response.clone().text()).toBe(200);
    const data = (await response.json()) as RegisterExportData;
    const ExcelJS = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await buildRegisterWorkbook(data, 'suppliers'));
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      'Supplier Register',
      'Supplier Documents',
    ]);
    const suppliers = workbook.getWorksheet('Supplier Register')!;
    const documents = workbook.getWorksheet('Supplier Documents')!;
    const supplierCount = Number(
      sqlite.prepare('SELECT COUNT(*) AS n FROM suppliers').get()?.n,
    );
    const documentCount = Number(
      sqlite
        .prepare(
          "SELECT COUNT(*) AS n FROM documents WHERE lifecycle_stage = 'supplier_record'",
        )
        .get()?.n,
    );
    expect(supplierCount).toBeGreaterThan(501);
    expect(documentCount).toBeGreaterThan(501);
    expect(suppliers.rowCount).toBe(supplierCount + 1);
    expect(documents.rowCount).toBe(documentCount + 1);
    expect(suppliers.getRow(suppliers.rowCount).getCell('A').value).toBe(
      'supplier-501',
    );
    expect(documents.getRow(documents.rowCount).getCell('D').value).toBe(
      'Qualification 501.pdf',
    );
  });
});
