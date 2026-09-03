import { afterEach, describe, expect, it } from 'vitest';

import {
  AI_SCOPES,
  AI_UNIT_COSTS,
  DAY_SECONDS,
  DEFAULT_DAILY_UNIT_BUDGET,
  DEFAULT_VISITOR_HOURLY_UNIT_BUDGET,
  HOUR_SECONDS,
  budgetMessage,
  dailyUnitBudget,
  evaluateReservation,
  secondsUntilWindowEnd,
  unitCost,
  visitorHourlyUnitBudget,
  windowResetsAt,
  windowStart,
} from '@/lib/ai-budget-policy';

const keys = ['AI_DAILY_UNIT_BUDGET', 'AI_VISITOR_HOURLY_UNIT_BUDGET'] as const;
const original = Object.fromEntries(keys.map((k) => [k, process.env[k]]));

afterEach(() => {
  for (const key of keys) {
    const value = original[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe('AI unit costs', () => {
  it('prices every model-backed scope', () => {
    expect(AI_SCOPES).toHaveLength(6);
    for (const scope of AI_SCOPES) {
      expect(unitCost(scope)).toBeGreaterThan(0);
    }
  });

  it('prices the fifteen-document validation run far above a single analysis', () => {
    expect(AI_UNIT_COSTS['ai-evaluation']).toBe(15);
    expect(AI_UNIT_COSTS['ai-evaluation']).toBeGreaterThan(
      AI_UNIT_COSTS['contract-analysis'] * 10,
    );
  });

  it('keeps the daily budget too small to absorb unlimited validation runs', () => {
    const runs = Math.floor(
      DEFAULT_DAILY_UNIT_BUDGET / AI_UNIT_COSTS['ai-evaluation'],
    );
    expect(runs).toBeLessThan(20);
  });
});

describe('budget configuration', () => {
  it('falls back to the defaults when unset', () => {
    delete process.env.AI_DAILY_UNIT_BUDGET;
    delete process.env.AI_VISITOR_HOURLY_UNIT_BUDGET;
    expect(dailyUnitBudget()).toBe(DEFAULT_DAILY_UNIT_BUDGET);
    expect(visitorHourlyUnitBudget()).toBe(DEFAULT_VISITOR_HOURLY_UNIT_BUDGET);
  });

  it('accepts a positive integer override', () => {
    process.env.AI_DAILY_UNIT_BUDGET = '40';
    expect(dailyUnitBudget()).toBe(40);
  });

  it('ignores values that would disable the ceiling', () => {
    for (const value of ['0', '-5', 'lots', '', '2.5']) {
      process.env.AI_DAILY_UNIT_BUDGET = value;
      expect(dailyUnitBudget()).toBe(DEFAULT_DAILY_UNIT_BUDGET);
    }
  });
});

describe('reservation decisions', () => {
  it('allows a reservation that lands inside the limit', () => {
    const decision = evaluateReservation({
      usedUnitsAfter: 10,
      limit: 250,
      cost: 1,
      reason: 'daily_budget',
      retryAfterSeconds: 100,
    });

    expect(decision.allowed).toBe(true);
    if (decision.allowed) expect(decision.remainingUnits).toBe(240);
  });

  it('allows a reservation that exactly consumes the limit', () => {
    const decision = evaluateReservation({
      usedUnitsAfter: 250,
      limit: 250,
      cost: 15,
      reason: 'daily_budget',
      retryAfterSeconds: 100,
    });

    expect(decision.allowed).toBe(true);
    if (decision.allowed) expect(decision.remainingUnits).toBe(0);
  });

  it('refuses a reservation that would exceed the limit', () => {
    const decision = evaluateReservation({
      usedUnitsAfter: 251,
      limit: 250,
      cost: 15,
      reason: 'daily_budget',
      retryAfterSeconds: 3600,
    });

    expect(decision.allowed).toBe(false);
    if (!decision.allowed) {
      expect(decision.reason).toBe('daily_budget');
      expect(decision.retryAfterSeconds).toBe(3600);
      // 236 units were used before this attempt, so 14 were still free.
      expect(decision.remainingUnits).toBe(14);
    }
  });

  it('refuses an expensive call that does not fit in what is left', () => {
    const decision = evaluateReservation({
      usedUnitsAfter: 248 + 15,
      limit: 250,
      cost: 15,
      reason: 'daily_budget',
      retryAfterSeconds: 60,
    });

    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.remainingUnits).toBe(2);
  });

  it('explains a daily exhaustion differently from an hourly throttle', () => {
    const daily = evaluateReservation({
      usedUnitsAfter: 300,
      limit: 250,
      cost: 1,
      reason: 'daily_budget',
      retryAfterSeconds: 60,
    });
    const hourly = evaluateReservation({
      usedUnitsAfter: 50,
      limit: 40,
      cost: 1,
      reason: 'visitor_rate',
      retryAfterSeconds: 60,
    });

    expect(daily.allowed).toBe(false);
    expect(hourly.allowed).toBe(false);
    if (!daily.allowed && !hourly.allowed) {
      expect(budgetMessage(daily)).toMatch(/daily AI budget/u);
      expect(budgetMessage(daily)).toMatch(/browsable/u);
      expect(budgetMessage(hourly)).toMatch(/hour/u);
      expect(budgetMessage(daily)).not.toBe(budgetMessage(hourly));
    }
  });
});

describe('budget windows', () => {
  it('aligns the daily window to UTC midnight', () => {
    const noon = Date.UTC(2026, 8, 2, 12, 30, 0);
    expect(windowStart(noon, DAY_SECONDS)).toBe(
      Math.floor(Date.UTC(2026, 8, 2, 0, 0, 0) / 1000),
    );
  });

  it('reports the seconds left until the window rolls over', () => {
    const oneHourIn = Date.UTC(2026, 8, 2, 1, 0, 0);
    expect(secondsUntilWindowEnd(oneHourIn, DAY_SECONDS)).toBe(23 * 60 * 60);
    expect(secondsUntilWindowEnd(oneHourIn, HOUR_SECONDS)).toBe(3600);
  });

  it('never reports a non-positive retry delay', () => {
    const exactBoundary = Date.UTC(2026, 8, 2, 0, 0, 0);
    expect(secondsUntilWindowEnd(exactBoundary, DAY_SECONDS)).toBeGreaterThan(
      0,
    );
  });
});

describe('window reset timestamps', () => {
  it('reports the next UTC midnight for the daily window', () => {
    expect(windowResetsAt(Date.UTC(2026, 8, 2, 13, 45, 0), DAY_SECONDS)).toBe(
      '2026-09-03T00:00:00.000Z',
    );
  });

  it('stays identical across the whole window, so payload snapshots compare', () => {
    const early = windowResetsAt(Date.UTC(2026, 8, 2, 0, 0, 1), DAY_SECONDS);
    const late = windowResetsAt(Date.UTC(2026, 8, 2, 23, 59, 59), DAY_SECONDS);

    expect(early).toBe(late);
  });

  it('rolls over to the following day once the window ends', () => {
    expect(windowResetsAt(Date.UTC(2026, 8, 3, 0, 0, 0), DAY_SECONDS)).toBe(
      '2026-09-04T00:00:00.000Z',
    );
  });
});
