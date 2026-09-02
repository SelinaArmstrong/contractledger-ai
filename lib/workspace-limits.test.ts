import { describe, expect, it } from 'vitest';

import {
  WORKSPACE_REGISTER_LIMIT,
  registerTruncation,
} from '@/lib/workspace-limits';

describe('register snapshot limits', () => {
  it('reports no truncation for a register that fits under the cap', () => {
    const result = registerTruncation(7, 7);

    expect(result.truncated).toBe(false);
    expect(result.message).toBe('');
  });

  it('reports truncation once the snapshot hits the cap and rows remain', () => {
    const result = registerTruncation(
      WORKSPACE_REGISTER_LIMIT,
      WORKSPACE_REGISTER_LIMIT + 250,
    );

    expect(result.truncated).toBe(true);
    expect(result.total).toBe(WORKSPACE_REGISTER_LIMIT + 250);
    expect(result.message).toContain(String(WORKSPACE_REGISTER_LIMIT));
    expect(result.message).toContain(String(WORKSPACE_REGISTER_LIMIT + 250));
  });

  it('does not claim truncation when the total merely disagrees below the cap', () => {
    // A filtered snapshot can be smaller than the table total without the cap
    // having been reached; that is not a truncated register.
    expect(registerTruncation(12, 40).truncated).toBe(false);
  });

  it('honours a cap supplied by the server payload', () => {
    expect(registerTruncation(50, 900, 50).truncated).toBe(true);
    expect(registerTruncation(50, 900, 200).truncated).toBe(false);
  });

  it('treats an empty register as complete', () => {
    const result = registerTruncation(0, 0);

    expect(result.truncated).toBe(false);
    expect(result.loaded).toBe(0);
  });
});
