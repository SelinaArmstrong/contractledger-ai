import { describe, expect, it } from 'vitest';

import {
  calculateResultingContractValue,
  formatAmendmentNumber,
  subtractCalendarDays,
} from '@/lib/amendment-lifecycle';

describe('amendment lifecycle calculations', () => {
  it('applies an extracted value delta to the current contract value', () => {
    expect(calculateResultingContractValue(47_500_000, 75_000, null)).toEqual({
      resultingValueCents: 55_000_000,
      valueChangeCents: 7_500_000,
    });
  });

  it('uses the stated resulting value as the source of truth', () => {
    expect(
      calculateResultingContractValue(47_500_000, 70_000, 550_000),
    ).toEqual({
      resultingValueCents: 55_000_000,
      valueChangeCents: 7_500_000,
    });
  });

  it('recalculates the notice deadline across a month boundary', () => {
    expect(subtractCalendarDays('2027-06-30', 30)).toBe('2027-05-31');
  });

  it('normalizes a numeric amendment identifier for the register', () => {
    expect(formatAmendmentNumber('2', 2)).toBe('Amendment No. 2');
    expect(formatAmendmentNumber('', 3)).toBe('Amendment No. 3');
  });
});
