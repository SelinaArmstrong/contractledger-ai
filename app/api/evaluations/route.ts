import { env } from 'cloudflare:workers';

import { analyzeSupplierFile } from '@/app/api/analyze-supplier-document/route';
import { analyzeContractFile } from '@/app/api/analyze/route';
import { getWorkspace } from '@/app/api/workspace/route';
import { ensureWorkspaceDatabase } from '@/db/bootstrap';
import {
  AI_EVALUATION_CASES,
  evaluateAIResults,
} from '@/lib/ai-evaluation';
import {
  authorizeApiRequest,
  enforceRateLimit,
} from '@/lib/server/request-security';

export async function POST(request: Request) {
  const access = await authorizeApiRequest(request, { write: true });
  if (!access.ok) return access.response;

  try {
    await ensureWorkspaceDatabase();
    const rateLimited = await enforceRateLimit(
      access.actor,
      'ai-evaluation',
      2,
      600,
    );
    if (rateLimited) return rateLimited;
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return Response.json(
        { error: 'DeepSeek is not configured.' },
        { status: 503 },
      );
    }

    const cases = await Promise.all(
      AI_EVALUATION_CASES.map(async (evaluationCase) => {
        const fileResponse = await fetch(
          new URL(`/demo-documents/${evaluationCase.fileName}`, request.url),
        );
        if (!fileResponse.ok)
          throw new Error(`Unable to load ${evaluationCase.fileName}.`);
        const file = new File(
          [await fileResponse.blob()],
          evaluationCase.fileName,
          { type: 'application/pdf' },
        );
        const result =
          evaluationCase.id === 'supplier-coi'
            ? await analyzeSupplierFile(
                file,
                'insurance_certificate',
                apiKey,
              )
            : await analyzeContractFile(
                file,
                evaluationCase.id === 'contract-executed'
                  ? 'executed'
                  : 'draft',
                apiKey,
              );
        return {
          caseId: evaluationCase.id,
          model: result.model,
          analysis: result.analysis,
        };
      }),
    );

    const evaluation = evaluateAIResults(cases);
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
          ?, ?, ?)`).bind(
          `audit-${crypto.randomUUID()}`,
          id,
          access.actor.name,
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
