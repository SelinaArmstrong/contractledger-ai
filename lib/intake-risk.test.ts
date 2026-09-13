import { describe, expect, it } from 'vitest';

import {
  intakeFindingSummary,
  intakeRiskBadge,
  intakeRiskLevel,
  intakeRiskRank,
  matchesIntakeRiskFilter,
} from '@/lib/intake-risk';

describe('intakeRiskLevel', () => {
  it('accepts the three assessed levels', () => {
    expect(intakeRiskLevel('high')).toBe('high');
    expect(intakeRiskLevel('medium')).toBe('medium');
    expect(intakeRiskLevel('low')).toBe('low');
  });

  it('treats a missing or unknown value as unassessed', () => {
    expect(intakeRiskLevel(null)).toBeNull();
    expect(intakeRiskLevel(undefined)).toBeNull();
    expect(intakeRiskLevel('')).toBeNull();
    expect(intakeRiskLevel('critical')).toBeNull();
  });
});

describe('intakeRiskBadge', () => {
  it('never labels an unreviewed intake as low risk', () => {
    const badge = intakeRiskBadge(null);
    expect(badge.assessed).toBe(false);
    expect(badge.label).toBe('Not assessed');
    expect(badge.tone).toBe('slate');
  });

  it('separates a cleared review from an unreviewed one', () => {
    expect(intakeRiskBadge('low')).toMatchObject({
      assessed: true,
      label: 'Low risk',
      tone: 'green',
    });
    expect(intakeRiskBadge('high').tone).toBe('rose');
    expect(intakeRiskBadge('medium').tone).toBe('amber');
  });
});

describe('intakeFindingSummary', () => {
  it('explains why an unassessed intake shows no findings', () => {
    expect(intakeFindingSummary(null, 0)).toBe('Playbook review not run');
  });

  it('counts open findings for a reviewed intake', () => {
    expect(intakeFindingSummary('low', 0)).toBe('0 open findings');
    expect(intakeFindingSummary('high', 1)).toBe('1 open finding');
    expect(intakeFindingSummary('high', '4')).toBe('4 open findings');
    expect(intakeFindingSummary('medium', null)).toBe('0 open findings');
  });
});

describe('matchesIntakeRiskFilter', () => {
  it('matches the unassessed filter only when no review has run', () => {
    expect(matchesIntakeRiskFilter(null, 'unassessed')).toBe(true);
    expect(matchesIntakeRiskFilter('low', 'unassessed')).toBe(false);
  });

  it('keeps elevated to high and medium', () => {
    expect(matchesIntakeRiskFilter('high', 'elevated')).toBe(true);
    expect(matchesIntakeRiskFilter('medium', 'elevated')).toBe(true);
    expect(matchesIntakeRiskFilter('low', 'elevated')).toBe(false);
    expect(matchesIntakeRiskFilter(null, 'elevated')).toBe(false);
  });

  it('passes everything through the all filter', () => {
    expect(matchesIntakeRiskFilter(null, 'all')).toBe(true);
    expect(matchesIntakeRiskFilter('high', 'all')).toBe(true);
  });

  it('matches an exact level', () => {
    expect(matchesIntakeRiskFilter('medium', 'medium')).toBe(true);
    expect(matchesIntakeRiskFilter('medium', 'low')).toBe(false);
  });
});

describe('intakeRiskRank', () => {
  it('ranks an unassessed intake above a cleared one', () => {
    expect(intakeRiskRank('high')).toBeLessThan(intakeRiskRank('medium'));
    expect(intakeRiskRank('medium')).toBeLessThan(intakeRiskRank(null));
    expect(intakeRiskRank(null)).toBeLessThan(intakeRiskRank('low'));
  });
});
