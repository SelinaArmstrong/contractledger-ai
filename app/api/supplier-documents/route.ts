import { env } from 'cloudflare:workers';
import { z } from 'zod';

import { ensureWorkspaceDatabase } from '@/db/bootstrap';
import { getWorkspace } from '@/app/api/workspace/route';

const fieldsSchema = z.object({
  supplierId: z.string().min(1),
  documentType: z.enum([
    'w9',
    'insurance_certificate',
    'business_license',
    'business_registration',
    'good_standing',
    'professional_license',
    'diversity_certification',
    'safety_qualification',
    'cybersecurity_assessment',
    'sanctions_debarment_check',
    'quality_certification',
    'other_qualification',
  ]),
  expirationDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal('')),
  issuer: z.string().trim().max(160).optional().or(z.literal('')),
  documentNumber: z.string().trim().max(100).optional().or(z.literal('')),
});

function safeFileName(name: string) {
  return (
    name.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(-120) || 'supplier-document'
  );
}

export async function POST(request: Request) {
  try {
    await ensureWorkspaceDatabase();
    const form = await request.formData();
    const fields = fieldsSchema.parse({
      supplierId: form.get('supplierId'),
      documentType: form.get('documentType'),
      expirationDate: form.get('expirationDate') ?? '',
      issuer: form.get('issuer') ?? '',
      documentNumber: form.get('documentNumber') ?? '',
    });
    const file = form.get('file');
    if (!(file instanceof File))
      return Response.json(
        { error: 'Choose a supplier document.' },
        { status: 400 },
      );
    if (file.size > 8 * 1024 * 1024)
      return Response.json(
        { error: 'The document must be 8 MB or smaller.' },
        { status: 400 },
      );
    if (!['application/pdf', 'image/png', 'image/jpeg'].includes(file.type)) {
      return Response.json(
        { error: 'Use a PDF, PNG, or JPEG file.' },
        { status: 400 },
      );
    }
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
      'SELECT id FROM suppliers WHERE id = ? LIMIT 1',
    )
      .bind(fields.supplierId)
      .first<{ id: string }>();
    if (!supplier)
      return Response.json({ error: 'Supplier not found.' }, { status: 404 });

    const now = new Date().toISOString();
    const documentId = `doc-${crypto.randomUUID()}`;
    const storageKey = `supplier-documents/${fields.supplierId}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
    await env.FILES.put(storageKey, await file.arrayBuffer(), {
      httpMetadata: { contentType: file.type },
      customMetadata: {
        supplierId: fields.supplierId,
        documentType: fields.documentType,
      },
    });

    const documentStatusUpdate =
      fields.documentType === 'w9'
        ? env.DB.prepare(
            "UPDATE suppliers SET w9_status = 'received', updated_at = ? WHERE id = ?",
          ).bind(now, fields.supplierId)
        : fields.documentType === 'insurance_certificate'
          ? env.DB.prepare(
              "UPDATE suppliers SET insurance_status = 'current', insurance_expiration = ?, updated_at = ? WHERE id = ?",
            ).bind(fields.expirationDate, now, fields.supplierId)
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

    await env.DB.batch([
      env.DB.prepare(`INSERT INTO documents
        (id, supplier_id, file_name, file_type, lifecycle_stage, storage_key, mime_type, issuer, document_number, expiration_date, review_status, ai_status, uploaded_at)
        VALUES (?, ?, ?, ?, 'supplier_record', ?, ?, ?, ?, ?, 'pending', 'verified', ?)`).bind(
        documentId,
        fields.supplierId,
        file.name,
        fields.documentType,
        storageKey,
        file.type,
        fields.issuer || null,
        fields.documentNumber || null,
        fields.expirationDate || null,
        now,
      ),
      documentStatusUpdate,
      qualificationUpdate,
      env.DB.prepare(`INSERT INTO audit_logs (id, entity_type, entity_id, action, actor, details, created_at)
        VALUES (?, 'supplier', ?, 'supplier_document_uploaded', 'Selina Armstrong', ?, ?)`).bind(
        `audit-${crypto.randomUUID()}`,
        fields.supplierId,
        JSON.stringify({
          documentId,
          documentType: fields.documentType,
          fileName: file.name,
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
