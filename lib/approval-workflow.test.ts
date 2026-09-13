import { describe, expect, it } from 'vitest';

import {
  APPROVAL_RULES_V1,
  addApprovalDueDays,
  approvalActionRequiresReason,
  approvalGate,
  deriveApprovalRequestStatus,
  generateApprovalRequirements,
  nextApprovalStatus,
  type ApprovalContext,
} from '@/lib/approval-workflow';

const context: ApprovalContext = {
  proposedValueCents: 58_500_000,
  governingLaw: 'New York',
  renewalType: 'automatic',
  insuranceStatus: 'missing',
  supplierRiskTier: 'high',
  liabilityCap: null,
  findings: [
    {
      id: 'finding-law',
      field: 'governing_law',
      ruleName: 'Governing law',
      sourcePage: 9,
      observedText: 'New York',
    },
  ],
  fieldSources: {
    contractValue: { sourcePage: 3, sourceQuote: '$585,000' },
    governingLaw: { sourcePage: 9, sourceQuote: 'State of New York' },
    renewalType: { sourcePage: 7, sourceQuote: 'automatically renew' },
  },
};

describe('finding to approval linkage', () => {
  const withFindings: ApprovalContext = {
    ...context,
    findings: [
      {
        id: 'finding-law',
        field: 'governing_law',
        ruleName: 'Governing law',
        sourcePage: 9,
        observedText: 'New York',
      },
      {
        id: 'finding-value',
        field: 'contract_value_threshold',
        ruleName: 'Contract value threshold',
        sourcePage: 3,
        observedText: 'Proposed Value USD 585,000',
      },
      {
        id: 'finding-renewal',
        field: 'automatic_renewal',
        ruleName: 'Automatic renewal',
        sourcePage: 7,
        observedText: 'renews automatically for successive terms',
      },
    ],
  };

  it('traces every escalating rule back to the finding that caused it', () => {
    const sources = Object.fromEntries(
      generateApprovalRequirements(withFindings, APPROVAL_RULES_V1).map(
        (item) => [item.rule.ruleKey, item.sourceFindingId],
      ),
    );
    expect(sources.financial_value_threshold).toBe('finding-value');
    expect(sources.non_california_governing_law).toBe('finding-law');
    expect(sources.automatic_renewal_control).toBe('finding-renewal');
  });

  it('leaves operational rules without a playbook source', () => {
    const sources = Object.fromEntries(
      generateApprovalRequirements(withFindings, APPROVAL_RULES_V1).map(
        (item) => [item.rule.ruleKey, item.sourceFindingId],
      ),
    );
    // Supplier risk and insurance status are register facts, not clause
    // deviations, so no finding can be their source.
    expect(sources.high_risk_supplier).toBeNull();
    expect(sources.insurance_exception).toBeNull();
  });

  it('does not invent a source when the model placed no playbook key', () => {
    const unresolved: ApprovalContext = {
      ...context,
      findings: [
        {
          id: 'finding-unknown',
          field: 'contract_values_above_usd_500_000_require_cfo_approval_',
          ruleName: 'Contract values above USD 500,000 require CFO approval.',
          sourcePage: 3,
          observedText: 'Proposed Value USD 585,000',
        },
      ],
    };
    const financial = generateApprovalRequirements(
      unresolved,
      APPROVAL_RULES_V1,
    ).find((item) => item.rule.ruleKey === 'financial_value_threshold');
    expect(financial?.sourceFindingId).toBeNull();
    // The verified field still carries the evidence.
    expect(financial?.sourcePage).toBe(3);
  });
});

