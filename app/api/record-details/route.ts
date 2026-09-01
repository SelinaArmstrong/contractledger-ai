import { env } from 'cloudflare:workers';
import { z } from 'zod';

import { ensureWorkspaceDatabase } from '@/db/bootstrap';
import { authorizeApiRequest } from '@/lib/server/request-security';

const querySchema = z.object({
  type: z.enum(['contract', 'supplier']),
  id: z.string().min(1).max(200),
});

export async function GET(request: Request) {
  const access = await authorizeApiRequest(request);
  if (!access.ok) return access.response;

  try {
    await ensureWorkspaceDatabase();
    const url = new URL(request.url);
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
          r.prompt_version, r.correction_count, r.status AS analysis_status,
          r.reviewed_by, r.reviewed_at
        FROM ai_field_reviews f
        JOIN ai_analysis_runs r ON r.id = f.analysis_run_id
        WHERE r.document_id IN (${documentIds.map(() => '?').join(',')})
        ORDER BY r.reviewed_at DESC, f.field_name
        LIMIT 2_000`)
          .bind(...documentIds)
          .all()
      : { results: [] };

    return Response.json({
      documents: documents.results,
      aiReviews: aiReviews.results,
    });
  } catch (error) {
    const validationError = error instanceof z.ZodError;
    return Response.json(
      {
        error: validationError
          ? 'Choose a valid record type and identifier.'
          : 'Unable to load record details.',
      },
      { status: validationError ? 400 : 500 },
    );
  }
}
