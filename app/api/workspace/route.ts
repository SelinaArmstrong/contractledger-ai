import { env } from 'cloudflare:workers';
import { z } from 'zod';

import {
  addApprovalDueDays,
  approvalGate,
  generateApprovalRequirements,
  type ApprovalContext,
  type ApprovalRequestStatus,
  type ApprovalRuleDefinition,
  type ApprovalTriggerType,
} from '@/lib/approval-workflow';
import {
  effectiveInsuranceStatus,
  normalizeSupplierName,
} from '@/lib/supplier-qualification';
import { approvedTerms, approvalCoversTerms } from '@/lib/approval-scope';
import { validatedOverrideReason } from '@/lib/ai-governance';
import {
  calculateObligationMetrics,
  type ObligationMetricRecord,
} from '@/lib/obligation-workflow';
import { playbookRule, resolvePlaybookKey } from '@/lib/contract-playbook';
import {
  approvalQueueQuery,
  buildSupplierRiskProfiles,
  contractRegisterQuery,
  intakeRegisterQuery,
  keyDatesQuery,
  orderedRows,
  supplierDocumentationFollowUp,
  supplierDocumentsQuery,
  supplierRegisterQuery,
} from '@/lib/server/register-data';
import type { RegisterRow } from '@/lib/registers';
import { isIsoDate, storedDocumentMimeTypeSchema } from '@/lib/validation';
import { withApiRoute } from '@/lib/server/route-handler';
import { aiBudgetStatus } from '@/lib/server/ai-budget';
import { WORKSPACE_REGISTER_LIMIT } from '@/lib/workspace-limits';

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
  'liabilityCap',
] as const;

