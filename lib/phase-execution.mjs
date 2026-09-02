export const PHASE_EXECUTION_VERSION = 'phase-execution-2026.1';

export const PHASE_EXECUTION_STEPS = [
  { id: 'define', label: 'Define the user story, business rules, non-goals, and acceptance criteria.' },
  { id: 'fixture-first', label: 'Create a positive fixture and at least one failure or edge case.' },
  { id: 'model', label: 'Design the smallest schema change and migration path.' },
  { id: 'business-logic', label: 'Implement deterministic calculations and state transitions outside the UI.' },
  { id: 'api', label: 'Add validation, authorization, transaction, storage-cleanup, and audit controls.' },
  { id: 'interface', label: 'Add the smallest complete workflow and clear review states.' },
  { id: 'test', label: 'Cover logic, state, invalid input, authorization, rollback, and regression paths.' },
  { id: 'measure', label: 'Save a bounded phase metric and sample size.' },
  { id: 'demonstrate', label: 'Add the feature to the resettable fictional demo.' },
  { id: 'document', label: 'Update product, demo, roadmap, limitation, and resume documentation.' },
];

const PATH_EVIDENCE_KINDS = new Set(['documentation', 'file', 'fixture', 'migration', 'test']);
const VALID_EVIDENCE_KINDS = new Set([...PATH_EVIDENCE_KINDS, 'command', 'metric']);
const VALID_STEP_STATUSES = new Set(['pending', 'in_progress', 'complete', 'not_applicable']);
const REQUIRED_DEFINE_FIELDS = ['userStory', 'businessRules', 'nonGoals', 'acceptanceCriteria'];

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function evidencePath(reference) {
  return reference.split('#', 1)[0].split(':', 1)[0];
}

