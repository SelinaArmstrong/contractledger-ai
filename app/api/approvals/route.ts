import { env } from 'cloudflare:workers';
import { z } from 'zod';

import { getWorkspace } from '@/app/api/workspace/route';
import {
  approvalActionRequiresReason,
  approvalActions,
  deriveApprovalRequestStatus,
  nextApprovalStatus,
  type ApprovalRequestStatus,
} from '@/lib/approval-workflow';
import { withApiRoute } from '@/lib/server/route-handler';

const querySchema = z.object({ id: z.string().min(1).max(200) });

const actionSchema = z.object({
  stepId: z.string().min(1).max(200),
  action: z.enum(approvalActions),
  reason: z.string().trim().max(2_000).default(''),
  assignedReviewer: z.string().trim().max(160).default(''),
});

async function getApprovalDetails(id: string) {
  const request = await env.DB.prepare(`SELECT ar.*,
      r.rule_key, r.version AS rule_version, r.name AS rule_name,
      r.description AS rule_description, r.owner_role, r.mandatory,
      i.intake_number, i.title AS intake_title, i.proposed_supplier_name,
      i.proposed_value_cents, i.status AS intake_status,
      f.rule_name AS finding_rule_name, f.observed_text,
      f.standard_text, f.severity AS finding_severity,
      d.file_name AS source_file_name
    FROM approval_requests ar
    JOIN approval_rules r ON r.id = ar.rule_id
    JOIN contract_intakes i ON i.id = ar.intake_id
    LEFT JOIN review_findings f ON f.id = ar.source_finding_id
    LEFT JOIN documents d ON d.id = ar.source_document_id
    WHERE ar.id = ? LIMIT 1`)
    .bind(id)
    .first<Record<string, string | number | null>>();
  if (!request) return null;
  const [steps, history] = await Promise.all([
    env.DB.prepare(`SELECT * FROM approval_steps
      WHERE request_id = ? ORDER BY sequence`)
      .bind(id)
      .all<Record<string, string | number | null>>(),
    env.DB.prepare(`SELECT * FROM approval_decision_history
      WHERE request_id = ? ORDER BY created_at DESC, id DESC`)
      .bind(id)
      .all<Record<string, string | number | null>>(),
  ]);
  return { request, steps: steps.results, history: history.results };
}

export const GET = withApiRoute(
  {
    permission: 'view_workspace',
    errorStatus: 500,
    redactErrors: true,
    invalidPayloadError: 'Choose a valid approval request.',
    fallbackError: 'Unable to load the approval request.',
  },
  async ({ url }) => {
    const { id } = querySchema.parse({ id: url.searchParams.get('id') });
    const details = await getApprovalDetails(id);
    if (!details)
      return Response.json(
        { error: 'Approval request not found.' },
        { status: 404 },
      );
    return Response.json(details);
  },
);