describe('approval rule evaluation', () => {
  it('generates every applicable requirement deterministically', () => {
    const first = generateApprovalRequirements(context, APPROVAL_RULES_V1);
    const second = generateApprovalRequirements(
      context,
      [...APPROVAL_RULES_V1].reverse(),
    );

    expect(first).toEqual(second);
    expect(first.map((item) => item.rule.ruleKey)).toEqual([
      'automatic_renewal_control',
      'financial_value_threshold',
      'high_risk_supplier',
      'insurance_exception',
      'non_california_governing_law',
    ]);
    expect(
      first.find(
        (item) => item.rule.ruleKey === 'non_california_governing_law',
      ),
    ).toMatchObject({ sourceFindingId: 'finding-law', sourcePage: 9 });
  });

  it('does not generate requirements for compliant verified values', () => {
    expect(
      generateApprovalRequirements(
        {
          ...context,
          // Below the lowest delegation-of-authority band.
          proposedValueCents: 4_000_000,
          governingLaw: 'State of California',
          renewalType: 'none',
          insuranceStatus: 'current',
          supplierRiskTier: 'low',
        },
        APPROVAL_RULES_V1,
      ),
    ).toEqual([]);
  });

  describe('delegation-of-authority bands', () => {
    const compliant = {
      ...context,
      governingLaw: 'State of California',
      renewalType: 'none',
      insuranceStatus: 'current',
      supplierRiskTier: 'low',
    };
    const financialOwners = (proposedValueCents: number) =>
      generateApprovalRequirements(
        { ...compliant, proposedValueCents },
        APPROVAL_RULES_V1,
      ).map((item) => item.rule.ownerRole);

    it('routes a value to one owner instead of every band beneath it', () => {
      expect(financialOwners(20_000_000)).toEqual(['Procurement Director']);
      expect(financialOwners(58_500_000)).toEqual(['Finance / CFO']);
      expect(financialOwners(500_000_000)).toEqual(['Chief Executive Officer']);
    });

    it('places a band boundary in the lower band', () => {
      // USD 500,000 exactly is the Director ceiling, not the Finance floor.
      expect(financialOwners(50_000_000)).toEqual(['Procurement Director']);
      expect(financialOwners(50_000_001)).toEqual(['Finance / CFO']);
    });

    it('leaves values below the lowest floor unrouted', () => {
      expect(financialOwners(5_000_000)).toEqual([]);
    });
  });

  describe('uncapped liability gate', () => {
    const owners = (liabilityCap: string | null) =>
      generateApprovalRequirements(
        { ...context, liabilityCap },
        APPROVAL_RULES_V1,
      )
        .filter((item) => item.rule.ruleKey === 'uncapped_liability')
        .map((item) => item.rule.ownerRole);

    it('gates only an expressly uncapped agreement', () => {
      expect(owners('uncapped')).toEqual(['Legal Reviewer']);
    });

    it('treats silence as no gate rather than as unlimited exposure', () => {
      expect(owners(null)).toEqual([]);
      expect(owners('')).toEqual([]);
      expect(owners('capped')).toEqual([]);
    });

    it('links the gate to the limitation-of-liability finding', () => {
      const requirement = generateApprovalRequirements(
        {
          ...context,
          liabilityCap: 'uncapped',
          findings: [
            {
              id: 'finding-liability',
              field: 'liability_cap',
              ruleName: 'Limitation of liability',
              sourcePage: 12,
              observedText: 'Supplier liability shall not be limited.',
            },
          ],
        },
        APPROVAL_RULES_V1,
      ).find((item) => item.rule.ruleKey === 'uncapped_liability');
      expect(requirement).toMatchObject({
        sourceFindingId: 'finding-liability',
        sourcePage: 12,
      });
    });
  });

  it('ignores inactive rule versions', () => {
    expect(
      generateApprovalRequirements(context, [
        { ...APPROVAL_RULES_V1[0], active: false },
      ]),
    ).toEqual([]);
  });
});

describe('approval state machine and execution gate', () => {
  it('supports review, decision, revision, exception, escalation, and cancel actions', () => {
    expect(nextApprovalStatus('pending', 'start_review')).toBe('in_review');
    expect(nextApprovalStatus('in_review', 'approve')).toBe('approved');
    expect(nextApprovalStatus('pending', 'decline')).toBe('declined');
    expect(nextApprovalStatus('in_review', 'request_revision')).toBe(
      'revision_requested',
    );
    expect(nextApprovalStatus('pending', 'approve_exception')).toBe('approved');
    expect(nextApprovalStatus('pending', 'escalate')).toBe('in_review');
    expect(nextApprovalStatus('revision_requested', 'cancel')).toBe(
      'cancelled',
    );
  });

  it('prevents mutation of terminal decisions', () => {
    expect(() => nextApprovalStatus('approved', 'decline')).toThrow(
      'immutable',
    );
    expect(() => nextApprovalStatus('declined', 'approve')).toThrow(
      'immutable',
    );
  });

  it('requires reasons for exception and adverse workflow actions', () => {
    expect(approvalActionRequiresReason('approve_exception')).toBe(true);
    expect(approvalActionRequiresReason('decline')).toBe(true);
    expect(approvalActionRequiresReason('escalate')).toBe(true);
    expect(approvalActionRequiresReason('approve')).toBe(false);
  });

  it('derives a request status from all normalized steps', () => {
    expect(deriveApprovalRequestStatus(['approved', 'approved'])).toBe(
      'approved',
    );
    expect(deriveApprovalRequestStatus(['approved', 'in_review'])).toBe(
      'in_review',
    );
    expect(deriveApprovalRequestStatus(['approved', 'declined'])).toBe(
      'declined',
    );
    expect(deriveApprovalRequestStatus(['pending', 'revision_requested'])).toBe(
      'revision_requested',
    );
  });

  it('blocks execution until every mandatory request is approved', () => {
    expect(
      approvalGate([
        { mandatory: true, status: 'approved' },
        { mandatory: true, status: 'pending' },
        { mandatory: false, status: 'declined' },
      ]),
    ).toEqual({ allowed: false, blockingCount: 1 });
    expect(
      approvalGate([
        { mandatory: true, status: 'approved' },
        { mandatory: false, status: 'pending' },
      ]),
    ).toEqual({ allowed: true, blockingCount: 0 });
  });

  it('calculates stable calendar due dates', () => {
    expect(addApprovalDueDays('2026-09-01', 4)).toBe('2026-09-05');
  });
});
