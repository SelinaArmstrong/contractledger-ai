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

/**
 * Public read-only browsing lets a reviewer open the hosted demo without
 * credentials. It is opt-in per deployment because it exposes every read route
 * to anonymous traffic; writes and AI calls stay behind a signed-in account.
 */
export function guestAccessEnabled() {
  return process.env.DEMO_GUEST_ACCESS === 'true';
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

function isLoopback(hostname: string) {
  return (
    hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]'
  );
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
  const local = isLoopback(url.hostname);
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

  const write = options.permission
    ? !['view_workspace', 'view_documents'].includes(options.permission)
    : false;
  if (write && !sameOrigin(request)) {
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
