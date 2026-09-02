export const SUPPLIER_RISK_PROFILE_VERSION = 'supplier-risk-2026.1' as const;

export type SupplierRiskLevel = 'low' | 'medium' | 'high';

export type SupplierRiskFactor = {
  key: string;
  label: string;
  status: 'satisfied' | 'attention' | 'high_risk' | 'informational';
  points: number;
  explanation: string;
  evidence: string;
};

export type SupplierRiskInput = {
  declaredRiskTier: string | null;
  w9Status: string | null;
  insuranceStatus: string | null;
  insuranceExpiration: string | null;
  qualificationStatus: string | null;
  qualificationDocumentCount: number;
  hasCybersecurityRecord: boolean;
  hasExclusionScreening: boolean;
  hasLicenseOrGoodStanding: boolean;
  openHighRiskFindings: number;
  overdueObligations: number;
  activeContractValueCents: number;
  portfolioValueCents: number;
  asOfDate: string;
};

export type SupplierRiskProfile = {
  version: typeof SUPPLIER_RISK_PROFILE_VERSION;
  level: SupplierRiskLevel;
  score: number;
  asOfDate: string;
  summary: string;
  factors: SupplierRiskFactor[];
};

function daysUntil(dateValue: string | null, asOfDate: string) {
  if (!dateValue) return null;
  const target = Date.parse(`${dateValue}T12:00:00Z`);
  const asOf = Date.parse(`${asOfDate}T12:00:00Z`);
  if (!Number.isFinite(target) || !Number.isFinite(asOf)) return null;
  return Math.round((target - asOf) / 86_400_000);
}

function percentage(numerator: number, denominator: number) {
  if (denominator <= 0) return 0;
  return Math.round((1000 * numerator) / denominator) / 10;
}

