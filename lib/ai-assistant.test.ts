import { describe, expect, it } from 'vitest';

import {
  executeAssistantQuery,
  type AssistantQueryPlan,
} from '@/lib/ai-assistant';
import type { Workspace } from '@/lib/contract-ledger-types';

const workspace: Workspace = {
  metrics: {
    active_contracts: 2,
    current_value_cents: 45_000_000,
    active_suppliers: 2,
    pending_suppliers: 0,
    records_to_verify: 0,
  },
  contracts: [
    {
      id: 'con-1',
      contract_number: 'CT-001',
      title: 'Engineering support',
      supplier_name: 'Westline Engineering LLC',
      contract_type: 'Professional Services Agreement',
      department: 'Engineering',
      owner: 'Selina Armstrong',
      status: 'active',
      current_value_cents: 25_000_000,
      effective_date: '2026-01-01',
      expiration_date: '2026-12-15',
      renewal_type: 'automatic',
      notice_deadline: '2026-10-16',
      payment_terms: 'Net 30',
      governing_law: 'California',
    },
    {
      id: 'con-2',
      contract_number: 'CT-002',
      title: 'Office supplies',
      supplier_name: 'Apex Supply LLC',
      contract_type: 'Supply Agreement',
      department: 'Procurement',
      owner: 'Selina Armstrong',
      status: 'active',
      current_value_cents: 20_000_000,
      effective_date: '2026-03-01',
      expiration_date: '2027-02-28',
      renewal_type: 'none',
      notice_deadline: null,
      payment_terms: 'Net 45',
      governing_law: 'California',
    },
  ],
  suppliers: [
    {
      id: 'sup-1',
      legal_name: 'Westline Engineering LLC',
      vendor_number: 'VND-1',
      category: 'Engineering',
      status: 'active',
      state: 'CA',
      risk_tier: 'high',
      qualification_status: 'under_review',
      w9_status: 'received',
      insurance_status: 'current',
      insurance_expiration: '2026-10-15',
      relationship_stage: 'contracted',
      total_contract_value_cents: 25_000_000,
      linked_contracts: 1,
      linked_intakes: 1,
    },
    {
      id: 'sup-2',
      legal_name: 'Apex Supply LLC',
      vendor_number: 'VND-2',
      category: 'Supplies',
      status: 'active',
      state: 'NV',
      risk_tier: 'low',
      qualification_status: 'complete',
      w9_status: 'missing',
      insurance_status: 'missing',
      insurance_expiration: null,
      relationship_stage: 'contracted',
      total_contract_value_cents: 20_000_000,
      linked_contracts: 1,
      linked_intakes: 0,
    },
  ],
  intakes: [],
  keyDates: [
    {
      id: 'date-1',
      contract_id: 'con-1',
      supplier_id: 'sup-1',
      type: 'non_renewal_notice',
      title: 'Non-renewal deadline',
      due_date: '2026-10-16',
      status: 'upcoming',
      owner: 'Selina Armstrong',
      contract_number: 'CT-001',
      supplier_name: 'Westline Engineering LLC',
      current_value_cents: 25_000_000,
    },
  ],
  obligationMetrics: {
    open_obligations: 1,
    overdue_obligations: 0,
    average_overdue_age_days: 0,
    on_time_completion_rate: 0,
    completed_with_evidence_rate: 0,
    median_assignment_hours: 0,
    median_completion_hours: 0,
  },
  supplierAlerts: [],
  supplierDocuments: [],
  transactionComparisons: [],
  evaluationRuns: [],
  approvalMetrics: {
    open_requests: 1,
    overdue_requests: 1,
    blocked_intakes: 1,
    average_turnaround_hours: 0,
    exception_approval_rate: 0,
  },
  approvalQueue: [
    {
      request_id: 'approval-1',
      step_id: 'approval-step-1',
      intake_id: 'intake-1',
      intake_number: 'INT-001',
      intake_title: 'Engineering support review',
      proposed_supplier_name: 'Westline Engineering LLC',
      proposed_value_cents: 58_500_000,
      request_status: 'pending',
      step_status: 'pending',
      reason: 'Value exceeds the financial approval threshold.',
      generated_at: '2026-08-20T00:00:00.000Z',
      due_at: '2026-08-23',
      completed_at: null,
      rule_id: 'rule-1',
      rule_key: 'financial_value_threshold',
      rule_name: 'Financial approval above USD 500,000',
      rule_version: 1,
      owner_role: 'Finance / CFO',
      mandatory: 1,
      assigned_reviewer: null,
      escalation_level: 0,
      source_finding_id: null,
      source_document_id: 'document-1',
      source_page: 3,
      source_quote: '$585,000',
      source_file_name: 'draft.pdf',
      age_days: 11,
      overdue: 1,
    },
  ],
};

