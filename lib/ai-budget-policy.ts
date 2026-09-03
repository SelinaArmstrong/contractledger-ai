/**
 * Cost policy for the model-backed endpoints.
 *
 * The demo account's password is published, so anyone can sign in and call the
 * AI routes. Per-actor rate limiting alone does not bound the bill: every
 * visitor shares the one demo identity, so they share one bucket, and a bucket
 * that refills every ten minutes still has no ceiling over a day.
 *
 * This module holds the arithmetic — what each call costs and what the caps
 * are — separately from the storage so it can be reasoned about and tested as
 * plain data.
 */

/**
 * Relative cost of one call, in budget units. Roughly proportional to the
 * number of model round-trips the route makes: the validation run analyses all
 * fifteen fixtures, so it is priced accordingly and cannot be used to drain the
 * day's budget in a handful of clicks.
 */
export const AI_UNIT_COSTS = {
  'contract-analysis': 1,
  'supplier-analysis': 1,
  'amendment-analysis': 1,
  'contract-operations-assistant': 1,
  'management-insights': 2,
  'ai-evaluation': 15,
} as const;

export type AIScope = keyof typeof AI_UNIT_COSTS;

export const AI_SCOPES = Object.keys(AI_UNIT_COSTS) as AIScope[];

/** Default ceiling for the whole deployment, per UTC day. */
export const DEFAULT_DAILY_UNIT_BUDGET = 250;

/** Default ceiling for one visitor, per hour, so nobody drains the shared pool. */
export const DEFAULT_VISITOR_HOURLY_UNIT_BUDGET = 40;

export const DAY_SECONDS = 24 * 60 * 60;
export const HOUR_SECONDS = 60 * 60;

function positiveInteger(raw: string | undefined, fallback: number) {
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function dailyUnitBudget() {
  return positiveInteger(
    process.env.AI_DAILY_UNIT_BUDGET,
    DEFAULT_DAILY_UNIT_BUDGET,
  );
}

export function visitorHourlyUnitBudget() {
  return positiveInteger(
    process.env.AI_VISITOR_HOURLY_UNIT_BUDGET,
    DEFAULT_VISITOR_HOURLY_UNIT_BUDGET,
  );
}

export function unitCost(scope: AIScope) {
  return AI_UNIT_COSTS[scope];
}

/** Start of the window a timestamp falls in, as epoch seconds. */
export function windowStart(nowMs: number, windowSeconds: number) {
  const nowSeconds = Math.floor(nowMs / 1000);
  return Math.floor(nowSeconds / windowSeconds) * windowSeconds;
}

export function secondsUntilWindowEnd(nowMs: number, windowSeconds: number) {
  const start = windowStart(nowMs, windowSeconds);
  return Math.max(1, start + windowSeconds - Math.floor(nowMs / 1000));
}

/**
 * When the current window rolls over, as an absolute ISO timestamp.
 *
 * Reported instead of a countdown so the value is stable for the whole window:
 * a field that changes every second would make the workspace payload
 * impossible to compare between two snapshots, which the release baseline
 * check does byte for byte.
 */
export function windowResetsAt(nowMs: number, windowSeconds: number) {
  return new Date(
    (windowStart(nowMs, windowSeconds) + windowSeconds) * 1000,
  ).toISOString();
}

export type BudgetDecision =
  | { allowed: true; remainingUnits: number }
  | {
      allowed: false;
      reason: 'daily_budget' | 'visitor_rate';
      retryAfterSeconds: number;
      remainingUnits: number;
    };

/**
 * Decides whether a reservation fits. `usedUnits` is the total *after* the
 * reservation was applied, matching the value an atomic increment returns.
 */
export function evaluateReservation({
  usedUnitsAfter,
  limit,
  cost,
  reason,
  retryAfterSeconds,
}: {
  usedUnitsAfter: number;
  limit: number;
  cost: number;
  reason: 'daily_budget' | 'visitor_rate';
  retryAfterSeconds: number;
}): BudgetDecision {
  if (usedUnitsAfter <= limit) {
    return {
      allowed: true,
      remainingUnits: Math.max(0, limit - usedUnitsAfter),
    };
  }
  return {
    allowed: false,
    reason,
    retryAfterSeconds,
    // The reservation is rolled back by the caller, so report what was
    // available before it was attempted.
    remainingUnits: Math.max(0, limit - (usedUnitsAfter - cost)),
  };
}

export function budgetMessage(
  decision: Extract<BudgetDecision, { allowed: false }>,
) {
  return decision.reason === 'daily_budget'
    ? 'The shared daily AI budget for this demonstration workspace is used up. Every saved record, the validation report and the register exports remain fully browsable, and the budget resets at 00:00 UTC.'
    : 'You have used this hour’s AI allowance for the shared demonstration workspace. Saved records stay browsable while it resets.';
}
