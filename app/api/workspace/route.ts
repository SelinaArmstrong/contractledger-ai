import { env } from 'cloudflare:workers';
import { z } from 'zod';

import { ensureWorkspaceDatabase } from '@/db/bootstrap';
import { normalizeSupplierName } from '@/lib/supplier-qualification';
import { authorizeApiRequest } from '@/lib/server/request-security';
import { isIsoDate } from '@/lib/validation';

const fieldSchema = z.object({
  value: z.union([z.string(), z.number(), z.null()]),
  confidence: z.number().min(0).max(1),
  sourcePage: z.number().int().positive().nullable(),
  sourceQuote: z.string().max(500).nullable(),
});

const reviewFieldNames = [
  'documentTitle',
  'supplierLegalName',
  'contractType',
  'contractNumber',
  'contractValue',
  'effectiveDate',
  'expirationDate',
  'renewalType',
  'noticeDays',
  'governingLaw',
  'paymentTerms',
] as const;

const saveSchema = z.object({
  analysisRunId: z.string().min(1),
  stage: z.enum(['draft', 'executed']),
  document: z.object({
    fileName: z.string().min(1).max(255),
    totalPages: z.number().int().positive().max(40),
    storageKey: z.string().min(1).max(500),
    mimeType: z.string().min(1).max(120),
  }),
  analysis: z.object({
    documentTitle: fieldSchema,
    supplierLegalName: fieldSchema,
    contractType: fieldSchema,
    contractNumber: fieldSchema,
    contractValue: fieldSchema,
    effectiveDate: fieldSchema,
    expirationDate: fieldSchema,
    renewalType: fieldSchema,
    noticeDays: fieldSchema,
    governingLaw: fieldSchema,
    paymentTerms: fieldSchema,
    findings: z.array(
      z.object({
        rule: z.string().min(1).max(200),
        observed: z.string().max(2_000),
        standard: z.string().max(2_000),
        suggestedRevision: z.string().min(1).max(4_000),
        severity: z.enum(['info', 'low', 'medium', 'high']),
        sourcePage: z.number().nullable(),
      }),
    ),
    keyDates: z.array(
      z.object({
        type: z.string().min(1).max(100),
        title: z.string().min(1).max(200),
        dueDate: z
          .string()
          .refine(isIsoDate, 'Key dates must use a valid YYYY-MM-DD date.')
          .nullable(),
        sourcePage: z.number().nullable(),
        sourceQuote: z.string().nullable(),
      }),
    ),
    warnings: z.array(z.string().max(500)).max(50),
  }),
  review: z.object({
    fields: z.array(
      z.object({
        fieldName: z.enum(reviewFieldNames),
        status: z.enum(['accepted', 'corrected']),
      }),
    ),
  }),
});

function stringValue(field: z.infer<typeof fieldSchema>, fallback = '') {
  return typeof field.value === 'string' ? field.value.trim() : fallback;
}

