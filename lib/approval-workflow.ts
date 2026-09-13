import { playbookRule } from '@/lib/contract-playbook';

export const approvalRequestStatuses = [
  'pending',
  'in_review',
  'approved',
  'declined',
  'revision_requested',
  'cancelled',
] as const;

export const approvalActions = [
  'start_review',
  'approve',
  'decline',
  'request_revision',
  'approve_exception',
  'escalate',
  'cancel',
] as const;

export type ApprovalRequestStatus = (typeof approvalRequestStatuses)[number];
export type ApprovalAction = (typeof approvalActions)[number];

export type ApprovalTriggerType =
  | 'value_above'
  | 'governing_law_not_allowed'
  | 'automatic_renewal'
  | 'insurance_status_in'
  | 'supplier_risk_tier_in'
  | 'liability_uncapped';

export type ApprovalRuleDefinition = {
  id: string;
  ruleKey: string;
  version: number;
  name: string;
  description: string;
  triggerType: ApprovalTriggerType;
  triggerConfig: Record<string, unknown>;
  ownerRole: string;
  dueDays: number;
  mandatory: boolean;
  active: boolean;
};

export type ApprovalSourceField = {
  sourcePage: number | null;
  sourceQuote: string | null;
};

export type ApprovalFinding = {
  id: string;
  field: string;
  ruleName: string;
  sourcePage: number | null;
  observedText: string | null;
};

export type ApprovalContext = {
  proposedValueCents: number;
  governingLaw: string | null;
  renewalType: string | null;
  insuranceStatus: string | null;
  supplierRiskTier: string | null;
  /** 'capped' | 'uncapped' | null. Only an express 'uncapped' gates. */
  liabilityCap: string | null;
  findings: ApprovalFinding[];
  fieldSources: Partial<
    Record<
      'contractValue' | 'governingLaw' | 'renewalType',
      ApprovalSourceField
    >
  >;
};

export type ApprovalRequirement = {
  rule: ApprovalRuleDefinition;
  reason: string;
  sourceFindingId: string | null;
  sourcePage: number | null;
  sourceQuote: string | null;
};

export const APPROVAL_RULES_V1: readonly ApprovalRuleDefinition[] = [
  {
    id: 'approval-rule-financial-director-v1',
    ruleKey: 'financial_value_director',
    version: 1,
    name: 'Director approval from USD 50,000',
    description:
      'Proposed or executed value from USD 50,000 up to USD 500,000 requires Procurement Director approval.',
    triggerType: 'value_above',
    triggerConfig: { thresholdCents: 5_000_000, maxCents: 50_000_000 },
    ownerRole: 'Procurement Director',
    dueDays: 2,
    mandatory: true,
    active: true,
  },
  {
    id: 'approval-rule-financial-v2',
    ruleKey: 'financial_value_threshold',
    version: 2,
    name: 'Finance approval from USD 500,000',
    description:
      'Proposed or executed value from USD 500,000 up to USD 2,000,000 requires Finance/CFO approval. Version 2 adds the band ceiling so higher values route to executive approval instead.',
    triggerType: 'value_above',
    triggerConfig: { thresholdCents: 50_000_000, maxCents: 200_000_000 },
    ownerRole: 'Finance / CFO',
    dueDays: 3,
    mandatory: true,
    active: true,
  },
  {
    id: 'approval-rule-financial-executive-v1',
    ruleKey: 'financial_value_executive',
    version: 1,
    name: 'Executive approval above USD 2,000,000',
    description:
      'Proposed or executed value above USD 2,000,000 requires CEO approval.',
    triggerType: 'value_above',
    triggerConfig: { thresholdCents: 200_000_000 },
    ownerRole: 'Chief Executive Officer',
    dueDays: 5,
    mandatory: true,
    active: true,
  },
  {
    id: 'approval-rule-governing-law-v1',
    ruleKey: 'non_california_governing_law',
    version: 1,
    name: 'Non-California governing law exception',
    description:
      'A governing-law term outside California requires a Legal exception decision.',
    triggerType: 'governing_law_not_allowed',
    triggerConfig: { allowedText: 'california' },
    ownerRole: 'Legal Reviewer',
    dueDays: 4,
    mandatory: true,
    active: true,
  },
  {
    id: 'approval-rule-auto-renewal-v1',
    ruleKey: 'automatic_renewal_control',
    version: 1,
    name: 'Automatic renewal control',
    description:
      'Automatic renewal requires confirmation by the accountable contract owner.',
    triggerType: 'automatic_renewal',
    triggerConfig: {},
    ownerRole: 'Contract Owner',
    dueDays: 5,
    mandatory: true,
    active: true,
  },
  {
    id: 'approval-rule-insurance-v1',
    ruleKey: 'insurance_exception',
    version: 1,
    name: 'Missing or expired insurance',
    description:
      'Missing or expired supplier insurance requires a Procurement/Compliance decision.',
    triggerType: 'insurance_status_in',
    triggerConfig: { statuses: ['missing', 'expired'] },
    ownerRole: 'Procurement / Compliance',
    dueDays: 3,
    mandatory: true,
    active: true,
  },
  {
    id: 'approval-rule-uncapped-liability-v1',
    ruleKey: 'uncapped_liability',
    version: 1,
    name: 'Uncapped supplier liability',
    description:
      'An agreement that expressly leaves supplier liability uncapped requires a Legal exception decision.',
    triggerType: 'liability_uncapped',
    triggerConfig: {},
    ownerRole: 'Legal Reviewer',
    dueDays: 3,
    mandatory: true,
    active: true,
  },
  {
    id: 'approval-rule-high-risk-supplier-v1',
    ruleKey: 'high_risk_supplier',
    version: 1,
    name: 'High-risk supplier due diligence',
    description:
      'A high-risk supplier classification requires enhanced due-diligence approval.',
    triggerType: 'supplier_risk_tier_in',
    triggerConfig: { riskTiers: ['high'] },
    ownerRole: 'Compliance Reviewer',
    dueDays: 5,
    mandatory: true,
    active: true,
  },
] as const;

