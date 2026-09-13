/**
 * The fictional company playbook that New Contract Review checks drafts against.
 *
 * This used to live as free text inside the analysis prompt, which meant a
 * finding's identity was a slug of whatever sentence the model echoed back
 * (`contract_values_above_usd_500_000_require_cfo_approval_`). Nothing could
 * join a finding to the approval rule it escalates to, so most approval
 * requests were stored with no source finding at all.
 *
 * Holding the playbook as data gives every rule a stable key that the model is
 * asked to return, that findings are stored under, and that approval rules
 * reference. The standard text is authoritative here rather than paraphrased by
 * the model.
 */

export type PlaybookCategory = 'commercial' | 'legal' | 'risk' | 'operational';

export type PlaybookRule = {
  key: string;
  title: string;
  /** The company position, stated once and reused wherever it is displayed. */
  standard: string;
  category: PlaybookCategory;
  /**
   * The approval rule this deviation escalates to, or null when the finding is
   * advisory only. Most playbook positions are negotiation guidance, not gates.
   */
  approvalRuleKey: string | null;
};

export const CONTRACT_PLAYBOOK: readonly PlaybookRule[] = [
  {
    key: 'payment_terms',
    title: 'Payment terms',
    standard: 'Preferred payment terms are Net 30.',
    category: 'commercial',
    approvalRuleKey: null,
  },
  {
    key: 'contract_value_threshold',
    title: 'Contract value threshold',
    standard: 'Contract values above USD 500,000 require CFO approval.',
    category: 'commercial',
    approvalRuleKey: 'financial_value_threshold',
  },
  {
    key: 'governing_law',
    title: 'Governing law',
    standard: 'Preferred governing law is California.',
    category: 'legal',
    approvalRuleKey: 'non_california_governing_law',
  },
  {
    key: 'automatic_renewal',
    title: 'Automatic renewal',
    standard: 'Automatic renewal requires human review.',
    category: 'commercial',
    approvalRuleKey: 'automatic_renewal_control',
  },
  {
    key: 'termination_for_convenience',
    title: 'Termination for convenience',
    standard:
      'Northstar should have a 30-day termination-for-convenience right without an early termination fee.',
    category: 'commercial',
    approvalRuleKey: null,
  },
  {
    key: 'liability_cap',
    title: 'Limitation of liability',
    standard:
      'Supplier liability should be capped at total fees, with carveouts for confidentiality, data security, indemnification, infringement, fraud, gross negligence, and willful misconduct.',
    category: 'legal',
    approvalRuleKey: 'uncapped_liability',
  },
  {
    key: 'deliverable_ownership',
    title: 'Deliverable ownership',
    standard:
      'Project-specific deliverables should be owned by Northstar, with a sufficient license to embedded supplier materials.',
    category: 'legal',
    approvalRuleKey: null,
  },
  {
    key: 'insurance_cgl',
    title: 'Commercial general liability',
    standard:
      'Service contracts require commercial general liability of USD 2M per occurrence.',
    category: 'risk',
    approvalRuleKey: null,
  },
  {
    key: 'insurance_professional_liability',
    title: 'Professional liability',
    standard: 'Service contracts require professional liability of USD 2M.',
    category: 'risk',
    approvalRuleKey: null,
  },
  {
    key: 'insurance_cyber',
    title: 'Cyber liability',
    standard:
      'Service contracts require cyber liability of USD 1M when company data is accessed.',
    category: 'risk',
    approvalRuleKey: null,
  },
  {
    key: 'insurance_certificate',
    title: 'Certificate of insurance',
    standard:
      'A current certificate of insurance must be provided before work begins.',
    category: 'risk',
    approvalRuleKey: null,
  },
  {
    key: 'indemnification',
    title: 'Indemnification',
    standard:
      'Supplier should indemnify Northstar for third-party claims arising from supplier negligence, willful misconduct, and intellectual-property infringement. Northstar does not give a broad reciprocal indemnity.',
    category: 'legal',
    approvalRuleKey: null,
  },
  {
    key: 'confidentiality',
    title: 'Confidentiality',
    standard:
      'Confidentiality obligations should survive at least three years after termination, and confidential material must be returned or destroyed on request.',
    category: 'legal',
    approvalRuleKey: null,
  },
  {
    key: 'data_protection',
    title: 'Data protection',
    standard:
      'A supplier that processes personal data on Northstar behalf requires a signed data processing agreement, named subprocessors, and written approval before any subprocessor change.',
    category: 'risk',
    approvalRuleKey: null,
  },
  {
    key: 'assignment_change_of_control',
    title: 'Assignment and change of control',
    standard:
      'Supplier may not assign the agreement, including by change of control, without prior written consent from Northstar.',
    category: 'legal',
    approvalRuleKey: null,
  },
  {
    key: 'insurance_workers_comp',
    title: "Workers' compensation",
    standard:
      "Suppliers performing on-site work require workers' compensation at statutory limits and employer's liability of USD 1M.",
    category: 'risk',
    approvalRuleKey: null,
  },
  {
    key: 'security_incident_notice',
    title: 'Security incident notification',
    standard: 'Confirmed security incidents must be reported within 72 hours.',
    category: 'risk',
    approvalRuleKey: null,
  },
  {
    key: 'subcontractor_consent',
    title: 'Subcontractor consent',
    standard:
      'Subcontractors accessing a site, system, or company information require prior written consent.',
    category: 'operational',
    approvalRuleKey: null,
  },
  {
    key: 'change_order_control',
    title: 'Change order control',
    standard:
      'Changes affecting scope, fees, or schedule require a signed change order; project-manager email alone is insufficient.',
    category: 'operational',
    approvalRuleKey: null,
  },
  {
    key: 'records_retention',
    title: 'Records retention',
    standard:
      'Invoice and compliance records should be retained for four years after final payment.',
    category: 'operational',
    approvalRuleKey: null,
  },
] as const;

/** Bumped when a rule is added, removed, or its standard text changes. */
export const PLAYBOOK_VERSION = '2026.1';

const rulesByKey = new Map(CONTRACT_PLAYBOOK.map((rule) => [rule.key, rule]));

export function playbookRule(key: unknown): PlaybookRule | null {
  return typeof key === 'string' ? (rulesByKey.get(key.trim()) ?? null) : null;
}

/**
 * Accepts the key the model returned. Anything unrecognised resolves to null so
 * the caller can fall back to the model's own wording rather than inventing a
 * playbook position that does not exist.
 */
export function resolvePlaybookKey(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const candidate = value.trim().toLowerCase();
  return rulesByKey.has(candidate) ? candidate : null;
}

/** The playbook rule whose deviation escalates to a given approval rule. */
export function playbookRuleForApproval(
  approvalRuleKey: string,
): PlaybookRule | null {
  return (
    CONTRACT_PLAYBOOK.find(
      (rule) => rule.approvalRuleKey === approvalRuleKey,
    ) ?? null
  );
}

/** The playbook section of the analysis prompt, rendered from the same data. */
export function playbookPromptSection() {
  return CONTRACT_PLAYBOOK.map(
    (rule) => `- ${rule.key}: ${rule.standard}`,
  ).join('\n');
}
