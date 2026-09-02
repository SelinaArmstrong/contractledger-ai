import { env } from 'cloudflare:workers';
import { z } from 'zod';

import {
  AMENDMENT_PROMPT_VERSION,
  analyzeAmendmentFile,
  type AmendmentBaseContract,
} from '@/app/api/amendments/analyze/route';
import {
  SUPPLIER_PROMPT_VERSION,
  analyzeSupplierFile,
} from '@/app/api/analyze-supplier-document/route';
import {
  CONTRACT_PROMPT_VERSION,
  analyzeContractFile,
} from '@/app/api/analyze/route';
import { getWorkspace } from '@/app/api/workspace/route';
import {
  AI_EVALUATION_DATASET_VERSION,
  AI_EVALUATION_EXECUTION_CASES,
  AI_EXTRACTION_VERSION,
  evaluateAIResults,
  type EvaluationCaseInput,
} from '@/lib/ai-evaluation';
import { enforceRateLimit } from '@/lib/server/request-security';
import { withApiRoute } from '@/lib/server/route-handler';

const actionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('run') }).strict(),
  z
    .object({
      action: z.literal('approve_baseline'),
      runId: z.string().regex(/^aieval-[a-f0-9-]+$/),
    })
    .strict(),
]);

const apexBaseContract: AmendmentBaseContract = {
  contract_number: 'CT-2026-004',
  title: 'Equipment Supply Agreement',
  supplier_name: 'Apex Equipment LLC',
  current_value_cents: 47_500_000,
  expiration_date: '2027-01-31',
  payment_terms: 'Net 45',
  renewal_type: 'none',
  notice_days: null,
};

function promptVersion(kind: string) {
  if (kind === 'supplier_document') return SUPPLIER_PROMPT_VERSION;
  if (kind === 'amendment') return AMENDMENT_PROMPT_VERSION;
  return CONTRACT_PROMPT_VERSION;
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  mapper: (value: T) => Promise<R>,
) {
  const results = Array.from({ length: values.length }) as R[];
  let nextIndex = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, async () => {
      while (nextIndex < values.length) {
        const index = nextIndex++;
        results[index] = await mapper(values[index]);
      }
    }),
  );
  return results;
}

function chunkRows<T>(values: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size)
    chunks.push(values.slice(index, index + size));
  return chunks;
}

async function loadFixture(request: Request, fileName: string) {
  const response = await fetch(
    new URL(`/demo-documents/${encodeURIComponent(fileName)}`, request.url),
  );
  if (!response.ok) throw new Error(`Unable to load ${fileName}.`);
  const isText = fileName.toLowerCase().endsWith('.txt');
  return new File([await response.blob()], fileName, {
    type: isText ? 'text/plain' : 'application/pdf',
  });
}

async function evaluateFixture(
  request: Request,
  apiKey: string,
  evaluationCase: (typeof AI_EVALUATION_EXECUTION_CASES)[number],
): Promise<EvaluationCaseInput> {
  const startedAt = Date.now();
  const version = promptVersion(evaluationCase.kind);
  try {
    const file = await loadFixture(request, evaluationCase.fileName);
    const result =
      evaluationCase.kind === 'supplier_document'
        ? await analyzeSupplierFile(
            file,
            evaluationCase.expectedDocumentType ?? '',
            apiKey,
          )
        : evaluationCase.kind === 'amendment'
          ? await analyzeAmendmentFile(file, apexBaseContract, apiKey)
          : await analyzeContractFile(
              file,
              evaluationCase.stage ?? 'draft',
              apiKey,
            );
    return {
      caseId: evaluationCase.id,
      model: result.model,
      promptVersion: version,
      extractionVersion: AI_EXTRACTION_VERSION,
      analysis: result.analysis,
      status: 'success',
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      caseId: evaluationCase.id,
      model: 'analysis-failed',
      promptVersion: version,
      extractionVersion: AI_EXTRACTION_VERSION,
      status: 'failed',
      durationMs: Date.now() - startedAt,
      failureReason:
        error instanceof Error ? error.message : 'Fixture analysis failed.',
    };
  }
}

