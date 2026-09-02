import { describe, expect, it } from 'vitest';

import { AI_EVALUATION_DATASET_VERSION } from '@/lib/ai-evaluation';
import {
  DEMO_EVALUATION_MODEL,
  DEMO_EVALUATION_RUN_ID,
  buildDemoEvaluationRun,
} from '@/lib/ai-evaluation-demo-run';

describe('seeded demonstration evaluation run', () => {
  it('covers every fixture in the locked dataset', () => {
    const run = buildDemoEvaluationRun();

    expect(run.caseCount).toBe(15);
    expect(run.datasetVersion).toBe(AI_EVALUATION_DATASET_VERSION);
    expect(run.totalFields).toBe(113);
  });

  it('produces the same report on every build so resets stay identical', () => {
    const first = buildDemoEvaluationRun();
    const second = buildDemoEvaluationRun();

    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });

  it('labels itself as seeded rather than as a model measurement', () => {
    const run = buildDemoEvaluationRun();

    expect(run.model).toBe(DEMO_EVALUATION_MODEL);
    expect(DEMO_EVALUATION_MODEL).toMatch(/^seeded-demonstration/);
    expect(DEMO_EVALUATION_RUN_ID).toContain('seeded-demonstration');
  });

  it('never presents itself as an approved regression baseline', () => {
    const run = buildDemoEvaluationRun();

    expect(run.promotionStatus).toBe('baseline_required');
    expect(run.baselineRunId).toBeNull();
    expect(run.regressionDelta).toBeNull();
  });

  it('reports an imperfect result so the metrics are not a flat 100 percent', () => {
    const run = buildDemoEvaluationRun();

    expect(run.correctFields).toBeLessThan(run.totalFields);
    expect(run.accuracyPercent).toBeGreaterThan(80);
    expect(run.accuracyPercent).toBeLessThan(100);
    expect(run.criticalAccuracyPercent).toBeLessThan(100);
    expect(run.sourceCoveragePercent).toBeLessThan(100);
    expect(run.unsupportedValuePercent).toBeGreaterThan(0);
  });

  it('scores critical fields against the same ground truth as a live run', () => {
    const run = buildDemoEvaluationRun();

    expect(run.criticalFields).toBeGreaterThan(0);
    expect(run.correctCriticalFields).toBeLessThanOrEqual(run.criticalFields);
    const recomputed = Number(
      ((run.correctCriticalFields / run.criticalFields) * 100).toFixed(1),
    );
    expect(run.criticalAccuracyPercent).toBe(recomputed);
  });

  it('records a duration for every case so the median is meaningful', () => {
    const run = buildDemoEvaluationRun();

    expect(run.details).toHaveLength(15);
    for (const detail of run.details) {
      expect(detail.durationMs).toBeGreaterThan(0);
    }
    expect(run.medianDurationMs).toBeGreaterThan(0);
  });
});
