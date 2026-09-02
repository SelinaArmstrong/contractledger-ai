export const DEFINITION_OF_DONE_VERSION = 'dod-2026.1';

export const DEFINITION_OF_DONE_CRITERIA = [
  { id: 'user-story', label: 'A clear contract-operations user story exists.' },
  { id: 'happy-and-failure-paths', label: 'The happy path and at least two failure paths are implemented.' },
  { id: 'interaction-states', label: 'Loading, empty, validation, error, and success states are usable.' },
  { id: 'server-validation', label: 'Server-side validation enforces the same rules as the interface.' },
  { id: 'transactional-writes', label: 'Material writes are transactional where partial state would be unsafe.' },
  { id: 'auditability', label: 'Actor, timestamp, source, and before/after values are auditable.' },
  { id: 'migration-strategy', label: 'D1 schema changes include a reviewed migration and existing-data strategy.' },
  { id: 'r2-consistency', label: 'R2 files are deleted or retained consistently when database writes fail.' },
  { id: 'unit-tests', label: 'Deterministic business logic has unit tests.' },
  { id: 'api-tests', label: 'API authorization and invalid-input paths have tests.' },
  { id: 'fictional-fixture', label: 'A fictional demo fixture exercises the workflow.' },
  { id: 'data-model-consumers', label: 'Export and assistant behavior are updated when the official data model changes.' },
  { id: 'accessibility', label: 'Accessibility and keyboard behavior are checked for the new interaction.' },
  { id: 'quality-gate', label: 'Test, lint, type check, and production build pass.' },
  { id: 'documentation', label: 'README, demo script, roadmap status, and limitations are updated.' },
  { id: 'metric', label: 'At least one useful metric is captured without overstating results.' },
];

const PATH_EVIDENCE_KINDS = new Set([
  'documentation',
  'file',
  'fixture',
  'migration',
  'test',
]);
const VALID_EVIDENCE_KINDS = new Set([...PATH_EVIDENCE_KINDS, 'command', 'metric']);
const VALID_STATUSES = new Set(['complete', 'not_applicable', 'pending']);
const REQUIRED_QUALITY_COMMANDS = ['npm test', 'npm run lint', 'npx tsc --noEmit', 'npm run build'];
const REQUIRED_DOCUMENTS = ['README.md', 'DEMO_RUNBOOK.md', 'ROADMAP.md'];

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function evidencePath(reference) {
  return reference.split('#', 1)[0].split(':', 1)[0];
}

export function summarizeDefinitionOfDone(manifest) {
  const criteria = Array.isArray(manifest?.criteria) ? manifest.criteria : [];
  const counts = { complete: 0, notApplicable: 0, pending: 0 };

  for (const criterion of criteria) {
    if (criterion?.status === 'complete') counts.complete += 1;
    if (criterion?.status === 'not_applicable') counts.notApplicable += 1;
    if (criterion?.status === 'pending') counts.pending += 1;
  }

  return {
    ...counts,
    accountedFor: counts.complete + counts.notApplicable,
    total: DEFINITION_OF_DONE_CRITERIA.length,
  };
}

