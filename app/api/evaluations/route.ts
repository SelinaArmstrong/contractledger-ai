import { env } from 'cloudflare:workers';
import { z } from 'zod';

import { getWorkspace } from '@/app/api/workspace/route';
import { ensureWorkspaceDatabase } from '@/db/bootstrap';
import {
  AI_EVALUATION_CASES,
  evaluateAIResults,
} from '@/lib/ai-evaluation';

const evaluationSchema = z.object({
  cases: z
    .array(
      z.object({
        caseId: z.string(),
        model: z.string().min(1),
        analysis: z.record(z.string(), z.unknown()),
      }),
    )
    .length(AI_EVALUATION_CASES.length),
});

export async function POST(request: Request) {
  try {
    await ensureWorkspaceDatabase();
    const input = evaluationSchema.parse(await request.json());
    const requiredCaseIds = new Set(AI_EVALUATION_CASES.map((item) => item.id));
    const submittedCaseIds = new Set(input.cases.map((item) => item.caseId));
    if (
      submittedCaseIds.size !== requiredCaseIds.size ||
      [...requiredCaseIds].some((caseId) => !submittedCaseIds.has(caseId))
    )
      throw new Error('Run every required demo evaluation case.');

    const evaluation = evaluateAIResults(input.cases);
    const id = `aieval-${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO ai_evaluation_runs
        (id, model, case_count, total_fields, correct_fields,
         source_backed_fields, accuracy_percent, source_coverage_percent,
         average_confidence, details_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
        id,
        evaluation.model,
        evaluation.caseCount,
        evaluation.totalFields,
        evaluation.correctFields,
        evaluation.sourceBackedFields,
        evaluation.accuracyPercent,
        evaluation.sourceCoveragePercent,
        evaluation.averageConfidence,
        JSON.stringify(evaluation.details),
        now,
      ),
      env.DB.prepare(`INSERT INTO audit_logs
        (id, entity_type, entity_id, action, actor, details, created_at)
        VALUES (?, 'ai_evaluation', ?, 'evaluation_completed',
          'Selina Armstrong', ?, ?)`).bind(
        `audit-${crypto.randomUUID()}`,
        id,
        JSON.stringify({
          caseCount: evaluation.caseCount,
          totalFields: evaluation.totalFields,
          accuracyPercent: evaluation.accuracyPercent,
          sourceCoveragePercent: evaluation.sourceCoveragePercent,
        }),
        now,
      ),
    ]);
    return Response.json({
      saved: true,
      evaluation: { id, createdAt: now, ...evaluation },
      workspace: await getWorkspace(),
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Unable to complete the AI evaluation.',
      },
      { status: 400 },
    );
  }
}
