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
import type { ContractAnalysis, Workspace } from '@/lib/contract-ledger-types';
import { roleCanApproveStep, type WorkspaceRole } from '@/lib/workspace-roles';

vi.mock('cloudflare:workers', () => ({ env: {} }));
const { env } = await import('cloudflare:workers');
const { ensureWorkspaceDatabase, resetWorkspaceDatabase } =
  await import('@/db/bootstrap');
const workspaceRoute = await import('@/app/api/workspace/route');
const approvalsRoute = await import('@/app/api/approvals/route');
const supplierRoute = await import('@/app/api/supplier-documents/route');
const documentRoute = await import('@/app/api/document/route');
const { createDemoSessionToken } = await import('@/lib/workspace-auth');

// Real SQLite statements and atomic batches, with only platform bindings
// adapted. Tests exercise route validation, authorization, SQL and audit writes.
const sqlite = new DatabaseSync(':memory:');
sqlite.exec('PRAGMA foreign_keys = ON');
class Statement {
  constructor(
    readonly sql: string,
    readonly values: SQLInputValue[] = [],
  ) {}
  bind(...values: SQLInputValue[]) {
    return new Statement(this.sql, values);
  }
  async first(column?: string) {
    const row = sqlite.prepare(this.sql).get(...this.values);
    return row ? (column ? row[column] : row) : null;
  }
  async all() {
    return {
      results: sqlite.prepare(this.sql).all(...this.values),
      success: true,
    };
  }
  async run() {
    return {
      meta: sqlite.prepare(this.sql).run(...this.values),
      success: true,
    };
  }
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
    DB: {
      prepare: (sql: string) => new Statement(sql),
      batch: async (statements: Statement[]) => {
        sqlite.exec('BEGIN');
        try {
          const results = [];
          for (const statement of statements)
            results.push(await statement.all());
          sqlite.exec('COMMIT');
          return results;
        } catch (error) {
          sqlite.exec('ROLLBACK');
          throw error;
        }
      },
    },
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
