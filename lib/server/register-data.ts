import type { RegisterRow } from '@/lib/registers';
import { calculateSupplierRiskProfile } from '@/lib/supplier-risk';
import { effectiveInsuranceStatus } from '@/lib/supplier-qualification';

const expiredCompliance = `(s.insurance_expiration < date('now') OR EXISTS (
        SELECT 1 FROM documents d WHERE d.supplier_id = s.id AND d.lifecycle_stage = 'supplier_record' AND COALESCE(d.review_status, '') NOT IN ('superseded', 'not_applicable') AND d.expiration_date < date('now') AND COALESCE(d.review_status, '') != 'not_applicable'
      ))`;

export const supplierDocumentationFollowUp = `(COALESCE(s.qualification_status, '') != 'complete' OR ${expiredCompliance})`;

type OrderedQuery = { select: string; order: string };

export function orderedRows({ select, order }: OrderedQuery, limit?: number) {
  return `${select} ORDER BY ${order}${limit === undefined ? '' : ` LIMIT ${limit}`}`;
}

export const contractRegisterQuery = {
  select: `SELECT c.*, s.legal_name AS supplier_name,
      (SELECT COUNT(*) FROM key_dates k
        WHERE k.contract_id = c.id AND k.status != 'completed') AS open_obligation_count,
      (SELECT MIN(k.due_date) FROM key_dates k
        WHERE k.contract_id = c.id AND k.status != 'completed') AS next_obligation_date,
      (SELECT COUNT(*) FROM amendments a
        WHERE a.contract_id = c.id) AS amendment_count,
      COALESCE((SELECT MAX(a.version_number) FROM amendments a
        WHERE a.contract_id = c.id), 1) AS current_version
      FROM contracts c JOIN suppliers s ON s.id = c.supplier_id`,
  order: 'c.last_updated DESC, c.id',
};

export const intakeRegisterQuery = {
  select: `SELECT i.*,
      s.vendor_number, s.status AS supplier_status,
      s.w9_status, s.insurance_status, s.qualification_status,
      (SELECT COUNT(*) FROM review_findings f WHERE f.intake_id = i.id AND f.status = 'open') AS finding_count,
      (SELECT COUNT(*) FROM review_findings f WHERE f.intake_id = i.id AND f.status = 'open' AND f.severity = 'high') AS high_finding_count,
      CASE
        WHEN EXISTS (SELECT 1 FROM review_findings f WHERE f.intake_id = i.id AND f.status = 'open' AND f.severity = 'high') THEN 'high'
        WHEN EXISTS (SELECT 1 FROM review_findings f WHERE f.intake_id = i.id AND f.status = 'open' AND f.severity = 'medium') THEN 'medium'
        -- Only a completed playbook review earns 'low'. Without one the risk is
        -- unknown, not cleared, so the column stays NULL.
        WHEN EXISTS (SELECT 1 FROM ai_analysis_runs r WHERE r.intake_id = i.id)
          OR EXISTS (SELECT 1 FROM review_findings f WHERE f.intake_id = i.id) THEN 'low'
        ELSE NULL
      END AS risk_level,
      (SELECT COUNT(*) FROM approval_requests arq
        JOIN approval_rules arr ON arr.id = arq.rule_id
        WHERE arq.intake_id = i.id AND arr.mandatory = 1) AS approval_request_count,
      (SELECT COUNT(*) FROM approval_requests arq
        JOIN approval_rules arr ON arr.id = arq.rule_id
        WHERE arq.intake_id = i.id AND arr.mandatory = 1
          AND arq.status != 'approved') AS open_approval_count,
      COALESCE((SELECT GROUP_CONCAT(arr.name, '; ')
        FROM approval_requests arq
        JOIN approval_rules arr ON arr.id = arq.rule_id
        WHERE arq.intake_id = i.id AND arq.status != 'cancelled'),
        'No additional approval') AS required_approval
      FROM contract_intakes i
      LEFT JOIN suppliers s ON s.id = i.supplier_id`,
  order: 'i.received_at DESC, i.id',
};

