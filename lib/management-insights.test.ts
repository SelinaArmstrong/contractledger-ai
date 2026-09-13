import { describe, expect, it } from 'vitest';

import {
  buildManagementReport,
  isDataQualityIssue,
} from '@/lib/management-insights';

describe('management report', () => {
  it('flags an active contract whose expiration date has passed', () => {
    const report = buildManagementReport({
      scope: 'contracts',
      contracts: [
        {
          id: 'contract-1',
          contract_number: 'CT-001',
          title: 'Expired active agreement',
          status: 'active',
          current_value_cents: 100_000_00,
          original_value_cents: 100_000_00,
          amendment_value_cents: 0,
          expiration_date: '2026-08-01',
          renewal_type: 'none',
          category: 'Professional services',
          supplier_name: 'Example Supplier',
        },
      ],
      suppliers: [],
      keyDates: [],
      supplierAlerts: [],
      today: '2026-08-31',
    });

    expect(report.recordCount).toBe(1);
    expect(report.attentionItems[0]).toMatchObject({
      entityId: 'contract-1',
      priority: 'high',
      issue: 'Expired date conflicts with active status',
    });
    expect(
      report.metrics.find((metric) => metric.key === 'attention')?.value,
    ).toBeGreaterThanOrEqual(1);
  });

  it('flags an amendment total that no amendment record supports', () => {
    const report = buildManagementReport({
      scope: 'contracts',
      contracts: [
        {
          id: 'contract-2',
          contract_number: 'CT-002',
          title: 'Reduced supply agreement',
          status: 'active',
          // The arithmetic balances, so the reconciliation check stays quiet.
          original_value_cents: 630_000_00,
          amendment_value_cents: -50_000_00,
          current_value_cents: 580_000_00,
          amendment_count: 0,
          expiration_date: '2027-09-30',
          renewal_type: 'none',
          category: 'Supply',
          supplier_name: 'Example Supplier',
        },
      ],
      suppliers: [],
      keyDates: [],
      supplierAlerts: [],
      today: '2026-08-31',
    });

    const items = report.attentionItems.filter(
      (item) => item.entityId === 'contract-2',
    );
    expect(items).toContainEqual(
      expect.objectContaining({
        issue: 'Amendment value without a recorded amendment',
        priority: 'high',
      }),
    );
    expect(
      items.some(
        (item) => item.issue === 'Contract value reconciliation exception',
      ),
    ).toBe(false);
  });

  it('stays quiet when the amendment total has a matching record', () => {
    const report = buildManagementReport({
      scope: 'contracts',
      contracts: [
        {
          id: 'contract-3',
          contract_number: 'CT-003',
          title: 'Expanded equipment agreement',
          status: 'active',
          original_value_cents: 400_000_00,
          amendment_value_cents: 75_000_00,
          current_value_cents: 475_000_00,
          amendment_count: 1,
          expiration_date: '2027-01-31',
          renewal_type: 'none',
          category: 'Equipment',
          supplier_name: 'Example Supplier',
        },
      ],
      suppliers: [],
      keyDates: [],
      supplierAlerts: [],
      today: '2026-08-31',
    });

    expect(
      report.attentionItems.some(
        (item) => item.issue === 'Amendment value without a recorded amendment',
      ),
    ).toBe(false);
  });

  it('separates register data quality from operational follow-up', () => {
    expect(isDataQualityIssue('Contract value reconciliation exception')).toBe(
      true,
    );
    expect(
      isDataQualityIssue('Amendment value without a recorded amendment'),
    ).toBe(true);
    // Time-based items belong to Obligations & Evidence, not data quality.
    expect(isDataQualityIssue('Contract expiration requires review')).toBe(
      false,
    );
    expect(isDataQualityIssue('Documentation status requires follow-up')).toBe(
      false,
    );
    // Obligation and supplier-alert items carry a dynamic issue label.
    expect(isDataQualityIssue('Monthly service report evidence')).toBe(false);
  });

  it('returns stable empty-scope metrics without dividing by zero', () => {
    const report = buildManagementReport({
      scope: 'suppliers',
      contracts: [],
      suppliers: [],
      keyDates: [],
      supplierAlerts: [],
      today: '2026-08-31',
    });

    expect(report.recordCount).toBe(0);
    expect(report.attentionCount).toBe(0);
    expect(report.charts).toHaveLength(2);
  });
});
