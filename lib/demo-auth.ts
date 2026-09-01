export const DEMO_SESSION_COOKIE = 'contractledger_demo_session';

const SESSION_TTL_SECONDS = 12 * 60 * 60;

type DemoAuthConfig = {
  username: string;
  password: string;
  displayName: string;
  sessionSecret: string;
};

export type DemoSession = {
  username: string;
  displayName: string;
  email: string;
  expiresAt: number;
};

function environmentValue(name: string) {
  return process.env[name]?.trim() ?? '';
}

export function getDemoAuthConfig(): DemoAuthConfig | null {
  const username = environmentValue('DEMO_AUTH_USERNAME');
  const password = environmentValue('DEMO_AUTH_PASSWORD');
  const sessionSecret = environmentValue('DEMO_AUTH_SESSION_SECRET');
  if (!username && !password && !sessionSecret) return null;
  if (!username || !password || sessionSecret.length < 32) return null;

  return {
    username,
    password,
    displayName: environmentValue('DEMO_AUTH_DISPLAY_NAME') || username,
    sessionSecret,
  };
}

export function demoAuthConfigurationError() {
  const values = [
    environmentValue('DEMO_AUTH_USERNAME'),
    environmentValue('DEMO_AUTH_PASSWORD'),
    environmentValue('DEMO_AUTH_SESSION_SECRET'),
  ];
  if (values.every((value) => !value)) return '';
  if (!values[0] || !values[1])
    return 'The demo username and password must both be configured.';
  if (values[2].length < 32)
    return 'The demo session secret must contain at least 32 characters.';
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

export function authenticateDemoCredentials(
  username: string,
  password: string,
) {
  const config = getDemoAuthConfig();
  return Boolean(
    config &&
    constantTimeEqual(username, config.username) &&
    constantTimeEqual(password, config.password),
  );
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

export async function createDemoSessionToken(now = Date.now()) {
  const config = getDemoAuthConfig();
  if (!config) throw new Error('Demo authentication is not configured.');
  const payload = textToBase64Url(
    JSON.stringify({
      username: config.username,
      expiresAt: Math.floor(now / 1000) + SESSION_TTL_SECONDS,
    }),
  );
  return `${payload}.${await sign(payload, config.sessionSecret)}`;
}

export async function verifyDemoSessionToken(
  token: string | null | undefined,
  now = Date.now(),
): Promise<DemoSession | null> {
  const config = getDemoAuthConfig();
  if (!config || !token) return null;
  const [payload, suppliedSignature, ...extra] = token.split('.');
  if (!payload || !suppliedSignature || extra.length) return null;

  const expectedSignature = await sign(payload, config.sessionSecret);
  if (!constantTimeEqual(suppliedSignature, expectedSignature)) return null;

  try {
    const parsed = JSON.parse(base64UrlToText(payload)) as {
      username?: unknown;
      expiresAt?: unknown;
    };
    if (
      parsed.username !== config.username ||
      typeof parsed.expiresAt !== 'number' ||
      parsed.expiresAt <= Math.floor(now / 1000)
    ) {
      return null;
    }
    return {
      username: config.username,
      displayName: config.displayName,
      email: `${config.username}@contractledger.demo`,
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
