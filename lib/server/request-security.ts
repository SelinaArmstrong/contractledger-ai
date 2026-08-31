import { env } from 'cloudflare:workers';

export type RequestActor = {
  id: string;
  email: string;
  name: string;
  local: boolean;
};

type AuthorizationOptions = {
  write?: boolean;
  admin?: boolean;
};

type AuthorizationResult =
  | { ok: true; actor: RequestActor }
  | { ok: false; response: Response };

function isLoopback(hostname: string) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

function decodedDisplayName(headers: Headers) {
  const encoded = headers.get('oai-authenticated-user-full-name');
  if (
    !encoded ||
    headers.get('oai-authenticated-user-full-name-encoding') !==
      'percent-encoded-utf-8'
  ) {
    return '';
  }

  try {
    return decodeURIComponent(encoded).trim();
  } catch {
    return '';
  }
}

function sameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

function hostedAdminIds() {
  return new Set(
    (process.env.DEMO_ADMIN_USER_IDS ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
  );
}

export function authorizeApiRequest(
  request: Request,
  options: AuthorizationOptions = {},
): AuthorizationResult {
  const url = new URL(request.url);
  const local = isLoopback(url.hostname);
  const id = request.headers.get('oai-authenticated-user-id')?.trim() ?? '';
  const email = request.headers.get('oai-authenticated-user-email')?.trim() ?? '';

  if (!local && !id) {
    return {
      ok: false,
      response: Response.json(
        { error: 'Sign in to access this ContractLedger workspace.' },
        { status: 401 },
      ),
    };
  }

  if (options.write && !sameOrigin(request)) {
    return {
      ok: false,
      response: Response.json(
        { error: 'Cross-origin write requests are not allowed.' },
        { status: 403 },
      ),
    };
  }

  const actor: RequestActor = local
    ? {
        id: 'local-demo-user',
        email: 'local-demo@contractledger.invalid',
        name: 'Selina Armstrong',
        local: true,
      }
    : {
        id,
        email,
        name: decodedDisplayName(request.headers) || email || 'Authenticated user',
        local: false,
      };

  if (options.admin && !actor.local && !hostedAdminIds().has(actor.id)) {
    return {
      ok: false,
      response: Response.json(
        { error: 'Workspace reset is restricted to configured administrators.' },
        { status: 403 },
      ),
    };
  }

  return { ok: true, actor };
}

export async function enforceRateLimit(
  actor: RequestActor,
  scope: string,
  limit: number,
  windowSeconds: number,
) {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const windowStart = Math.floor(nowSeconds / windowSeconds) * windowSeconds;
  const key = `${actor.id}:${scope}:${windowStart}`;
  const result = await env.DB.prepare(`INSERT INTO api_rate_limits
      (key, window_start, request_count)
      VALUES (?, ?, 1)
      ON CONFLICT(key) DO UPDATE SET request_count = request_count + 1
      RETURNING request_count`)
    .bind(key, windowStart)
    .first<{ request_count: number }>();

  if ((result?.request_count ?? 1) <= limit) return null;

  const retryAfter = Math.max(1, windowStart + windowSeconds - nowSeconds);
  return Response.json(
    { error: 'Too many AI requests. Please wait before trying again.' },
    {
      status: 429,
      headers: { 'Retry-After': String(retryAfter) },
    },
  );
}
