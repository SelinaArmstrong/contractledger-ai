import { env } from 'cloudflare:workers';
import { z } from 'zod';

import { getWorkspace } from '@/app/api/workspace/route';
import { isIsoDate } from '@/lib/validation';
import { withApiRoute } from '@/lib/server/route-handler';

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
      COALESCE((SELECT GROUP_CONCAT(r.name, '; ')
        FROM approval_requests ar
        JOIN approval_rules r ON r.id = ar.rule_id
        WHERE ar.intake_id = i.id AND ar.status != 'cancelled'),
        'No additional approval') AS required_approval,
      (SELECT COUNT(*) FROM approval_requests ar
        JOIN approval_rules r ON r.id = ar.rule_id
        WHERE ar.intake_id = i.id AND r.mandatory = 1) AS approval_request_count,
      (SELECT COUNT(*) FROM approval_requests ar
        JOIN approval_rules r ON r.id = ar.rule_id
        WHERE ar.intake_id = i.id AND r.mandatory = 1
          AND ar.status != 'approved') AS open_approval_count,
      CASE
        WHEN EXISTS (SELECT 1 FROM review_findings f WHERE f.intake_id = i.id AND f.status = 'open' AND f.severity = 'high') THEN 'high'
        WHEN EXISTS (SELECT 1 FROM review_findings f WHERE f.intake_id = i.id AND f.status = 'open' AND f.severity = 'medium') THEN 'medium'
        ELSE 'low'
      END AS risk_level
    FROM contract_intakes i WHERE i.id = ? LIMIT 1`)
    .bind(id)
    .first<Record<string, string | number | null>>();
  if (!intake) return null;

  const [
    supplier,
    documents,
    findings,
    analysisRun,
    auditLogs,
    approvalRequests,
    approvalHistory,
  ] = await Promise.all([
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
    env.DB.prepare(`SELECT id, model, prompt_version, quality_report_json,
          verified_result_json,
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
    env.DB.prepare(`SELECT ar.id AS request_id, ar.status AS request_status,
          ar.reason, ar.generated_at, ar.due_at, ar.completed_at,
          r.rule_key, r.version AS rule_version, r.name AS rule_name,
          r.owner_role, r.mandatory, ast.id AS step_id,
          ast.status AS step_status, ast.assigned_reviewer,
          ast.escalation_level, ar.source_finding_id,
          ast.source_page, ast.source_quote
        FROM approval_requests ar
        JOIN approval_rules r ON r.id = ar.rule_id
        JOIN approval_steps ast ON ast.request_id = ar.id
        WHERE ar.intake_id = ? ORDER BY ar.due_at, r.name`)
      .bind(id)
      .all<Record<string, string | number | null>>(),
    env.DB.prepare(`SELECT h.*, r.name AS rule_name
        FROM approval_decision_history h
        JOIN approval_requests ar ON ar.id = h.request_id
        JOIN approval_rules r ON r.id = ar.rule_id
        WHERE ar.intake_id = ? ORDER BY h.created_at DESC LIMIT 200`)
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
          quality_report_json: analysisRun.quality_report_json,
          correction_count: analysisRun.correction_count,
          reviewed_by: analysisRun.reviewed_by,
          reviewed_at: analysisRun.reviewed_at,
          file_name: analysisRun.file_name,
          document_id: analysisRun.document_id,
        }
      : null,
    fieldReviews: fieldReviews.results,
    auditLogs: auditLogs.results,
    approvalRequests: approvalRequests.results,
    approvalHistory: approvalHistory.results,
  };
}

export const GET = withApiRoute(
  {
    permission: 'view_workspace',
    errorStatus: 500,
    redactErrors: true,
    invalidPayloadError: 'Choose a valid review intake.',
    fallbackError: 'Unable to load the review intake.',
  },
  async ({ url }) => {
    const { id } = querySchema.parse({ id: url.searchParams.get('id') });
    const details = await getIntakeDetails(id);
    if (!details)
      return Response.json(
        { error: 'Review intake not found.' },
        { status: 404 },
      );
    return Response.json(details);
  },
);

export const PATCH = withApiRoute(
  {
    permission: 'edit_verified_fields',
    errorStatus: 500,
    invalidPayloadError: 'Review workflow values are incomplete or invalid.',
    fallbackError: 'Unable to update the review workflow.',
  },
  async ({ request, actor }) => {
    const input = updateSchema.parse(await request.json());
    const existing = await env.DB.prepare(`SELECT id, approval_status
      FROM contract_intakes WHERE id = ? LIMIT 1`)
      .bind(input.id)
      .first<{ id: string; approval_status: string }>();
    if (!existing)
      return Response.json(
        { error: 'Review intake not found.' },
        { status: 404 },
      );

    const blockingApproval = await env.DB.prepare(`SELECT COUNT(*) AS count
      FROM approval_requests ar
      JOIN approval_rules r ON r.id = ar.rule_id
      WHERE ar.intake_id = ? AND r.mandatory = 1
        AND ar.status != 'approved'`)
      .bind(input.id)
      .first<{ count: number }>();
    if (
      input.status === 'approved_for_signature' &&
      Number(blockingApproval?.count ?? 0) > 0
    ) {
      return Response.json(
        {
          error: `${blockingApproval?.count ?? 0} mandatory approval${Number(blockingApproval?.count ?? 0) === 1 ? '' : 's'} must be completed before this intake can be approved for signature.`,
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
          updated_at = ? WHERE id = ?`).bind(
        input.status,
        reviewStatus,
        input.owner,
        input.targetReviewDate || null,
        input.internalNotes.trim() || null,
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
        actor.name,
        JSON.stringify({
          status: input.status,
          owner: input.owner,
          targetReviewDate: input.targetReviewDate || null,
          approvalStatus: existing.approval_status,
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
  },
);
