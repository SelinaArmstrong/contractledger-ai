export interface DefinitionOfDoneEvidence {
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

export interface DefinitionOfDoneCriterion {
  id: string;
  status: 'complete' | 'not_applicable' | 'pending';
  evidence?: DefinitionOfDoneEvidence[];
  rationale?: string;
}

export interface DefinitionOfDoneManifest {
  schemaVersion: string;
  featureId: string;
  title: string;
  owner: string;
  userStory: string;
  updatedAt: string;
  status: 'draft' | 'complete';
  criteria: DefinitionOfDoneCriterion[];
  metric?: {
    name: string;
    value: string;
    sampleSize: number;
    source: string;
  };
}

export const DEFINITION_OF_DONE_VERSION: string;
export const DEFINITION_OF_DONE_CRITERIA: ReadonlyArray<{
  id: string;
  label: string;
}>;
export function summarizeDefinitionOfDone(
  manifest: Partial<DefinitionOfDoneManifest>,
): {
  complete: number;
  notApplicable: number;
  pending: number;
  accountedFor: number;
  total: number;
};
export function validateDefinitionOfDone(
  manifest: unknown,
  options?: { pathExists?: (path: string) => boolean },
): string[];
