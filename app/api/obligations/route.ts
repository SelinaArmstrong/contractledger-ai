import { env } from 'cloudflare:workers';
import { z } from 'zod';

import { ensureWorkspaceDatabase } from '@/db/bootstrap';
import { getWorkspace } from '@/app/api/workspace/route';
import { authorizeApiRequest } from '@/lib/server/request-security';

const obligationSchema = z.object({
  id: z.string().min(1),
  status: z.enum(['upcoming', 'due', 'completed']),
  owner: z.string().trim().max(100).nullable().optional(),
  decision: z
    .enum(['under_review', 'renew', 'do_not_renew', 'not_applicable'])
    .nullable()
    .optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
});

export async function POST(request: Request) {
  const access = await authorizeApiRequest(request, { write: true });
  if (!access.ok) return access.response;

  try {
    await ensureWorkspaceDatabase();
    const input = obligationSchema.parse(await request.json());
    const current = await env.DB.prepare(
      'SELECT id, contract_id FROM key_dates WHERE id = ? LIMIT 1',
    )
      .bind(input.id)
      .first<{ id: string; contract_id: string | null }>();
    if (!current)
      return Response.json({ error: 'Obligation not found.' }, { status: 404 });

    const now = new Date().toISOString();
    await env.DB.batch([
      env.DB.prepare(`UPDATE key_dates
        SET status = ?, owner = ?, decision = ?, notes = ?, completed_at = ?
        WHERE id = ?`).bind(
        input.status,
        input.owner || null,
        input.decision || null,
        input.notes || null,
        input.status === 'completed' ? now : null,
        input.id,
      ),
      env.DB.prepare(`INSERT INTO audit_logs (id, entity_type, entity_id, action, actor, details, created_at)
        VALUES (?, 'key_date', ?, 'obligation_updated', ?, ?, ?)`).bind(
        `audit-${crypto.randomUUID()}`,
        input.id,
        access.actor.name,
        JSON.stringify({
          status: input.status,
          owner: input.owner,
          decision: input.decision,
        }),
        now,
      ),
      ...(current.contract_id
        ? [
            env.DB.prepare(
              'UPDATE contracts SET last_updated = ? WHERE id = ?',
            ).bind(now, current.contract_id),
          ]
        : []),
    ]);

    return Response.json({ saved: true, workspace: await getWorkspace() });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Unable to update the obligation.',
      },
      { status: 400 },
    );
  }
}
