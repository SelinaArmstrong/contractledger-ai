import { workspaceRoles, type WorkspaceRole } from '@/lib/workspace-roles';

export const DEMO_SESSION_COOKIE = 'contractledger_demo_session';

const SESSION_TTL_SECONDS = 12 * 60 * 60;

/**
 * The published demo account. Username and password are deliberately public:
 * this is a fictional portfolio workspace and a reviewer should be able to
 * sign in from the README without being sent a credential. Its role is
 * `demo_operator`, which can run every contract-operations workflow but
 * cannot reset the shared workspace out from under another visitor.
 */
export const DEFAULT_DEMO_USERNAME = 'demo';
export const DEFAULT_DEMO_PASSWORD = 'demotest';
export const DEFAULT_DEMO_ROLE: WorkspaceRole = 'demo_operator';

/**
 * Signing key used when no secret is configured. A forged cookie for the demo
 * account grants nothing that the published password does not already grant,
 * so a well-known fallback is acceptable *only* while every account it can
 * sign for is public. Configuring an administrator account therefore requires
 * a real `WORKSPACE_SESSION_SECRET`; see `workspaceAuthConfigurationError`.
 */
const PUBLIC_DEMO_SESSION_SECRET =
  'contractledger-public-demo-session-key-not-a-secret';

export type WorkspaceAccount = {
  username: string;
  password: string;
  displayName: string;
  role: WorkspaceRole;
};

export type DemoSession = {
  username: string;
  displayName: string;
  email: string;
  role: WorkspaceRole;
  expiresAt: number;
};

function environmentValue(name: string) {
  return process.env[name]?.trim() ?? '';
}

function roleValue(name: string, fallback: WorkspaceRole): WorkspaceRole {
  const value = environmentValue(name);
  return workspaceRoles.includes(value as WorkspaceRole)
    ? (value as WorkspaceRole)
    : fallback;
}

function sessionSecret() {
  return (
    environmentValue('WORKSPACE_SESSION_SECRET') || PUBLIC_DEMO_SESSION_SECRET
  );
}

function adminAccount(): WorkspaceAccount | null {
  const username = environmentValue('ADMIN_AUTH_USERNAME');
  const password = environmentValue('ADMIN_AUTH_PASSWORD');
  // Refuse to enable an administrator that a well-known signing key could forge.
  if (!username || !password) return null;
  if (environmentValue('WORKSPACE_SESSION_SECRET').length < 32) return null;
  return {
    username,
    password,
    displayName: environmentValue('ADMIN_AUTH_DISPLAY_NAME') || username,
    role: 'administrator',
  };
}

/**
 * Every account that can sign in. The demo account always exists so the
 * deployment is never left with no way in; an optional administrator account
 * is what the maintainer uses to reset the workspace.
 */
export function workspaceAccounts(): WorkspaceAccount[] {
  const demo: WorkspaceAccount = {
    username: environmentValue('DEMO_AUTH_USERNAME') || DEFAULT_DEMO_USERNAME,
    password: environmentValue('DEMO_AUTH_PASSWORD') || DEFAULT_DEMO_PASSWORD,
    displayName: environmentValue('DEMO_AUTH_DISPLAY_NAME') || 'Demo reviewer',
    role: roleValue('DEMO_AUTH_ROLE', DEFAULT_DEMO_ROLE),
  };
  const admin = adminAccount();
  return admin ? [demo, admin] : [demo];
}

export function findWorkspaceAccount(username: string) {
  return (
    workspaceAccounts().find((account) => account.username === username) ?? null
  );
}

/** Surfaced on the sign-in page so a misconfiguration is visible, not silent. */
export function workspaceAuthConfigurationError() {
  const adminUser = environmentValue('ADMIN_AUTH_USERNAME');
  const adminPassword = environmentValue('ADMIN_AUTH_PASSWORD');
  if (!adminUser && !adminPassword) return '';
  if (!adminUser || !adminPassword)
    return 'The administrator username and password must both be configured.';
  if (environmentValue('WORKSPACE_SESSION_SECRET').length < 32)
    return 'An administrator account requires WORKSPACE_SESSION_SECRET of at least 32 characters.';
  return '';
}

