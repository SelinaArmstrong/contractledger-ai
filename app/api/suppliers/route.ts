import { env } from 'cloudflare:workers';
import { z } from 'zod';

import { getWorkspace } from '@/app/api/workspace/route';
import { ensureWorkspaceDatabase } from '@/db/bootstrap';
import {
  ALLOWED_SUPPLIER_DOCUMENT_MIME_TYPES,
  MAX_SUPPLIER_DOCUMENT_BYTES,
  normalizeSupplierName,
  safeSupplierFileName,
  SUPPLIER_DOCUMENT_TYPES,
} from '@/lib/supplier-qualification';

const optionalText = (maximum: number) =>
  z.string().trim().max(maximum).optional().or(z.literal(''));

const supplierSchema = z.object({
  legalName: z.string().trim().min(2).max(180),
  dbaName: optionalText(180),
  category: z.string().trim().min(2).max(120),
  primaryContact: optionalText(120),
  email: z.email().optional().or(z.literal('')),
  phone: optionalText(40),
  website: z.url().optional().or(z.literal('')),
  addressLine1: z.string().trim().min(2).max(180),
  addressLine2: optionalText(120),
  city: z.string().trim().min(2).max(100),
  state: z.string().trim().min(2).max(80),
  postalCode: z.string().trim().min(3).max(20),
  country: z.string().trim().min(2).max(100),
  taxClassification: optionalText(100),
  riskTier: z.enum(['low', 'medium', 'high']),
});

const documentMetadataSchema = z
  .array(
    z.object({
      fileField: z.string().regex(/^document-\d+$/),
      analysisRunId: z.string().optional().or(z.literal('')),
      documentType: z.enum(SUPPLIER_DOCUMENT_TYPES),
      issuer: optionalText(160),
      documentNumber: optionalText(100),
      effectiveDate: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional()
        .or(z.literal('')),
      expirationDate: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional()
        .or(z.literal('')),
      coverageSummary: optionalText(1000),
    }),
  )
  .min(1)
  .max(10);

