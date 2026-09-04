import { env } from 'cloudflare:workers';

import {
  DAY_SECONDS,
  HOUR_SECONDS,
  budgetMessage,
  dailyUnitBudget,
  evaluateReservation,
  secondsUntilWindowEnd,
  unitCost,
  windowResetsAt,
  visitorHourlyUnitBudget,
  windowStart,
  type AIScope,
} from '@/lib/ai-budget-policy';
import {
  clientAddress,
  type RequestActor,
} from '@/lib/server/request-security';

/**
 * Enforces the AI cost policy against D1.
 *
 * Counters live in `api_rate_limits`, which already stores a counter per key
 * per window; a budget is the same shape with a weighted increment. Every
 * reservation is an atomic upsert, so two concurrent requests cannot both read
 * the last remaining unit.
 */

/** Derives a stable, non-identifying key for one visitor. */
async function visitorKey(request: Request, actor: RequestActor) {
  const address = clientAddress(request);
  // Without a client address every visitor would share one bucket, so fall
  // back to the actor. The address is hashed because a raw IP is personal data
  // and nothing here needs to reverse it.
  const material = address || `actor:${actor.id}`;
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(material),
  );
  return [...new Uint8Array(digest)]
    .slice(0, 8)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function addUnits(key: string, window: number, units: number) {
  const result = await env.DB.prepare(`INSERT INTO api_rate_limits
      (key, window_start, request_count)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET request_count = request_count + ?
      RETURNING request_count`)
    .bind(key, window, units, units)
    .first<{ request_count: number }>();
  if (!result) throw new Error('Budget counter unavailable.');
  return Number(result.request_count);
}

async function releaseUnits(key: string, units: number) {
  try {
    await env.DB.prepare(
      `UPDATE api_rate_limits
       SET request_count = MAX(0, request_count - ?)
       WHERE key = ?`,
    )
      .bind(units, key)
      .run();
  } catch {
    // A failed refund only makes the budget stricter, never more permissive.
  }
}

function refusal(
  message: string,
  retryAfterSeconds: number,
  status: number,
  remainingUnits: number,
) {
  return Response.json(
    { error: message, aiBudget: { remainingUnits } },
    {
      status,
      headers: { 'Retry-After': String(retryAfterSeconds) },
    },
  );
}

/**
 * Reserves budget for one model-backed call. Returns a response to send when
 * the call must not proceed, or null when it may.
 *
 * Fails closed: if the counters cannot be read or written, the call is refused
 * rather than allowed, because the failure mode of guessing wrong is an
 * unbounded bill.
 */
export async function reserveAIBudget(
  request: Request,
  actor: RequestActor,
  scope: AIScope,
  now = Date.now(),
): Promise<Response | null> {
  const cost = unitCost(scope);
  const dayWindow = windowStart(now, DAY_SECONDS);
  const dayKey = `aibudget:day:${dayWindow}`;

  let dailyAfter: number;
  try {
    dailyAfter = await addUnits(dayKey, dayWindow, cost);
  } catch {
    return refusal(
      'The AI usage budget could not be verified, so this request was not sent to the model.',
      60,
      503,
      0,
    );
  }

  const daily = evaluateReservation({
    usedUnitsAfter: dailyAfter,
    limit: dailyUnitBudget(),
    cost,
    reason: 'daily_budget',
    retryAfterSeconds: secondsUntilWindowEnd(now, DAY_SECONDS),
  });
  if (!daily.allowed) {
    await releaseUnits(dayKey, cost);
    return refusal(
      budgetMessage(daily),
      daily.retryAfterSeconds,
      503,
      daily.remainingUnits,
    );
  }

  const hourWindow = windowStart(now, HOUR_SECONDS);
  const visitor = await visitorKey(request, actor);
  const visitorCounterKey = `aibudget:visitor:${visitor}:${hourWindow}`;

  let visitorAfter: number;
  try {
    visitorAfter = await addUnits(visitorCounterKey, hourWindow, cost);
  } catch {
    await releaseUnits(dayKey, cost);
    return refusal(
      'The AI usage budget could not be verified, so this request was not sent to the model.',
      60,
      503,
      daily.remainingUnits,
    );
  }

  const perVisitor = evaluateReservation({
    usedUnitsAfter: visitorAfter,
    limit: visitorHourlyUnitBudget(),
    cost,
    reason: 'visitor_rate',
    retryAfterSeconds: secondsUntilWindowEnd(now, HOUR_SECONDS),
  });
  if (!perVisitor.allowed) {
    // Give the shared pool back: this visitor was throttled, the day was not.
    await releaseUnits(dayKey, cost);
    await releaseUnits(visitorCounterKey, cost);
    return refusal(
      budgetMessage(perVisitor),
      perVisitor.retryAfterSeconds,
      429,
      perVisitor.remainingUnits,
    );
  }

  return null;
}

export type AIBudgetStatus = {
  dailyUnitLimit: number;
  usedUnits: number;
  remainingUnits: number;
  /** Absolute ISO timestamp; stable for the whole window. */
  resetsAt: string;
};

/** Read-only view of the shared budget, for display in the workspace. */
export async function aiBudgetStatus(
  now = Date.now(),
): Promise<AIBudgetStatus> {
  const dayWindow = windowStart(now, DAY_SECONDS);
  const limit = dailyUnitBudget();
  let used = 0;
  try {
    const row = await env.DB.prepare(
      'SELECT request_count FROM api_rate_limits WHERE key = ? LIMIT 1',
    )
      .bind(`aibudget:day:${dayWindow}`)
      .first<{ request_count: number }>();
    used = Number(row?.request_count ?? 0);
  } catch {
    used = 0;
  }
  return {
    dailyUnitLimit: limit,
    usedUnits: used,
    remainingUnits: Math.max(0, limit - used),
    resetsAt: windowResetsAt(now, DAY_SECONDS),
  };
}
