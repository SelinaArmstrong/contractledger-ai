/**
 * Timed workflow evidence.
 *
 * The evidence ledger blocks any "reduced contract-entry time by X%" claim
 * until repeated manual and assisted runs of the *same* fictional scenario are
 * recorded with a stated sample size. This module owns that arithmetic so the
 * numbers a resume quotes come from saved runs rather than an estimate.
 */

export const WORKFLOW_TIMING_SCENARIOS = [
  'draft_contract_review',
  'executed_contract_registration',
  'supplier_onboarding',
  'amendment_application',
  'legacy_register_import',
] as const;

export type WorkflowTimingScenario = (typeof WORKFLOW_TIMING_SCENARIOS)[number];

export const WORKFLOW_TIMING_MODES = ['manual', 'assisted'] as const;

export type WorkflowTimingMode = (typeof WORKFLOW_TIMING_MODES)[number];

export const WORKFLOW_TIMING_SCENARIO_LABELS: Record<
  WorkflowTimingScenario,
  string
> = {
  draft_contract_review: 'Draft contract review',
  executed_contract_registration: 'Executed contract registration',
  supplier_onboarding: 'Supplier onboarding',
  amendment_application: 'Amendment application',
  legacy_register_import: 'Legacy register import',
};

/**
 * A comparison needs enough runs on both sides before it means anything. Below
 * this the UI reports the samples but withholds the percentage.
 */
export const MINIMUM_COMPARABLE_RUNS = 3;

/** A single saved run. Durations are whole milliseconds. */
export type WorkflowTimingRun = {
  scenario: WorkflowTimingScenario;
  mode: WorkflowTimingMode;
  durationMs: number;
};

export function isWorkflowTimingScenario(
  value: unknown,
): value is WorkflowTimingScenario {
  return WORKFLOW_TIMING_SCENARIOS.includes(value as WorkflowTimingScenario);
}

export function isWorkflowTimingMode(
  value: unknown,
): value is WorkflowTimingMode {
  return WORKFLOW_TIMING_MODES.includes(value as WorkflowTimingMode);
}

export function medianDuration(durations: number[]) {
  if (!durations.length) return 0;
  const sorted = [...durations].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

export type WorkflowTimingComparison = {
  scenario: WorkflowTimingScenario;
  label: string;
  manualRuns: number;
  assistedRuns: number;
  manualMedianMs: number;
  assistedMedianMs: number;
  /**
   * Median reduction as a percentage, or null while either side is below
   * `MINIMUM_COMPARABLE_RUNS`. Null means "not enough evidence yet", never 0.
   */
  reductionPercent: number | null;
  savedMsPerRun: number | null;
  comparable: boolean;
  evidenceNote: string;
};

/**
 * Summarises one scenario. The comparison is deliberately conservative: it
 * reports medians as soon as any run exists, but refuses to state a percentage
 * until both modes clear the minimum sample.
 */
export function compareWorkflowTiming(
  scenario: WorkflowTimingScenario,
  runs: WorkflowTimingRun[],
): WorkflowTimingComparison {
  const forScenario = runs.filter((run) => run.scenario === scenario);
  const manual = forScenario
    .filter((run) => run.mode === 'manual')
    .map((run) => run.durationMs);
  const assisted = forScenario
    .filter((run) => run.mode === 'assisted')
    .map((run) => run.durationMs);

  const manualMedianMs = medianDuration(manual);
  const assistedMedianMs = medianDuration(assisted);
  const comparable =
    manual.length >= MINIMUM_COMPARABLE_RUNS &&
    assisted.length >= MINIMUM_COMPARABLE_RUNS &&
    manualMedianMs > 0;

  return {
    scenario,
    label: WORKFLOW_TIMING_SCENARIO_LABELS[scenario],
    manualRuns: manual.length,
    assistedRuns: assisted.length,
    manualMedianMs,
    assistedMedianMs,
    reductionPercent: comparable
      ? Number(
          (
            ((manualMedianMs - assistedMedianMs) / manualMedianMs) *
            100
          ).toFixed(1),
        )
      : null,
    savedMsPerRun: comparable ? manualMedianMs - assistedMedianMs : null,
    comparable,
    evidenceNote: comparable
      ? `Median of ${manual.length} manual and ${assisted.length} assisted fictional runs.`
      : `Needs at least ${MINIMUM_COMPARABLE_RUNS} runs per mode. Recorded ${manual.length} manual and ${assisted.length} assisted.`,
  };
}

export function summariseWorkflowTiming(runs: WorkflowTimingRun[]) {
  return WORKFLOW_TIMING_SCENARIOS.map((scenario) =>
    compareWorkflowTiming(scenario, runs),
  );
}

/** Formats a duration for the evidence panel: "4m 12s", "48s". */
export function formatDuration(durationMs: number) {
  if (durationMs <= 0) return '—';
  const totalSeconds = Math.round(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes
    ? `${minutes}m ${String(seconds).padStart(2, '0')}s`
    : `${seconds}s`;
}

/**
 * Guards against a stopwatch left running overnight, which would poison the
 * median. One hour is far longer than any demo scenario.
 */
export const MAX_TIMED_RUN_MS = 60 * 60 * 1000;
export const MIN_TIMED_RUN_MS = 1_000;

export function assertRecordableDuration(durationMs: number) {
  if (!Number.isFinite(durationMs) || Math.round(durationMs) < MIN_TIMED_RUN_MS)
    throw new Error('A timed run must last at least one second.');
  if (durationMs > MAX_TIMED_RUN_MS)
    throw new Error(
      'A timed run longer than one hour is not recorded; restart the scenario.',
    );
  return Math.round(durationMs);
}