export function validateDefinitionOfDone(manifest, options = {}) {
  const errors = [];
  const pathExists = options.pathExists ?? (() => true);

  if (!isRecord(manifest)) {
    return ['Manifest must be a JSON object.'];
  }

  if (manifest.schemaVersion !== DEFINITION_OF_DONE_VERSION) {
    errors.push(`schemaVersion must be "${DEFINITION_OF_DONE_VERSION}".`);
  }
  if (!isNonEmptyString(manifest.featureId) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(manifest.featureId)) {
    errors.push('featureId must be a lowercase kebab-case identifier.');
  }
  if (!isNonEmptyString(manifest.title)) errors.push('title is required.');
  if (!isNonEmptyString(manifest.owner)) errors.push('owner is required.');
  if (!isNonEmptyString(manifest.userStory) || manifest.userStory.trim().length < 30) {
    errors.push('userStory must describe the contract-operations value in at least 30 characters.');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(manifest.updatedAt ?? '')) {
    errors.push('updatedAt must use YYYY-MM-DD.');
  }
  if (!['draft', 'complete'].includes(manifest.status)) {
    errors.push('status must be "draft" or "complete".');
  }
  if (!Array.isArray(manifest.criteria)) {
    errors.push('criteria must be an array.');
    return errors;
  }

  const knownIds = new Set(DEFINITION_OF_DONE_CRITERIA.map(({ id }) => id));
  const seenIds = new Set();

  for (const [index, criterion] of manifest.criteria.entries()) {
    const prefix = `criteria[${index}]`;
    if (!isRecord(criterion)) {
      errors.push(`${prefix} must be an object.`);
      continue;
    }
    if (!knownIds.has(criterion.id)) {
      errors.push(`${prefix}.id "${criterion.id ?? ''}" is not a recognized criterion.`);
      continue;
    }
    if (seenIds.has(criterion.id)) {
      errors.push(`${prefix}.id "${criterion.id}" is duplicated.`);
    }
    seenIds.add(criterion.id);

    if (!VALID_STATUSES.has(criterion.status)) {
      errors.push(`${criterion.id}: status must be complete, not_applicable, or pending.`);
      continue;
    }

    if (criterion.status === 'complete') {
      if (!Array.isArray(criterion.evidence) || criterion.evidence.length === 0) {
        errors.push(`${criterion.id}: complete criteria require evidence.`);
      } else {
        for (const [evidenceIndex, evidence] of criterion.evidence.entries()) {
          const evidencePrefix = `${criterion.id}.evidence[${evidenceIndex}]`;
          if (!isRecord(evidence) || !isNonEmptyString(evidence.kind) || !isNonEmptyString(evidence.ref)) {
            errors.push(`${evidencePrefix} requires non-empty kind and ref values.`);
            continue;
          }
          if (!VALID_EVIDENCE_KINDS.has(evidence.kind)) {
            errors.push(`${evidencePrefix}.kind "${evidence.kind}" is not recognized.`);
            continue;
          }
          if (PATH_EVIDENCE_KINDS.has(evidence.kind)) {
            const path = evidencePath(evidence.ref);
            if (!path || !pathExists(path)) errors.push(`${evidencePrefix} path does not exist: ${path || evidence.ref}`);
          }
        }
      }
    }

    if (criterion.status === 'not_applicable' && (!isNonEmptyString(criterion.rationale) || criterion.rationale.trim().length < 30)) {
      errors.push(`${criterion.id}: not_applicable requires a specific rationale of at least 30 characters.`);
    }
  }

  for (const { id } of DEFINITION_OF_DONE_CRITERIA) {
    if (!seenIds.has(id)) errors.push(`Missing criterion: ${id}.`);
  }

  const qualityCriterion = manifest.criteria.find((criterion) => criterion?.id === 'quality-gate');
  if (qualityCriterion?.status === 'complete') {
    const references = (qualityCriterion.evidence ?? []).map((item) => item?.ref);
    for (const command of REQUIRED_QUALITY_COMMANDS) {
      if (!references.includes(command)) errors.push(`quality-gate evidence must include "${command}".`);
    }
  }

  const documentationCriterion = manifest.criteria.find((criterion) => criterion?.id === 'documentation');
  if (documentationCriterion?.status === 'complete') {
    const references = (documentationCriterion.evidence ?? []).map((item) => evidencePath(item?.ref ?? ''));
    for (const document of REQUIRED_DOCUMENTS) {
      if (!references.includes(document)) errors.push(`documentation evidence must include ${document}.`);
    }
    if (!references.some((reference) => /limit/i.test(reference) || reference === 'PORTFOLIO_CASE_STUDY.md')) {
      errors.push('documentation evidence must identify where limitations were updated.');
    }
  }

  if (!isRecord(manifest.metric)) {
    errors.push('metric is required.');
  } else {
    if (!isNonEmptyString(manifest.metric.name)) errors.push('metric.name is required.');
    if (!isNonEmptyString(manifest.metric.value)) errors.push('metric.value is required and must include its unit or boundary.');
    if (!Number.isInteger(manifest.metric.sampleSize) || manifest.metric.sampleSize < 1) {
      errors.push('metric.sampleSize must be a positive integer.');
    }
    if (!isNonEmptyString(manifest.metric.source)) {
      errors.push('metric.source is required.');
    } else if (!pathExists(evidencePath(manifest.metric.source))) {
      errors.push(`metric.source path does not exist: ${evidencePath(manifest.metric.source)}`);
    }
  }

  const metricCriterion = manifest.criteria.find((criterion) => criterion?.id === 'metric');
  if (metricCriterion?.status === 'complete' && !isRecord(manifest.metric)) {
    errors.push('metric criterion cannot be complete without a metric record.');
  }

  if (manifest.status === 'complete') {
    const summary = summarizeDefinitionOfDone(manifest);
    if (summary.pending > 0) errors.push('A complete feature cannot contain pending criteria.');
    if (summary.accountedFor !== summary.total) {
      errors.push(`A complete feature must account for all ${summary.total} criteria.`);
    }
  }

  return errors;
}
