import { env } from 'cloudflare:workers';
import { z } from 'zod';

import { getWorkspace } from '@/app/api/workspace/route';
import {
  buildIntakeWorkflowUpdate,
  intakeStatuses,
  intakeWorkflowAuditDetails,
} from '@/lib/intake-workflow';
import { isIsoDate } from '@/lib/validation';
import { withApiRoute } from '@/lib/server/route-handler';

const querySchema = z.object({ id: z.string().min(1).max(200) });

/** Bulk assignment is deliberately bounded so one request stays one D1 batch. */
const MAX_BULK_INTAKES = 50;

/**
 * Every workflow field is optional: the queue sends only what the reviewer
 * touched, and an omitted field is left as it is. Sending an empty object is
 * rejected rather than treated as a no-op write.
 */
const workflowFields = {
  status: z.enum(intakeStatuses).optional(),
  owner: z.string().trim().min(1).max(160).optional(),
  targetReviewDate: z
    .string()
    .refine((value) => !value || isIsoDate(value), 'Use a valid target date.')
    .optional(),
  internalNotes: z.string().max(5_000).optional(),
};

const updateSchema = z
  .object({
    id: z.string().min(1).max(200),
    ...workflowFields,
    findings: z
      .array(
        z.object({
          id: z.string().min(1).max(200),
          status: z.enum(['open', 'accepted', 'resolved', 'dismissed']),
        }),
      )
      .max(100)
      .optional(),
  })
  .refine(
    (value) =>
      value.status !== undefined ||
      value.owner !== undefined ||
      value.targetReviewDate !== undefined ||
      value.internalNotes !== undefined ||
      value.findings !== undefined,
    'Send at least one review workflow field to update.',
  );

const bulkUpdateSchema = z
  .object({
    ids: z.array(z.string().min(1).max(200)).min(1).max(MAX_BULK_INTAKES),
    ...workflowFields,
  })
  .refine(
    (value) =>
      value.status !== undefined ||
      value.owner !== undefined ||
      value.targetReviewDate !== undefined ||
      value.internalNotes !== undefined,
    'Send at least one review workflow field to update.',
  );

const patchSchema = z.union([bulkUpdateSchema, updateSchema]);

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
        -- Only a completed playbook review earns 'low'. Without one the risk is
        -- unknown, not cleared, so the column stays NULL.
        WHEN EXISTS (SELECT 1 FROM ai_analysis_runs r WHERE r.intake_id = i.id)
          OR EXISTS (SELECT 1 FROM review_findings f WHERE f.intake_id = i.id) THEN 'low'
        ELSE NULL
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

/**
 * Intakes that still have an open mandatory approval, so they cannot move to
 * `approved_for_signature`. Checked for the whole batch before anything is
 * written, so a bulk request either applies to every row or to none.
 */
async function blockedByApproval(ids: string[]) {
  const placeholders = ids.map(() => '?').join(', ');
  const blocked = await env.DB.prepare(`SELECT i.id, i.intake_number,
      COUNT(*) AS open_count
    FROM contract_intakes i
    JOIN approval_requests ar ON ar.intake_id = i.id
    JOIN approval_rules r ON r.id = ar.rule_id
    WHERE i.id IN (${placeholders}) AND r.mandatory = 1 AND ar.status != 'approved'
    GROUP BY i.id`)
    .bind(...ids)
    .all<{ id: string; intake_number: string; open_count: number }>();
  return blocked.results;
}

export const PATCH = withApiRoute(
  {
    permission: 'edit_verified_fields',
    errorStatus: 500,
    invalidPayloadError: 'Review workflow values are incomplete or invalid.',
    fallbackError: 'Unable to update the review workflow.',
  },
  async ({ request, actor }) => {
    const input = patchSchema.parse(await request.json());
    const ids = 'ids' in input ? [...new Set(input.ids)] : [input.id];
    const findings = 'ids' in input ? [] : (input.findings ?? []);
    const fields = {
      status: input.status,
      owner: input.owner,
      targetReviewDate: input.targetReviewDate,
      internalNotes: input.internalNotes,
    };

    const placeholders = ids.map(() => '?').join(', ');
    const existing =
      await env.DB.prepare(`SELECT id, intake_number, approval_status
      FROM contract_intakes WHERE id IN (${placeholders})`)
        .bind(...ids)
        .all<{ id: string; intake_number: string; approval_status: string }>();
    if (existing.results.length !== ids.length)
      return Response.json(
        {
          error:
            ids.length === 1
              ? 'Review intake not found.'
              : `${ids.length - existing.results.length} of the selected reviews no longer exist. Refresh the queue and try again.`,
        },
        { status: 404 },
      );

    if (fields.status === 'approved_for_signature') {
      const blocked = await blockedByApproval(ids);
      if (blocked.length) {
        const total = blocked.reduce(
          (sum, row) => sum + Number(row.open_count ?? 0),
          0,
        );
        return Response.json(
          {
            error:
              ids.length === 1
                ? `${total} mandatory approval${total === 1 ? '' : 's'} must be completed before this intake can be approved for signature.`
                : `${blocked.length} of the selected reviews still have mandatory approvals open (${blocked
                    .map((row) => row.intake_number)
                    .join(', ')}). Nothing was changed.`,
          },
          { status: 400 },
        );
      }
    }

    const now = new Date().toISOString();
    const update = buildIntakeWorkflowUpdate(fields, now);
    const auditDetails = intakeWorkflowAuditDetails(fields);
    const approvalStatusById = new Map(
      existing.results.map((row) => [row.id, row.approval_status]),
    );

    await env.DB.batch([
      ...(update
        ? ids.map((id) =>
            env.DB.prepare(update.sql).bind(...update.bindings, id),
          )
        : []),
      ...findings.map((finding) =>
        env.DB.prepare(`UPDATE review_findings SET status = ?
          WHERE id = ? AND intake_id = ?`).bind(
          finding.status,
          finding.id,
          ids[0],
        ),
      ),
      ...ids.map((id) =>
        env.DB.prepare(`INSERT INTO audit_logs
          (id, entity_type, entity_id, action, actor, details, created_at)
          VALUES (?, 'contract_intake', ?, 'review_workflow_updated', ?, ?, ?)`).bind(
          `audit-${crypto.randomUUID()}`,
          id,
          actor.name,
          JSON.stringify({
            ...auditDetails,
            approvalStatus: approvalStatusById.get(id) ?? null,
            ...(findings.length ? { findingStatuses: findings } : {}),
            ...(ids.length > 1 ? { bulkUpdateOf: ids.length } : {}),
          }),
          now,
        ),
      ),
    ]);
    await env.DB.prepare('PRAGMA optimize').run();
    return Response.json({
      saved: true,
      updated: ids.length,
      details: ids.length === 1 ? await getIntakeDetails(ids[0]) : null,
      workspace: await getWorkspace(),
    });
  },
);