function normalized(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase();
}

function stringList(config: Record<string, unknown>, key: string) {
  const value = config[key];
  return Array.isArray(value)
    ? value.map((item) => normalized(String(item))).filter(Boolean)
    : [];
}

/**
 * The finding whose playbook rule escalates to this approval rule. Findings are
 * stored under a stable playbook key, so this is an exact lookup rather than
 * the substring match on model-generated wording it replaced.
 */
function findingForApprovalRule(
  findings: ApprovalFinding[],
  approvalRuleKey: string,
) {
  return (
    findings.find(
      (finding) =>
        playbookRule(finding.field)?.approvalRuleKey === approvalRuleKey,
    ) ?? null
  );
}

function evaluateRule(
  rule: ApprovalRuleDefinition,
  context: ApprovalContext,
): Omit<ApprovalRequirement, 'rule'> | null {
  if (!rule.active) return null;
  const emptySource = {
    sourceFindingId: null,
    sourcePage: null,
    sourceQuote: null,
  };

  switch (rule.triggerType) {
    case 'value_above': {
      const threshold = Number(rule.triggerConfig.thresholdCents ?? 0);
      if (context.proposedValueCents <= threshold) return null;
      // A delegation-of-authority band stops where the next one starts, so a
      // single value routes to one accountable owner rather than to every
      // owner whose floor it happens to clear.
      const ceiling = Number(rule.triggerConfig.maxCents ?? 0);
      if (ceiling > 0 && context.proposedValueCents > ceiling) return null;
      const finding = findingForApprovalRule(context.findings, rule.ruleKey);
      const source = context.fieldSources.contractValue;
      return {
        reason: `Verified value ${(context.proposedValueCents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })} exceeds the ${(threshold / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })} approval threshold.`,
        sourceFindingId: finding?.id ?? null,
        sourcePage: finding?.sourcePage ?? source?.sourcePage ?? null,
        sourceQuote: finding?.observedText ?? source?.sourceQuote ?? null,
      };
    }
    case 'governing_law_not_allowed': {
      const governingLaw = normalized(context.governingLaw);
      const allowedText = normalized(
        typeof rule.triggerConfig.allowedText === 'string'
          ? rule.triggerConfig.allowedText
          : 'california',
      );
      if (!governingLaw || governingLaw.includes(allowedText)) return null;
      const finding = findingForApprovalRule(context.findings, rule.ruleKey);
      const source = context.fieldSources.governingLaw;
      return {
        reason: `Verified governing law is ${context.governingLaw}; the playbook position is California.`,
        sourceFindingId: finding?.id ?? null,
        sourcePage: finding?.sourcePage ?? source?.sourcePage ?? null,
        sourceQuote:
          finding?.observedText ?? source?.sourceQuote ?? context.governingLaw,
      };
    }
    case 'automatic_renewal': {
      if (normalized(context.renewalType) !== 'automatic') return null;
      const finding = findingForApprovalRule(context.findings, rule.ruleKey);
      const source = context.fieldSources.renewalType;
      return {
        reason:
          'The verified agreement renews automatically and requires an accountable owner decision.',
        sourceFindingId: finding?.id ?? null,
        sourcePage: finding?.sourcePage ?? source?.sourcePage ?? null,
        sourceQuote: finding?.observedText ?? source?.sourceQuote ?? null,
      };
    }
    case 'insurance_status_in': {
      const statuses = stringList(rule.triggerConfig, 'statuses');
      const insuranceStatus = normalized(context.insuranceStatus);
      if (!insuranceStatus || !statuses.includes(insuranceStatus)) return null;
      return {
        reason: `Supplier insurance status is ${insuranceStatus}; a risk decision is required before progression.`,
        ...emptySource,
      };
    }
    case 'liability_uncapped': {
      // Silence in the document is not a waiver of the cap, so only an express
      // "uncapped" verified value opens this gate.
      if (normalized(context.liabilityCap) !== 'uncapped') return null;
      const finding = findingForApprovalRule(context.findings, rule.ruleKey);
      return {
        reason:
          'The verified agreement states supplier liability is not capped; Legal must accept or renegotiate the exposure.',
        sourceFindingId: finding?.id ?? null,
        sourcePage: finding?.sourcePage ?? null,
        sourceQuote: finding?.observedText ?? null,
      };
    }
    case 'supplier_risk_tier_in': {
      const riskTiers = stringList(rule.triggerConfig, 'riskTiers');
      const riskTier = normalized(context.supplierRiskTier);
      if (!riskTier || !riskTiers.includes(riskTier)) return null;
      return {
        reason: `Supplier risk tier is ${riskTier}; enhanced due diligence is required.`,
        ...emptySource,
      };
    }
  }
}

