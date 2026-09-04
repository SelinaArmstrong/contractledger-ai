import { env } from 'cloudflare:workers';

import {
  demoSessionFromCookieHeader,
  verifyDemoSessionToken,
} from '@/lib/workspace-auth';
import {
  permissionsForRole,
  roleCan,
  workspacePermissions,
  workspaceRoles,
  type WorkspacePermission,
  type WorkspaceRole,
} from '@/lib/workspace-roles';

export {
  permissionsForRole,
  roleCan,
  workspacePermissions,
  workspaceRoles,
  type WorkspacePermission,
  type WorkspaceRole,
};

export type RequestActor = {
  id: string;
  email: string;
  name: string;
  local: boolean;
  demo: boolean;
  /** Unauthenticated visitor on the public portfolio demo. Always read-only. */
  guest: boolean;
  role: WorkspaceRole;
};

export const GUEST_ACTOR_ID = 'guest-viewer';

function isLoopback(hostname: string) {
  return (
    hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1'
  );
}

/**
 * Public read-only browsing lets a reviewer open the hosted demo without
 * credentials. It is opt-in per deployment because it exposes every read route
 * to anonymous traffic; writes and AI calls stay behind a signed-in account.
 */
export function guestAccessEnabled() {
  return process.env.DEMO_GUEST_ACCESS === 'true';
}

/**
 * Whether an unauthenticated loopback request may act as the maintainer.
 *
 * The hostname of a request is derived from the `Host` header, which the
 * client supplies. Granting the administrator role on that basis alone means a
 * deployment sitting behind any proxy that forwards an arbitrary `Host` hands
 * out full access for free. The convenience is only ever wanted on a developer
 * machine, so it is now an explicit opt-in that `.env.example` enables for
 * local work and no hosted deployment turns on by accident.
 */
export function localMaintainerAccessEnabled() {
  return process.env.ALLOW_LOCAL_MAINTAINER === 'true';
}

/** Hostname of a request, with an IPv6 literal's brackets removed. */
export function requestHostname(host: string | null | undefined) {
  const value = (host ?? '').toLowerCase().trim();
  if (value.startsWith('[')) return value.slice(1, value.indexOf(']'));
  return value.split(':', 1)[0] ?? '';
}

/**
 * True only when this request may use the loopback shortcut: the opt-in is set
 * *and* the request really did arrive on a loopback name.
 */
export function localMaintainerRequest(host: string | null | undefined) {
  return localMaintainerAccessEnabled() && isLoopback(requestHostname(host));
}

/**
 * Client address used to key rate limits and per-visitor AI budgets.
 *
 * `cf-connecting-ip` is written by Cloudflare and cannot be set by the client,
 * so it is trusted whenever present. `x-forwarded-for` is just a request
 * header: on a deployment that is not behind a proxy which overwrites it, a
 * caller can rotate it freely and walk around both the login rate limit and
 * the per-visitor budget. It is therefore only consulted when the operator
 * confirms that something in front of this app rewrites it.
 *
 * Returns '' when no address can be established, which callers treat as a
 * single shared bucket — stricter than trusting a forgeable value.
 */
export function clientAddress(request: Request) {
  const connecting = request.headers.get('cf-connecting-ip')?.trim();
  if (connecting) return connecting;
  if (process.env.TRUST_PROXY_ADDRESS_HEADER !== 'true') return '';
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '';
}

export function guestIdentity() {
  return {
    userId: GUEST_ACTOR_ID,
    displayName: 'Guest viewer',
    email: '',
    fullName: 'Guest viewer',
    local: false,
    demo: false,
    guest: true,
  };
}

/**
 * Whether a state-changing request demonstrably came from this application.
 *
 * `Origin` is sent by every browser on a cross-site POST and cannot be forged
 * by page script, so it is the check that matters. When it is absent the
 * request did not come from a browser form or fetch at all; `Sec-Fetch-Site`
 * is accepted as the same-origin witness for the navigations that legitimately
 * omit `Origin`, and anything else is refused rather than assumed friendly.
 */
export function sameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (origin) {
    try {
      return new URL(origin).origin === new URL(request.url).origin;
    } catch {
      return false;
    }
  }
  const site = request.headers.get('sec-fetch-site');
  return site === 'same-origin' || site === 'none';
}

type AuthorizationOptions = {
  permission?: WorkspacePermission;
};

type AuthorizationResult =
  | { ok: true; actor: RequestActor }
  | { ok: false; response: Response };

/**
 * Resolves who is making the request and whether their role allows it.
 *
 * There is exactly one way to sign in: a signed session cookie issued by
 * `/api/auth/login` for a configured workspace account. Loopback requests are
 * treated as the maintainer so local development needs no credentials, and an
 * anonymous visitor becomes a read-only guest when the deployment opts in.
 */
export async function authorizeApiRequest(
  request: Request,
  options: AuthorizationOptions = {},
): Promise<AuthorizationResult> {
  const url = new URL(request.url);
  const local = localMaintainerRequest(url.hostname);
  const session = await verifyDemoSessionToken(
    demoSessionFromCookieHeader(request.headers.get('cookie')),
  );
  const guest = !local && !session && guestAccessEnabled();

  if (!local && !session && !guest) {
    return {
      ok: false,
      response: Response.json(
        { error: 'Sign in to access this ContractLedger workspace.' },
        { status: 401 },
      ),
    };
  }

  // The origin check is keyed on the method, not the permission. Every browser
  // sends `Origin` on POST and friends, so an unsafe method can be refused
  // outright when it cannot prove where it came from. A GET is left alone even
  // when its permission is a privileged one: CORS already stops another site
  // from reading the response, and demanding a header that Safari only began
  // sending in 16.4 would break exports for no security gain.
  const unsafeMethod = !['GET', 'HEAD', 'OPTIONS'].includes(
    request.method.toUpperCase(),
  );
  if (unsafeMethod && !sameOrigin(request)) {
    return {
      ok: false,
      response: Response.json(
        { error: 'Cross-origin write requests are not allowed.' },
        { status: 403 },
      ),
    };
  }

  // A signed-in account wins over the loopback shortcut, so the maintainer can
  // sign in locally as the demo role to check what a reviewer actually sees.
  const actor: RequestActor = session
    ? {
        id: `account:${session.username}`,
        email: session.email,
        name: session.displayName,
        local,
        demo: true,
        guest: false,
        role: session.role,
      }
    : local
      ? {
          id: 'local-maintainer',
          email: 'local@contractledger.invalid',
          name: 'Local maintainer',
          local: true,
          demo: false,
          guest: false,
          role: 'administrator',
        }
      : {
          id: GUEST_ACTOR_ID,
          email: '',
          name: 'Guest viewer',
          local: false,
          demo: false,
          guest: true,
          role: 'read_only_auditor',
        };

  if (options.permission && !roleCan(actor.role, options.permission)) {
    return {
      ok: false,
      response: Response.json(
        {
          error: `The ${actor.role.replaceAll('_', ' ')} role is not permitted to ${options.permission.replaceAll('_', ' ')}.`,
        },
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