export const PATCH = withApiRoute(
  {
    permission: 'approve_exceptions',
    invalidPayloadError: 'Approval action values are incomplete or invalid.',
    fallbackError: 'Unable to record the approval decision.',
  },
  async ({ request, actor }) => {
    const input = actionSchema.parse(await request.json());
    if (approvalActionRequiresReason(input.action) && !input.reason) {
      return Response.json(
        { error: 'A decision reason is required for this action.' },
        { status: 400 },
      );
    }
    const step = await env.DB.prepare(`SELECT ast.*, ar.intake_id,
        ar.status AS request_status, ar.source_finding_id,
        r.id AS rule_id, r.rule_key, r.version AS rule_version,
        r.name AS rule_name, r.mandatory
      FROM approval_steps ast
      JOIN approval_requests ar ON ar.id = ast.request_id
      JOIN approval_rules r ON r.id = ar.rule_id
      WHERE ast.id = ? LIMIT 1`)
      .bind(input.stepId)
      .first<{
        id: string;
        request_id: string;
        intake_id: string;
        status: ApprovalRequestStatus;
        request_status: ApprovalRequestStatus;
        owner_role: string;
        assigned_reviewer: string | null;
        escalation_level: number;
        source_finding_id: string | null;
        rule_id: string;
        rule_key: string;
        rule_version: number;
        rule_name: string;
        mandatory: number;
      }>();
    if (!step)
      return Response.json(
        { error: 'Approval step not found.' },
        { status: 404 },
      );

    const nextStepStatus = nextApprovalStatus(step.status, input.action);
    const siblingSteps = await env.DB.prepare(`SELECT id, status
      FROM approval_steps WHERE request_id = ? ORDER BY sequence`)
      .bind(step.request_id)
      .all<{ id: string; status: ApprovalRequestStatus }>();
    const nextRequestStatus = deriveApprovalRequestStatus(
      siblingSteps.results.map((item) =>
        item.id === step.id ? nextStepStatus : item.status,
      ),
    );
    const allIntakeRequests = await env.DB.prepare(`SELECT ar.id, ar.status,
        r.mandatory
      FROM approval_requests ar
      JOIN approval_rules r ON r.id = ar.rule_id
      WHERE ar.intake_id = ?`)
      .bind(step.intake_id)
      .all<{
        id: string;
        status: ApprovalRequestStatus;
        mandatory: number;
      }>();
    const mandatoryStatuses = allIntakeRequests.results
      .filter((item) => Boolean(item.mandatory))
      .map((item) =>
        item.id === step.request_id ? nextRequestStatus : item.status,
      );
    const legacyApprovalStatus = !mandatoryStatuses.length
      ? 'not_required'
      : mandatoryStatuses.every((status) => status === 'approved')
        ? 'approved'
        : mandatoryStatuses.includes('declined')
          ? 'declined'
          : 'pending';
    const now = new Date().toISOString();
    const terminalDecision = [
      'approved',
      'declined',
      'revision_requested',
      'cancelled',
    ].includes(nextStepStatus);
    const requestCompleted = ['approved', 'declined', 'cancelled'].includes(
      nextRequestStatus,
    );
    const assignedReviewer =
      input.assignedReviewer || step.assigned_reviewer || actor.name;

    await env.DB.batch([
      env.DB.prepare(`UPDATE approval_steps SET status = ?,
        assigned_reviewer = ?,
        started_at = CASE WHEN ? IN ('start_review', 'escalate')
          THEN COALESCE(started_at, ?) ELSE started_at END,
        decided_at = CASE WHEN ? = 1 THEN ? ELSE decided_at END,
        escalated_at = CASE WHEN ? = 'escalate' THEN ? ELSE escalated_at END,
        escalation_level = escalation_level + CASE WHEN ? = 'escalate' THEN 1 ELSE 0 END,
        decision_reason = COALESCE(?, decision_reason) WHERE id = ?`).bind(
        nextStepStatus,
        assignedReviewer,
        input.action,
        now,
        terminalDecision ? 1 : 0,
        now,
        input.action,
        now,
        input.action,
        input.reason || null,
        step.id,
      ),
      env.DB.prepare(`UPDATE approval_requests SET status = ?, updated_at = ?,
        completed_at = CASE WHEN ? = 1 THEN ? ELSE NULL END
        WHERE id = ?`).bind(
        nextRequestStatus,
        now,
        requestCompleted ? 1 : 0,
        now,
        step.request_id,
      ),
      env.DB.prepare(`INSERT INTO approval_decision_history
        (id, request_id, step_id, action, from_status, to_status,
         actor, actor_role, reason, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
        `approval-history-${crypto.randomUUID()}`,
        step.request_id,
        step.id,
        input.action,
        step.status,
        nextStepStatus,
        actor.name,
        actor.role,
        input.reason || null,
        now,
      ),
      env.DB.prepare(`UPDATE contract_intakes SET approval_status = ?,
        status = CASE WHEN ? = 'request_revision' THEN 'revision_requested'
          ELSE status END, updated_at = ? WHERE id = ?`).bind(
        legacyApprovalStatus,
        input.action,
        now,
        step.intake_id,
      ),
      ...(input.action === 'approve_exception' && step.source_finding_id
        ? [
            env.DB.prepare(`UPDATE review_findings SET status = 'accepted'
              WHERE id = ?`).bind(step.source_finding_id),
          ]
        : []),
      env.DB.prepare(`INSERT INTO audit_logs
        (id, entity_type, entity_id, action, actor, details, created_at)
        VALUES (?, 'contract_intake', ?, 'approval_decision_recorded', ?, ?, ?)`).bind(
        `audit-${crypto.randomUUID()}`,
        step.intake_id,
        actor.name,
        JSON.stringify({
          requestId: step.request_id,
          stepId: step.id,
          ruleId: step.rule_id,
          ruleKey: step.rule_key,
          ruleVersion: step.rule_version,
          ruleName: step.rule_name,
          mandatory: Boolean(step.mandatory),
          actorRole: actor.role,
          accountableOwnerRole: step.owner_role,
          action: input.action,
          reason: input.reason || null,
          before: {
            stepStatus: step.status,
            requestStatus: step.request_status,
          },
          after: {
            stepStatus: nextStepStatus,
            requestStatus: nextRequestStatus,
          },
        }),
        now,
      ),
    ]);

    return Response.json({
      saved: true,
      details: await getApprovalDetails(step.request_id),
      workspace: await getWorkspace(),
    });
  },
);