function plan(overrides: Partial<AssistantQueryPlan>): AssistantQueryPlan {
  return {
    entity: 'contracts',
    intent: 'list',
    filters: [],
    filterLogic: 'all',
    sort: null,
    limit: 20,
    interpretation: 'Test query',
    ...overrides,
  };
}

describe('AI assistant deterministic query execution', () => {
  it('combines amount and date filters and calculates the matched value', () => {
    const result = executeAssistantQuery(
      workspace,
      plan({
        filters: [
          {
            field: 'current_value_cents',
            operator: 'greater_than',
            value: 10_000_000,
            label: 'Value above $100,000',
          },
          {
            field: 'expiration_date',
            operator: 'before',
            value: '2027-01-01',
            label: 'Expires before 2027',
          },
        ],
      }),
      '2026-08-31',
    );

    expect(result.matchedCount).toBe(1);
    expect(result.totalValueCents).toBe(25_000_000);
    expect(result.records[0]).toMatchObject({
      id: 'con-1',
      openTarget: { type: 'contract', id: 'con-1' },
    });
  });

  it('normalizes natural-language active-status synonyms', () => {
    const result = executeAssistantQuery(
      workspace,
      plan({
        filters: [
          {
            field: 'status',
            operator: 'equals',
            value: 'effective',
            label: 'Effective contracts',
          },
        ],
      }),
    );

    expect(result.matchedCount).toBe(2);
  });

  it('supports explicit OR searches for missing supplier records', () => {
    const result = executeAssistantQuery(
      workspace,
      plan({
        entity: 'suppliers',
        filterLogic: 'any',
        filters: [
          {
            field: 'w9_status',
            operator: 'equals',
            value: 'missing',
            label: 'W-9 missing',
          },
          {
            field: 'insurance_status',
            operator: 'equals',
            value: 'missing',
            label: 'Insurance missing',
          },
        ],
      }),
    );

    expect(result.records.map((record) => record.id)).toEqual(['sup-2']);
  });

  it('includes upcoming obligations but excludes overdue dates', () => {
    const result = executeAssistantQuery(
      workspace,
      plan({
        entity: 'obligations',
        filters: [
          {
            field: 'due_date',
            operator: 'within_next_days',
            value: 60,
            label: 'Due in the next 60 days',
          },
        ],
      }),
      '2026-08-31',
    );

    expect(result.matchedCount).toBe(1);
    expect(result.records[0].openTarget).toEqual({
      type: 'contract',
      id: 'con-1',
    });
  });

  it('does not count the same supplier insurance expiration twice', () => {
    const duplicateWorkspace: Workspace = {
      ...workspace,
      keyDates: [
        {
          id: 'insurance-date',
          contract_id: null,
          supplier_id: 'sup-1',
          type: 'insurance_expiration',
          title: 'Certificate of Insurance expires',
          due_date: '2026-10-15',
          status: 'upcoming',
          owner: 'Selina Armstrong',
          contract_number: null,
          supplier_name: 'Westline Engineering LLC',
        },
      ],
      supplierAlerts: [
        {
          alert_id: 'insurance:sup-1',
          supplier_id: 'sup-1',
          supplier_name: 'Westline Engineering LLC',
          item_type: 'insurance_certificate',
          title: 'Insurance certificate (register record)',
          due_date: '2026-10-15',
          review_status: 'current',
        },
      ],
    };
    const result = executeAssistantQuery(
      duplicateWorkspace,
      plan({ entity: 'obligations' }),
      '2026-08-31',
    );

    expect(result.matchedCount).toBe(1);
    expect(result.records[0].title).toBe('Certificate of Insurance expires');
  });

  it('queries the deterministic approval aging queue', () => {
    const result = executeAssistantQuery(
      workspace,
      plan({
        entity: 'approvals',
        filters: [
          {
            field: 'overdue',
            operator: 'equals',
            value: 1,
            label: 'Overdue approvals',
          },
        ],
      }),
    );

    expect(result.matchedCount).toBe(1);
    expect(result.records[0]).toMatchObject({
      id: 'approval-1',
      openTarget: { type: 'intake', id: 'intake-1' },
    });
  });

  it('rejects model-proposed fields outside the allowlist', () => {
    expect(() =>
      executeAssistantQuery(
        workspace,
        plan({
          filters: [
            {
              field: 'raw_sql',
              operator: 'contains',
              value: 'DROP TABLE',
              label: 'Unsupported',
            },
          ],
        }),
      ),
    ).toThrow('Unsupported contracts filter field');
  });
});
