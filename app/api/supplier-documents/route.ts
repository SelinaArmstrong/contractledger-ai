import { env } from 'cloudflare:workers';
import { z } from 'zod';

import { ensureWorkspaceDatabase } from '@/db/bootstrap';
import { getWorkspace } from '@/app/api/workspace/route';
import {
  ALLOWED_SUPPLIER_DOCUMENT_MIME_TYPES,
  MAX_SUPPLIER_DOCUMENT_BYTES,
  safeSupplierFileName,
  SUPPLIER_DOCUMENT_TYPES,
} from '@/lib/supplier-qualification';
import { authorizeApiRequest } from '@/lib/server/request-security';
import { assertSupplierFileSignature } from '@/lib/server/file-validation';
import { isoDateSchema } from '@/lib/validation';

const fieldsSchema = z.object({
  supplierId: z.string().min(1),
  analysisRunId: z.string().optional().or(z.literal('')),
  documentType: z.enum(SUPPLIER_DOCUMENT_TYPES),
  effectiveDate: isoDateSchema.optional().or(z.literal('')),
  expirationDate: isoDateSchema.optional().or(z.literal('')),
  issuer: z.string().trim().max(160).optional().or(z.literal('')),
  documentNumber: z.string().trim().max(100).optional().or(z.literal('')),
  coverageSummary: z.string().trim().max(1000).optional().or(z.literal('')),
});

