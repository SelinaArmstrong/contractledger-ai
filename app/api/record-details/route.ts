import { env } from 'cloudflare:workers';
import { z } from 'zod';

import { withApiRoute } from '@/lib/server/route-handler';

const querySchema = z.object({
  type: z.enum(['contract', 'supplier']),
  id: z.string().min(1).max(200),
});

export const GET = withApiRoute(
  {
    permission: 'view_documents',
    errorStatus: 500,
    redactErrors: true,
    invalidPayloadError: 'Choose a valid record type and identifier.',
    fallbackError: 'Unable to load record details.',
  },
  async ({ url }) => {
    const input = querySchema.parse({
      type: url.searchParams.get('type'),
      id: url.searchParams.get('id'),
    });
    const predicate =
      input.type === 'contract'
        ? 'd.contract_id = ?'
        : "d.supplier_id = ? AND d.lifecycle_stage = 'supplier_record'";
    const documents = await env.DB.prepare(`SELECT
        d.id, d.supplier_id, d.intake_id, d.contract_id, d.parent_document_id,
        d.file_name, d.file_type, d.lifecycle_stage, d.mime_type, d.page_count,
        d.issuer, d.document_number, d.effective_date, d.expiration_date,
        d.coverage_summary, d.review_status, d.ai_status, d.uploaded_at
      FROM documents d
      WHERE ${predicate}
      ORDER BY d.uploaded_at DESC
      LIMIT 100`)
      .bind(input.id)
      .all();
    const documentIds = documents.results.map((item) => String(item.id));
    const aiReviews = documentIds.length
      ? await env.DB.prepare(`SELECT f.*, r.stage, r.intake_id, r.contract_id,
          r.supplier_id, r.document_id, r.file_name, r.model,
          r.prompt_version, r.quality_report_json, r.correction_count,
          r.status AS analysis_status,
          r.reviewed_by, r.reviewed_at
        FROM ai_field_reviews f
        JOIN ai_analysis_runs r ON r.id = f.analysis_run_id
        WHERE r.document_id IN (${documentIds.map(() => '?').join(',')})
        ORDER BY r.reviewed_at DESC, f.field_name
        LIMIT 2_000`)
          .bind(...documentIds)
          .all()
      : { results: [] };
    const amendments =
      input.type === 'contract'
        ? await env.DB.prepare(`SELECT a.*, d.file_name, d.mime_type,
            r.model, r.prompt_version, r.quality_report_json,
            r.correction_count,
            r.reviewed_by, r.reviewed_at
          FROM amendments a
          LEFT JOIN documents d ON d.id = a.document_id
          LEFT JOIN ai_analysis_runs r ON r.document_id = a.document_id
          WHERE a.contract_id = ?
          ORDER BY a.version_number DESC
          LIMIT 100`)
            .bind(input.id)
            .all()
        : { results: [] };
    const auditLogs =
      input.type === 'contract'
        ? await env.DB.prepare(`SELECT * FROM audit_logs
          WHERE entity_type = 'contract' AND entity_id = ?
          ORDER BY created_at DESC LIMIT 100`)
            .bind(input.id)
            .all()
        : { results: [] };
    const approvalRequests =
      input.type === 'contract'
        ? await env.DB.prepare(`SELECT ar.id AS request_id,
            ar.status AS request_status, ar.reason, ar.generated_at,
            ar.due_at, ar.completed_at, r.rule_key,
            r.version AS rule_version, r.name AS rule_name,
            r.owner_role, r.mandatory, ast.status AS step_status,
            ast.assigned_reviewer, ast.decision_reason,
            ast.source_page, ast.source_quote
          FROM contracts c
          JOIN approval_requests ar ON ar.intake_id = c.intake_id
          JOIN approval_rules r ON r.id = ar.rule_id
          JOIN approval_steps ast ON ast.request_id = ar.id
          WHERE c.id = ? ORDER BY ar.generated_at, r.name`)
            .bind(input.id)
            .all()
        : { results: [] };
    const approvalHistory =
      input.type === 'contract'
        ? await env.DB.prepare(`SELECT h.*, r.name AS rule_name,
            r.version AS rule_version
          FROM contracts c
          JOIN approval_requests ar ON ar.intake_id = c.intake_id
          JOIN approval_rules r ON r.id = ar.rule_id
          JOIN approval_decision_history h ON h.request_id = ar.id
          WHERE c.id = ? ORDER BY h.created_at DESC LIMIT 500`)
            .bind(input.id)
            .all()
        : { results: [] };

    return Response.json({
      documents: documents.results,
      aiReviews: aiReviews.results,
      amendments: amendments.results,
      auditLogs: auditLogs.results,
      approvalRequests: approvalRequests.results,
      approvalHistory: approvalHistory.results,
    });
  },
);
