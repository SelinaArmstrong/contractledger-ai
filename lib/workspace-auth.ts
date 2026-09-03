import { workspaceRoles, type WorkspaceRole } from '@/lib/workspace-roles';

export const DEMO_SESSION_COOKIE = 'contractledger_demo_session';

const SESSION_TTL_SECONDS = 12 * 60 * 60;

/**
 * Role the reviewer account carries unless the deployment says otherwise. It
 * can run every contract-operations workflow but cannot reset the shared
 * workspace out from under another visitor.
 */
export const DEFAULT_DEMO_ROLE: WorkspaceRole = 'demo_operator';

/**
 * Minimum length for the session signing key.
 *
 * There is no fallback key. Credentials are supplied entirely by the
 * deployment's secret store, so a well-known signing key would let anyone mint
 * a valid session without knowing any password — the cookie would become the
 * credential. No secret means no account can sign in; loopback development and
 * read-only guest access are unaffected.
 */
export const MINIMUM_SESSION_SECRET_LENGTH = 32;

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

/** Returns the configured signing key, or '' when sign-in is not enabled. */
function sessionSecret() {
  const secret = environmentValue('WORKSPACE_SESSION_SECRET');
  return secret.length >= MINIMUM_SESSION_SECRET_LENGTH ? secret : '';
}

function accountFrom(
  userKey: string,
  passwordKey: string,
  displayKey: string,
  fallbackDisplayName: string,
  role: WorkspaceRole,
): WorkspaceAccount | null {
  const username = environmentValue(userKey);
  const password = environmentValue(passwordKey);
  if (!username || !password) return null;
  return {
    username,
    password,
    displayName: environmentValue(displayKey) || fallbackDisplayName,
    role,
  };
}

/**
 * Every account that can sign in. Credentials live only in the deployment's
 * secret store: nothing here is defaulted, so a copy of this repository grants
 * no access, and an unconfigured deployment has no sign-in rather than a
 * guessable one.
 */
export function workspaceAccounts(): WorkspaceAccount[] {
  if (!sessionSecret()) return [];
  const reviewer = accountFrom(
    'DEMO_AUTH_USERNAME',
    'DEMO_AUTH_PASSWORD',
    'DEMO_AUTH_DISPLAY_NAME',
    'Reviewer',
    roleValue('DEMO_AUTH_ROLE', DEFAULT_DEMO_ROLE),
  );
  const admin = accountFrom(
    'ADMIN_AUTH_USERNAME',
    'ADMIN_AUTH_PASSWORD',
    'ADMIN_AUTH_DISPLAY_NAME',
    'Maintainer',
    'administrator',
  );
  return [reviewer, admin].filter(
    (account): account is WorkspaceAccount => account !== null,
  );
}

export function findWorkspaceAccount(username: string) {
  return (
    workspaceAccounts().find((account) => account.username === username) ?? null
  );
}

/** Surfaced on the sign-in page so a misconfiguration is visible, not silent. */
export function workspaceAuthConfigurationError() {
  if (!environmentValue('WORKSPACE_SESSION_SECRET'))
    return 'Sign-in is not configured on this deployment: WORKSPACE_SESSION_SECRET is missing.';
  if (!sessionSecret())
    return `WORKSPACE_SESSION_SECRET must contain at least ${MINIMUM_SESSION_SECRET_LENGTH} characters.`;
  // A half-configured account is a more specific and more useful diagnosis
  // than "nothing is configured", so it is reported first.
  for (const [user, password, label] of [
    ['DEMO_AUTH_USERNAME', 'DEMO_AUTH_PASSWORD', 'reviewer'],
    ['ADMIN_AUTH_USERNAME', 'ADMIN_AUTH_PASSWORD', 'administrator'],
  ] as const) {
    const hasUser = Boolean(environmentValue(user));
    const hasPassword = Boolean(environmentValue(password));
    if (hasUser !== hasPassword)
      return `The ${label} username and password must both be configured.`;
  }
  if (!workspaceAccounts().length)
    return 'Sign-in is not configured on this deployment: no account credentials are set.';
  return '';
}

/** True when at least one account can sign in on this deployment. */
export function signInAvailable() {
  return workspaceAccounts().length > 0;
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
  const secret = sessionSecret();
  if (!secret) throw new Error('Sign-in is not configured.');
  if (!findWorkspaceAccount(username))
    throw new Error('Unknown workspace account.');
  const payload = textToBase64Url(
    JSON.stringify({
      username,
      expiresAt: Math.floor(now / 1000) + SESSION_TTL_SECONDS,
    }),
  );
  return `${payload}.${await sign(payload, secret)}`;
}

export async function verifyDemoSessionToken(
  token: string | null | undefined,
  now = Date.now(),
): Promise<DemoSession | null> {
  const secret = sessionSecret();
  // No signing key means sign-in is switched off; every cookie is refused
  // rather than verified against an empty key.
  if (!secret || !token) return null;
  const [payload, suppliedSignature, ...extra] = token.split('.');
  if (!payload || !suppliedSignature || extra.length) return null;

  const expectedSignature = await sign(payload, secret);
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
