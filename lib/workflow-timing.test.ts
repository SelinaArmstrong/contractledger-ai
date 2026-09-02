import { describe, expect, it } from 'vitest';

import {
  MAX_TIMED_RUN_MS,
  MINIMUM_COMPARABLE_RUNS,
  assertRecordableDuration,
  compareWorkflowTiming,
  formatDuration,
  isWorkflowTimingMode,
  isWorkflowTimingScenario,
  medianDuration,
  summariseWorkflowTiming,
  type WorkflowTimingRun,
} from '@/lib/workflow-timing';

const run = (
  mode: 'manual' | 'assisted',
  durationMs: number,
): WorkflowTimingRun => ({
  scenario: 'draft_contract_review',
  mode,
  durationMs,
});

describe('median duration', () => {
  it('returns zero without samples', () => {
    expect(medianDuration([])).toBe(0);
  });

  it('takes the middle value of an odd sample', () => {
    expect(medianDuration([30, 10, 20])).toBe(20);
  });

  it('averages the middle pair of an even sample', () => {
    expect(medianDuration([10, 20, 30, 41])).toBe(25);
  });
});

describe('workflow timing comparison', () => {
  it('withholds a percentage until both modes clear the minimum sample', () => {
    const result = compareWorkflowTiming('draft_contract_review', [
      run('manual', 600_000),
      run('manual', 620_000),
      run('assisted', 200_000),
    ]);

    expect(result.comparable).toBe(false);
    expect(result.reductionPercent).toBeNull();
    expect(result.savedMsPerRun).toBeNull();
    expect(result.evidenceNote).toContain(String(MINIMUM_COMPARABLE_RUNS));
  });

  it('still reports the medians and sample sizes while not yet comparable', () => {
    const result = compareWorkflowTiming('draft_contract_review', [
      run('manual', 600_000),
      run('assisted', 200_000),
    ]);

    expect(result.manualRuns).toBe(1);
    expect(result.assistedRuns).toBe(1);
    expect(result.manualMedianMs).toBe(600_000);
    expect(result.assistedMedianMs).toBe(200_000);
  });

  it('computes the reduction once both modes have enough runs', () => {
    const result = compareWorkflowTiming('draft_contract_review', [
      run('manual', 600_000),
      run('manual', 620_000),
      run('manual', 580_000),
      run('assisted', 200_000),
      run('assisted', 210_000),
      run('assisted', 190_000),
    ]);

    expect(result.comparable).toBe(true);
    expect(result.manualMedianMs).toBe(600_000);
    expect(result.assistedMedianMs).toBe(200_000);
    expect(result.reductionPercent).toBe(66.7);
    expect(result.savedMsPerRun).toBe(400_000);
    expect(result.evidenceNote).toContain('3 manual and 3 assisted');
  });

  it('reports a negative reduction when the assisted path is slower', () => {
    const result = compareWorkflowTiming('draft_contract_review', [
      run('manual', 100_000),
      run('manual', 100_000),
      run('manual', 100_000),
      run('assisted', 150_000),
      run('assisted', 150_000),
      run('assisted', 150_000),
    ]);

    expect(result.reductionPercent).toBe(-50);
  });

  it('ignores runs recorded against a different scenario', () => {
    const result = compareWorkflowTiming('draft_contract_review', [
      run('manual', 600_000),
      run('manual', 600_000),
      run('manual', 600_000),
      run('assisted', 300_000),
      run('assisted', 300_000),
      run('assisted', 300_000),
      {
        scenario: 'supplier_onboarding',
        mode: 'assisted',
        durationMs: 1_000,
      },
    ]);

    expect(result.assistedRuns).toBe(3);
    expect(result.assistedMedianMs).toBe(300_000);
  });

  it('summarises every scenario, including ones with no runs', () => {
    const summary = summariseWorkflowTiming([run('manual', 60_000)]);

    expect(summary).toHaveLength(5);
    const empty = summary.find((s) => s.scenario === 'supplier_onboarding');
    expect(empty?.manualRuns).toBe(0);
    expect(empty?.reductionPercent).toBeNull();
  });
});

describe('recordable duration guard', () => {
  it('rejects a run shorter than a second', () => {
    expect(() => assertRecordableDuration(400)).toThrow(/at least one second/);
  });

  it('rejects a stopwatch left running', () => {
    expect(() => assertRecordableDuration(MAX_TIMED_RUN_MS + 1)).toThrow(
      /longer than one hour/,
    );
  });

  it('rounds an accepted duration to whole milliseconds', () => {
    expect(assertRecordableDuration(65_432.7)).toBe(65_433);
  });
});

describe('input guards and formatting', () => {
  it('recognises only the defined scenarios and modes', () => {
    expect(isWorkflowTimingScenario('draft_contract_review')).toBe(true);
    expect(isWorkflowTimingScenario('anything_else')).toBe(false);
    expect(isWorkflowTimingMode('assisted')).toBe(true);
    expect(isWorkflowTimingMode('auto')).toBe(false);
  });

  it('formats durations for the evidence panel', () => {
    expect(formatDuration(0)).toBe('—');
    expect(formatDuration(48_000)).toBe('48s');
    expect(formatDuration(252_000)).toBe('4m 12s');
  });
});