const saveSchema = z.object({
  analysisRunId: z.string().min(1),
  intakeId: z.string().min(1).max(200).nullable().optional(),
  stage: z.enum(['draft', 'executed']),
  document: z.object({
    fileName: z.string().min(1).max(255),
    totalPages: z.number().int().positive().max(40),
    storageKey: z.string().min(1).max(500),
    mimeType: storedDocumentMimeTypeSchema,
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
    liabilityCap: fieldSchema,
    findings: z.array(
      z.object({
        ruleKey: z.string().max(80).optional(),
        rule: z.string().min(1).max(400),
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
        overrideReason: z.string().max(500).optional(),
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

async function loadActiveApprovalRules(db: D1Database) {
  const rows = await db
    .prepare(`SELECT id, rule_key, version, name, description, trigger_type,
      trigger_config_json, owner_role, due_days, mandatory, active
      FROM approval_rules WHERE active = 1 ORDER BY rule_key, version`)
    .all<{
      id: string;
      rule_key: string;
      version: number;
      name: string;
      description: string;
      trigger_type: string;
      trigger_config_json: string;
      owner_role: string;
      due_days: number;
      mandatory: number;
      active: number;
    }>();
  return rows.results.map(
    (row): ApprovalRuleDefinition => ({
      id: row.id,
      ruleKey: row.rule_key,
      version: row.version,
      name: row.name,
      description: row.description,
      triggerType: row.trigger_type as ApprovalTriggerType,
      triggerConfig: JSON.parse(row.trigger_config_json) as Record<
        string,
        unknown
      >,
      ownerRole: row.owner_role,
      dueDays: row.due_days,
      mandatory: Boolean(row.mandatory),
      active: Boolean(row.active),
    }),
  );
}

type VerifiedAnalysisRun = {
  id: string;
  stage: 'draft' | 'executed';
  supplier_id: string | null;
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
      if (
        !draft ||
        !draft.intake_id ||
        !executed.contract_id ||
        !executed.supplier_id
      )
        return [];
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
    pendingReviewRows,
    keyDateRows,
    supplierAlertRows,
    supplierDocumentRows,
    aiComparisonRows,
    evaluationRows,
    aiGovernanceMetricRow,
    aiCorrectionRows,
    approvalMetricRow,
    approvalQueueRows,
    integrationMetricRow,
    approvalRuleRows,
  ] = await Promise.all([
    db
      .prepare(`SELECT
      (SELECT COUNT(*) FROM contracts WHERE status IN ('executed','active')) AS active_contracts,
      (SELECT COALESCE(SUM(current_value_cents), 0) FROM contracts WHERE status IN ('executed','active')) AS current_value_cents,
      (SELECT COUNT(*) FROM suppliers WHERE status = 'active') AS active_suppliers,
      (SELECT COUNT(*) FROM suppliers WHERE status = 'pending') AS pending_suppliers,
      (SELECT COUNT(*) FROM contract_intakes WHERE review_status != 'complete') AS records_to_verify,
      (SELECT COUNT(*) FROM contracts) AS total_contracts,
      (SELECT COUNT(*) FROM suppliers) AS total_suppliers,
      (SELECT COUNT(*) FROM suppliers s WHERE ${supplierDocumentationFollowUp}) AS supplier_documentation_follow_up,
      (SELECT COUNT(*) FROM contract_intakes) AS total_intakes,
      (SELECT COUNT(*) FROM key_dates) AS total_key_dates`)
      .first(),
    db
      .prepare(orderedRows(contractRegisterQuery, WORKSPACE_REGISTER_LIMIT))
      .all<RegisterRow>(),
    db
      .prepare(orderedRows(supplierRegisterQuery, WORKSPACE_REGISTER_LIMIT))
      .all<RegisterRow>(),
    db
      .prepare(orderedRows(intakeRegisterQuery, WORKSPACE_REGISTER_LIMIT))
      .all<RegisterRow>(),
    db
      .prepare(`SELECT i.id, i.intake_number, i.title, i.proposed_supplier_name,
        i.proposed_value_cents, i.status, i.received_at,
        (SELECT COUNT(*) FROM review_findings f WHERE f.intake_id = i.id AND f.status = 'open') AS finding_count
        FROM contract_intakes i WHERE i.review_status != 'complete'
        ORDER BY i.received_at DESC, i.id LIMIT 4`)
      .all<RegisterRow>(),
    db
      .prepare(orderedRows(keyDatesQuery, WORKSPACE_REGISTER_LIMIT))
      .all<ObligationMetricRecord & RegisterRow>(),
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
        WHERE d.lifecycle_stage = 'supplier_record' AND COALESCE(d.review_status, '') NOT IN ('superseded', 'not_applicable')
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
              AND d.lifecycle_stage = 'supplier_record' AND COALESCE(d.review_status, '') NOT IN ('superseded', 'not_applicable')
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
      .prepare(orderedRows(supplierDocumentsQuery, WORKSPACE_REGISTER_LIMIT))
      .all<RegisterRow>(),
    db
      .prepare(`SELECT r.id, r.stage, r.supplier_id,
        COALESCE(s.legal_name, i.proposed_supplier_name, 'Supplier not recorded') AS supplier_name,
        r.intake_id, r.contract_id, r.file_name, r.verified_result_json,
        COALESCE(r.intake_id, c.intake_id) AS source_intake_id,
        r.reviewed_at
      FROM ai_analysis_runs r
      LEFT JOIN suppliers s ON s.id = r.supplier_id
      LEFT JOIN contract_intakes i ON i.id = r.intake_id
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
    db
      .prepare(`SELECT
        COUNT(*) AS reviewed_fields,
        SUM(CASE WHEN f.review_status = 'corrected' THEN 1 ELSE 0 END) AS corrected_fields,
        COALESCE(ROUND(100.0 * SUM(CASE WHEN f.review_status = 'corrected' THEN 1 ELSE 0 END) /
          NULLIF(COUNT(*), 0), 1), 0) AS correction_rate_percent,
        SUM(CASE WHEN f.field_name IN (
          'supplierLegalName', 'contractNumber', 'contractValue',
          'effectiveDate', 'expirationDate', 'renewalType', 'noticeDays',
          'referencedContractNumber', 'signedDate', 'valueChange',
          'resultingContractValue', 'newExpirationDate', 'documentType'
        ) THEN 1 ELSE 0 END) AS critical_reviewed_fields,
        SUM(CASE WHEN f.field_name IN (
          'supplierLegalName', 'contractNumber', 'contractValue',
          'effectiveDate', 'expirationDate', 'renewalType', 'noticeDays',
          'referencedContractNumber', 'signedDate', 'valueChange',
          'resultingContractValue', 'newExpirationDate', 'documentType'
        ) AND ((f.source_page IS NOT NULL AND TRIM(COALESCE(f.source_quote, '')) != '')
          OR TRIM(COALESCE(f.override_reason, '')) != '') THEN 1 ELSE 0 END)
          AS critical_supported_or_overridden_fields,
        COALESCE(ROUND(100.0 * SUM(CASE WHEN f.field_name IN (
          'supplierLegalName', 'contractNumber', 'contractValue',
          'effectiveDate', 'expirationDate', 'renewalType', 'noticeDays',
          'referencedContractNumber', 'signedDate', 'valueChange',
          'resultingContractValue', 'newExpirationDate', 'documentType'
        ) AND ((f.source_page IS NOT NULL AND TRIM(COALESCE(f.source_quote, '')) != '')
          OR TRIM(COALESCE(f.override_reason, '')) != '') THEN 1 ELSE 0 END) /
          NULLIF(SUM(CASE WHEN f.field_name IN (
            'supplierLegalName', 'contractNumber', 'contractValue',
            'effectiveDate', 'expirationDate', 'renewalType', 'noticeDays',
            'referencedContractNumber', 'signedDate', 'valueChange',
            'resultingContractValue', 'newExpirationDate', 'documentType'
          ) THEN 1 ELSE 0 END), 0), 1), 100)
          AS critical_source_control_percent
        FROM ai_field_reviews f`)
      .first(),
    db
      .prepare(`SELECT f.field_name, r.stage, r.model, r.prompt_version,
        COUNT(*) AS reviewed_fields,
        SUM(CASE WHEN f.review_status = 'corrected' THEN 1 ELSE 0 END) AS corrected_fields,
        ROUND(100.0 * SUM(CASE WHEN f.review_status = 'corrected' THEN 1 ELSE 0 END) /
          NULLIF(COUNT(*), 0), 1) AS correction_rate_percent
        FROM ai_field_reviews f
        JOIN ai_analysis_runs r ON r.id = f.analysis_run_id
        GROUP BY f.field_name, r.stage, r.model, r.prompt_version
        ORDER BY correction_rate_percent DESC, reviewed_fields DESC, f.field_name`)
      .all(),
    db
      .prepare(`SELECT
        (SELECT COUNT(*) FROM approval_requests
          WHERE status IN ('pending', 'in_review', 'revision_requested')) AS open_requests,
        (SELECT COUNT(*) FROM approval_requests
          WHERE status IN ('pending', 'in_review', 'revision_requested')
            AND due_at < date('now')) AS overdue_requests,
        (SELECT COUNT(DISTINCT ar.intake_id)
          FROM approval_requests ar
          JOIN approval_rules r ON r.id = ar.rule_id
          WHERE r.mandatory = 1 AND ar.status != 'approved') AS blocked_intakes,
        COALESCE((SELECT ROUND(AVG((julianday(completed_at) - julianday(generated_at)) * 24), 1)
          FROM approval_requests WHERE completed_at IS NOT NULL), 0) AS average_turnaround_hours,
        COALESCE((SELECT ROUND(100.0 * SUM(CASE WHEN action = 'approve_exception' THEN 1 ELSE 0 END) /
          NULLIF(SUM(CASE WHEN action IN ('approve', 'approve_exception', 'decline') THEN 1 ELSE 0 END), 0), 1)
          FROM approval_decision_history), 0) AS exception_approval_rate`)
      .first(),
    db.prepare(orderedRows(approvalQueueQuery, 500)).all<RegisterRow>(),
    db
      .prepare(`SELECT COUNT(*) AS total_events,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending_events,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed_events,
        MAX(occurred_at) AS last_event_at
        FROM integration_outbox`)
      .first(),
    // Read-only: the rules reference page renders the definitions the engine
    // actually evaluates, rather than a hand-maintained copy of them.
    db
      .prepare(`SELECT id, rule_key, version, name, description, trigger_type,
        trigger_config_json, owner_role, due_days, mandatory, active
        FROM approval_rules WHERE active = 1 ORDER BY rule_key, version`)
      .all(),
  ]);

  const asOfDate = new Date().toISOString().slice(0, 10);
  const supplierRiskProfiles = buildSupplierRiskProfiles(
    supplierRows.results,
    Number(metricRow?.current_value_cents ?? 0),
    asOfDate,
  );

  return {
    metrics: metricRow,
    contracts: contractRows.results,
    suppliers: supplierRows.results,
    supplierRiskProfiles,
    intakes: intakeRows.results,
    pendingReviews: pendingReviewRows.results,
    keyDates: keyDateRows.results,
    registerLimit: WORKSPACE_REGISTER_LIMIT,
    aiBudget: await aiBudgetStatus(),
    obligationMetrics: calculateObligationMetrics(keyDateRows.results),
    supplierAlerts: supplierAlertRows.results,
    supplierDocuments: supplierDocumentRows.results,
    transactionComparisons: buildTransactionComparisons(
      aiComparisonRows.results,
    ),
    evaluationRuns: evaluationRows.results,
    aiGovernanceMetrics: aiGovernanceMetricRow,
    aiCorrectionByField: aiCorrectionRows.results,
    approvalMetrics: approvalMetricRow,
    approvalQueue: approvalQueueRows.results,
    approvalRules: approvalRuleRows.results,
    integrationMetrics: integrationMetricRow,
  };
}

export const GET = withApiRoute(
  {
    permission: 'view_workspace',
    errorStatus: 500,
    fallbackError: 'Unable to load the workspace.',
  },
  async () => Response.json(await getWorkspace()),
);

export const POST = withApiRoute(
  {
    permission: 'edit_verified_fields',
    fallbackError: 'Unable to save the verified record.',
  },
  async ({ request, actor }) => {
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
    const reviewByField = new Map(
      input.review.fields.map((item) => [item.fieldName, item]),
    );
    const overrideReasons = Object.fromEntries(
      reviewFieldNames.map((fieldName) => [
        fieldName,
        validatedOverrideReason(
          fieldName,
          {
            ...originalAnalysis[fieldName],
            value: input.analysis[fieldName].value,
          },
          reviewByField.get(fieldName)?.overrideReason,
        ),
      ]),
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
    const title = stringValue(
      input.analysis.documentTitle,
      input.document.fileName.replace(/\.[^.]+$/, ''),
    );
    const contractType = stringValue(input.analysis.contractType, 'Contract');
    const valueCents = Math.round(
      numberValue(input.analysis.contractValue) * 100,
    );
    const documentId = `doc-${crypto.randomUUID()}`;
    const supplierRecord = await db
      .prepare(`SELECT id, status, risk_tier, insurance_status, insurance_expiration
        FROM suppliers WHERE normalized_name = ? LIMIT 1`)
      .bind(normalizedName)
      .first<{
        id: string;
        status: string;
        risk_tier: string | null;
        insurance_status: string | null;
        insurance_expiration: string | null;
      }>();
    // A resolved playbook key is what lets an approval request point back at
    // the finding that caused it, and it makes the stored standard the
    // company's own wording rather than the model's paraphrase. Anything the
    // model could not place keeps its previous slug-and-echo behaviour.
    const findingRecords = input.analysis.findings.map((finding) => {
      const rule = playbookRule(resolvePlaybookKey(finding.ruleKey));
      return {
        ...finding,
        id: `finding-${crypto.randomUUID()}`,
        field:
          rule?.key ?? finding.rule.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
        rule: rule?.title ?? finding.rule,
        standard: rule?.standard ?? finding.standard,
      };
    });
    const approvalContext: ApprovalContext = {
      proposedValueCents: valueCents,
      governingLaw: stringValue(input.analysis.governingLaw) || null,
      renewalType: stringValue(input.analysis.renewalType) || null,
      insuranceStatus: effectiveInsuranceStatus(
        supplierRecord?.insurance_status ?? null,
        supplierRecord?.insurance_expiration ?? null,
        now.slice(0, 10),
      ),
      supplierRiskTier: supplierRecord?.risk_tier ?? null,
      liabilityCap: stringValue(input.analysis.liabilityCap) || null,
      findings: findingRecords.map((finding) => ({
        id: finding.id,
        field: finding.field,
        ruleName: finding.rule,
        sourcePage: finding.sourcePage,
        observedText: finding.observed,
      })),
      fieldSources: {
        contractValue: {
          sourcePage: input.analysis.contractValue.sourcePage,
          sourceQuote: input.analysis.contractValue.sourceQuote,
        },
        governingLaw: {
          sourcePage: input.analysis.governingLaw.sourcePage,
          sourceQuote: input.analysis.governingLaw.sourceQuote,
        },
        renewalType: {
          sourcePage: input.analysis.renewalType.sourcePage,
          sourceQuote: input.analysis.renewalType.sourceQuote,
        },
      },
    };
    const activeApprovalRules = await loadActiveApprovalRules(db);
    const approvalRequirements = generateApprovalRequirements(
      approvalContext,
      activeApprovalRules,
    );

    let linkedIntakeId: string | null = null;
    if (input.stage === 'executed') {
      if (input.intakeId) {
        const intake = await db
          .prepare(`SELECT i.id, i.proposed_supplier_name
          FROM contract_intakes i
          WHERE i.id = ? AND i.status IN ('draft', 'under_review', 'revision_requested', 'approved_for_signature')
            AND NOT EXISTS (SELECT 1 FROM contracts c WHERE c.intake_id = i.id)`)
          .bind(input.intakeId)
          .first<{ id: string; proposed_supplier_name: string }>();
        if (
          !intake ||
          normalizeSupplierName(intake.proposed_supplier_name) !==
            normalizedName
        ) {
          throw new Error(
            'Choose an unregistered review intake for this supplier.',
          );
        }
        linkedIntakeId = intake.id;
      }
      if (linkedIntakeId) {
        const existingApprovals = await db
          .prepare(`SELECT ar.rule_id, ar.status, ar.rule_snapshot_json, r.mandatory
            FROM approval_requests ar
            JOIN approval_rules r ON r.id = ar.rule_id
            WHERE ar.intake_id = ? AND r.mandatory = 1`)
          .bind(linkedIntakeId)
          .all<{
            rule_id: string;
            status: ApprovalRequestStatus;
            mandatory: number;
            rule_snapshot_json: string;
          }>();
        const terms = approvedTerms(input.analysis);
        if (
          existingApprovals.results.some(
            (approval) =>
              !approvalCoversTerms(approval.rule_snapshot_json, terms),
          )
        ) {
          throw new Error(
            'The executed terms differ from the approved review, or the old approval has no verified terms snapshot. Submit this agreement as a new draft review, complete its approvals, then select that intake here.',
          );
        }
        const existingRuleIds = new Set(
          existingApprovals.results.map((approval) => approval.rule_id),
        );
        const gate = approvalGate([
          ...existingApprovals.results.map((approval) => ({
            mandatory: Boolean(approval.mandatory),
            status: approval.status,
          })),
          ...approvalRequirements
            .filter(
              (requirement) =>
                requirement.rule.mandatory &&
                !existingRuleIds.has(requirement.rule.id),
            )
            .map(() => ({
              mandatory: true,
              status: 'pending' as const,
            })),
        ]);
        if (!gate.allowed) {
          throw new Error(
            `Executed registration is blocked by ${gate.blockingCount} incomplete mandatory approval${gate.blockingCount === 1 ? '' : 's'}. Complete the approval queue before retrying this verified analysis.`,
          );
        }
      } else {
        const mandatoryRequirements = approvalRequirements.filter(
          (requirement) => requirement.rule.mandatory,
        );
        if (mandatoryRequirements.length) {
          throw new Error(
            `Executed registration requires a linked review intake with ${mandatoryRequirements.length} completed mandatory approval${mandatoryRequirements.length === 1 ? '' : 's'}. Save the agreement as a draft review first.`,
          );
        }
      }
    }

    let supplier: { id: string; status: string } | null = null;
    let supplierMutation: D1PreparedStatement | null = null;
    if (input.stage === 'executed') {
      if (supplierRecord) {
        supplier = { id: supplierRecord.id, status: supplierRecord.status };
        if (supplierRecord.status !== 'active') {
          supplierMutation = db
            .prepare(
              "UPDATE suppliers SET status = 'active', updated_at = ? WHERE id = ?",
            )
            .bind(now, supplierRecord.id);
        }
      } else {
        supplier = { id: `sup-${crypto.randomUUID()}`, status: 'active' };
        supplierMutation = db
          .prepare(`INSERT INTO suppliers
            (id, legal_name, normalized_name, category, status,
             qualification_status, w9_status, insurance_status, created_at, updated_at)
            VALUES (?, ?, ?, 'Pending classification', 'active',
              'incomplete', 'missing', 'missing', ?, ?)`)
          .bind(supplier.id, supplierName, normalizedName, now, now);
      }
    }
    const aiReviewStatements = ({
      intakeId,
      contractId,
      supplierId,
    }: {
      intakeId: string | null;
      contractId: string | null;
      supplierId: string | null;
    }) => [
      db
        .prepare(`UPDATE ai_analysis_runs SET intake_id = ?, contract_id = ?,
          supplier_id = ?, document_id = ?, verified_result_json = ?,
          correction_count = ?, status = 'verified', reviewed_by = ?,
          reviewed_at = ? WHERE id = ?`)
        .bind(
          intakeId,
          contractId,
          supplierId,
          documentId,
          JSON.stringify(input.analysis),
          correctionCount,
          actor.name,
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
             override_reason, review_status, reviewed_by, reviewed_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
          .bind(
            `aifield-${crypto.randomUUID()}`,
            input.analysisRunId,
            fieldName,
            JSON.stringify(originalField.value),
            JSON.stringify(verifiedField.value),
            originalField.confidence,
            originalField.sourcePage,
            originalField.sourceQuote,
            overrideReasons[fieldName],
            reviewStatus,
            actor.name,
            now,
          );
      }),
    ];
    const approvalStatements = (intakeId: string) =>
      approvalRequirements.flatMap((requirement) => {
        const requestId = `approval-${crypto.randomUUID()}`;
        const stepId = `approval-step-${crypto.randomUUID()}`;
        const dueAt = addApprovalDueDays(now, requirement.rule.dueDays);
        return [
          db
            .prepare(`INSERT INTO approval_requests
              (id, intake_id, rule_id, source_finding_id, source_document_id,
               status, reason, rule_snapshot_json, generated_at, due_at, updated_at)
              VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?)`)
            .bind(
              requestId,
              intakeId,
              requirement.rule.id,
              requirement.sourceFindingId,
              documentId,
              requirement.reason,
              JSON.stringify({
                ...requirement.rule,
                reviewedTerms: approvedTerms(input.analysis),
                sourceAnalysisRunId: input.analysisRunId,
              }),
              now,
              dueAt,
              now,
            ),
          db
            .prepare(`INSERT INTO approval_steps
              (id, request_id, sequence, owner_role, status, due_at,
               source_page, source_quote)
              VALUES (?, ?, 1, ?, 'pending', ?, ?, ?)`)
            .bind(
              stepId,
              requestId,
              requirement.rule.ownerRole,
              dueAt,
              requirement.sourcePage,
              requirement.sourceQuote,
            ),
          db
            .prepare(`INSERT INTO approval_decision_history
              (id, request_id, step_id, action, from_status, to_status,
               actor, actor_role, reason, created_at)
              VALUES (?, ?, ?, 'generated', 'pending', 'pending',
                'Rules engine', 'System', ?, ?)`)
            .bind(
              `approval-history-${crypto.randomUUID()}`,
              requestId,
              stepId,
              requirement.reason,
              now,
            ),
        ];
      });

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
            null,
            supplierName,
            title,
            contractType,
            valueCents || null,
            actor.name,
            addDays(now.slice(0, 10), 5),
            approvalRequirements.length ? 'pending' : 'not_required',
            now.slice(0, 10),
            now,
          ),
        db
          .prepare(`INSERT INTO documents
          (id, supplier_id, intake_id, file_name, file_type, lifecycle_stage, storage_key, mime_type, page_count, ai_status, uploaded_at)
          VALUES (?, ?, ?, ?, ?, 'draft', ?, ?, ?, 'needs_review', ?)`)
          .bind(
            documentId,
            null,
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
            actor.name,
            JSON.stringify({
              source: input.document.fileName,
              model: analysisRun.model,
              analysisRunId: input.analysisRunId,
              correctionCount,
              approvalRequirementCount: approvalRequirements.length,
            }),
            now,
          ),
        ...aiReviewStatements({
          intakeId: id,
          contractId: null,
          supplierId: null,
        }),
        ...findingRecords.map((finding) =>
          db
            .prepare(`INSERT INTO review_findings
              (id, intake_id, field, rule_name, standard_text, observed_text,
               suggested_revision, severity, source_page, status)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'open')`)
            .bind(
              finding.id,
              id,
              finding.field,
              finding.rule,
              finding.standard,
              finding.observed,
              finding.suggestedRevision,
              finding.severity,
              finding.sourcePage,
            ),
        ),
        ...approvalStatements(id),
      ]);
    } else {
      if (!supplier) throw new Error('The executed supplier was not resolved.');
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
        ...(supplierMutation ? [supplierMutation] : []),
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
            actor.name,
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
            actor.name,
            JSON.stringify({
              source: input.document.fileName,
              model: analysisRun.model,
              analysisRunId: input.analysisRunId,
              correctionCount,
            }),
            now,
          ),
        ...aiReviewStatements({
          intakeId: linkedIntakeId,
          contractId: id,
          supplierId: supplier.id,
        }),
        ...(linkedIntakeId
          ? [
              db
                .prepare(`UPDATE contract_intakes
                  SET supplier_id = ?, status = 'executed',
                    review_status = 'complete', updated_at = ?
                  WHERE id = ?`)
                .bind(supplier.id, now, linkedIntakeId),
            ]
          : []),
        ...extractedDates.map((item) =>
          db
            .prepare(`INSERT INTO key_dates
              (id, contract_id, supplier_id, type, title, due_date, status,
               owner, priority, assigned_at, decision, source_document_id,
               source_clause, source_page, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, 'upcoming', ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .bind(
              `date-${crypto.randomUUID()}`,
              id,
              supplier.id,
              item.type,
              item.title,
              item.dueDate,
              actor.name,
              item.type === 'non_renewal_notice' ? 'high' : 'medium',
              now,
              item.type === 'non_renewal_notice' ? 'under_review' : null,
              documentId,
              item.sourceQuote,
              item.sourcePage,
              now,
              now,
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
  },
);
