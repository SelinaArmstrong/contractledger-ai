import { describe, expect, it } from 'vitest';

import { buildManagementReport } from '@/lib/management-insights';

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