export const supplierRegisterQuery = {
  select: `SELECT s.*,
      (SELECT COUNT(*) FROM contracts c WHERE c.supplier_id = s.id
        AND c.status IN ('executed','active')) AS active_contract_count,
      COALESCE((SELECT SUM(c.current_value_cents) FROM contracts c
        WHERE c.supplier_id = s.id AND c.status IN ('executed','active')), 0) AS total_contract_value_cents,
      (SELECT GROUP_CONCAT(c2.contract_number || ' — ' || c2.title, '||') FROM contracts c2 WHERE c2.supplier_id = s.id) AS linked_contracts,
      (SELECT GROUP_CONCAT(i.intake_number || ' — ' || i.title || ' [' || i.status || ']', '||') FROM contract_intakes i WHERE i.supplier_id = s.id) AS linked_intakes,
      CASE
        WHEN EXISTS (SELECT 1 FROM contracts c3 WHERE c3.supplier_id = s.id) THEN 'contracted'
        WHEN EXISTS (SELECT 1 FROM contract_intakes i2 WHERE i2.supplier_id = s.id) THEN 'pre_contract'
        ELSE 'onboarding'
      END AS relationship_stage,
      (SELECT COUNT(*) FROM documents d WHERE d.supplier_id = s.id AND d.lifecycle_stage = 'supplier_record' AND COALESCE(d.review_status, '') NOT IN ('superseded', 'not_applicable')) AS qualification_document_count,
      (SELECT MIN(d.expiration_date) FROM documents d WHERE d.supplier_id = s.id AND d.lifecycle_stage = 'supplier_record' AND COALESCE(d.review_status, '') NOT IN ('superseded', 'not_applicable') AND d.expiration_date >= date('now')) AS next_document_expiration,
      (SELECT COUNT(*) FROM documents d WHERE d.supplier_id = s.id AND d.lifecycle_stage = 'supplier_record' AND COALESCE(d.review_status, '') NOT IN ('superseded', 'not_applicable') AND d.expiration_date < date('now') AND COALESCE(d.review_status, '') != 'not_applicable') AS expired_qualification_document_count,
      (SELECT MIN(candidate.expiration_date) FROM (
        SELECT s.insurance_expiration AS expiration_date
        UNION ALL
        SELECT d.expiration_date FROM documents d WHERE d.supplier_id = s.id AND d.lifecycle_stage = 'supplier_record' AND COALESCE(d.review_status, '') NOT IN ('superseded', 'not_applicable')
      ) candidate WHERE candidate.expiration_date >= date('now')) AS next_compliance_expiration,
      CASE WHEN ${expiredCompliance} THEN 1 ELSE 0 END AS has_expired_compliance,
      (SELECT COUNT(*) FROM review_findings f
        JOIN contract_intakes i3 ON i3.id = f.intake_id
        WHERE i3.supplier_id = s.id AND f.status = 'open' AND f.severity = 'high')
        AS open_high_risk_findings,
      (SELECT COUNT(*) FROM key_dates k
        WHERE k.supplier_id = s.id AND k.status != 'completed'
          AND k.due_date < date('now')) AS overdue_obligations,
      CASE WHEN EXISTS (SELECT 1 FROM documents d WHERE d.supplier_id = s.id
        AND d.lifecycle_stage = 'supplier_record' AND COALESCE(d.review_status, '') NOT IN ('superseded', 'not_applicable') AND d.file_type = 'cybersecurity_assessment')
        THEN 1 ELSE 0 END AS has_cybersecurity_record,
      CASE WHEN EXISTS (SELECT 1 FROM documents d WHERE d.supplier_id = s.id
        AND d.lifecycle_stage = 'supplier_record' AND COALESCE(d.review_status, '') NOT IN ('superseded', 'not_applicable') AND d.file_type = 'exclusion_screening')
        THEN 1 ELSE 0 END AS has_exclusion_screening,
      CASE WHEN EXISTS (SELECT 1 FROM documents d WHERE d.supplier_id = s.id
        AND d.lifecycle_stage = 'supplier_record' AND COALESCE(d.review_status, '') NOT IN ('superseded', 'not_applicable')
        AND d.file_type IN ('business_license', 'professional_license', 'good_standing'))
        THEN 1 ELSE 0 END AS has_license_or_good_standing
      FROM suppliers s`,
  order: 's.legal_name, s.id',
};

export const keyDatesQuery = {
  select: `SELECT k.*,
      CASE WHEN k.status != 'completed' AND k.due_date < date('now')
        THEN 'overdue' ELSE k.status END AS effective_status,
      CASE WHEN k.status != 'completed' AND k.due_date < date('now')
        THEN CAST(julianday(date('now')) - julianday(k.due_date) AS INTEGER)
        ELSE 0 END AS overdue_days,
      c.contract_number, c.title AS contract_title,
      c.current_value_cents,
      c.expiration_date AS contract_expiration_date, c.status AS contract_status,
      s.legal_name AS supplier_name,
      evidence.file_name AS evidence_file_name,
      source.file_name AS source_file_name
      FROM key_dates k
      LEFT JOIN contracts c ON c.id = k.contract_id
      LEFT JOIN suppliers s ON s.id = k.supplier_id
      LEFT JOIN documents evidence ON evidence.id = k.evidence_document_id
      LEFT JOIN documents source ON source.id = k.source_document_id`,
  order: "CASE WHEN k.status = 'completed' THEN 1 ELSE 0 END, k.due_date, k.id",
};

