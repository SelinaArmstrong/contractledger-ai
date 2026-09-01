import { env } from 'cloudflare:workers';
import { z } from 'zod';

import { ensureWorkspaceDatabase } from '@/db/bootstrap';
import { getWorkspace } from '@/app/api/workspace/route';
import { authorizeApiRequest } from '@/lib/server/request-security';
import { isIsoDate } from '@/lib/validation';

const intakeStatuses = [
  'draft',
  'under_review',
  'waiting_on_business',
  'waiting_on_legal',
  'revision_requested',
  'approved_for_signature',
  'not_awarded',
  'executed',
] as const;

const querySchema = z.object({ id: z.string().min(1).max(200) });

const updateSchema = z.object({
  id: z.string().min(1).max(200),
  status: z.enum(intakeStatuses),
  owner: z.string().trim().min(1).max(160),
  targetReviewDate: z
    .string()
    .refine((value) => !value || isIsoDate(value), 'Use a valid target date.'),
  internalNotes: z.string().max(5_000),
  approvalStatus: z.enum(['not_required', 'pending', 'approved', 'declined']),
  findings: z
    .array(
      z.object({
        id: z.string().min(1).max(200),
        status: z.enum(['open', 'accepted', 'resolved', 'dismissed']),
      }),
    )
    .max(100),
});

async function getIntakeDetails(id: string) {
  const intake = await env.DB.prepare(`SELECT i.*,
      CASE WHEN COALESCE(i.proposed_value_cents, 0) > 50000000
        THEN 'CFO approval' ELSE 'No additional approval' END AS required_approval,
      CASE
        WHEN EXISTS (SELECT 1 FROM review_findings f WHERE f.intake_id = i.id AND f.status = 'open' AND f.severity = 'high') THEN 'high'
        WHEN EXISTS (SELECT 1 FROM review_findings f WHERE f.intake_id = i.id AND f.status = 'open' AND f.severity = 'medium') THEN 'medium'
        ELSE 'low'
      END AS risk_level
    FROM contract_intakes i WHERE i.id = ? LIMIT 1`)
    .bind(id)
    .first<Record<string, string | number | null>>();
  if (!intake) return null;

  const [supplier, documents, findings, analysisRun, auditLogs] =
    await Promise.all([
      intake.supplier_id
        ? env.DB.prepare(`SELECT * FROM suppliers WHERE id = ? LIMIT 1`)
            .bind(intake.supplier_id)
            .first<Record<string, string | number | null>>()
        : Promise.resolve(null),
      env.DB.prepare(`SELECT id, supplier_id, intake_id, contract_id,
          parent_document_id, file_name, file_type, lifecycle_stage, mime_type,
          page_count, review_status, ai_status, uploaded_at
        FROM documents WHERE intake_id = ? ORDER BY uploaded_at DESC LIMIT 100`)
        .bind(id)
        .all<Record<string, string | number | null>>(),
      env.DB.prepare(`SELECT * FROM review_findings
        WHERE intake_id = ? ORDER BY
          CASE severity WHEN 'high' THEN 0 WHEN 'medium' THEN 1 WHEN 'low' THEN 2 ELSE 3 END,
          source_page, rule_name`)
        .bind(id)
        .all<Record<string, string | number | null>>(),
      env.DB.prepare(`SELECT id, model, prompt_version, verified_result_json,
          correction_count, reviewed_by, reviewed_at, file_name, document_id
        FROM ai_analysis_runs
        WHERE intake_id = ? AND stage = 'draft' AND status = 'verified'
        ORDER BY reviewed_at DESC LIMIT 1`)
        .bind(id)
        .first<Record<string, string | number | null>>(),
      env.DB.prepare(`SELECT id, action, actor, details, created_at
        FROM audit_logs WHERE entity_type = 'contract_intake' AND entity_id = ?
        ORDER BY created_at DESC LIMIT 50`)
        .bind(id)
        .all<Record<string, string | number | null>>(),
    ]);

  const fieldReviews = analysisRun
    ? await env.DB.prepare(`SELECT * FROM ai_field_reviews
        WHERE analysis_run_id = ? ORDER BY field_name`)
        .bind(analysisRun.id)
        .all<Record<string, string | number | null>>()
    : { results: [] };
  let analysis: unknown = null;
  if (typeof analysisRun?.verified_result_json === 'string') {
    try {
      analysis = JSON.parse(analysisRun.verified_result_json);
    } catch {
      analysis = null;
    }
  }

  return {
    intake,
    supplier,
    documents: documents.results,
    findings: findings.results,
    analysis,
    analysisMeta: analysisRun
      ? {
          id: analysisRun.id,
          model: analysisRun.model,
          prompt_version: analysisRun.prompt_version,
          correction_count: analysisRun.correction_count,
          reviewed_by: analysisRun.reviewed_by,
          reviewed_at: analysisRun.reviewed_at,
          file_name: analysisRun.file_name,
          document_id: analysisRun.document_id,
        }
      : null,
    fieldReviews: fieldReviews.results,
    auditLogs: auditLogs.results,
  };
}

