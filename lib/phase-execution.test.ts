import { describe, expect, it } from 'vitest';

import {
  PHASE_EXECUTION_STEPS,
  summarizePhaseExecution,
  validatePhaseExecution,
  type PhaseExecutionManifest,
} from './phase-execution.mjs';

const existingPaths = new Set([
  'ROADMAP.md',
  'README.md',
  'lib/phase-execution.test.ts',
]);
const pathExists = (path: string) => existingPaths.has(path);

function validManifest(): PhaseExecutionManifest {
  return {
    schemaVersion: 'phase-execution-2026.1',
    phaseId: 'approval-workflow',
    title: 'Approval workflow',
    owner: 'Contract operations',
    updatedAt: '2026-09-02',
    status: 'complete',
    userStory:
      'As a contract administrator, I can route material exceptions to an accountable reviewer.',
    businessRules: ['Mandatory approvals block executed registration.'],
    nonGoals: ['This phase does not send external approval email.'],
    acceptanceCriteria: [
      'Every mandatory decision has an actor, reason, and timestamp.',
    ],
    startGate: {
      previousPhase: {
        phaseId: 'amendment-lifecycle',
        status: 'complete',
        evidence: 'ROADMAP.md',
      },
      unresolvedDataIntegrityDefects: [],
      unresolvedAuditTrailDefects: [],
    },
    steps: PHASE_EXECUTION_STEPS.map(({ id }) => ({
      id,
      status: 'complete',
      evidence: [{ kind: 'file', ref: 'README.md' }],
    })),
    metric: {
      name: 'Execution steps accounted for',
      value: '10 of 10',
      sampleSize: 10,
      source: 'ROADMAP.md',
    },
  };
}

describe('phase execution loop gate', () => {
  it('accepts a complete, ordered phase with a clear start gate', () => {
    const manifest = validManifest();

    expect(validatePhaseExecution(manifest, { pathExists })).toEqual([]);
    expect(summarizePhaseExecution(manifest)).toEqual({
      complete: 10,
      notApplicable: 0,
      inProgress: 0,
      pending: 0,
      finished: 10,
      total: 10,
    });
  });

  it('requires all ten steps in the roadmap order', () => {
    const manifest = validManifest();
    [manifest.steps[0], manifest.steps[1]] = [
      manifest.steps[1],
      manifest.steps[0],
    ];

    const errors = validatePhaseExecution(manifest, { pathExists });
    expect(errors).toContain('steps[0].id must be "define".');
    expect(errors).toContain('steps[1].id must be "fixture-first".');
  });

  it('blocks a later step from finishing before an earlier step', () => {
    const manifest = validManifest();
    manifest.status = 'active';
    manifest.steps[2] = { id: 'model', status: 'pending' };

    expect(validatePhaseExecution(manifest, { pathExists })).toContain(
      'business-logic: cannot finish before the earlier "model" step.',
    );
  });

  it('blocks a new phase when the previous phase is not complete', () => {
    const manifest = validManifest();
    manifest.startGate.previousPhase!.status = 'active';

    expect(validatePhaseExecution(manifest, { pathExists })).toContain(
      'The previous phase must be complete before this phase can start.',
    );
  });

  it('blocks active work while data-integrity or audit defects remain open', () => {
    const manifest = validManifest();
    manifest.status = 'active';
    manifest.startGate.unresolvedDataIntegrityDefects = [
      'Current version uniqueness is unresolved.',
    ];
    manifest.startGate.unresolvedAuditTrailDefects = [
      'Decision actor is absent.',
    ];

    const errors = validatePhaseExecution(manifest, { pathExists });
    expect(errors).toContain(
      'A phase cannot be active with open unresolvedDataIntegrityDefects.',
    );
    expect(errors).toContain(
      'A phase cannot be active with open unresolvedAuditTrailDefects.',
    );
  });

  it('requires evidence for completed steps and a rationale for exclusions', () => {
    const manifest = validManifest();
    manifest.steps[2] = { id: 'model', status: 'complete' };
    manifest.steps[4] = {
      id: 'api',
      status: 'not_applicable',
      rationale: 'No API.',
    };

    const errors = validatePhaseExecution(manifest, { pathExists });
    expect(errors).toContain('model: complete steps require evidence.');
    expect(errors).toContain(
      'api: not_applicable requires a specific rationale of at least 30 characters.',
    );
  });

  it('rejects missing evidence paths and unsupported evidence kinds', () => {
    const manifest = validManifest();
    manifest.steps[0].evidence = [
      { kind: 'file', ref: '../outside.md' },
      { kind: 'unsupported' as 'file', ref: 'README.md' },
    ];

    const errors = validatePhaseExecution(manifest, { pathExists });
    expect(errors).toContain(
      'define.evidence[0] path does not exist: ../outside.md',
    );
    expect(errors).toContain(
      'define.evidence[1].kind "unsupported" is not recognized.',
    );
  });

  it('requires one bounded metric with an existing source', () => {
    const manifest = validManifest();
    manifest.metric = {
      name: '',
      value: '',
      sampleSize: 0,
      source: 'missing.json',
    };

    const errors = validatePhaseExecution(manifest, { pathExists });
    expect(errors).toContain('metric.name is required.');
    expect(errors).toContain('metric.value is required.');
    expect(errors).toContain('metric.sampleSize must be a positive integer.');
    expect(errors).toContain('metric.source path does not exist: missing.json');
  });

  it('keeps draft phases entirely unstarted', () => {
    const manifest = validManifest();
    manifest.status = 'draft';
    manifest.startGate.previousPhase!.status = 'active';
    manifest.startGate.unresolvedDataIntegrityDefects = [
      'May be recorded while planning.',
    ];
    manifest.startGate.unresolvedAuditTrailDefects = [
      'May be recorded while planning.',
    ];

    const errors = validatePhaseExecution(manifest, { pathExists });
    expect(errors).toContain('A draft phase cannot start execution steps.');
    expect(errors).not.toContain(
      'The previous phase must be complete before this phase can start.',
    );
    expect(errors.some((error) => error.includes('with open unresolved'))).toBe(
      false,
    );
  });
});
