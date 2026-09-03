import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  DEFAULT_DEMO_PASSWORD,
  DEFAULT_DEMO_USERNAME,
  authenticateWorkspaceCredentials,
  clearDemoSessionCookie,
  createDemoSessionToken,
  demoSessionCookie,
  demoSessionFromCookieHeader,
  findWorkspaceAccount,
  verifyDemoSessionToken,
  workspaceAccounts,
  workspaceAuthConfigurationError,
} from './workspace-auth';

const environmentKeys = [
  'DEMO_AUTH_USERNAME',
  'DEMO_AUTH_PASSWORD',
  'DEMO_AUTH_DISPLAY_NAME',
  'DEMO_AUTH_ROLE',
  'ADMIN_AUTH_USERNAME',
  'ADMIN_AUTH_PASSWORD',
  'ADMIN_AUTH_DISPLAY_NAME',
  'WORKSPACE_SESSION_SECRET',
] as const;

const originalEnvironment = Object.fromEntries(
  environmentKeys.map((key) => [key, process.env[key]]),
);

const STRONG_SECRET = 'a-test-only-session-secret-that-is-long-enough';

beforeEach(() => {
  for (const key of environmentKeys) delete process.env[key];
});

afterEach(() => {
  for (const key of environmentKeys) {
    const value = originalEnvironment[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe('workspace accounts', () => {
  it('always offers the published demo account so a deployment is never locked out', () => {
    const accounts = workspaceAccounts();

    expect(accounts).toHaveLength(1);
    expect(accounts[0].username).toBe(DEFAULT_DEMO_USERNAME);
    expect(accounts[0].password).toBe(DEFAULT_DEMO_PASSWORD);
    expect(accounts[0].role).toBe('demo_operator');
  });

  it('accepts the published demo credentials', () => {
    expect(authenticateWorkspaceCredentials('demo', 'demotest')?.role).toBe(
      'demo_operator',
    );
  });

  it('rejects a wrong password or a wrong username', () => {
    expect(authenticateWorkspaceCredentials('demo', 'wrong')).toBeNull();
    expect(authenticateWorkspaceCredentials('nobody', 'demotest')).toBeNull();
    expect(authenticateWorkspaceCredentials('', '')).toBeNull();
  });

  it('lets a deployment override the demo credentials and role', () => {
    process.env.DEMO_AUTH_USERNAME = 'reviewer';
    process.env.DEMO_AUTH_PASSWORD = 'another-password';
    process.env.DEMO_AUTH_ROLE = 'read_only_auditor';

    expect(authenticateWorkspaceCredentials('demo', 'demotest')).toBeNull();
    expect(
      authenticateWorkspaceCredentials('reviewer', 'another-password')?.role,
    ).toBe('read_only_auditor');
  });

  it('ignores an unknown role rather than failing open', () => {
    process.env.DEMO_AUTH_ROLE = 'superuser';
    expect(workspaceAccounts()[0].role).toBe('demo_operator');
  });
});

describe('administrator account', () => {
  it('is refused without a strong session secret, because the fallback key is public', () => {
    process.env.ADMIN_AUTH_USERNAME = 'selina';
    process.env.ADMIN_AUTH_PASSWORD = 'a-real-password';

    expect(workspaceAccounts()).toHaveLength(1);
    expect(
      authenticateWorkspaceCredentials('selina', 'a-real-password'),
    ).toBeNull();
    expect(workspaceAuthConfigurationError()).toMatch(
      /at least 32 characters/u,
    );
  });

  it('is enabled once a strong session secret is configured', () => {
    process.env.ADMIN_AUTH_USERNAME = 'selina';
    process.env.ADMIN_AUTH_PASSWORD = 'a-real-password';
    process.env.WORKSPACE_SESSION_SECRET = STRONG_SECRET;

    expect(
      authenticateWorkspaceCredentials('selina', 'a-real-password')?.role,
    ).toBe('administrator');
    expect(workspaceAuthConfigurationError()).toBe('');
  });

  it('reports an incomplete administrator configuration', () => {
    process.env.ADMIN_AUTH_USERNAME = 'selina';
    expect(workspaceAuthConfigurationError()).toMatch(
      /must both be configured/u,
    );
  });
});

describe('session tokens', () => {
  it('round-trips a signed session for a known account', async () => {
    const token = await createDemoSessionToken('demo');
    const session = await verifyDemoSessionToken(token);

    expect(session?.username).toBe('demo');
    expect(session?.role).toBe('demo_operator');
    expect(session?.email).toBe('demo@contractledger.demo');
  });

  it('refuses to issue a session for an account that does not exist', async () => {
    await expect(createDemoSessionToken('intruder')).rejects.toThrow(
      /Unknown workspace account/u,
    );
  });

  it('rejects a tampered payload or signature', async () => {
    const token = await createDemoSessionToken('demo');
    const [payload, signature] = token.split('.');

    expect(await verifyDemoSessionToken(`${payload}x.${signature}`)).toBeNull();
    expect(await verifyDemoSessionToken(`${payload}.${signature}x`)).toBeNull();
    expect(await verifyDemoSessionToken('not-a-token')).toBeNull();
    expect(await verifyDemoSessionToken(null)).toBeNull();
  });

  it('rejects an expired session', async () => {
    const issuedAt = Date.now();
    const token = await createDemoSessionToken('demo', issuedAt);

    expect(
      await verifyDemoSessionToken(token, issuedAt + 13 * 60 * 60 * 1000),
    ).toBeNull();
  });

  it('reads the role from configuration at verification time, so a downgrade takes effect immediately', async () => {
    const token = await createDemoSessionToken('demo');
    process.env.DEMO_AUTH_ROLE = 'read_only_auditor';

    expect((await verifyDemoSessionToken(token))?.role).toBe(
      'read_only_auditor',
    );
  });

  it('invalidates a session whose account was renamed away', async () => {
    const token = await createDemoSessionToken('demo');
    process.env.DEMO_AUTH_USERNAME = 'someone-else';

    expect(await verifyDemoSessionToken(token)).toBeNull();
  });

  it('does not accept a session signed with a different secret', async () => {
    process.env.WORKSPACE_SESSION_SECRET = STRONG_SECRET;
    const token = await createDemoSessionToken('demo');

    process.env.WORKSPACE_SESSION_SECRET = `${STRONG_SECRET}-rotated`;
    expect(await verifyDemoSessionToken(token)).toBeNull();
  });
});

describe('session cookie handling', () => {
  it('marks the cookie HttpOnly, SameSite and Secure over https', () => {
    const cookie = demoSessionCookie('token-value', true);

    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Secure');
  });

  it('omits Secure over plain http so local development still works', () => {
    expect(demoSessionCookie('token-value', false)).not.toContain('Secure');
  });

  it('expires the cookie on sign out', () => {
    expect(clearDemoSessionCookie(true)).toContain('Max-Age=0');
  });

  it('extracts the session from a crowded cookie header', () => {
    expect(
      demoSessionFromCookieHeader(
        'other=1; contractledger_demo_session=abc.def; another=2',
      ),
    ).toBe('abc.def');
    expect(demoSessionFromCookieHeader(null)).toBe('');
    expect(demoSessionFromCookieHeader('unrelated=1')).toBe('');
  });
});

describe('account lookup', () => {
  it('finds a configured account and nothing else', () => {
    expect(findWorkspaceAccount('demo')?.role).toBe('demo_operator');
    expect(findWorkspaceAccount('missing')).toBeNull();
  });
});
