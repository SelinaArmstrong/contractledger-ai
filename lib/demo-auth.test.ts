import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  authenticateDemoCredentials,
  clearDemoSessionCookie,
  createDemoSessionToken,
  demoAuthConfigurationError,
  demoSessionCookie,
  demoSessionFromCookieHeader,
  getDemoAuthConfig,
  verifyDemoSessionToken,
} from './demo-auth';

const environmentKeys = [
  'DEMO_AUTH_USERNAME',
  'DEMO_AUTH_PASSWORD',
  'DEMO_AUTH_DISPLAY_NAME',
  'DEMO_AUTH_SESSION_SECRET',
] as const;

const originalEnvironment = Object.fromEntries(
  environmentKeys.map((key) => [key, process.env[key]]),
);

function configureDemoAuth() {
  process.env.DEMO_AUTH_USERNAME = 'selina';
  process.env.DEMO_AUTH_PASSWORD = 'correct horse battery staple';
  process.env.DEMO_AUTH_DISPLAY_NAME = 'Selina Demo';
  process.env.DEMO_AUTH_SESSION_SECRET =
    'a-test-only-session-secret-that-is-long-enough';
}

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

describe('demo authentication', () => {
  it('stays disabled when no demo credentials are configured', () => {
    expect(getDemoAuthConfig()).toBeNull();
    expect(demoAuthConfigurationError()).toBe('');
  });

  it('rejects incomplete or weak configuration', () => {
    process.env.DEMO_AUTH_USERNAME = 'selina';
    process.env.DEMO_AUTH_PASSWORD = 'password';
    process.env.DEMO_AUTH_SESSION_SECRET = 'too-short';

    expect(getDemoAuthConfig()).toBeNull();
    expect(demoAuthConfigurationError()).toMatch(/at least 32 characters/u);
  });

  it('accepts only the configured credentials', () => {
    configureDemoAuth();

    expect(
      authenticateDemoCredentials('selina', 'correct horse battery staple'),
    ).toBe(true);
    expect(authenticateDemoCredentials('selina', 'wrong')).toBe(false);
    expect(
      authenticateDemoCredentials('other', 'correct horse battery staple'),
    ).toBe(false);
  });

  it('creates a signed session and rejects tampering', async () => {
    configureDemoAuth();
    const now = Date.UTC(2026, 7, 31, 12);
    const token = await createDemoSessionToken(now);

    await expect(verifyDemoSessionToken(token, now)).resolves.toMatchObject({
      username: 'selina',
      displayName: 'Selina Demo',
      email: 'selina@contractledger.demo',
    });
    await expect(
      verifyDemoSessionToken(`${token}changed`, now),
    ).resolves.toBeNull();
  });

  it('expires sessions after twelve hours', async () => {
    configureDemoAuth();
    const now = Date.UTC(2026, 7, 31, 12);
    const token = await createDemoSessionToken(now);

    await expect(
      verifyDemoSessionToken(token, now + 12 * 60 * 60 * 1000),
    ).resolves.toBeNull();
  });

  it('uses secure HttpOnly cookies and can clear them', () => {
    const cookie = demoSessionCookie('signed-token', true);

    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Secure');
    expect(
      demoSessionFromCookieHeader(`theme=dark; ${cookie.split(';')[0]}`),
    ).toBe('signed-token');
    expect(clearDemoSessionCookie(true)).toContain('Max-Age=0');
  });
});