export function calculateSupplierRiskProfile(
  input: SupplierRiskInput,
): SupplierRiskProfile {
  const factors: SupplierRiskFactor[] = [];
  const add = (factor: SupplierRiskFactor) => factors.push(factor);

  const declaredRiskTier = input.declaredRiskTier ?? 'not_recorded';
  const declaredRiskPoints =
    declaredRiskTier === 'high' ? 40 : declaredRiskTier === 'medium' ? 10 : 0;
  add({
    key: 'approved_classification',
    label: 'Approved supplier classification',
    status:
      declaredRiskTier === 'high'
        ? 'high_risk'
        : declaredRiskTier === 'medium'
          ? 'attention'
          : declaredRiskTier === 'low'
            ? 'satisfied'
            : 'informational',
    points: declaredRiskPoints,
    explanation:
      declaredRiskTier === 'not_recorded'
        ? 'No human-approved supplier classification is recorded.'
        : `The supplier master records a ${declaredRiskTier}-risk classification.`,
    evidence: `Human-reviewed supplier register tier: ${declaredRiskTier}`,
  });

  const w9Status = input.w9Status ?? 'missing';
  add(
    w9Status === 'received' || w9Status === 'not_required'
      ? {
          key: 'w9',
          label: 'Tax documentation',
          status: 'satisfied',
          points: 0,
          explanation: 'W-9 control is satisfied.',
          evidence: `Supplier register status: ${w9Status}`,
        }
      : {
          key: 'w9',
          label: 'Tax documentation',
          status: w9Status === 'expired' ? 'high_risk' : 'attention',
          points: w9Status === 'expired' ? 20 : 15,
          explanation: `W-9 is ${w9Status}; obtain and verify current tax documentation.`,
          evidence: `Supplier register status: ${w9Status}`,
        },
  );

  const insuranceStatus = input.insuranceStatus ?? 'missing';
  const insuranceDays = daysUntil(input.insuranceExpiration, input.asOfDate);
  if (
    insuranceStatus === 'expired' ||
    (insuranceDays !== null && insuranceDays < 0)
  ) {
    add({
      key: 'insurance',
      label: 'Insurance coverage',
      status: 'high_risk',
      points: 30,
      explanation:
        'Insurance evidence is expired and requires immediate follow-up.',
      evidence: `Status ${insuranceStatus}; expiration ${input.insuranceExpiration ?? 'not recorded'}`,
    });
  } else if (insuranceStatus === 'missing') {
    add({
      key: 'insurance',
      label: 'Insurance coverage',
      status: 'high_risk',
      points: 25,
      explanation: 'Required insurance evidence is not on file.',
      evidence: 'Supplier register status: missing',
    });
  } else if (insuranceDays !== null && insuranceDays <= 60) {
    add({
      key: 'insurance',
      label: 'Insurance coverage',
      status: 'attention',
      points: 10,
      explanation: `Insurance expires in ${insuranceDays} day${insuranceDays === 1 ? '' : 's'}.`,
      evidence: `Expiration ${input.insuranceExpiration}`,
    });
  } else {
    add({
      key: 'insurance',
      label: 'Insurance coverage',
      status: 'satisfied',
      points: 0,
      explanation: 'Insurance control is current or not required.',
      evidence: `Status ${insuranceStatus}; expiration ${input.insuranceExpiration ?? 'not applicable'}`,
    });
  }

  const qualificationStatus = input.qualificationStatus ?? 'incomplete';
  const qualificationSatisfied = qualificationStatus === 'complete';
  add({
    key: 'qualification',
    label: 'Qualification package',
    status: qualificationSatisfied ? 'satisfied' : 'attention',
    points: qualificationSatisfied ? 0 : 15,
    explanation: qualificationSatisfied
      ? 'Qualification review is complete.'
      : `Qualification status is ${qualificationStatus.replaceAll('_', ' ')}.`,
    evidence: `${input.qualificationDocumentCount} supplier document${input.qualificationDocumentCount === 1 ? '' : 's'} on file`,
  });

  const screeningCount =
    Number(input.hasCybersecurityRecord) +
    Number(input.hasExclusionScreening) +
    Number(input.hasLicenseOrGoodStanding);
  add({
    key: 'screening',
    label: 'License and screening evidence',
    status: screeningCount >= 2 ? 'satisfied' : 'informational',
    points: 0,
    explanation:
      screeningCount >= 2
        ? 'Multiple visible screening or standing records are retained.'
        : 'Limited screening evidence is on file; requirements remain category-specific.',
    evidence: `Cybersecurity ${input.hasCybersecurityRecord ? 'on file' : 'not recorded'}; exclusion screening ${input.hasExclusionScreening ? 'on file' : 'not recorded'}; license/good standing ${input.hasLicenseOrGoodStanding ? 'on file' : 'not recorded'}`,
  });

  const findingPoints = Math.min(30, input.openHighRiskFindings * 15);
  add({
    key: 'findings',
    label: 'Open high-risk findings',
    status: input.openHighRiskFindings ? 'high_risk' : 'satisfied',
    points: findingPoints,
    explanation: input.openHighRiskFindings
      ? `${input.openHighRiskFindings} open high-risk finding${input.openHighRiskFindings === 1 ? '' : 's'} require a controlled decision.`
      : 'No linked open high-risk findings were found.',
    evidence: `${input.openHighRiskFindings} linked finding${input.openHighRiskFindings === 1 ? '' : 's'}`,
  });

  const concentration = percentage(
    input.activeContractValueCents,
    input.portfolioValueCents,
  );
  const concentrationPoints =
    concentration >= 25 ? 15 : concentration >= 15 ? 8 : 0;
  add({
    key: 'concentration',
    label: 'Contract concentration',
    status:
      concentrationPoints >= 15
        ? 'attention'
        : concentrationPoints
          ? 'informational'
          : 'satisfied',
    points: concentrationPoints,
    explanation: `${concentration}% of current active contract value is assigned to this supplier.`,
    evidence: `${input.activeContractValueCents} of ${input.portfolioValueCents} cents`,
  });

  const obligationPoints = Math.min(20, input.overdueObligations * 10);
  add({
    key: 'obligations',
    label: 'Overdue supplier obligations',
    status: input.overdueObligations ? 'high_risk' : 'satisfied',
    points: obligationPoints,
    explanation: input.overdueObligations
      ? `${input.overdueObligations} supplier-linked obligation${input.overdueObligations === 1 ? '' : 's'} are overdue.`
      : 'No supplier-linked obligations are overdue.',
    evidence: `${input.overdueObligations} overdue obligation${input.overdueObligations === 1 ? '' : 's'}`,
  });

  const score = factors.reduce((sum, factor) => sum + factor.points, 0);
  const level: SupplierRiskLevel =
    score >= 40 ? 'high' : score >= 20 ? 'medium' : 'low';
  const attentionCount = factors.filter((factor) => factor.points > 0).length;
  return {
    version: SUPPLIER_RISK_PROFILE_VERSION,
    level,
    score,
    asOfDate: input.asOfDate,
    summary: attentionCount
      ? `${attentionCount} visible factor${attentionCount === 1 ? '' : 's'} ${attentionCount === 1 ? 'contributes' : 'contribute'} to this ${level}-risk profile.`
      : 'No scored risk factors are currently open.',
    factors,
  };
}
