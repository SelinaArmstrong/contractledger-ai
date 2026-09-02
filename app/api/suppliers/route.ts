import { env } from 'cloudflare:workers';
import { z } from 'zod';

import { getWorkspace } from '@/app/api/workspace/route';
import {
  ALLOWED_SUPPLIER_DOCUMENT_MIME_TYPES,
  MAX_SUPPLIER_DOCUMENT_BYTES,
  normalizeSupplierName,
  safeSupplierFileName,
  SUPPLIER_DOCUMENT_TYPES,
  supplierDocumentationStatus,
} from '@/lib/supplier-qualification';
import { assertSupplierFileSignature } from '@/lib/server/file-validation';
import { isoDateSchema } from '@/lib/validation';
import { validatedOverrideReason } from '@/lib/ai-governance';
import { withApiRoute } from '@/lib/server/route-handler';

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
      effectiveDate: isoDateSchema.optional().or(z.literal('')),
      expirationDate: isoDateSchema.optional().or(z.literal('')),
      coverageSummary: optionalText(1000),
      overrideReason: optionalText(500),
    }),
  )
  .min(1)
  .max(10);

export const POST = withApiRoute(
  {
    permission: 'edit_supplier_records',
    fallbackError: 'Unable to create the supplier onboarding record.',
  },
  async ({ request, actor }) => {
    const storedKeys: string[] = [];
    let committed = false;

    try {
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
      await Promise.all(
        fileRecords.map(({ file }) => assertSupplierFileSignature(file)),
      );

      const supplierId = `sup-${crypto.randomUUID()}`;
      const now = new Date().toISOString();
      const today = now.slice(0, 10);
      const vendorNumber = `VND-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

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

      const reviewedDocuments = storedDocuments.map((document) => {
        const analysis = document.analysisRun
          ? (JSON.parse(document.analysisRun.original_result_json) as Record<
              string,
              unknown
            >)
          : null;
        const hasIssues = Boolean(
          analysis &&
          ((Array.isArray(analysis.findings) && analysis.findings.length) ||
            (Array.isArray(analysis.warnings) && analysis.warnings.length)),
        );
        const reviewStatus =
          document.expirationDate && document.expirationDate < today
            ? 'expired'
            : !document.analysisRun
              ? 'under_review'
              : hasIssues
                ? 'needs_follow_up'
                : 'current';
        return { ...document, analysis, reviewStatus };
      });

      const insuranceExpirations = reviewedDocuments
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
      const w9Status = reviewedDocuments.some(
        (item) => item.documentType === 'w9',
      )
        ? 'received'
        : 'missing';
      const documentationStatus = supplierDocumentationStatus({
        w9Status,
        insuranceStatus,
        documentStatuses: reviewedDocuments.map((item) => item.reviewStatus),
      });

      const aiReviewStatements = [];
      for (const document of reviewedDocuments) {
        if (!document.analysisRun) continue;
        const original = document.analysis as Record<
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
        const profileValues: Record<string, string | null> = {
          dbaName: supplier.dbaName || null,
          supplierCategory: supplier.category || null,
          primaryContact: supplier.primaryContact || null,
          email: supplier.email || null,
          phone: supplier.phone || null,
          website: supplier.website || null,
          addressLine1: supplier.addressLine1 || null,
          addressLine2: supplier.addressLine2 || null,
          city: supplier.city || null,
          state: supplier.state || null,
          postalCode: supplier.postalCode || null,
          country: supplier.country || null,
          taxClassification: supplier.taxClassification || null,
        };
        for (const [fieldName, verifiedValue] of Object.entries(
          profileValues,
        )) {
          if (
            original[fieldName]?.value !== null &&
            original[fieldName]?.value !== undefined
          )
            verifiedValues[fieldName] = verifiedValue;
        }
        const verifiedResult = { ...original };
        let correctionCount = 0;
        for (const [fieldName, verifiedValue] of Object.entries(
          verifiedValues,
        )) {
          const originalField = original[fieldName] ?? {
            value: null,
            confidence: 0,
            sourcePage: null,
            sourceQuote: null,
          };
          const corrected =
            JSON.stringify(originalField.value) !==
            JSON.stringify(verifiedValue);
          const overrideReason = validatedOverrideReason(
            fieldName,
            { ...originalField, value: verifiedValue },
            document.overrideReason,
          );
          if (corrected) correctionCount += 1;
          verifiedResult[fieldName] = {
            ...originalField,
            value: verifiedValue,
          };
          aiReviewStatements.push(
            env.DB.prepare(`INSERT INTO ai_field_reviews
            (id, analysis_run_id, field_name, original_value_json,
             verified_value_json, confidence, source_page, source_quote,
             override_reason, review_status, reviewed_by, reviewed_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
              `aifield-${crypto.randomUUID()}`,
              document.analysisRun.id,
              fieldName,
              JSON.stringify(originalField.value),
              JSON.stringify(verifiedValue),
              originalField.confidence,
              originalField.sourcePage,
              originalField.sourceQuote,
              overrideReason,
              corrected ? 'corrected' : 'accepted',
              actor.name,
              now,
            ),
          );
        }
        aiReviewStatements.push(
          env.DB.prepare(`UPDATE ai_analysis_runs SET supplier_id = ?,
          document_id = ?, verified_result_json = ?, correction_count = ?,
          status = 'verified', reviewed_by = ?, reviewed_at = ?
          WHERE id = ?`).bind(
            supplierId,
            document.documentId,
            JSON.stringify(verifiedResult),
            correctionCount,
            actor.name,
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
        VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
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
          documentationStatus,
          today,
          w9Status,
          insuranceStatus,
          insuranceExpiration,
          now,
          now,
        ),
        ...reviewedDocuments.map((document) =>
          env.DB.prepare(`INSERT INTO documents
          (id, supplier_id, file_name, file_type, lifecycle_stage, storage_key, mime_type,
           issuer, document_number, effective_date, expiration_date,
           coverage_summary, review_status, ai_status, uploaded_at)
          VALUES (?, ?, ?, ?, 'supplier_record', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
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
            document.reviewStatus,
            document.analysisRun ? 'verified' : 'needs_review',
            now,
          ),
        ),
        ...aiReviewStatements,
        env.DB.prepare(`INSERT INTO audit_logs
        (id, entity_type, entity_id, action, actor, details, created_at)
        VALUES (?, 'supplier', ?, 'supplier_onboarding_created', ?, ?, ?)`).bind(
          `audit-${crypto.randomUUID()}`,
          supplierId,
          actor.name,
          JSON.stringify({
            vendorNumber,
            source: 'ai_qualification_package_onboarding',
            documentCount: reviewedDocuments.length,
            documentTypes: reviewedDocuments.map((item) => item.documentType),
            documentationStatus,
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
      throw error;
    }
  },
);