export function generateApprovalRequirements(
  context: ApprovalContext,
  rules: readonly ApprovalRuleDefinition[],
) {
  return [...rules]
    .sort(
      (left, right) =>
        left.ruleKey.localeCompare(right.ruleKey) ||
        left.version - right.version,
    )
    .flatMap((rule) => {
      const result = evaluateRule(rule, context);
      return result ? [{ rule, ...result }] : [];
    });
}

export function addApprovalDueDays(dateValue: string, days: number) {
  const date = new Date(`${dateValue.slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) throw new Error('Invalid approval date.');
  date.setUTCDate(date.getUTCDate() + Math.max(0, Math.round(days)));
  return date.toISOString().slice(0, 10);
}

export function approvalActionRequiresReason(action: ApprovalAction) {
  return [
    'decline',
    'request_revision',
    'approve_exception',
    'escalate',
    'cancel',
  ].includes(action);
}

export function nextApprovalStatus(
  current: ApprovalRequestStatus,
  action: ApprovalAction,
): ApprovalRequestStatus {
  if (['approved', 'declined', 'cancelled'].includes(current)) {
    throw new Error(`A ${current} approval step is immutable.`);
  }
  if (action === 'start_review' || action === 'escalate') return 'in_review';
  if (action === 'approve' || action === 'approve_exception') return 'approved';
  if (action === 'decline') return 'declined';
  if (action === 'request_revision') return 'revision_requested';
  if (action === 'cancel') return 'cancelled';
  throw new Error('Unsupported approval action.');
}

export function deriveApprovalRequestStatus(
  stepStatuses: readonly ApprovalRequestStatus[],
): ApprovalRequestStatus {
  if (!stepStatuses.length) return 'pending';
  if (stepStatuses.includes('declined')) return 'declined';
  if (stepStatuses.includes('revision_requested')) return 'revision_requested';
  if (stepStatuses.every((status) => status === 'approved')) return 'approved';
  if (stepStatuses.some((status) => status === 'in_review')) return 'in_review';
  if (stepStatuses.every((status) => status === 'cancelled'))
    return 'cancelled';
  return 'pending';
}

export function approvalGate(
  requests: readonly { mandatory: boolean; status: ApprovalRequestStatus }[],
) {
  const blocking = requests.filter(
    (request) => request.mandatory && request.status !== 'approved',
  );
  return { allowed: blocking.length === 0, blockingCount: blocking.length };
}
