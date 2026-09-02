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
          proposedValueCents: 50_000_000,
          governingLaw: 'State of California',
          renewalType: 'none',
          insuranceStatus: 'current',
          supplierRiskTier: 'low',
        },
        APPROVAL_RULES_V1,
      ),
    ).toEqual([]);
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
