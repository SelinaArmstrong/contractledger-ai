export interface PhaseEvidence {
  kind:
    | 'command'
    | 'documentation'
    | 'file'
    | 'fixture'
    | 'metric'
    | 'migration'
    | 'test';
  ref: string;
}

export interface PhaseExecutionStep {
  id: string;
  status: 'pending' | 'in_progress' | 'complete' | 'not_applicable';
  evidence?: PhaseEvidence[];
  rationale?: string;
}

export interface PhaseExecutionManifest {
  schemaVersion: string;
  phaseId: string;
  title: string;
  owner: string;
  updatedAt: string;
  status: 'draft' | 'active' | 'complete';
  userStory: string;
  businessRules: string[];
  nonGoals: string[];
  acceptanceCriteria: string[];
  startGate: {
    previousPhase: null | { phaseId: string; status: string; evidence: string };
    unresolvedDataIntegrityDefects: string[];
    unresolvedAuditTrailDefects: string[];
  };
  steps: PhaseExecutionStep[];
  metric?: { name: string; value: string; sampleSize: number; source: string };
}

export const PHASE_EXECUTION_VERSION: string;
export const PHASE_EXECUTION_STEPS: ReadonlyArray<{
  id: string;
  label: string;
}>;
export function summarizePhaseExecution(
  manifest: Partial<PhaseExecutionManifest>,
): {
  complete: number;
  notApplicable: number;
  inProgress: number;
  pending: number;
  finished: number;
  total: number;
};
export function validatePhaseExecution(
  manifest: unknown,
  options?: { pathExists?: (path: string) => boolean },
): string[];