export async function POST(request: Request) {
  const storedKeys: string[] = [];
  let committed = false;

  try {
    await ensureWorkspaceDatabase();
    const form = await request.formData();
    const supplierJson = form.get('supplier');
    const documentsJson = form.get('documents');
    if (typeof supplierJson !== 'string' || typeof documentsJson !== 'string')
      throw new Error('Supplier and document details are required.');
    const supplier = supplierSchema.parse(JSON.parse(supplierJson));
    const documents = documentMetadataSchema.parse(JSON.parse(documentsJson));
    const normalizedName = normalizeSupplierName(supplier.legalName);
    if (!normalizedName) {
      return Response.json(
        { error: 'Enter a recognizable supplier legal name.' },
        { status: 400 },
      );
    }

    const existing = await env.DB.prepare(
      'SELECT id, legal_name FROM suppliers WHERE normalized_name = ? LIMIT 1',
    )
      .bind(normalizedName)
      .first<{ id: string; legal_name: string }>();
    if (existing) {
      return Response.json(
        {
          error: `${existing.legal_name} already exists. Open that supplier record to add qualification files.`,
          supplierId: existing.id,
        },
        { status: 409 },
      );
    }

    const fileRecords = documents.map((metadata) => {
      const file = form.get(metadata.fileField);
      if (!(file instanceof File))
        throw new Error('Choose a file for every qualification record.');
      if (file.size > MAX_SUPPLIER_DOCUMENT_BYTES)
        throw new Error(`${file.name} must be 8 MB or smaller.`);
      if (
        !ALLOWED_SUPPLIER_DOCUMENT_MIME_TYPES.includes(
          file.type as (typeof ALLOWED_SUPPLIER_DOCUMENT_MIME_TYPES)[number],
        )
      ) {
        throw new Error(`${file.name} must be a PDF, PNG, or JPEG file.`);
      }
      if (
        metadata.documentType === 'insurance_certificate' &&
        !metadata.expirationDate
      ) {
        throw new Error(
          'Enter an expiration date for every insurance certificate.',
        );
      }
      return { metadata, file };
    });

    const supplierId = `sup-${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    const today = now.slice(0, 10);
    const vendorSequence = await env.DB.prepare(`SELECT
      COALESCE(MAX(CAST(SUBSTR(vendor_number, 5) AS INTEGER)), 1000) AS max_number
      FROM suppliers WHERE vendor_number GLOB 'VND-[0-9]*'`).first<{
      max_number: number;
    }>();
    const vendorNumber = `VND-${String((vendorSequence?.max_number ?? 1000) + 1).padStart(4, '0')}`;

    const storedDocuments = [];
    for (const { metadata, file } of fileRecords) {
      const documentId = `doc-${crypto.randomUUID()}`;
      const analysisRun = metadata.analysisRunId
        ? await env.DB.prepare(`SELECT id, stage, file_name, storage_key,
            original_result_json, status, model
          FROM ai_analysis_runs WHERE id = ? LIMIT 1`)
            .bind(metadata.analysisRunId)
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
      if (metadata.analysisRunId && !analysisRun)
        throw new Error(`AI analysis for ${file.name} was not found.`);
      if (
        analysisRun &&
        (analysisRun.stage !== 'supplier_document' ||
          analysisRun.file_name !== file.name ||
          analysisRun.status !== 'pending_review')
      )
        throw new Error(`AI analysis does not match ${file.name}.`);
      const storageKey =
        analysisRun?.storage_key ??
        `supplier-documents/${supplierId}/${crypto.randomUUID()}-${safeSupplierFileName(file.name)}`;
      if (!analysisRun) {
        await env.FILES.put(storageKey, await file.arrayBuffer(), {
          httpMetadata: { contentType: file.type },
          customMetadata: {
            supplierId,
            documentType: metadata.documentType,
          },
        });
        storedKeys.push(storageKey);
      }
      storedDocuments.push({
        documentId,
        storageKey,
        file,
        analysisRun,
        ...metadata,
      });
    }

    const insuranceExpirations = storedDocuments
      .filter((item) => item.documentType === 'insurance_certificate')
      .map((item) => item.expirationDate)
      .filter((value): value is string => Boolean(value))
      .sort((a, b) => a.localeCompare(b));
    const insuranceExpiration = insuranceExpirations[0] ?? null;
    const insuranceStatus = insuranceExpiration
      ? insuranceExpiration >= today
        ? 'current'
        : 'expired'
      : 'missing';
    const w9Status = storedDocuments.some((item) => item.documentType === 'w9')
      ? 'received'
      : 'missing';

    const aiReviewStatements = [];
    for (const document of storedDocuments) {
      if (!document.analysisRun) continue;
      const original = JSON.parse(
        document.analysisRun.original_result_json,
      ) as Record<
        string,
        {
          value: string | number | null;
          confidence: number;
          sourcePage: number | null;
          sourceQuote: string | null;
        }
      >;
      const verifiedValues: Record<string, string | null> = {
        supplierLegalName: supplier.legalName,
        documentType: document.documentType,
        issuer: document.issuer || null,
        documentNumber: document.documentNumber || null,
        effectiveDate: document.effectiveDate || null,
        expirationDate: document.expirationDate || null,
        coverageSummary: document.coverageSummary || null,
      };
      const verifiedResult = { ...original };
      let correctionCount = 0;
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
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Selina Armstrong', ?)`).bind(
            `aifield-${crypto.randomUUID()}`,
            document.analysisRun.id,
            fieldName,
            JSON.stringify(originalField.value),
            JSON.stringify(verifiedValue),
            originalField.confidence,
            originalField.sourcePage,
            originalField.sourceQuote,
            corrected ? 'corrected' : 'accepted',
            now,
          ),
        );
      }
      aiReviewStatements.push(
        env.DB.prepare(`UPDATE ai_analysis_runs SET supplier_id = ?,
          document_id = ?, verified_result_json = ?, correction_count = ?,
          status = 'verified', reviewed_by = 'Selina Armstrong', reviewed_at = ?
          WHERE id = ?`).bind(
          supplierId,
          document.documentId,
          JSON.stringify(verifiedResult),
          correctionCount,
          now,
          document.analysisRun.id,
        ),
      );
    }

    await env.DB.batch([
      env.DB.prepare(`INSERT INTO suppliers
        (id, legal_name, normalized_name, dba_name, vendor_number, category, status,
         primary_contact, email, phone, website, address_line1, address_line2, city, state,
         postal_code, country, tax_classification, risk_tier, qualification_status,
         qualification_review_date, w9_status, insurance_status, insurance_expiration,
         created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'in_review', ?, ?, ?, ?, ?, ?)`).bind(
        supplierId,
        supplier.legalName,
        normalizedName,
        supplier.dbaName || null,
        vendorNumber,
        supplier.category,
        supplier.primaryContact || null,
        supplier.email || null,
        supplier.phone || null,
        supplier.website || null,
        supplier.addressLine1,
        supplier.addressLine2 || null,
        supplier.city,
        supplier.state,
        supplier.postalCode,
        supplier.country,
        supplier.taxClassification || 'Pending verification',
        supplier.riskTier,
        today,
        w9Status,
        insuranceStatus,
        insuranceExpiration,
        now,
        now,
      ),
      ...storedDocuments.map((document) =>
        env.DB.prepare(`INSERT INTO documents
          (id, supplier_id, file_name, file_type, lifecycle_stage, storage_key, mime_type,
           issuer, document_number, effective_date, expiration_date,
           coverage_summary, review_status, ai_status, uploaded_at)
          VALUES (?, ?, ?, ?, 'supplier_record', ?, ?, ?, ?, ?, ?, ?, 'pending', 'verified', ?)`).bind(
          document.documentId,
          supplierId,
          document.file.name,
          document.documentType,
          document.storageKey,
          document.file.type,
          document.issuer || null,
          document.documentNumber || null,
          document.effectiveDate || null,
          document.expirationDate || null,
          document.coverageSummary || null,
          now,
        ),
      ),
      ...aiReviewStatements,
      env.DB.prepare(`INSERT INTO audit_logs
        (id, entity_type, entity_id, action, actor, details, created_at)
        VALUES (?, 'supplier', ?, 'supplier_onboarding_created', 'Selina Armstrong', ?, ?)`).bind(
        `audit-${crypto.randomUUID()}`,
        supplierId,
        JSON.stringify({
          vendorNumber,
          source: 'independent_supplier_onboarding',
          documentCount: storedDocuments.length,
          documentTypes: storedDocuments.map((item) => item.documentType),
        }),
        now,
      ),
    ]);
    committed = true;

    return Response.json({
      created: true,
      supplierId,
      vendorNumber,
      workspace: await getWorkspace(),
    });
  } catch (error) {
    if (!committed && storedKeys.length) {
      try {
        await env.FILES.delete(storedKeys);
      } catch {
        // Database state remains authoritative; orphan cleanup can be retried.
      }
    }
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Unable to create the supplier onboarding record.',
      },
      { status: 400 },
    );
  }
}