export async function POST(request: Request) {
  const access = authorizeApiRequest(request, { write: true });
  if (!access.ok) return access.response;

  let newlyStoredKey: string | null = null;
  try {
    await ensureWorkspaceDatabase();
    const form = await request.formData();
    const fields = fieldsSchema.parse({
      supplierId: form.get('supplierId'),
      analysisRunId: form.get('analysisRunId') ?? '',
      documentType: form.get('documentType'),
      effectiveDate: form.get('effectiveDate') ?? '',
      expirationDate: form.get('expirationDate') ?? '',
      issuer: form.get('issuer') ?? '',
      documentNumber: form.get('documentNumber') ?? '',
      coverageSummary: form.get('coverageSummary') ?? '',
    });
    const file = form.get('file');
    if (!(file instanceof File))
      return Response.json(
        { error: 'Choose a supplier document.' },
        { status: 400 },
      );
    if (file.size > MAX_SUPPLIER_DOCUMENT_BYTES)
      return Response.json(
        { error: 'The document must be 8 MB or smaller.' },
        { status: 400 },
      );
    if (
      !ALLOWED_SUPPLIER_DOCUMENT_MIME_TYPES.includes(
        file.type as (typeof ALLOWED_SUPPLIER_DOCUMENT_MIME_TYPES)[number],
      )
    ) {
      return Response.json(
        { error: 'Use a PDF, PNG, or JPEG file.' },
        { status: 400 },
      );
    }
    await assertSupplierFileSignature(file);
    if (
      fields.documentType === 'insurance_certificate' &&
      !fields.expirationDate
    ) {
      return Response.json(
        { error: 'Enter the insurance expiration date.' },
        { status: 400 },
      );
    }

    const supplier = await env.DB.prepare(
      'SELECT id, legal_name FROM suppliers WHERE id = ? LIMIT 1',
    )
      .bind(fields.supplierId)
      .first<{ id: string; legal_name: string }>();
    if (!supplier)
      return Response.json({ error: 'Supplier not found.' }, { status: 404 });

    const analysisRun = fields.analysisRunId
      ? await env.DB.prepare(`SELECT id, stage, file_name, storage_key,
          original_result_json, status, model
        FROM ai_analysis_runs WHERE id = ? LIMIT 1`)
          .bind(fields.analysisRunId)
          .first<{
            id: string;
            stage: string;
            file_name: string;
            storage_key: string;
            original_result_json: string;
            status: string;
            model: string;
          }>()
      : null;
    if (fields.analysisRunId && !analysisRun)
      return Response.json(
        { error: 'The supplier AI analysis was not found.' },
        { status: 404 },
      );
    if (
      analysisRun &&
      (analysisRun.stage !== 'supplier_document' ||
        analysisRun.file_name !== file.name ||
        analysisRun.status !== 'pending_review')
    )
      return Response.json(
        { error: 'The AI analysis does not match this supplier file.' },
        { status: 400 },
      );

    const now = new Date().toISOString();
    const documentId = `doc-${crypto.randomUUID()}`;
    const storageKey =
      analysisRun?.storage_key ??
      `supplier-documents/${fields.supplierId}/${crypto.randomUUID()}-${safeSupplierFileName(file.name)}`;
    const insuranceStatus =
      fields.expirationDate && fields.expirationDate < now.slice(0, 10)
        ? 'expired'
        : 'current';
    if (!analysisRun) {
      await env.FILES.put(storageKey, await file.arrayBuffer(), {
        httpMetadata: { contentType: file.type },
        customMetadata: {
          supplierId: fields.supplierId,
          documentType: fields.documentType,
        },
      });
      newlyStoredKey = storageKey;
    }

    const documentStatusUpdate =
      fields.documentType === 'w9'
        ? env.DB.prepare(
            "UPDATE suppliers SET w9_status = 'received', updated_at = ? WHERE id = ?",
          ).bind(now, fields.supplierId)
        : fields.documentType === 'insurance_certificate'
          ? env.DB.prepare(
              'UPDATE suppliers SET insurance_status = ?, insurance_expiration = ?, updated_at = ? WHERE id = ?',
            ).bind(
              insuranceStatus,
              fields.expirationDate,
              now,
              fields.supplierId,
            )
          : env.DB.prepare(
              'UPDATE suppliers SET updated_at = ? WHERE id = ?',
            ).bind(now, fields.supplierId);
    const qualificationUpdate = env.DB.prepare(`UPDATE suppliers SET
      qualification_status = CASE WHEN qualification_status IS NULL OR qualification_status = 'pending' THEN 'in_review' ELSE qualification_status END,
      qualification_review_date = ?, updated_at = ? WHERE id = ?`).bind(
      now.slice(0, 10),
      now,
      fields.supplierId,
    );

    const aiReviewStatements = [];
    let correctionCount = 0;
    if (analysisRun) {
      const original = JSON.parse(analysisRun.original_result_json) as Record<
        string,
        {
          value: string | number | null;
          confidence: number;
          sourcePage: number | null;
          sourceQuote: string | null;
        }
      >;
      const verifiedValues: Record<string, string | null> = {
        supplierLegalName: supplier.legal_name,
        documentType: fields.documentType,
        issuer: fields.issuer || null,
        documentNumber: fields.documentNumber || null,
        effectiveDate: fields.effectiveDate || null,
        expirationDate: fields.expirationDate || null,
        coverageSummary: fields.coverageSummary || null,
      };
      const verifiedResult = { ...original };
      for (const [fieldName, verifiedValue] of Object.entries(verifiedValues)) {
        const originalField = original[fieldName] ?? {
          value: null,
          confidence: 0,
          sourcePage: null,
          sourceQuote: null,
        };
        const corrected =
          JSON.stringify(originalField.value) !== JSON.stringify(verifiedValue);
        if (corrected) correctionCount += 1;
        verifiedResult[fieldName] = { ...originalField, value: verifiedValue };
        aiReviewStatements.push(
          env.DB.prepare(`INSERT INTO ai_field_reviews
            (id, analysis_run_id, field_name, original_value_json,
             verified_value_json, confidence, source_page, source_quote,
             review_status, reviewed_by, reviewed_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
            `aifield-${crypto.randomUUID()}`,
            analysisRun.id,
            fieldName,
            JSON.stringify(originalField.value),
            JSON.stringify(verifiedValue),
            originalField.confidence,
            originalField.sourcePage,
            originalField.sourceQuote,
            corrected ? 'corrected' : 'accepted',
            access.actor.name,
            now,
          ),
        );
      }
      aiReviewStatements.unshift(
        env.DB.prepare(`UPDATE ai_analysis_runs SET supplier_id = ?,
          document_id = ?, verified_result_json = ?, correction_count = ?,
          status = 'verified', reviewed_by = ?, reviewed_at = ?
          WHERE id = ?`).bind(
          fields.supplierId,
          documentId,
          JSON.stringify(verifiedResult),
          correctionCount,
          access.actor.name,
          now,
          analysisRun.id,
        ),
      );
    }

    await env.DB.batch([
      env.DB.prepare(`INSERT INTO documents
        (id, supplier_id, file_name, file_type, lifecycle_stage, storage_key,
         mime_type, issuer, document_number, effective_date, expiration_date,
         coverage_summary, review_status, ai_status, uploaded_at)
        VALUES (?, ?, ?, ?, 'supplier_record', ?, ?, ?, ?, ?, ?, ?, 'pending', 'verified', ?)`).bind(
        documentId,
        fields.supplierId,
        file.name,
        fields.documentType,
        storageKey,
        file.type,
        fields.issuer || null,
        fields.documentNumber || null,
        fields.effectiveDate || null,
        fields.expirationDate || null,
        fields.coverageSummary || null,
        now,
      ),
      documentStatusUpdate,
      qualificationUpdate,
      ...aiReviewStatements,
      env.DB.prepare(`INSERT INTO audit_logs (id, entity_type, entity_id, action, actor, details, created_at)
        VALUES (?, 'supplier', ?, 'supplier_document_uploaded', ?, ?, ?)`).bind(
        `audit-${crypto.randomUUID()}`,
        fields.supplierId,
        access.actor.name,
        JSON.stringify({
          documentId,
          documentType: fields.documentType,
          fileName: file.name,
          analysisRunId: analysisRun?.id ?? null,
          model: analysisRun?.model ?? null,
          correctionCount,
        }),
        now,
      ),
    ]);

    return Response.json({
      uploaded: true,
      documentId,
      workspace: await getWorkspace(),
    });
  } catch (error) {
    if (newlyStoredKey) {
      try {
        await env.FILES.delete(newlyStoredKey);
      } catch {
        // The D1 record was not committed; a maintenance sweep can retry cleanup.
      }
    }
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Unable to save the supplier document.',
      },
      { status: 400 },
    );
  }
}
