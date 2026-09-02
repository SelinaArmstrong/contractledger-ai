import { env } from 'cloudflare:workers';
import { z } from 'zod';

import { withApiRoute } from '@/lib/server/route-handler';
import {
  WORKFLOW_TIMING_MODES,
  WORKFLOW_TIMING_SCENARIOS,
  assertRecordableDuration,
  summariseWorkflowTiming,
  type WorkflowTimingRun,
} from '@/lib/workflow-timing';

const recordSchema = z.object({
  scenario: z.enum(WORKFLOW_TIMING_SCENARIOS),
  mode: z.enum(WORKFLOW_TIMING_MODES),
  durationMs: z.number(),
  note: z.string().trim().max(300).nullable().optional(),
});

const deleteSchema = z.object({ id: z.string().min(1).max(120) });

/** Caps the working set so the summary stays a bounded query. */
const TIMING_HISTORY_LIMIT = 500;

async function timingSummary() {
  const rows = await env.DB.prepare(
    `SELECT id, scenario, mode, duration_ms, note, actor, created_at
     FROM workflow_timings
     ORDER BY created_at DESC
     LIMIT ${TIMING_HISTORY_LIMIT}`,
  ).all<{
    id: string;
    scenario: string;
    mode: string;
    duration_ms: number;
    note: string | null;
    actor: string;
    created_at: string;
  }>();

  const runs = rows.results.map((row) => ({
    scenario: row.scenario,
    mode: row.mode,
    durationMs: Number(row.duration_ms),
  })) as WorkflowTimingRun[];

  return {
    comparisons: summariseWorkflowTiming(runs),
    runs: rows.results,
    totalRuns: rows.results.length,
  };
}

export const GET = withApiRoute(
  {
    permission: 'view_workspace',
    errorStatus: 500,
    fallbackError: 'Unable to load workflow timing evidence.',
  },
  async () => Response.json(await timingSummary()),
);

export const POST = withApiRoute(
  {
    permission: 'manage_ai_governance',
    invalidPayloadError: 'Choose a scenario, a mode, and a recorded duration.',
    fallbackError: 'Unable to record the timed run.',
  },
  async ({ request, actor }) => {
    const input = recordSchema.parse(await request.json());
    const durationMs = assertRecordableDuration(input.durationMs);
    const now = new Date().toISOString();

    await env.DB.prepare(
      `INSERT INTO workflow_timings
        (id, scenario, mode, duration_ms, note, actor, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        `timing-${crypto.randomUUID()}`,
        input.scenario,
        input.mode,
        durationMs,
        input.note?.trim() || null,
        actor.name,
        now,
      )
      .run();

    return Response.json({ saved: true, ...(await timingSummary()) });
  },
);

export const DELETE = withApiRoute(
  {
    permission: 'manage_ai_governance',
    invalidPayloadError: 'Choose a recorded run to discard.',
    fallbackError: 'Unable to discard the timed run.',
  },
  async ({ request }) => {
    const input = deleteSchema.parse(await request.json());
    await env.DB.prepare('DELETE FROM workflow_timings WHERE id = ?')
      .bind(input.id)
      .run();
    return Response.json({ deleted: true, ...(await timingSummary()) });
  },
);
