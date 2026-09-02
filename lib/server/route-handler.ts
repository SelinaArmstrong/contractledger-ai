import { z } from 'zod';

import { ensureWorkspaceDatabase } from '@/db/bootstrap';
import { DocumentQualityError } from '@/lib/document-quality';
import {
  authorizeApiRequest,
  type RequestActor,
  type WorkspacePermission,
} from '@/lib/server/request-security';

/**
 * Everything a route handler needs after the shared prologue has run. The
 * request is still available for body parsing; `url` and `actor` are provided
 * because nearly every handler needed to recompute them by hand.
 */
export type RouteContext = {
  request: Request;
  url: URL;
  actor: RequestActor;
};

/**
 * Most routes require one fixed permission. A few resolve it from the request
 * (an `?format=ics` export needs `export_data` while the plain read does not),
 * so a resolver function is accepted as well.
 */
type PermissionResolver =
  | WorkspacePermission
  | ((url: URL) => WorkspacePermission);

export type RouteOptions = {
  permission?: PermissionResolver;
  /**
   * Routes that never touch D1 (signed-URL authorization, R2-only reads) skip
   * the migration/seed check so they stay cheap.
   */
  database?: boolean;
  /**
   * Status for uncaught handler errors. Defaults to 400. A resolver lets a
   * route separate conflicts from bad requests. Validation failures always
   * answer 400 regardless of this value.
   */
  errorStatus?: number | ((error: unknown) => number);
  /** Message used when the request body fails Zod validation. */
  invalidPayloadError?: string;
  /** Message used when a non-Error value is thrown, or when redacting. */
  fallbackError?: string;
  /**
   * Suppresses the thrown message so internal failures (SQL, storage) are not
   * echoed to the client. The route answers `fallbackError` instead.
   */
  redactErrors?: boolean;
};

/**
 * Translates a thrown value into the response shape the workspace client
 * expects. Keeping this in one place is why individual routes no longer repeat
 * the DocumentQualityError / ZodError / Error ladder.
 */
function errorResponse(error: unknown, options: RouteOptions): Response {
  if (error instanceof DocumentQualityError) {
    return Response.json(
      { error: error.message, qualityReport: error.report },
      { status: 422 },
    );
  }

  const fallback =
    options.fallbackError ?? 'The request could not be completed.';

  // A malformed request is a client error even when the route reports its own
  // failures as 500s, so validation keeps its own status.
  if (error instanceof z.ZodError) {
    return Response.json(
      { error: options.invalidPayloadError ?? fallback },
      { status: 400 },
    );
  }

  return Response.json(
    {
      error:
        error instanceof Error && !options.redactErrors
          ? error.message
          : fallback,
    },
    {
      status:
        typeof options.errorStatus === 'function'
          ? options.errorStatus(error)
          : (options.errorStatus ?? 400),
    },
  );
}

/**
 * Wraps an API route with the prologue every authenticated route shared:
 * permission check, workspace database readiness, and consistent error
 * mapping. Handlers keep their own try/catch only when they need to undo a
 * side effect before the error is reported.
 */
export function withApiRoute(
  options: RouteOptions,
  handler: (context: RouteContext) => Promise<Response>,
) {
  return async function route(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const permission =
      typeof options.permission === 'function'
        ? options.permission(url)
        : options.permission;

    const access = await authorizeApiRequest(request, { permission });
    if (!access.ok) return access.response;

    try {
      if (options.database !== false) await ensureWorkspaceDatabase();
      return await handler({ request, url, actor: access.actor });
    } catch (error) {
      return errorResponse(error, options);
    }
  };
}
