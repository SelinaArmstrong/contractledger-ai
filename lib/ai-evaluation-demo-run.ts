import {
  AI_EXTRACTION_VERSION,
  evaluationCaseGroundTruth,
  evaluateAIResults,
  type EvaluationCaseInput,
} from '@/lib/ai-evaluation';

/**
 * Identifies the seeded run everywhere it is stored or rendered. Nothing in
 * this module is a measurement of a live model: the "extractions" below are
 * replayed from the fixture ground truth with a fixed, deterministic set of
 * defects so the validation report has something to render before anyone
 * spends an API key.
 */
export const DEMO_EVALUATION_MODEL = 'seeded-demonstration (no model call)';
export const DEMO_EVALUATION_PROMPT_VERSION = 'seeded-demonstration-2026.09';
export const DEMO_EVALUATION_RUN_ID = 'aieval-seeded-demonstration-baseline';

/**
 * Field positions (counted across the whole dataset, in definition order) that
 * the replay deliberately gets wrong or leaves unsupported. Fixed indexes keep
 * the seeded report byte-identical between resets, which the release baseline
 * check depends on.
 */
const WRONG_FIELD_POSITIONS = new Set([3, 17, 34, 58, 76, 91, 103, 110]);
const UNSUPPORTED_FIELD_POSITIONS = new Set([8, 22, 41, 49, 63, 84, 99, 107]);
const MISSING_FIELD_POSITIONS = new Set([12, 71, 88]);

/** Deterministic per-case durations so the median never moves between resets. */
const DURATION_BASE_MS = 4_200;
const DURATION_STEP_MS = 260;

function wrongValueFor(expected: string | number | null) {
  if (expected === null) return 'Not stated in document';
  if (typeof expected === 'number')
    return Number((expected * 0.9).toFixed(2)) + 1;
  return `${String(expected).slice(0, 12)} (unconfirmed)`;
}

/**
 * Rebuilds the analysis payload for one case from its ground truth, injecting
 * the scripted defects. The result is fed through the same
 * `evaluateAIResults` scorer the live route uses, so the published metrics are
 * computed rather than hand-written.
 */
function replayedCases(): EvaluationCaseInput[] {
  let position = 0;
  return evaluationCaseGroundTruth().map((definition, caseIndex) => {
    const analysis: Record<string, unknown> = {};

    for (const field of definition.fields) {
      const index = position;
      position += 1;
      if (MISSING_FIELD_POSITIONS.has(index)) {
        analysis[field.fieldName] = {
          value: null,
          confidence: 0.31,
          sourcePage: null,
          sourceQuote: null,
        };
        continue;
      }
      const wrong = WRONG_FIELD_POSITIONS.has(index);
      const unsupported = UNSUPPORTED_FIELD_POSITIONS.has(index);
      analysis[field.fieldName] = {
        value: wrong ? wrongValueFor(field.expected) : field.expected,
        confidence: wrong ? 0.54 : unsupported ? 0.68 : 0.93,
        sourcePage: unsupported ? null : 1 + (index % 9),
        sourceQuote: unsupported
          ? null
          : `Replayed fixture excerpt for ${field.label}.`,
      };
    }

    return {
      caseId: definition.id,
      model: DEMO_EVALUATION_MODEL,
      promptVersion: DEMO_EVALUATION_PROMPT_VERSION,
      extractionVersion: AI_EXTRACTION_VERSION,
      analysis,
      status: 'success',
      durationMs: DURATION_BASE_MS + caseIndex * DURATION_STEP_MS,
      failureReason: null,
    };
  });
}

/**
 * The seeded validation report. Deterministic, so two consecutive resets
 * produce identical evidence.
 */
export function buildDemoEvaluationRun() {
  return evaluateAIResults(replayedCases(), null);
}
