import { describe, expect, it } from 'vitest';

import {
  needsSourceOverride,
  validatedOverrideReason,
} from '@/lib/ai-governance';

describe('AI source governance', () => {
  const unsupported = {
    value: 'CT-2026-004',
    sourcePage: null,
    sourceQuote: null,
  };

  it('requires an explicit reason for an unsupported critical value', () => {
    expect(needsSourceOverride('contractNumber', unsupported)).toBe(true);
    expect(() =>
      validatedOverrideReason('contractNumber', unsupported, 'too short'),
    ).toThrow('reviewer override reason');
  });

  it('accepts source evidence or a sufficiently specific override', () => {
    expect(
      validatedOverrideReason(
        'contractNumber',
        unsupported,
        'Verified against the signed cover page.',
      ),
    ).toBe('Verified against the signed cover page.');
    expect(
      validatedOverrideReason(
        'contractNumber',
        { ...unsupported, sourcePage: 1, sourceQuote: 'Contract No. 004' },
        '',
      ),
    ).toBeNull();
  });

  it('does not require an override for a missing value', () => {
    expect(
      needsSourceOverride('expirationDate', { ...unsupported, value: null }),
    ).toBe(false);
  });
});
