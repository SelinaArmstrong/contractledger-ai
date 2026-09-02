import { env } from 'cloudflare:workers';

import {
  demoSessionFromCookieHeader,
  verifyDemoSessionToken,
} from '@/lib/demo-auth';

export type RequestActor = {
  id: string;
  email: string;
  name: string;
  local: boolean;
  demo: boolean;
  role: WorkspaceRole;
};

export const workspaceRoles = [
  'requester',
  'contract_administrator',
  'legal_reviewer',
  'procurement_compliance_reviewer',
  'approver',
  'read_only_auditor',
  'administrator',
] as const;

export type WorkspaceRole = (typeof workspaceRoles)[number];

export const workspacePermissions = [
  'view_workspace',
  'view_documents',
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
  'reset_workspace',
] as const;

export type WorkspacePermission = (typeof workspacePermissions)[number];

const permissionPolicy: Record<
  WorkspaceRole,
  ReadonlySet<WorkspacePermission>
> = {
  requester: new Set(['view_workspace', 'view_documents', 'submit_documents']),
  contract_administrator: new Set([
    'view_workspace',
    'view_documents',
    'submit_documents',
    'edit_verified_fields',
    'edit_supplier_records',
    'apply_amendments',
    'complete_obligations',
    'manage_imports',
    'run_ai_assistant',
    'manage_ai_governance',
    'export_data',
  ]),
  legal_reviewer: new Set([
    'view_workspace',
    'view_documents',
    'approve_exceptions',
    'run_ai_assistant',
  ]),
  procurement_compliance_reviewer: new Set([
    'view_workspace',
    'view_documents',
    'submit_documents',
    'edit_supplier_records',
    'approve_exceptions',
    'complete_obligations',
    'run_ai_assistant',
  ]),
  approver: new Set(['view_workspace', 'view_documents', 'approve_exceptions']),
  read_only_auditor: new Set([
    'view_workspace',
    'view_documents',
    'export_data',
  ]),
  administrator: new Set(workspacePermissions),
};

type AuthorizationOptions = {
  permission?: WorkspacePermission;
};

type AuthorizationResult =
  | { ok: true; actor: RequestActor }
  | { ok: false; response: Response };

function isLoopback(hostname: string) {
  return (
    hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]'
  );
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

function configuredRoleAssignments() {
  const raw = process.env.WORKSPACE_ROLE_ASSIGNMENTS?.trim();
  if (!raw) return new Map<string, WorkspaceRole>();
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return new Map(
      Object.entries(parsed).flatMap(([identity, role]) =>
        typeof role === 'string' &&
        workspaceRoles.includes(role as WorkspaceRole)
          ? [[identity.trim().toLowerCase(), role as WorkspaceRole]]
          : [],
      ),
    );
  } catch {
    return new Map<string, WorkspaceRole>();
  }
}

export function resolveWorkspaceRole(actor: {
  id: string;
  email: string;
  local: boolean;
  demo: boolean;
}): WorkspaceRole {
  if (actor.local || actor.demo || hostedAdminIds().has(actor.id)) {
    return 'administrator';
  }
  const assignments = configuredRoleAssignments();
  return (
    assignments.get(actor.id.toLowerCase()) ??
    assignments.get(actor.email.toLowerCase()) ??
    'read_only_auditor'
  );
}

export function roleCan(role: WorkspaceRole, permission: WorkspacePermission) {
  return permissionPolicy[role].has(permission);
}

export function permissionsForRole(role: WorkspaceRole) {
  return workspacePermissions.filter((permission) => roleCan(role, permission));
}

export async function authorizeApiRequest(
  request: Request,
  options: AuthorizationOptions = {},
): Promise<AuthorizationResult> {
  const url = new URL(request.url);
  const local = isLoopback(url.hostname);
  const id = request.headers.get('oai-authenticated-user-id')?.trim() ?? '';
  const email =
    request.headers.get('oai-authenticated-user-email')?.trim() ?? '';
  const demoSession =
    !local && !id
      ? await verifyDemoSessionToken(
          demoSessionFromCookieHeader(request.headers.get('cookie')),
        )
      : null;

  if (!local && !id && !demoSession) {
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

  const actorWithoutRole = local
    ? {
        id: 'local-demo-user',
        email: 'local-demo@contractledger.invalid',
        name: 'Selina Armstrong',
        local: true,
        demo: false,
      }
    : demoSession
      ? {
          id: `demo:${demoSession.username}`,
          email: demoSession.email,
          name: demoSession.displayName,
          local: false,
          demo: true,
        }
      : {
          id,
          email,
          name:
            decodedDisplayName(request.headers) ||
            email ||
            'Authenticated user',
          local: false,
          demo: false,
        };

  const actor: RequestActor = {
    ...actorWithoutRole,
    role: resolveWorkspaceRole(actorWithoutRole),
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