function numberValue(field: z.infer<typeof fieldSchema>) {
  if (typeof field.value === 'number') return field.value;
  if (typeof field.value === 'string') {
    const parsed = Number(field.value.replace(/[^0-9.-]/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function subtractDays(dateValue: string, days: number | null) {
  if (!dateValue || !days) return null;
  const date = new Date(`${dateValue}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function addDays(dateValue: string, days: number) {
  const date = new Date(`${dateValue}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

type VerifiedAnalysisRun = {
  id: string;
  stage: 'draft' | 'executed';
  supplier_id: string;
  supplier_name: string;
  intake_id: string | null;
  contract_id: string | null;
  source_intake_id: string | null;
  file_name: string;
  verified_result_json: string;
  reviewed_at: string;
};

function buildTransactionComparisons(rows: VerifiedAnalysisRun[]) {
  const fieldLabels = [
    ['contractValue', 'Contract value'],
    ['paymentTerms', 'Payment terms'],
    ['governingLaw', 'Governing law'],
    ['renewalType', 'Renewal type'],
    ['noticeDays', 'Notice period'],
    ['effectiveDate', 'Effective date'],
    ['expirationDate', 'Expiration date'],
    ['contractType', 'Contract type'],
  ] as const;
  const drafts = rows.filter((row) => row.stage === 'draft');
  return rows
    .filter((row) => row.stage === 'executed')
    .flatMap((executed) => {
      const draft = drafts.find(
        (candidate) => candidate.intake_id === executed.source_intake_id,
      );
      if (!draft || !draft.intake_id || !executed.contract_id) return [];
      try {
        const draftAnalysis = JSON.parse(draft.verified_result_json) as Record<
          string,
          { value?: string | number | null } | unknown[]
        >;
        const executedAnalysis = JSON.parse(
          executed.verified_result_json,
        ) as Record<string, { value?: string | number | null } | unknown[]>;
        const valueFor = (
          analysis: Record<
            string,
            { value?: string | number | null } | unknown[]
          >,
          fieldName: string,
        ) => {
          const field = analysis[fieldName];
          return field && !Array.isArray(field) ? (field.value ?? null) : null;
        };
        const draftFindings = Array.isArray(draftAnalysis.findings)
          ? draftAnalysis.findings.length
          : 0;
        const executedFindings = Array.isArray(executedAnalysis.findings)
          ? executedAnalysis.findings.length
          : 0;
        return [
          {
            id: `${draft.id}:${executed.id}`,
            supplierId: executed.supplier_id,
            supplierName: executed.supplier_name,
            intakeId: draft.intake_id,
            contractId: executed.contract_id,
            draftFileName: draft.file_name,
            executedFileName: executed.file_name,
            draftReviewedAt: draft.reviewed_at,
            executedReviewedAt: executed.reviewed_at,
            draftFindingCount: draftFindings,
            executedFindingCount: executedFindings,
            changes: fieldLabels.map(([fieldName, label]) => {
              const draftValue = valueFor(draftAnalysis, fieldName);
              const executedValue = valueFor(executedAnalysis, fieldName);
              return {
                fieldName,
                label,
                draftValue,
                executedValue,
                changed:
                  JSON.stringify(draftValue) !== JSON.stringify(executedValue),
              };
            }),
          },
        ];
      } catch {
        return [];
      }
    });
}

export async function getWorkspace() {
  const db = env.DB;
  const [
    metricRow,
    contractRows,
    supplierRows,
    intakeRows,
    keyDateRows,
    supplierAlertRows,
    aiComparisonRows,
    evaluationRows,
  ] = await Promise.all([
    db
      .prepare(`SELECT
      (SELECT COUNT(*) FROM contracts WHERE status IN ('executed','active')) AS active_contracts,
      (SELECT COALESCE(SUM(current_value_cents), 0) FROM contracts WHERE status IN ('executed','active')) AS current_value_cents,
      (SELECT COUNT(*) FROM suppliers WHERE status = 'active') AS active_suppliers,
      (SELECT COUNT(*) FROM suppliers WHERE status = 'pending') AS pending_suppliers,
      (SELECT COUNT(*) FROM contract_intakes WHERE review_status != 'complete') AS records_to_verify`)
      .first(),
    db
      .prepare(`SELECT c.*, s.legal_name AS supplier_name
      FROM contracts c JOIN suppliers s ON s.id = c.supplier_id
      ORDER BY c.last_updated DESC`)
      .all(),
    db
      .prepare(`SELECT s.*,
      COALESCE(SUM(CASE WHEN c.status IN ('executed','active') THEN 1 ELSE 0 END), 0) AS active_contract_count,
      COALESCE(SUM(CASE WHEN c.status IN ('executed','active') THEN c.current_value_cents ELSE 0 END), 0) AS total_contract_value_cents,
      (SELECT GROUP_CONCAT(c2.contract_number || ' — ' || c2.title, '||') FROM contracts c2 WHERE c2.supplier_id = s.id) AS linked_contracts,
      (SELECT GROUP_CONCAT(i.intake_number || ' — ' || i.title || ' [' || i.status || ']', '||') FROM contract_intakes i WHERE i.supplier_id = s.id) AS linked_intakes,
      CASE
        WHEN EXISTS (SELECT 1 FROM contracts c3 WHERE c3.supplier_id = s.id) THEN 'contracted'
        WHEN EXISTS (SELECT 1 FROM contract_intakes i2 WHERE i2.supplier_id = s.id) THEN 'pre_contract'
        ELSE 'onboarding'
      END AS relationship_stage,
      (SELECT COUNT(*) FROM documents d WHERE d.supplier_id = s.id AND d.lifecycle_stage = 'supplier_record') AS qualification_document_count,
      (SELECT MIN(d.expiration_date) FROM documents d WHERE d.supplier_id = s.id AND d.lifecycle_stage = 'supplier_record' AND d.expiration_date >= date('now')) AS next_document_expiration,
      (SELECT COUNT(*) FROM documents d WHERE d.supplier_id = s.id AND d.lifecycle_stage = 'supplier_record' AND d.expiration_date < date('now') AND COALESCE(d.review_status, '') != 'not_applicable') AS expired_qualification_document_count,
      (SELECT MIN(candidate.expiration_date) FROM (
        SELECT s.insurance_expiration AS expiration_date
        UNION ALL
        SELECT d.expiration_date FROM documents d WHERE d.supplier_id = s.id AND d.lifecycle_stage = 'supplier_record'
      ) candidate WHERE candidate.expiration_date >= date('now')) AS next_compliance_expiration,
      CASE WHEN s.insurance_expiration < date('now') OR EXISTS (
        SELECT 1 FROM documents d WHERE d.supplier_id = s.id AND d.lifecycle_stage = 'supplier_record' AND d.expiration_date < date('now') AND COALESCE(d.review_status, '') != 'not_applicable'
      ) THEN 1 ELSE 0 END AS has_expired_compliance
      FROM suppliers s LEFT JOIN contracts c ON c.supplier_id = s.id
      GROUP BY s.id ORDER BY s.legal_name`)
      .all(),
    db
      .prepare(`SELECT i.*,
      s.vendor_number, s.status AS supplier_status,
      s.w9_status, s.insurance_status, s.qualification_status,
      (SELECT COUNT(*) FROM review_findings f WHERE f.intake_id = i.id AND f.status = 'open') AS finding_count,
      (SELECT COUNT(*) FROM review_findings f WHERE f.intake_id = i.id AND f.status = 'open' AND f.severity = 'high') AS high_finding_count,
      CASE
        WHEN EXISTS (SELECT 1 FROM review_findings f WHERE f.intake_id = i.id AND f.status = 'open' AND f.severity = 'high') THEN 'high'
        WHEN EXISTS (SELECT 1 FROM review_findings f WHERE f.intake_id = i.id AND f.status = 'open' AND f.severity = 'medium') THEN 'medium'
        ELSE 'low'
      END AS risk_level,
      CASE WHEN COALESCE(i.proposed_value_cents, 0) > 50000000
        THEN 'CFO approval' ELSE 'No additional approval' END AS required_approval
      FROM contract_intakes i
      LEFT JOIN suppliers s ON s.id = i.supplier_id
      ORDER BY i.received_at DESC`)
      .all(),
    db
      .prepare(`SELECT k.*, c.contract_number, c.title AS contract_title,
      c.current_value_cents,
      c.expiration_date AS contract_expiration_date, c.status AS contract_status,
      s.legal_name AS supplier_name
      FROM key_dates k
      LEFT JOIN contracts c ON c.id = k.contract_id
      LEFT JOIN suppliers s ON s.id = k.supplier_id
      ORDER BY CASE WHEN k.status = 'completed' THEN 1 ELSE 0 END, k.due_date`)
      .all(),
    db
      .prepare(`SELECT * FROM (
        SELECT 'document:' || d.id AS alert_id, 'document' AS source_type,
          s.id AS supplier_id, s.vendor_number, s.legal_name AS supplier_name,
          d.file_type AS item_type, d.file_name AS title,
          d.expiration_date AS due_date,
          COALESCE(d.review_status, 'pending') AS review_status,
          d.id AS document_id, d.issuer, d.document_number
        FROM documents d
        JOIN suppliers s ON s.id = d.supplier_id
        WHERE d.lifecycle_stage = 'supplier_record'
          AND d.expiration_date IS NOT NULL
        UNION ALL
        SELECT 'insurance:' || s.id AS alert_id,
          'supplier_register' AS source_type, s.id AS supplier_id,
          s.vendor_number, s.legal_name AS supplier_name,
          'insurance_certificate' AS item_type,
          'Insurance certificate (register record)' AS title,
          s.insurance_expiration AS due_date,
          s.insurance_status AS review_status, NULL AS document_id,
          NULL AS issuer, NULL AS document_number
        FROM suppliers s
        WHERE s.insurance_expiration IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM documents d
            WHERE d.supplier_id = s.id
              AND d.lifecycle_stage = 'supplier_record'
              AND d.file_type = 'insurance_certificate'
              AND d.expiration_date IS NOT NULL
          )
        UNION ALL
        SELECT 'missing-w9:' || s.id AS alert_id,
          'missing_record' AS source_type, s.id AS supplier_id,
          s.vendor_number, s.legal_name AS supplier_name,
          'w9' AS item_type, 'W-9 not on file' AS title,
          NULL AS due_date, 'missing' AS review_status,
          NULL AS document_id, NULL AS issuer, NULL AS document_number
        FROM suppliers s WHERE s.w9_status = 'missing'
        UNION ALL
        SELECT 'missing-insurance:' || s.id AS alert_id,
          'missing_record' AS source_type, s.id AS supplier_id,
          s.vendor_number, s.legal_name AS supplier_name,
          'insurance_certificate' AS item_type,
          'Insurance certificate not on file' AS title,
          NULL AS due_date, 'missing' AS review_status,
          NULL AS document_id, NULL AS issuer, NULL AS document_number
        FROM suppliers s WHERE s.insurance_status = 'missing'
      ) supplier_alerts
      ORDER BY CASE WHEN due_date IS NULL THEN 0 ELSE 1 END,
        due_date, supplier_name`)
      .all(),
    db
      .prepare(`SELECT r.id, r.stage, r.supplier_id, s.legal_name AS supplier_name,
        r.intake_id, r.contract_id, r.file_name, r.verified_result_json,
        COALESCE(r.intake_id, c.intake_id) AS source_intake_id,
        r.reviewed_at
      FROM ai_analysis_runs r
      JOIN suppliers s ON s.id = r.supplier_id
      LEFT JOIN contracts c ON c.id = r.contract_id
      WHERE r.status = 'verified'
        AND r.stage IN ('draft', 'executed')
        AND r.verified_result_json IS NOT NULL
      ORDER BY r.reviewed_at DESC`)
      .all<VerifiedAnalysisRun>(),
    db
      .prepare(`SELECT * FROM ai_evaluation_runs
        ORDER BY created_at DESC LIMIT 20`)
      .all(),
  ]);

  return {
    metrics: metricRow,
    contracts: contractRows.results,
    suppliers: supplierRows.results,
    intakes: intakeRows.results,
    keyDates: keyDateRows.results,
    supplierAlerts: supplierAlertRows.results,
    transactionComparisons: buildTransactionComparisons(
      aiComparisonRows.results,
    ),
    evaluationRuns: evaluationRows.results,
  };
}

export async function GET(request: Request) {
  const access = await authorizeApiRequest(request);
  if (!access.ok) return access.response;

  try {
    await ensureWorkspaceDatabase();
    return Response.json(await getWorkspace());
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Unable to load the workspace.',
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const access = await authorizeApiRequest(request, { write: true });
  if (!access.ok) return access.response;

  try {
    await ensureWorkspaceDatabase();
    const input = saveSchema.parse(await request.json());
    for (const fieldName of ['effectiveDate', 'expirationDate'] as const) {
      const value = stringValue(input.analysis[fieldName]);
      if (value && !isIsoDate(value)) {
        throw new Error(`${fieldName} must be a valid YYYY-MM-DD date.`);
      }
    }
    const contractValue = numberValue(input.analysis.contractValue);
    if (contractValue < 0 || contractValue > 100_000_000_000) {
      throw new Error('Contract value is outside the supported range.');
    }
    const noticeDaysValue = numberValue(input.analysis.noticeDays);
    if (noticeDaysValue < 0 || noticeDaysValue > 3_650) {
      throw new Error('Notice period must be between 0 and 3,650 days.');
    }
    const db = env.DB;
    const now = new Date().toISOString();
    const submittedReviewFields = new Set(
      input.review.fields.map((field) => field.fieldName),
    );
    if (submittedReviewFields.size !== reviewFieldNames.length) {
      throw new Error(
        'Confirm every extracted field before saving the reviewed record.',
      );
    }
    const analysisRun = await db
      .prepare(`SELECT id, stage, file_name, storage_key, model,
        original_result_json, status
      FROM ai_analysis_runs WHERE id = ? LIMIT 1`)
      .bind(input.analysisRunId)
      .first<{
        id: string;
        stage: string;
        file_name: string;
        storage_key: string;
        model: string;
        original_result_json: string;
        status: string;
      }>();
    if (!analysisRun) throw new Error('The AI analysis record was not found.');
    if (
      analysisRun.stage !== input.stage ||
      analysisRun.file_name !== input.document.fileName ||
      analysisRun.storage_key !== input.document.storageKey
    ) {
      throw new Error(
        'The reviewed values do not match the analyzed document.',
      );
    }
    if (analysisRun.status !== 'pending_review') {
      throw new Error('This AI analysis has already been saved.');
    }
    const originalAnalysis = saveSchema.shape.analysis.parse(
      JSON.parse(analysisRun.original_result_json),
    );
    const correctionCount = reviewFieldNames.filter(
      (fieldName) =>
        JSON.stringify(originalAnalysis[fieldName].value) !==
        JSON.stringify(input.analysis[fieldName].value),
    ).length;
    let registeredContract: { id: string; contractNumber: string } | null =
      null;
    const supplierName = stringValue(
      input.analysis.supplierLegalName,
      'Supplier pending verification',
    );
    const normalizedName =
      normalizeSupplierName(supplierName) || `pending-${crypto.randomUUID()}`;
    let supplier = await db
      .prepare(
        'SELECT id, status FROM suppliers WHERE normalized_name = ? LIMIT 1',
      )
      .bind(normalizedName)
      .first<{ id: string; status: string }>();

    if (!supplier) {
      const supplierId = `sup-${crypto.randomUUID()}`;
      await db
        .prepare(`INSERT INTO suppliers
          (id, legal_name, normalized_name, category, status, w9_status, insurance_status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, 'missing', 'missing', ?, ?)`)
        .bind(
          supplierId,
          supplierName,
          normalizedName,
          'Pending classification',
          input.stage === 'executed' ? 'active' : 'pending',
          now,
          now,
        )
        .run();
      supplier = {
        id: supplierId,
        status: input.stage === 'executed' ? 'active' : 'pending',
      };
    } else if (input.stage === 'executed' && supplier.status !== 'active') {
      await db
        .prepare(
          "UPDATE suppliers SET status = 'active', updated_at = ? WHERE id = ?",
        )
        .bind(now, supplier.id)
        .run();
    }

    let linkedIntakeId: string | null = null;
    if (input.stage === 'executed') {
      const candidates = await db
        .prepare(`SELECT i.id
          FROM contract_intakes i
          LEFT JOIN contracts c ON c.intake_id = i.id
          WHERE i.supplier_id = ? AND c.id IS NULL
            AND i.status IN ('draft', 'under_review', 'revision_requested', 'approved_for_signature')
          ORDER BY i.updated_at DESC
          LIMIT 2`)
        .bind(supplier.id)
        .all<{ id: string }>();
      if (candidates.results.length === 1) {
        linkedIntakeId = candidates.results[0].id;
      }
    }

    const title = stringValue(
      input.analysis.documentTitle,
      input.document.fileName.replace(/\.[^.]+$/, ''),
    );
    const contractType = stringValue(input.analysis.contractType, 'Contract');
    const valueCents = Math.round(
      numberValue(input.analysis.contractValue) * 100,
    );
    const documentId = `doc-${crypto.randomUUID()}`;
    const aiReviewStatements = ({
      intakeId,
      contractId,
    }: {
      intakeId: string | null;
      contractId: string | null;
    }) => [
      db
        .prepare(`UPDATE ai_analysis_runs SET intake_id = ?, contract_id = ?,
          supplier_id = ?, document_id = ?, verified_result_json = ?,
          correction_count = ?, status = 'verified', reviewed_by = ?,
          reviewed_at = ? WHERE id = ?`)
        .bind(
          intakeId,
          contractId,
          supplier.id,
          documentId,
          JSON.stringify(input.analysis),
          correctionCount,
          access.actor.name,
          now,
          input.analysisRunId,
        ),
      ...reviewFieldNames.map((fieldName) => {
        const originalField = originalAnalysis[fieldName];
        const verifiedField = input.analysis[fieldName];
        const reviewStatus =
          JSON.stringify(originalField.value) ===
          JSON.stringify(verifiedField.value)
            ? 'accepted'
            : 'corrected';
        return db
          .prepare(`INSERT INTO ai_field_reviews
            (id, analysis_run_id, field_name, original_value_json,
             verified_value_json, confidence, source_page, source_quote,
             review_status, reviewed_by, reviewed_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
          .bind(
            `aifield-${crypto.randomUUID()}`,
            input.analysisRunId,
            fieldName,
            JSON.stringify(originalField.value),
            JSON.stringify(verifiedField.value),
            originalField.confidence,
            originalField.sourcePage,
            originalField.sourceQuote,
            reviewStatus,
            access.actor.name,
            now,
          );
      }),
    ];

    if (input.stage === 'draft') {
      const id = `int-${crypto.randomUUID()}`;
      const intakeNumber = `INT-${new Date().getUTCFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
      await db.batch([
        db
          .prepare(`INSERT INTO contract_intakes
          (id, intake_number, supplier_id, proposed_supplier_name, title,
           contract_type, proposed_value_cents, status, review_status, owner,
           target_review_date, approval_status, received_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'under_review', 'in_progress', ?, ?, ?, ?, ?)`)
          .bind(
            id,
            intakeNumber,
            supplier.id,
            supplierName,
            title,
            contractType,
            valueCents || null,
            access.actor.name,
            addDays(now.slice(0, 10), 5),
            valueCents > 50_000_000 ? 'pending' : 'not_required',
            now.slice(0, 10),
            now,
          ),
        db
          .prepare(`INSERT INTO documents
          (id, supplier_id, intake_id, file_name, file_type, lifecycle_stage, storage_key, mime_type, page_count, ai_status, uploaded_at)
          VALUES (?, ?, ?, ?, ?, 'draft', ?, ?, ?, 'needs_review', ?)`)
          .bind(
            documentId,
            supplier.id,
            id,
            input.document.fileName,
            contractType,
            input.document.storageKey,
            input.document.mimeType,
            input.document.totalPages,
            now,
          ),
        db
          .prepare(`INSERT INTO audit_logs (id, entity_type, entity_id, action, actor, details, created_at)
          VALUES (?, 'contract_intake', ?, 'ai_extraction_saved', ?, ?, ?)`)
          .bind(
            `audit-${crypto.randomUUID()}`,
            id,
            access.actor.name,
            JSON.stringify({
              source: input.document.fileName,
              model: analysisRun.model,
              analysisRunId: input.analysisRunId,
              correctionCount,
            }),
            now,
          ),
        ...aiReviewStatements({ intakeId: id, contractId: null }),
        ...input.analysis.findings.map((finding) =>
          db
            .prepare(`INSERT INTO review_findings
              (id, intake_id, field, rule_name, standard_text, observed_text,
               suggested_revision, severity, source_page, status)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'open')`)
            .bind(
              `finding-${crypto.randomUUID()}`,
              id,
              finding.rule.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
              finding.rule,
              finding.standard,
              finding.observed,
              finding.suggestedRevision,
              finding.severity,
              finding.sourcePage,
            ),
        ),
      ]);
    } else {
      const id = `con-${crypto.randomUUID()}`;
      const extractedNumber = stringValue(input.analysis.contractNumber);
      const contractNumber =
        extractedNumber ||
        `CT-${new Date().getUTCFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
      const effectiveDate = stringValue(
        input.analysis.effectiveDate,
        now.slice(0, 10),
      );
      const expirationDate = stringValue(input.analysis.expirationDate) || null;
      const noticeDays =
        Math.round(numberValue(input.analysis.noticeDays)) || null;
      const renewalType = stringValue(input.analysis.renewalType, 'none');
      const noticeDeadline = subtractDays(expirationDate ?? '', noticeDays);
      const extractedDates = input.analysis.keyDates.filter(
        (item) => item.dueDate,
      );
      if (
        noticeDeadline &&
        !extractedDates.some(
          (item) =>
            item.type === 'non_renewal_notice' &&
            item.dueDate === noticeDeadline,
        )
      ) {
        extractedDates.unshift({
          type: 'non_renewal_notice',
          title: 'Non-renewal notice deadline',
          dueDate: noticeDeadline,
          sourcePage: input.analysis.noticeDays.sourcePage,
          sourceQuote: input.analysis.noticeDays.sourceQuote,
        });
      }

      await db.batch([
        db
          .prepare(`INSERT INTO contracts
          (id, contract_number, intake_id, supplier_id, title, contract_type, department, owner, original_value_cents, amendment_value_cents, current_value_cents, effective_date, expiration_date, renewal_type, notice_days, notice_deadline, payment_terms, governing_law, status, last_updated)
          VALUES (?, ?, ?, ?, ?, ?, 'Procurement', ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`)
          .bind(
            id,
            contractNumber,
            linkedIntakeId,
            supplier.id,
            title,
            contractType,
            access.actor.name,
            valueCents,
            valueCents,
            effectiveDate,
            expirationDate,
            ['automatic', 'optional', 'none'].includes(renewalType)
              ? renewalType
              : 'none',
            noticeDays,
            noticeDeadline,
            stringValue(input.analysis.paymentTerms) || null,
            stringValue(input.analysis.governingLaw) || null,
            now,
          ),
        db
          .prepare(`INSERT INTO documents
          (id, supplier_id, contract_id, file_name, file_type, lifecycle_stage, storage_key, mime_type, page_count, ai_status, uploaded_at)
          VALUES (?, ?, ?, ?, ?, 'executed', ?, ?, ?, 'verified', ?)`)
          .bind(
            documentId,
            supplier.id,
            id,
            input.document.fileName,
            contractType,
            input.document.storageKey,
            input.document.mimeType,
            input.document.totalPages,
            now,
          ),
        db
          .prepare(`INSERT INTO audit_logs (id, entity_type, entity_id, action, actor, details, created_at)
          VALUES (?, 'contract', ?, 'executed_contract_registered', ?, ?, ?)`)
          .bind(
            `audit-${crypto.randomUUID()}`,
            id,
            access.actor.name,
            JSON.stringify({
              source: input.document.fileName,
              model: analysisRun.model,
              analysisRunId: input.analysisRunId,
              correctionCount,
            }),
            now,
          ),
        ...aiReviewStatements({ intakeId: linkedIntakeId, contractId: id }),
        ...(linkedIntakeId
          ? [
              db
                .prepare(`UPDATE contract_intakes
                  SET status = 'executed', review_status = 'complete', updated_at = ?
                  WHERE id = ?`)
                .bind(now, linkedIntakeId),
            ]
          : []),
        ...extractedDates.map((item) =>
          db
            .prepare(`INSERT INTO key_dates
              (id, contract_id, supplier_id, type, title, due_date, status, owner, decision, source_clause, source_page)
              VALUES (?, ?, ?, ?, ?, ?, 'upcoming', ?, ?, ?, ?)`)
            .bind(
              `date-${crypto.randomUUID()}`,
              id,
              supplier.id,
              item.type,
              item.title,
              item.dueDate,
              access.actor.name,
              item.type === 'non_renewal_notice' ? 'under_review' : null,
              item.sourceQuote,
              item.sourcePage,
            ),
        ),
      ]);
      registeredContract = { id, contractNumber };
    }

    await db.prepare('PRAGMA optimize').run();
    return Response.json({
      saved: true,
      registeredContract,
      workspace: await getWorkspace(),
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Unable to save the verified record.',
      },
      { status: 400 },
    );
  }
}
