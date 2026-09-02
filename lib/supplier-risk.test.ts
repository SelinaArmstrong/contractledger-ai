import { describe, expect, it } from 'vitest';

import { calculateSupplierRiskProfile } from '@/lib/supplier-risk';

const baseline = {
  declaredRiskTier: 'low',
  w9Status: 'received',
  insuranceStatus: 'current',
  insuranceExpiration: '2027-06-30',
  qualificationStatus: 'complete',
  qualificationDocumentCount: 4,
  hasCybersecurityRecord: true,
  hasExclusionScreening: true,
  hasLicenseOrGoodStanding: true,
  openHighRiskFindings: 0,
  overdueObligations: 0,
  activeContractValueCents: 10_000_000,
  portfolioValueCents: 100_000_000,
  asOfDate: '2026-09-01',
} as const;

describe('calculateSupplierRiskProfile', () => {
  it('keeps a fully controlled supplier low risk and explains every factor', () => {
    const profile = calculateSupplierRiskProfile(baseline);
    expect(profile.level).toBe('low');
    expect(profile.score).toBe(0);
    expect(profile.factors).toHaveLength(8);
    expect(profile.factors.every((factor) => factor.evidence.length > 0)).toBe(true);
  });

  it('raises missing insurance and overdue work to high risk', () => {
    const profile = calculateSupplierRiskProfile({
      ...baseline,
      insuranceStatus: 'missing',
      insuranceExpiration: null,
      overdueObligations: 2,
    });
    expect(profile.level).toBe('high');
    expect(profile.score).toBe(45);
    expect(profile.factors.find((factor) => factor.key === 'insurance')).toMatchObject({
      status: 'high_risk',
      points: 25,
    });
  });

  it('uses deterministic concentration thresholds', () => {
    const medium = calculateSupplierRiskProfile({
      ...baseline,
      activeContractValueCents: 25_000_000,
    });
    expect(medium.score).toBe(15);
    expect(medium.level).toBe('low');
    expect(medium.factors.find((factor) => factor.key === 'concentration')?.points).toBe(15);
  });

  it('flags insurance that expires within sixty days without calling it expired', () => {
    const profile = calculateSupplierRiskProfile({
      ...baseline,
      insuranceExpiration: '2026-10-15',
    });
    expect(profile.factors.find((factor) => factor.key === 'insurance')).toMatchObject({
      status: 'attention',
      points: 10,
    });
  });
});
