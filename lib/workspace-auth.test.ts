import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  MINIMUM_SESSION_SECRET_LENGTH,
  authenticateWorkspaceCredentials,
  clearDemoSessionCookie,
  createDemoSessionToken,
  demoSessionCookie,
  demoSessionFromCookieHeader,
  findWorkspaceAccount,
  signInAvailable,
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

function configureReviewer() {
  process.env.WORKSPACE_SESSION_SECRET = STRONG_SECRET;
  process.env.DEMO_AUTH_USERNAME = 'reviewer';
  process.env.DEMO_AUTH_PASSWORD = 'a-private-reviewer-password';
}

describe('workspace accounts', () => {
  it('ships no credentials, so a copy of the repository grants no access', () => {
    expect(workspaceAccounts()).toEqual([]);
    expect(signInAvailable()).toBe(false);
    expect(authenticateWorkspaceCredentials('demo', 'demotest')).toBeNull();
  });

  it('refuses every account until a signing secret exists', () => {
    process.env.DEMO_AUTH_USERNAME = 'reviewer';
    process.env.DEMO_AUTH_PASSWORD = 'a-private-reviewer-password';

    expect(workspaceAccounts()).toEqual([]);
    expect(
      authenticateWorkspaceCredentials(
        'reviewer',
        'a-private-reviewer-password',
      ),
    ).toBeNull();
  });

  it('refuses a signing secret that is too short to be worth signing with', () => {
    process.env.DEMO_AUTH_USERNAME = 'reviewer';
    process.env.DEMO_AUTH_PASSWORD = 'a-private-reviewer-password';
    process.env.WORKSPACE_SESSION_SECRET = 'x'.repeat(
      MINIMUM_SESSION_SECRET_LENGTH - 1,
    );

    expect(workspaceAccounts()).toEqual([]);
    expect(workspaceAuthConfigurationError()).toMatch(/at least 32/u);
  });

  it('enables the reviewer account once credentials and a secret are configured', () => {
    configureReviewer();

    expect(signInAvailable()).toBe(true);
    expect(
      authenticateWorkspaceCredentials(
        'reviewer',
        'a-private-reviewer-password',
      )?.role,
    ).toBe('demo_operator');
  });

  it('rejects a wrong password or a wrong username', () => {
    configureReviewer();

    expect(authenticateWorkspaceCredentials('reviewer', 'wrong')).toBeNull();
    expect(
      authenticateWorkspaceCredentials('nobody', 'a-private-reviewer-password'),
    ).toBeNull();
    expect(authenticateWorkspaceCredentials('', '')).toBeNull();
  });

  it('lets a deployment choose the reviewer role', () => {
    configureReviewer();
    process.env.DEMO_AUTH_ROLE = 'read_only_auditor';

    expect(
      authenticateWorkspaceCredentials(
        'reviewer',
        'a-private-reviewer-password',
      )?.role,
    ).toBe('read_only_auditor');
  });

  it('ignores an unknown role rather than failing open', () => {
    configureReviewer();
    process.env.DEMO_AUTH_ROLE = 'superuser';

    expect(workspaceAccounts()[0].role).toBe('demo_operator');
  });

  it('reports a half-configured account instead of silently ignoring it', () => {
    process.env.WORKSPACE_SESSION_SECRET = STRONG_SECRET;
    process.env.DEMO_AUTH_USERNAME = 'reviewer';

    expect(workspaceAuthConfigurationError()).toMatch(/reviewer username/u);
  });
});

describe('administrator account', () => {
  it('is enabled alongside the reviewer once configured', () => {
    configureReviewer();
    process.env.ADMIN_AUTH_USERNAME = 'selina';
    process.env.ADMIN_AUTH_PASSWORD = 'a-separate-maintainer-password';

    expect(workspaceAccounts()).toHaveLength(2);
    expect(
      authenticateWorkspaceCredentials(
        'selina',
        'a-separate-maintainer-password',
      )?.role,
    ).toBe('administrator');
    expect(workspaceAuthConfigurationError()).toBe('');
  });

  it('can be the only account, so a deployment may omit the reviewer', () => {
    process.env.WORKSPACE_SESSION_SECRET = STRONG_SECRET;
    process.env.ADMIN_AUTH_USERNAME = 'selina';
    process.env.ADMIN_AUTH_PASSWORD = 'a-separate-maintainer-password';

    expect(workspaceAccounts()).toHaveLength(1);
    expect(workspaceAccounts()[0].role).toBe('administrator');
  });

  it('reports an incomplete administrator configuration', () => {
    configureReviewer();
    process.env.ADMIN_AUTH_USERNAME = 'selina';

    expect(workspaceAuthConfigurationError()).toMatch(
      /administrator username/u,
    );
  });
});

describe('session tokens', () => {
  beforeEach(configureReviewer);

  it('round-trips a signed session for a known account', async () => {
    const token = await createDemoSessionToken('reviewer');
    const session = await verifyDemoSessionToken(token);

    expect(session?.username).toBe('reviewer');
    expect(session?.role).toBe('demo_operator');
    expect(session?.email).toBe('reviewer@contractledger.demo');
  });

  it('refuses to issue a session for an account that does not exist', async () => {
    await expect(createDemoSessionToken('intruder')).rejects.toThrow(
      /Unknown workspace account/u,
    );
  });

  it('rejects a tampered payload or signature', async () => {
    const token = await createDemoSessionToken('reviewer');
    const [payload, signature] = token.split('.');

    expect(await verifyDemoSessionToken(`${payload}x.${signature}`)).toBeNull();
    expect(await verifyDemoSessionToken(`${payload}.${signature}x`)).toBeNull();
    expect(await verifyDemoSessionToken('not-a-token')).toBeNull();
    expect(await verifyDemoSessionToken(null)).toBeNull();
  });

  it('rejects an expired session', async () => {
    const issuedAt = Date.now();
    const token = await createDemoSessionToken('reviewer', issuedAt);

    expect(
      await verifyDemoSessionToken(token, issuedAt + 13 * 60 * 60 * 1000),
    ).toBeNull();
  });

  it('reads the role from configuration at verification time, so a downgrade takes effect immediately', async () => {
    const token = await createDemoSessionToken('reviewer');
    process.env.DEMO_AUTH_ROLE = 'read_only_auditor';

    expect((await verifyDemoSessionToken(token))?.role).toBe(
      'read_only_auditor',
    );
  });

  it('invalidates a session whose account was renamed away', async () => {
    const token = await createDemoSessionToken('reviewer');
    process.env.DEMO_AUTH_USERNAME = 'someone-else';

    expect(await verifyDemoSessionToken(token)).toBeNull();
  });

  it('does not accept a session signed with a different secret', async () => {
    const token = await createDemoSessionToken('reviewer');

    process.env.WORKSPACE_SESSION_SECRET = `${STRONG_SECRET}-rotated`;
    expect(await verifyDemoSessionToken(token)).toBeNull();
  });

  it('rejects every session once sign-in is unconfigured again', async () => {
    const token = await createDemoSessionToken('reviewer');
    delete process.env.WORKSPACE_SESSION_SECRET;

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
    configureReviewer();

    expect(findWorkspaceAccount('reviewer')?.role).toBe('demo_operator');
    expect(findWorkspaceAccount('missing')).toBeNull();
  });
});