function csvCell(value: unknown) {
  let text = '';
  if (typeof value === 'string') text = value;
  else if (typeof value === 'number' || typeof value === 'boolean')
    text = `${value}`;
  else if (value !== null && value !== undefined) text = JSON.stringify(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export const GET = withApiRoute(
  {
    permission: 'export_data',
    errorStatus: 500,
    fallbackError: 'Unable to export the validation report.',
  },
  async ({ url }) => {
    const requestedRunId = url.searchParams.get('runId');
    if (requestedRunId && !/^aieval-[a-f0-9-]+$/.test(requestedRunId)) {
      return Response.json(
        { error: 'Invalid evaluation run.' },
        { status: 400 },
      );
    }
    const run = requestedRunId
      ? await env.DB.prepare('SELECT * FROM ai_evaluation_runs WHERE id = ?')
          .bind(requestedRunId)
          .first<Record<string, string | number | null>>()
      : await env.DB.prepare(
          'SELECT * FROM ai_evaluation_runs ORDER BY created_at DESC LIMIT 1',
        ).first<Record<string, string | number | null>>();
    if (!run)
      return Response.json(
        { error: 'No validation run is available.' },
        { status: 404 },
      );
    const [fields, corrections] = await Promise.all([
      env.DB.prepare(`SELECT * FROM ai_evaluation_field_results
        WHERE run_id = ? ORDER BY document_type, case_id, field_name`)
        .bind(run.id)
        .all<Record<string, string | number | null>>(),
      env.DB.prepare(`SELECT field_name, COUNT(*) AS reviewed_fields,
        SUM(CASE WHEN review_status = 'corrected' THEN 1 ELSE 0 END) AS corrected_fields,
        ROUND(100.0 * SUM(CASE WHEN review_status = 'corrected' THEN 1 ELSE 0 END) /
          NULLIF(COUNT(*), 0), 1) AS correction_rate_percent
        FROM ai_field_reviews GROUP BY field_name ORDER BY field_name`).all<
        Record<string, string | number | null>
      >(),
    ]);
    const correctionByField = new Map(
      corrections.results.map((item) => [item.field_name, item]),
    );
    const headers = [
      'dataset_version',
      'fixture_version',
      'run_id',
      'created_at',
      'model',
      'prompt_version',
      'extraction_version',
      'case_count',
      'field_accuracy_percent',
      'critical_accuracy_percent',
      'source_coverage_percent',
      'unsupported_value_percent',
      'processing_success_percent',
      'median_duration_ms',
      'baseline_run_id',
      'regression_delta',
      'promotion_status',
      'case_id',
      'document_type',
      'field_name',
      'field_label',
      'critical',
      'expected',
      'actual',
      'correct',
      'source_backed',
      'confidence',
      'operational_reviewed_fields',
      'operational_corrected_fields',
      'operational_correction_rate_percent',
    ];
    const rows = fields.results.map((item) => {
      const correction = correctionByField.get(item.field_name);
      return [
        run.dataset_version,
        run.fixture_version,
        run.id,
        run.created_at,
        run.model,
        run.prompt_version,
        run.extraction_version,
        run.case_count,
        run.accuracy_percent,
        run.critical_accuracy_percent,
        run.source_coverage_percent,
        run.unsupported_value_percent,
        run.processing_success_percent,
        run.median_duration_ms,
        run.baseline_run_id,
        run.regression_delta,
        run.promotion_status,
        item.case_id,
        item.document_type,
        item.field_name,
        item.label,
        item.critical,
        item.expected_json,
        item.actual_json,
        item.correct,
        item.source_backed,
        item.confidence,
        correction?.reviewed_fields,
        correction?.corrected_fields,
        correction?.correction_rate_percent,
      ];
    });
    const csv = [headers, ...rows]
      .map((row) => row.map(csvCell).join(','))
      .join('\n');
    return new Response(`\uFEFF${csv}`, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="contractledger-ai-validation-${run.id}.csv"`,
        'Cache-Control': 'no-store',
      },
    });
  },
);

export const POST = withApiRoute(
  {
    permission: 'manage_ai_governance',
    invalidPayloadError: 'Invalid evaluation action.',
    fallbackError: 'Unable to complete the AI evaluation.',
  },
  async ({ request, actor }) => {
    const input = actionSchema.parse(
      request.headers.get('content-type')?.includes('application/json')
        ? await request.json()
        : { action: 'run' },
    );
    if (input.action === 'approve_baseline') {
      const run = await env.DB.prepare(`SELECT id, dataset_version,
        promotion_status, failed_cases FROM ai_evaluation_runs WHERE id = ?`)
        .bind(input.runId)
        .first<{
          id: string;
          dataset_version: string;
          promotion_status: string;
          failed_cases: number;
        }>();
      if (!run) throw new Error('The validation run was not found.');
      if (run.promotion_status === 'blocked' || run.failed_cases > 0) {
        throw new Error(
          'A blocked or incomplete validation run cannot become the approved baseline.',
        );
      }
      const now = new Date().toISOString();
      await env.DB.batch([
        env.DB.prepare(`UPDATE ai_evaluation_runs
          SET is_approved_baseline = 0 WHERE dataset_version = ?`).bind(
          run.dataset_version,
        ),
        env.DB.prepare(`UPDATE ai_evaluation_runs
          SET is_approved_baseline = 1 WHERE id = ?`).bind(run.id),
        env.DB.prepare(`INSERT INTO audit_logs
          (id, entity_type, entity_id, action, actor, details, created_at)
          VALUES (?, 'ai_evaluation', ?, 'baseline_approved', ?, ?, ?)`).bind(
          `audit-${crypto.randomUUID()}`,
          run.id,
          actor.name,
          JSON.stringify({ datasetVersion: run.dataset_version }),
          now,
        ),
      ]);
      return Response.json({ saved: true, workspace: await getWorkspace() });
    }

    const rateLimited = await enforceRateLimit(actor, 'ai-evaluation', 2, 600);
    if (rateLimited) return rateLimited;
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return Response.json(
        { error: 'DeepSeek is not configured.' },
        { status: 503 },
      );
    }

    const baseline = await env.DB.prepare(`SELECT id,
        critical_accuracy_percent AS criticalAccuracyPercent
        FROM ai_evaluation_runs
        WHERE dataset_version = ? AND is_approved_baseline = 1
        ORDER BY created_at DESC LIMIT 1`)
      .bind(AI_EVALUATION_DATASET_VERSION)
      .first<{ id: string; criticalAccuracyPercent: number }>();
    const cases = await mapWithConcurrency(
      AI_EVALUATION_EXECUTION_CASES,
      3,
      (evaluationCase) => evaluateFixture(request, apiKey, evaluationCase),
    );
    const evaluation = evaluateAIResults(cases, baseline);
    const id = `aieval-${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    const caseRows = evaluation.details.map((detail) => [
      `aievalcase-${crypto.randomUUID()}`,
      id,
      detail.caseId,
      detail.title,
      detail.fileName,
      detail.documentType,
      detail.difficulty,
      detail.fixtureVersion,
      detail.model,
      detail.promptVersion,
      detail.extractionVersion,
      detail.status,
      detail.durationMs,
      detail.failureReason,
      detail.totalFields,
      detail.correctFields,
      now,
    ]);
    const caseStatements = chunkRows(caseRows, 5).map((rows) =>
      env.DB.prepare(`INSERT INTO ai_evaluation_case_results
        (id, run_id, case_id, title, file_name, document_type, difficulty,
         fixture_version, model, prompt_version, extraction_version, status,
         duration_ms, failure_reason, total_fields, correct_fields, created_at)
        VALUES ${rows.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ')}`).bind(
        ...rows.flat(),
      ),
    );
    const fieldRows = evaluation.details.flatMap((detail) =>
      detail.fields.map((item) => [
        `aievalfield-${crypto.randomUUID()}`,
        id,
        detail.caseId,
        detail.documentType,
        item.fieldName,
        item.label,
        JSON.stringify(item.expected),
        JSON.stringify(item.actual),
        item.critical ? 1 : 0,
        item.correct ? 1 : 0,
        item.confidence,
        item.sourceBacked ? 1 : 0,
        item.unsupported ? 1 : 0,
        now,
      ]),
    );
    const fieldStatements = chunkRows(fieldRows, 6).map((rows) =>
      env.DB.prepare(`INSERT INTO ai_evaluation_field_results
        (id, run_id, case_id, document_type, field_name, label,
         expected_json, actual_json, critical, correct, confidence,
         source_backed, unsupported, created_at)
        VALUES ${rows.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ')}`).bind(
        ...rows.flat(),
      ),
    );
    const statements = [
      env.DB.prepare(`INSERT INTO ai_evaluation_runs
        (id, model, case_count, total_fields, correct_fields,
         source_backed_fields, accuracy_percent, source_coverage_percent,
         average_confidence, dataset_version, fixture_version, prompt_version,
         extraction_version, critical_fields, correct_critical_fields,
         critical_accuracy_percent, unsupported_fields,
         unsupported_value_percent, successful_cases, failed_cases,
         processing_success_percent, median_duration_ms, baseline_run_id,
         regression_delta, regression_threshold, promotion_status,
         is_approved_baseline, details_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?, 0, ?, ?)`).bind(
        id,
        evaluation.model,
        evaluation.caseCount,
        evaluation.totalFields,
        evaluation.correctFields,
        evaluation.sourceBackedFields,
        evaluation.accuracyPercent,
        evaluation.sourceCoveragePercent,
        evaluation.averageConfidence,
        evaluation.datasetVersion,
        evaluation.fixtureVersion,
        evaluation.promptVersion,
        evaluation.extractionVersion,
        evaluation.criticalFields,
        evaluation.correctCriticalFields,
        evaluation.criticalAccuracyPercent,
        evaluation.unsupportedFields,
        evaluation.unsupportedValuePercent,
        evaluation.successfulCases,
        evaluation.failedCases,
        evaluation.processingSuccessPercent,
        evaluation.medianDurationMs,
        evaluation.baselineRunId,
        evaluation.regressionDelta,
        evaluation.regressionThreshold,
        evaluation.promotionStatus,
        JSON.stringify(evaluation.details),
        now,
      ),
      ...caseStatements,
      ...fieldStatements,
      env.DB.prepare(`INSERT INTO audit_logs
        (id, entity_type, entity_id, action, actor, details, created_at)
        VALUES (?, 'ai_evaluation', ?, 'evaluation_completed', ?, ?, ?)`).bind(
        `audit-${crypto.randomUUID()}`,
        id,
        actor.name,
        JSON.stringify({
          datasetVersion: evaluation.datasetVersion,
          caseCount: evaluation.caseCount,
          totalFields: evaluation.totalFields,
          criticalAccuracyPercent: evaluation.criticalAccuracyPercent,
          processingSuccessPercent: evaluation.processingSuccessPercent,
          promotionStatus: evaluation.promotionStatus,
        }),
        now,
      ),
    ];
    await env.DB.batch(statements);
    return Response.json({
      saved: true,
      evaluation: { id, createdAt: now, ...evaluation },
      workspace: await getWorkspace(),
    });
  },
);