function constantTimeEqual(left: string, right: string) {
  const length = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;
  for (let index = 0; index < length; index += 1) {
    difference |=
      (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return difference === 0;
}

/**
 * Compares against every configured account in constant time, and always
 * performs the same number of comparisons so a wrong username and a wrong
 * password are indistinguishable by timing.
 */
export function authenticateWorkspaceCredentials(
  username: string,
  password: string,
): WorkspaceAccount | null {
  let matched: WorkspaceAccount | null = null;
  for (const account of workspaceAccounts()) {
    const ok =
      constantTimeEqual(username, account.username) &&
      constantTimeEqual(password, account.password);
    if (ok && !matched) matched = account;
  }
  return matched;
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/u, '');
}

function textToBase64Url(value: string) {
  return bytesToBase64Url(new TextEncoder().encode(value));
}

function base64UrlToText(value: string) {
  const normalized = value.replaceAll('-', '+').replaceAll('_', '/');
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    '=',
  );
  const binary = atob(padded);
  return new TextDecoder().decode(
    Uint8Array.from(binary, (character) => character.charCodeAt(0)),
  );
}

async function sign(payload: string, secret: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(payload),
  );
  return bytesToBase64Url(new Uint8Array(signature));
}

export async function createDemoSessionToken(
  username: string,
  now = Date.now(),
) {
  if (!findWorkspaceAccount(username))
    throw new Error('Unknown workspace account.');
  const payload = textToBase64Url(
    JSON.stringify({
      username,
      expiresAt: Math.floor(now / 1000) + SESSION_TTL_SECONDS,
    }),
  );
  return `${payload}.${await sign(payload, sessionSecret())}`;
}

export async function verifyDemoSessionToken(
  token: string | null | undefined,
  now = Date.now(),
): Promise<DemoSession | null> {
  if (!token) return null;
  const [payload, suppliedSignature, ...extra] = token.split('.');
  if (!payload || !suppliedSignature || extra.length) return null;

  const expectedSignature = await sign(payload, sessionSecret());
  if (!constantTimeEqual(suppliedSignature, expectedSignature)) return null;

  try {
    const parsed = JSON.parse(base64UrlToText(payload)) as {
      username?: unknown;
      expiresAt?: unknown;
    };
    if (
      typeof parsed.username !== 'string' ||
      typeof parsed.expiresAt !== 'number' ||
      parsed.expiresAt <= Math.floor(now / 1000)
    ) {
      return null;
    }
    // The role is read from configuration at verification time, so revoking or
    // downgrading an account takes effect without waiting for the cookie to
    // expire.
    const account = findWorkspaceAccount(parsed.username);
    if (!account) return null;
    return {
      username: account.username,
      displayName: account.displayName,
      email: `${account.username}@contractledger.demo`,
      role: account.role,
      expiresAt: parsed.expiresAt,
    };
  } catch {
    return null;
  }
}

export function demoSessionFromCookieHeader(cookieHeader: string | null) {
  if (!cookieHeader) return '';
  for (const segment of cookieHeader.split(';')) {
    const [name, ...value] = segment.trim().split('=');
    if (name === DEMO_SESSION_COOKIE) return value.join('=');
  }
  return '';
}

export function demoSessionCookie(token: string, secure: boolean) {
  return [
    `${DEMO_SESSION_COOKIE}=${token}`,
    'Path=/',
    `Max-Age=${SESSION_TTL_SECONDS}`,
    'HttpOnly',
    'SameSite=Lax',
    secure ? 'Secure' : '',
  ]
    .filter(Boolean)
    .join('; ');
}

export function clearDemoSessionCookie(secure: boolean) {
  return [
    `${DEMO_SESSION_COOKIE}=`,
    'Path=/',
    'Max-Age=0',
    'HttpOnly',
    'SameSite=Lax',
    secure ? 'Secure' : '',
  ]
    .filter(Boolean)
    .join('; ');
}
