import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

const authorizeApiRequest = vi.fn();
const ensureWorkspaceDatabase = vi.fn();

vi.mock('@/lib/server/request-security', () => ({
  authorizeApiRequest: (...args: unknown[]) => authorizeApiRequest(...args),
}));

vi.mock('@/db/bootstrap', () => ({
  ensureWorkspaceDatabase: (...args: unknown[]) =>
    ensureWorkspaceDatabase(...args),
}));

const { withApiRoute } = await import('@/lib/server/route-handler');
const { DocumentQualityError } = await import('@/lib/document-quality');

const actor = {
  id: 'user-1',
  email: 'reviewer@contractledger.invalid',
  name: 'Reviewer',
  local: true,
  demo: false,
  guest: false,
  role: 'administrator' as const,
};

function requestFor(url = 'https://ledger.test/api/thing') {
  return new Request(url, { method: 'POST' });
}

describe('withApiRoute', () => {
  beforeEach(() => {
    authorizeApiRequest.mockReset();
    ensureWorkspaceDatabase.mockReset();
    authorizeApiRequest.mockResolvedValue({ ok: true, actor });
    ensureWorkspaceDatabase.mockResolvedValue(undefined);
  });

  it('returns the authorization failure without running the handler', async () => {
    const denied = Response.json({ error: 'denied' }, { status: 403 });
    authorizeApiRequest.mockResolvedValue({ ok: false, response: denied });
    const handler = vi.fn();

    const route = withApiRoute({ permission: 'export_data' }, handler);
    const response = await route(requestFor());

    expect(response.status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
    expect(ensureWorkspaceDatabase).not.toHaveBeenCalled();
  });

  it('passes the resolved actor and url to the handler', async () => {
    const route = withApiRoute({ permission: 'view_workspace' }, async (ctx) =>
      Response.json({ actor: ctx.actor.name, path: ctx.url.pathname }),
    );

    const response = await route(requestFor('https://ledger.test/api/records'));

    expect(await response.json()).toEqual({
      actor: 'Reviewer',
      path: '/api/records',
    });
  });

  it('resolves a permission that depends on the request url', async () => {
    const route = withApiRoute(
      {
        permission: (url) =>
          url.searchParams.get('format') === 'ics'
            ? 'export_data'
            : 'view_workspace',
      },
      async () => Response.json({ ok: true }),
    );

    await route(requestFor('https://ledger.test/api/obligations?format=ics'));

    expect(authorizeApiRequest).toHaveBeenCalledWith(expect.anything(), {
      permission: 'export_data',
    });
  });

  it('skips the database prologue when the route does not need it', async () => {
    const route = withApiRoute(
      { permission: 'export_data', database: false },
      async () => Response.json({ ok: true }),
    );

    await route(requestFor());

    expect(ensureWorkspaceDatabase).not.toHaveBeenCalled();
  });

  it('answers 422 with the report for a document quality failure', async () => {
    const report = { pageCount: 3, checkedPages: 3 };
    const route = withApiRoute({ permission: 'submit_documents' }, async () => {
      throw new DocumentQualityError(
        'The file is unreadable.',
        report as never,
      );
    });

    const response = await route(requestFor());

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({
      error: 'The file is unreadable.',
      qualityReport: report,
    });
  });

  it('answers 400 for validation errors even when the route reports 500s', async () => {
    const route = withApiRoute(
      {
        permission: 'view_workspace',
        errorStatus: 500,
        invalidPayloadError: 'Choose a valid record type and identifier.',
      },
      async () => {
        z.object({ id: z.string() }).parse({});
        return Response.json({ ok: true });
      },
    );

    const response = await route(requestFor());

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'Choose a valid record type and identifier.',
    });
  });

  it('surfaces the thrown message by default', async () => {
    const route = withApiRoute({ permission: 'view_workspace' }, async () => {
      throw new Error('Obligation not found.');
    });

    const response = await route(requestFor());

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Obligation not found.' });
  });

  it('redacts internal failures when the route asks it to', async () => {
    const route = withApiRoute(
      {
        permission: 'view_documents',
        errorStatus: 500,
        redactErrors: true,
        fallbackError: 'Unable to load record details.',
      },
      async () => {
        throw new Error('D1_ERROR: no such column: secret_internal');
      },
    );

    const response = await route(requestFor());

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: 'Unable to load record details.',
    });
  });

  it('uses the fallback message when a non-Error value is thrown', async () => {
    const route = withApiRoute(
      { permission: 'view_workspace', fallbackError: 'Unable to load.' },
      async () => {
        throw 'string failure';
      },
    );

    expect(await (await route(requestFor())).json()).toEqual({
      error: 'Unable to load.',
    });
  });
});