export const supplierDocumentsQuery = {
  select: `SELECT d.id, d.supplier_id, s.vendor_number,
        s.legal_name AS supplier_name, d.file_name, d.file_type,
        d.issuer, d.document_number, d.effective_date, d.expiration_date,
        d.coverage_summary, d.review_status, d.ai_status, d.uploaded_at
      FROM documents d
      JOIN suppliers s ON s.id = d.supplier_id
      WHERE d.lifecycle_stage = 'supplier_record'`,
  order: 's.legal_name, d.file_type, d.uploaded_at DESC, d.id',
};

export const approvalQueueQuery = {
  select: `SELECT
        ar.id AS request_id, ast.id AS step_id, ar.intake_id,
        i.intake_number, i.title AS intake_title, i.proposed_supplier_name,
        i.proposed_value_cents, ar.status AS request_status,
        ast.status AS step_status, ar.reason, ar.generated_at, ar.due_at,
        ar.completed_at, r.id AS rule_id, r.rule_key, r.name AS rule_name,
        r.version AS rule_version, r.owner_role, r.mandatory,
        ast.assigned_reviewer, ast.escalation_level,
        ar.source_finding_id, ar.source_document_id,
        ast.source_page, ast.source_quote, d.file_name AS source_file_name,
        CAST(MAX(0, julianday(date('now')) - julianday(date(ar.generated_at))) AS INTEGER) AS age_days,
        CASE WHEN ar.status IN ('pending', 'in_review', 'revision_requested')
          AND ar.due_at < date('now') THEN 1 ELSE 0 END AS overdue
      FROM approval_requests ar
      JOIN approval_rules r ON r.id = ar.rule_id
      JOIN approval_steps ast ON ast.request_id = ar.id
      JOIN contract_intakes i ON i.id = ar.intake_id
      LEFT JOIN documents d ON d.id = ar.source_document_id`,
  order: `CASE WHEN ar.status IN ('pending', 'in_review', 'revision_requested') THEN 0 ELSE 1 END,
    overdue DESC, ar.due_at, r.name, ar.id, ast.id`,
};

export function normalizeSupplierRow(row: RegisterRow, asOfDate: string) {
  row.insurance_status = effectiveInsuranceStatus(
    stringValue(row.insurance_status),
    stringValue(row.insurance_expiration),
    asOfDate,
  );
  if (row.has_expired_compliance) row.qualification_status = 'expired';
}

function stringValue(value: RegisterRow[string]) {
  return typeof value === 'string' ? value : null;
}

export function buildSupplierRiskProfiles(
  suppliers: RegisterRow[],
  portfolioValueCents: number,
  asOfDate: string,
) {
  for (const row of suppliers) normalizeSupplierRow(row, asOfDate);
  return Object.fromEntries(
    suppliers.map((supplier) => [
      String(supplier.id),
      supplierRiskProfile(supplier, portfolioValueCents, asOfDate),
    ]),
  );
}

export function supplierRiskProfile(
  supplier: RegisterRow,
  portfolioValueCents: number,
  asOfDate: string,
) {
  return calculateSupplierRiskProfile({
    declaredRiskTier: stringValue(supplier.risk_tier),
    w9Status: stringValue(supplier.w9_status),
    insuranceStatus: stringValue(supplier.insurance_status),
    insuranceExpiration: stringValue(supplier.insurance_expiration),
    qualificationStatus: stringValue(supplier.qualification_status),
    qualificationDocumentCount: Number(
      supplier.qualification_document_count ?? 0,
    ),
    hasCybersecurityRecord: Boolean(supplier.has_cybersecurity_record),
    hasExclusionScreening: Boolean(supplier.has_exclusion_screening),
    hasLicenseOrGoodStanding: Boolean(supplier.has_license_or_good_standing),
    openHighRiskFindings: Number(supplier.open_high_risk_findings ?? 0),
    overdueObligations: Number(supplier.overdue_obligations ?? 0),
    activeContractValueCents: Number(supplier.total_contract_value_cents ?? 0),
    portfolioValueCents,
    asOfDate,
  });
}
