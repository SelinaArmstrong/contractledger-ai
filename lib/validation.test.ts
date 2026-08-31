import { describe, expect, it } from 'vitest';

import { isIsoDate, isoDateSchema } from '@/lib/validation';

describe('ISO date validation', () => {
  it.each(['2024-02-29', '2026-08-31', '2000-01-01'])(
    'accepts the real calendar date %s',
    (value) => {
      expect(isIsoDate(value)).toBe(true);
      expect(isoDateSchema.safeParse(value).success).toBe(true);
    },
  );

  it.each(['2026-02-29', '2026-04-31', '2026-13-01', '08/31/2026', ''])(
    'rejects the invalid date %s',
    (value) => {
      expect(isIsoDate(value)).toBe(false);
      expect(isoDateSchema.safeParse(value).success).toBe(false);
    },
  );
});
