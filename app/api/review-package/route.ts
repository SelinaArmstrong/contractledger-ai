import { env } from 'cloudflare:workers';
import { z } from 'zod';

import {
  buildReviewPackagePdf,
  reviewPackageFileName,
  type ReviewPackageRecord,
} from '@/lib/review-package';
import { withApiRoute } from '@/lib/server/route-handler';

const inputSchema = z.object({ contractId: z.string().min(1).max(200) });

export const POST = withApiRoute(
  {
    permission: 'export_data',
    errorStatus: 500,
    invalidPayloadError: 'Choose a valid contract.',
    fallbackError: 'Unable to generate the review package.',
  },
  async ({ request, actor }) => {
    const input = inputSchema.parse(await request.json());
    const contract =
      await env.DB.prepare(`SELECT c.*, s.legal_name AS supplier_name
      FROM contracts c JOIN suppliers s ON s.id = c.supplier_id
      WHERE c.id = ? LIMIT 1`)
        .bind(input.contractId)
        .first<ReviewPackageRecord>();
    if (!contract)
      return Response.json({ error: 'Contract not found.' }, { status: 404 });

    const [findings, approvals, versions, reviews] =
      await env.DB.batch<ReviewPackageRecord>([
        env.DB.prepare(`SELECT f.*, d.file_name AS source_file_name
        FROM contracts c JOIN review_findings f ON f.intake_id = c.intake_id
        LEFT JOIN approval_requests ar ON ar.source_finding_id = f.id
        LEFT JOIN documents d ON d.id = ar.source_document_id
        WHERE c.id = ? ORDER BY CASE f.severity WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, f.rule_name`).bind(
          input.contractId,
        ),
        env.DB.prepare(`SELECT ar.status AS request_status, ar.reason, ar.completed_at,
          r.name AS rule_name, r.version AS rule_version, r.owner_role,
          ast.status AS step_status, ast.assigned_reviewer, ast.decision_reason,
          ast.source_page, latest.action, latest.actor, latest.actor_role,
          latest.created_at AS decision_at
        FROM contracts c
        JOIN approval_requests ar ON ar.intake_id = c.intake_id
        JOIN approval_rules r ON r.id = ar.rule_id
        JOIN approval_steps ast ON ast.request_id = ar.id
        LEFT JOIN approval_decision_history latest ON latest.id = (
          SELECT h.id FROM approval_decision_history h
          WHERE h.request_id = ar.id ORDER BY h.created_at DESC LIMIT 1
        )
        WHERE c.id = ? ORDER BY ar.generated_at, r.name`).bind(
          input.contractId,
        ),
        env.DB.prepare(`SELECT * FROM amendments WHERE contract_id = ?
        ORDER BY version_number`).bind(input.contractId),
        env.DB.prepare(`SELECT DISTINCT r.stage, r.file_name, r.model,
          r.prompt_version, r.correction_count, r.reviewed_by, r.reviewed_at
        FROM ai_analysis_runs r
        JOIN contracts c ON c.id = ?
        WHERE r.status = 'verified' AND (
          r.contract_id = c.id OR (c.intake_id IS NOT NULL AND r.intake_id = c.intake_id)
        ) ORDER BY r.reviewed_at`).bind(input.contractId),
      ]);
    const now = new Date().toISOString();
    const pdf = buildReviewPackagePdf({
      contract,
      findings: findings.results,
      approvals: approvals.results,
      versions: versions.results,
      reviews: reviews.results,
      generatedAt: now,
      generatedBy: actor.name,
    });
    await env.DB.prepare(`INSERT INTO audit_logs
      (id, entity_type, entity_id, action, actor, details, created_at)
      VALUES (?, 'contract', ?, 'review_package_exported', ?, ?, ?)`)
      .bind(
        `audit-${crypto.randomUUID()}`,
        input.contractId,
        actor.name,
        JSON.stringify({
          version: 'review-package-2026.1',
          findingCount: findings.results.length,
          approvalCount: approvals.results.length,
          versionCount: versions.results.length + 1,
        }),
        now,
      )
      .run();
    return new Response(pdf, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${reviewPackageFileName(contract.contract_number)}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  },
);