function validateEvidence(step, prefix, pathExists, errors) {
  if (!Array.isArray(step.evidence) || step.evidence.length === 0) {
    errors.push(`${prefix}: complete steps require evidence.`);
    return;
  }

  for (const [evidenceIndex, evidence] of step.evidence.entries()) {
    const evidencePrefix = `${prefix}.evidence[${evidenceIndex}]`;
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

export function summarizePhaseExecution(manifest) {
  const steps = Array.isArray(manifest?.steps) ? manifest.steps : [];
  const counts = { complete: 0, notApplicable: 0, inProgress: 0, pending: 0 };

  for (const step of steps) {
    if (step?.status === 'complete') counts.complete += 1;
    if (step?.status === 'not_applicable') counts.notApplicable += 1;
    if (step?.status === 'in_progress') counts.inProgress += 1;
    if (step?.status === 'pending') counts.pending += 1;
  }

  return {
    ...counts,
    finished: counts.complete + counts.notApplicable,
    total: PHASE_EXECUTION_STEPS.length,
  };
}

export function validatePhaseExecution(manifest, options = {}) {
  const errors = [];
  const pathExists = options.pathExists ?? (() => true);

  if (!isRecord(manifest)) return ['Phase manifest must be a JSON object.'];

  if (manifest.schemaVersion !== PHASE_EXECUTION_VERSION) {
    errors.push(`schemaVersion must be "${PHASE_EXECUTION_VERSION}".`);
  }
  if (!isNonEmptyString(manifest.phaseId) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(manifest.phaseId)) {
    errors.push('phaseId must be a lowercase kebab-case identifier.');
  }
  if (!isNonEmptyString(manifest.title)) errors.push('title is required.');
  if (!isNonEmptyString(manifest.owner)) errors.push('owner is required.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(manifest.updatedAt ?? '')) {
    errors.push('updatedAt must use YYYY-MM-DD.');
  }
  if (!['draft', 'active', 'complete'].includes(manifest.status)) {
    errors.push('status must be "draft", "active", or "complete".');
  }

  for (const field of REQUIRED_DEFINE_FIELDS) {
    const value = manifest[field];
    if (field === 'userStory') {
      if (!isNonEmptyString(value) || value.trim().length < 30) {
        errors.push('userStory must describe the contract-operations value in at least 30 characters.');
      }
    } else if (!Array.isArray(value) || value.length === 0 || value.some((item) => !isNonEmptyString(item))) {
      errors.push(`${field} must contain at least one non-empty item.`);
    }
  }

  if (!isRecord(manifest.startGate)) {
    errors.push('startGate is required.');
  } else {
    const previous = manifest.startGate.previousPhase;
    if (previous !== null) {
      if (!isRecord(previous) || !isNonEmptyString(previous.phaseId)) {
        errors.push('startGate.previousPhase must be null or identify a phase.');
      } else {
        if (manifest.status !== 'draft' && previous.status !== 'complete') {
          errors.push('The previous phase must be complete before this phase can start.');
        }
        if (!isNonEmptyString(previous.evidence) || !pathExists(evidencePath(previous.evidence ?? ''))) {
          errors.push('startGate.previousPhase must reference existing completion evidence.');
        }
      }
    }

    for (const field of ['unresolvedDataIntegrityDefects', 'unresolvedAuditTrailDefects']) {
      if (!Array.isArray(manifest.startGate[field])) {
        errors.push(`startGate.${field} must be an array.`);
      } else if (manifest.status !== 'draft' && manifest.startGate[field].length > 0) {
        errors.push(`A phase cannot be ${manifest.status} with open ${field}.`);
      }
    }
  }

  if (!Array.isArray(manifest.steps)) {
    errors.push('steps must be an array.');
    return errors;
  }
  if (manifest.steps.length !== PHASE_EXECUTION_STEPS.length) {
    errors.push(`steps must contain all ${PHASE_EXECUTION_STEPS.length} execution steps in order.`);
  }

  let unfinishedStep = null;
  for (const [index, expectedStep] of PHASE_EXECUTION_STEPS.entries()) {
    const step = manifest.steps[index];
    if (!isRecord(step)) {
      errors.push(`steps[${index}] must be the "${expectedStep.id}" step.`);
      unfinishedStep ??= expectedStep.id;
      continue;
    }
    if (step.id !== expectedStep.id) {
      errors.push(`steps[${index}].id must be "${expectedStep.id}".`);
    }
    if (!VALID_STEP_STATUSES.has(step.status)) {
      errors.push(`${expectedStep.id}: status must be pending, in_progress, complete, or not_applicable.`);
      unfinishedStep ??= expectedStep.id;
      continue;
    }

    const terminal = step.status === 'complete' || step.status === 'not_applicable';
    if (unfinishedStep && terminal) {
      errors.push(`${expectedStep.id}: cannot finish before the earlier "${unfinishedStep}" step.`);
    }
    if (!terminal) unfinishedStep ??= expectedStep.id;

    if (step.status === 'complete') validateEvidence(step, expectedStep.id, pathExists, errors);
    if (
      step.status === 'not_applicable' &&
      (!isNonEmptyString(step.rationale) || step.rationale.trim().length < 30)
    ) {
      errors.push(`${expectedStep.id}: not_applicable requires a specific rationale of at least 30 characters.`);
    }
  }

  const summary = summarizePhaseExecution(manifest);
  if (summary.inProgress > 1) errors.push('Only one execution step can be in progress at a time.');
  if (manifest.status === 'complete' && summary.finished !== summary.total) {
    errors.push('A complete phase must finish or explicitly mark not applicable all 10 execution steps.');
  }
  if (manifest.status === 'draft' && (summary.inProgress > 0 || summary.complete > 0 || summary.notApplicable > 0)) {
    errors.push('A draft phase cannot start execution steps.');
  }

  if (!isRecord(manifest.metric)) {
    errors.push('metric is required.');
  } else {
    if (!isNonEmptyString(manifest.metric.name)) errors.push('metric.name is required.');
    if (!isNonEmptyString(manifest.metric.value)) errors.push('metric.value is required.');
    if (!Number.isInteger(manifest.metric.sampleSize) || manifest.metric.sampleSize < 1) {
      errors.push('metric.sampleSize must be a positive integer.');
    }
    if (!isNonEmptyString(manifest.metric.source)) {
      errors.push('metric.source is required.');
    } else if (!pathExists(evidencePath(manifest.metric.source))) {
      errors.push(`metric.source path does not exist: ${evidencePath(manifest.metric.source)}`);
    }
  }

  return errors;
}