export async function GET(request: Request) {
  const access = await authorizeApiRequest(request);
  if (!access.ok) return access.response;
  try {
    await ensureWorkspaceDatabase();
    const url = new URL(request.url);
    const { id } = querySchema.parse({ id: url.searchParams.get('id') });
    const details = await getIntakeDetails(id);
    if (!details)
      return Response.json(
        { error: 'Review intake not found.' },
        { status: 404 },
      );
    return Response.json(details);
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof z.ZodError
            ? 'Choose a valid review intake.'
            : 'Unable to load the review intake.',
      },
      { status: error instanceof z.ZodError ? 400 : 500 },
    );
  }
}

export async function PATCH(request: Request) {
  const access = await authorizeApiRequest(request, { write: true });
  if (!access.ok) return access.response;
  try {
    await ensureWorkspaceDatabase();
    const input = updateSchema.parse(await request.json());
    const existing = await env.DB.prepare(`SELECT id, proposed_value_cents
      FROM contract_intakes WHERE id = ? LIMIT 1`)
      .bind(input.id)
      .first<{ id: string; proposed_value_cents: number | null }>();
    if (!existing)
      return Response.json(
        { error: 'Review intake not found.' },
        { status: 404 },
      );

    const cfoApprovalRequired =
      Number(existing.proposed_value_cents ?? 0) > 50_000_000;
    if (
      input.status === 'approved_for_signature' &&
      cfoApprovalRequired &&
      input.approvalStatus !== 'approved'
    ) {
      return Response.json(
        {
          error:
            'CFO approval must be recorded before this intake can be approved for signature.',
        },
        { status: 400 },
      );
    }
    const reviewStatus = [
      'approved_for_signature',
      'not_awarded',
      'executed',
    ].includes(input.status)
      ? 'complete'
      : input.status === 'draft'
        ? 'pending'
        : 'in_progress';
    const now = new Date().toISOString();
    await env.DB.batch([
      env.DB.prepare(`UPDATE contract_intakes SET status = ?, review_status = ?,
          owner = ?, target_review_date = ?, internal_notes = ?,
          approval_status = ?, updated_at = ? WHERE id = ?`).bind(
        input.status,
        reviewStatus,
        input.owner,
        input.targetReviewDate || null,
        input.internalNotes.trim() || null,
        cfoApprovalRequired ? input.approvalStatus : 'not_required',
        now,
        input.id,
      ),
      ...input.findings.map((finding) =>
        env.DB.prepare(`UPDATE review_findings SET status = ?
          WHERE id = ? AND intake_id = ?`).bind(
          finding.status,
          finding.id,
          input.id,
        ),
      ),
      env.DB.prepare(`INSERT INTO audit_logs
        (id, entity_type, entity_id, action, actor, details, created_at)
        VALUES (?, 'contract_intake', ?, 'review_workflow_updated', ?, ?, ?)`).bind(
        `audit-${crypto.randomUUID()}`,
        input.id,
        access.actor.name,
        JSON.stringify({
          status: input.status,
          owner: input.owner,
          targetReviewDate: input.targetReviewDate || null,
          approvalStatus: cfoApprovalRequired
            ? input.approvalStatus
            : 'not_required',
          findingStatuses: input.findings,
        }),
        now,
      ),
    ]);
    await env.DB.prepare('PRAGMA optimize').run();
    return Response.json({
      saved: true,
      details: await getIntakeDetails(input.id),
      workspace: await getWorkspace(),
    });
  } catch (error) {
    const validationError = error instanceof z.ZodError;
    return Response.json(
      {
        error: validationError
          ? 'Review workflow values are incomplete or invalid.'
          : error instanceof Error
            ? error.message
            : 'Unable to update the review workflow.',
      },
      { status: validationError ? 400 : 500 },
    );
  }
}
