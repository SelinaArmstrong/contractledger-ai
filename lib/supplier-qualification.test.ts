import { describe, expect, it } from 'vitest';

import { supplierDocumentationStatus } from '@/lib/supplier-qualification';

describe('supplier documentation status', () => {
  it('prioritizes expired and follow-up records over completeness', () => {
    expect(
      supplierDocumentationStatus({
        w9Status: 'received',
        insuranceStatus: 'expired',
        documentStatuses: ['current'],
      }),
    ).toBe('expired');
    expect(
      supplierDocumentationStatus({
        w9Status: 'received',
        insuranceStatus: 'current',
        documentStatuses: ['needs_follow_up'],
      }),
    ).toBe('needs_follow_up');
  });

  it('distinguishes incomplete, under-review, and complete packages', () => {
    expect(
      supplierDocumentationStatus({
        w9Status: 'missing',
        insuranceStatus: 'current',
        documentStatuses: ['current'],
      }),
    ).toBe('incomplete');
    expect(
      supplierDocumentationStatus({
        w9Status: 'received',
        insuranceStatus: 'current',
        documentStatuses: ['under_review'],
      }),
    ).toBe('under_review');
    expect(
      supplierDocumentationStatus({
        w9Status: 'received',
        insuranceStatus: 'current',
        documentStatuses: ['current'],
      }),
    ).toBe('complete');
  });
});
