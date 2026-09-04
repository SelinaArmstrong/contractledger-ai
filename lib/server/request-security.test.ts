import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('cloudflare:workers', () => ({ env: {} }));

import {
  GUEST_ACTOR_ID,
  authorizeApiRequest,
  clientAddress,
  guestAccessEnabled,
  guestIdentity,
  sameOrigin,
} from './request-security';
import {
  permissionsForRole,
  roleCan,
  workspacePermissions,
} from '@/lib/workspace-roles';
import {
  createDemoSessionToken,
  demoSessionCookie,
} from '@/lib/workspace-auth';

const environmentKeys = [
  'DEMO_GUEST_ACCESS',
  'DEMO_AUTH_ROLE',
  'DEMO_AUTH_USERNAME',
  'DEMO_AUTH_PASSWORD',
  'WORKSPACE_SESSION_SECRET',
  'ALLOW_LOCAL_MAINTAINER',
  'TRUST_PROXY_ADDRESS_HEADER',
] as const;

const original = Object.fromEntries(
  environmentKeys.map((key) => [key, process.env[key]]),
);

afterEach(() => {
  for (const key of environmentKeys) {
    const value = original[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

const HOSTED = 'https://contractledger.example/api/workspace';

/** Configures an account, since nothing is enabled without host secrets. */
function configureReviewer() {
  process.env.WORKSPACE_SESSION_SECRET =
    'a-test-only-session-secret-that-is-long-enough';
  process.env.DEMO_AUTH_USERNAME = 'reviewer';
  process.env.DEMO_AUTH_PASSWORD = 'a-private-reviewer-password';
}

async function signedCookie() {
  configureReviewer();
  return demoSessionCookie(await createDemoSessionToken('reviewer'), true);
}

describe('workspace role authorization', () => {
  it('denies every material write to a read-only auditor', () => {
    const writes = [
      'submit_documents',
      'edit_verified_fields',
      'edit_supplier_records',
      'approve_exceptions',
      'apply_amendments',
      'complete_obligations',
      'manage_imports',
      'run_ai_assistant',
      'manage_ai_governance',
      'reset_workspace',
    ] as const;

    for (const permission of writes) {
      expect(roleCan('read_only_auditor', permission)).toBe(false);
    }
    expect(roleCan('read_only_auditor', 'view_workspace')).toBe(true);
  });

  it('keeps a contract administrator away from approving their own exceptions', () => {
    expect(roleCan('contract_administrator', 'edit_verified_fields')).toBe(
      true,
    );
    expect(roleCan('contract_administrator', 'approve_exceptions')).toBe(false);
  });

  it('gives the administrator every permission', () => {
    expect(permissionsForRole('administrator')).toEqual([
      ...workspacePermissions,
    ]);
  });
});

describe('demo_operator role', () => {
  it('can run the full contract-operations workflow, approvals included', () => {
    for (const permission of [
      'submit_documents',
      'edit_verified_fields',
      'edit_supplier_records',
      'approve_exceptions',
      'apply_amendments',
      'complete_obligations',
      'manage_imports',
      'run_ai_assistant',
      'manage_ai_governance',
      'export_data',
    ] as const) {
      expect(roleCan('demo_operator', permission)).toBe(true);
    }
  });

  it('cannot reset the shared workspace it shares with other reviewers', () => {
    expect(roleCan('demo_operator', 'reset_workspace')).toBe(false);
    expect(permissionsForRole('demo_operator')).not.toContain(
      'reset_workspace',
    );
  });
});

describe('guest access', () => {
  it('is disabled unless the deployment opts in', () => {
    delete process.env.DEMO_GUEST_ACCESS;
    expect(guestAccessEnabled()).toBe(false);
    process.env.DEMO_GUEST_ACCESS = 'false';
    expect(guestAccessEnabled()).toBe(false);
    process.env.DEMO_GUEST_ACCESS = 'true';
    expect(guestAccessEnabled()).toBe(true);
  });

  it('identifies itself as a guest viewer', () => {
    expect(guestIdentity().userId).toBe(GUEST_ACTOR_ID);
    expect(guestIdentity().guest).toBe(true);
  });

  it('withholds every write and AI permission from the guest role', () => {
    const granted = permissionsForRole('read_only_auditor');
    for (const permission of [
      'submit_documents',
      'edit_verified_fields',
      'approve_exceptions',
      'manage_imports',
      'run_ai_assistant',
      'reset_workspace',
    ] as const) {
      expect(granted).not.toContain(permission);
    }
    expect(granted).toContain('view_workspace');
  });
});

describe('authorizeApiRequest', () => {
  it('refuses an anonymous hosted request when guest access is off', async () => {
    delete process.env.DEMO_GUEST_ACCESS;
    const result = await authorizeApiRequest(new Request(HOSTED), {
      permission: 'view_workspace',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(401);
  });

  it('admits an anonymous hosted request as a read-only guest when enabled', async () => {
    process.env.DEMO_GUEST_ACCESS = 'true';
    const result = await authorizeApiRequest(new Request(HOSTED), {
      permission: 'view_workspace',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.actor.guest).toBe(true);
      expect(result.actor.role).toBe('read_only_auditor');
    }
  });

  it('refuses a guest write even with guest access enabled', async () => {
    process.env.DEMO_GUEST_ACCESS = 'true';
    const result = await authorizeApiRequest(
      new Request(HOSTED, { method: 'POST' }),
      { permission: 'reset_workspace' },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(403);
  });

  it('admits a signed-in demo account with the demo_operator role', async () => {
    const result = await authorizeApiRequest(
      new Request(HOSTED, { headers: { cookie: await signedCookie() } }),
      { permission: 'approve_exceptions' },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.actor.role).toBe('demo_operator');
      expect(result.actor.id).toBe('account:reviewer');
      expect(result.actor.demo).toBe(true);
    }
  });

  it('refuses a workspace reset from the signed-in demo account', async () => {
    const result = await authorizeApiRequest(
      new Request(HOSTED, {
        method: 'POST',
        headers: { cookie: await signedCookie() },
      }),
      { permission: 'reset_workspace' },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(403);
  });

  it('rejects a cross-origin write from a signed-in account', async () => {
    const result = await authorizeApiRequest(
      new Request(HOSTED, {
        method: 'POST',
        headers: {
          cookie: await signedCookie(),
          origin: 'https://attacker.example',
        },
      }),
      { permission: 'edit_verified_fields' },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(403);
  });

  it('treats a loopback request as the local maintainer when opted in', async () => {
    process.env.ALLOW_LOCAL_MAINTAINER = 'true';
    const result = await authorizeApiRequest(
      new Request('http://localhost:3000/api/workspace'),
      { permission: 'reset_workspace' },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.actor.local).toBe(true);
      expect(result.actor.role).toBe('administrator');
    }
  });

  it('lets a signed-in account override the loopback shortcut', async () => {
    process.env.ALLOW_LOCAL_MAINTAINER = 'true';
    const result = await authorizeApiRequest(
      new Request('http://localhost:3000/api/workspace', {
        headers: { cookie: await signedCookie() },
      }),
      { permission: 'view_workspace' },
    );

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.actor.role).toBe('demo_operator');
  });
});

describe('Host header cannot grant maintainer access', () => {
  it('refuses a spoofed Host when the opt-in is not set', async () => {
    delete process.env.ALLOW_LOCAL_MAINTAINER;
    const result = await authorizeApiRequest(
      new Request('http://localhost:3000/api/workspace', { method: 'POST' }),
      { permission: 'reset_workspace' },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(401);
  });

  it('still refuses when the opt-in is set but the host is not loopback', async () => {
    process.env.ALLOW_LOCAL_MAINTAINER = 'true';
    const result = await authorizeApiRequest(
      new Request('https://contractledger.example/api/workspace', {
        method: 'POST',
      }),
      { permission: 'reset_workspace' },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(401);
  });
});

describe('clientAddress', () => {
  it('trusts cf-connecting-ip, which a client cannot set', () => {
    const request = new Request('https://contractledger.example/', {
      headers: { 'cf-connecting-ip': '203.0.113.7' },
    });

    expect(clientAddress(request)).toBe('203.0.113.7');
  });

  it('ignores a forgeable x-forwarded-for by default', () => {
    delete process.env.TRUST_PROXY_ADDRESS_HEADER;
    const request = new Request('https://contractledger.example/', {
      headers: { 'x-forwarded-for': '203.0.113.9' },
    });

    // Empty means "one shared bucket", which throttles harder rather than
    // letting a caller mint a fresh identity per request.
    expect(clientAddress(request)).toBe('');
  });

  it('uses x-forwarded-for only when a proxy is declared', () => {
    process.env.TRUST_PROXY_ADDRESS_HEADER = 'true';
    const request = new Request('https://contractledger.example/', {
      headers: { 'x-forwarded-for': '203.0.113.9, 198.51.100.2' },
    });

    expect(clientAddress(request)).toBe('203.0.113.9');
  });
});

describe('sameOrigin', () => {
  it('accepts a matching Origin', () => {
    const request = new Request('https://contractledger.example/api/x', {
      method: 'POST',
      headers: { origin: 'https://contractledger.example' },
    });

    expect(sameOrigin(request)).toBe(true);
  });

  it('rejects a mismatched Origin', () => {
    const request = new Request('https://contractledger.example/api/x', {
      method: 'POST',
      headers: { origin: 'https://attacker.example' },
    });

    expect(sameOrigin(request)).toBe(false);
  });

  it('refuses a request that carries neither Origin nor Sec-Fetch-Site', () => {
    const request = new Request('https://contractledger.example/api/x', {
      method: 'POST',
    });

    expect(sameOrigin(request)).toBe(false);
  });

  it('accepts Sec-Fetch-Site: same-origin when Origin is absent', () => {
    const request = new Request('https://contractledger.example/api/x', {
      method: 'POST',
      headers: { 'sec-fetch-site': 'same-origin' },
    });

    expect(sameOrigin(request)).toBe(true);
  });
});

describe('origin enforcement is keyed on the HTTP method', () => {
  it('refuses an unsafe method that cannot prove its origin', async () => {
    process.env.ALLOW_LOCAL_MAINTAINER = 'true';
    const result = await authorizeApiRequest(
      new Request('http://localhost:3000/api/workspace', { method: 'POST' }),
      { permission: 'edit_verified_fields' },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(403);
  });

  it('allows a privileged GET without origin headers, since CORS covers it', async () => {
    process.env.ALLOW_LOCAL_MAINTAINER = 'true';
    const result = await authorizeApiRequest(
      new Request('http://localhost:3000/api/evaluations'),
      { permission: 'export_data' },
    );

    expect(result.ok).toBe(true);
  });
});
