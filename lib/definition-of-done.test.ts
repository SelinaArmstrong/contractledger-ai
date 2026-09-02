import { describe, expect, it } from 'vitest';

import {
  DEFINITION_OF_DONE_CRITERIA,
  summarizeDefinitionOfDone,
  validateDefinitionOfDone,
  type DefinitionOfDoneManifest,
} from './definition-of-done.mjs';

function validManifest(): DefinitionOfDoneManifest {
  return {
    schemaVersion: 'dod-2026.1',
    featureId: 'approval-workflow',
    title: 'Approval workflow',
    owner: 'Contract operations',
    userStory: 'As a contract administrator, I can route material exceptions to an accountable reviewer.',
    updatedAt: '2026-09-02',
    status: 'complete',
    criteria: DEFINITION_OF_DONE_CRITERIA.map(({ id }) => ({
      id,
      status: 'complete',
      evidence:
        id === 'quality-gate'
          ? [
              { kind: 'command', ref: 'npm test' },
              { kind: 'command', ref: 'npm run lint' },
              { kind: 'command', ref: 'npx tsc --noEmit' },
              { kind: 'command', ref: 'npm run build' },
            ]
          : id === 'documentation'
            ? [
                { kind: 'documentation', ref: 'README.md' },
                { kind: 'documentation', ref: 'DEMO_RUNBOOK.md' },
                { kind: 'documentation', ref: 'ROADMAP.md' },
                { kind: 'documentation', ref: 'PORTFOLIO_CASE_STUDY.md' },
              ]
            : [{ kind: 'file', ref: 'README.md' }],
    })),
    metric: {
      name: 'Criteria accounted for',
      value: '16 of 16',
      sampleSize: 16,
      source: 'ROADMAP.md',
    },
  };
}

const pathExists = (path: string) =>
  ['README.md', 'DEMO_RUNBOOK.md', 'ROADMAP.md', 'PORTFOLIO_CASE_STUDY.md'].includes(path);

describe('Definition of Done gate', () => {
  it('accepts a complete manifest with evidence for every criterion', () => {
    expect(validateDefinitionOfDone(validManifest(), { pathExists })).toEqual([]);
    expect(summarizeDefinitionOfDone(validManifest())).toEqual({
      complete: 16,
      notApplicable: 0,
      pending: 0,
      accountedFor: 16,
      total: 16,
    });
  });

  it('blocks a complete feature when a criterion is missing', () => {
    const manifest = validManifest();
    manifest.criteria = manifest.criteria.filter(({ id }) => id !== 'api-tests');

    expect(validateDefinitionOfDone(manifest, { pathExists })).toContain('Missing criterion: api-tests.');
  });

  it('blocks pending work from being marked complete', () => {
    const manifest = validManifest();
    manifest.criteria[0] = { id: 'user-story', status: 'pending' };

    expect(validateDefinitionOfDone(manifest, { pathExists })).toContain(
      'A complete feature cannot contain pending criteria.',
    );
  });

  it('requires a specific rationale for a not-applicable criterion', () => {
    const manifest = validManifest();
    manifest.criteria[2] = { id: 'interaction-states', status: 'not_applicable', rationale: 'No UI.' };

    expect(validateDefinitionOfDone(manifest, { pathExists })).toContain(
      'interaction-states: not_applicable requires a specific rationale of at least 30 characters.',
    );
  });

  it('rejects evidence and metric sources that do not exist', () => {
    const manifest = validManifest();
    manifest.criteria[0] = {
      id: 'user-story',
      status: 'complete',
      evidence: [{ kind: 'file', ref: 'missing.md' }],
    };
    manifest.metric = { ...manifest.metric!, source: 'missing-metric.json' };

    const errors = validateDefinitionOfDone(manifest, { pathExists });
    expect(errors).toContain('user-story.evidence[0] path does not exist: missing.md');
    expect(errors).toContain('metric.source path does not exist: missing-metric.json');
  });

  it('requires all four repository quality commands', () => {
    const manifest = validManifest();
    manifest.criteria.find(({ id }) => id === 'quality-gate')!.evidence = [
      { kind: 'command', ref: 'npm test' },
    ];

    const errors = validateDefinitionOfDone(manifest, { pathExists });
    expect(errors).toContain('quality-gate evidence must include "npm run lint".');
    expect(errors).toContain('quality-gate evidence must include "npx tsc --noEmit".');
    expect(errors).toContain('quality-gate evidence must include "npm run build".');
  });

  it('rejects unknown evidence kinds and paths outside the repository', () => {
    const manifest = validManifest();
    manifest.criteria[0] = {
      id: 'user-story',
      status: 'complete',
      evidence: [
        { kind: 'unsupported' as 'file', ref: 'not-verifiable' },
        { kind: 'file', ref: '../outside.md' },
      ],
    };

    const errors = validateDefinitionOfDone(manifest, { pathExists });
    expect(errors).toContain('user-story.evidence[0].kind "unsupported" is not recognized.');
    expect(errors).toContain('user-story.evidence[1] path does not exist: ../outside.md');
  });
});
