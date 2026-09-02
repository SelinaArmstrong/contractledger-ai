import { describe, expect, it } from 'vitest';

import { AI_EVALUATION_CASES, evaluateAIResults } from '@/lib/ai-evaluation';

const field = (value: string | number, sourcePage = 1) => ({
  value,
  confidence: 0.9,
  sourcePage,
  sourceQuote: 'Supporting contract language',
});

describe('AI evaluation scoring', () => {
  it('scores a correct executed-contract extraction deterministically', () => {
    const result = evaluateAIResults([
      {
        caseId: 'contract-executed',
        model: 'test-model',
        analysis: {
          supplierLegalName: field('Westline Engineering Group LLC'),
          contractType: field('Professional Services Agreement'),
          contractNumber: field('PSA-2026-118'),
          contractValue: field(475000),
          effectiveDate: field('2026-10-15'),
          expirationDate: field('2027-10-14'),
          renewalType: field('automatic'),
          noticeDays: field(60),
          governingLaw: field('State of California'),
          paymentTerms: field('Payment is due Net 30'),
        },
      },
    ]);

    expect(result).toMatchObject({
      caseCount: 1,
      totalFields: 10,
      correctFields: 10,
      sourceBackedFields: 10,
      accuracyPercent: 100,
      sourceCoveragePercent: 100,
      averageConfidence: 90,
    });
  });

  it('does not treat a page-zero citation as source-backed', () => {
    const result = evaluateAIResults([
      {
        caseId: 'supplier-harbor-coi',
        model: 'test-model',
        analysis: {
          supplierLegalName: field('Harbor Technology Solutions Inc.', 0),
        },
      },
    ]);

    expect(result.sourceBackedFields).toBe(0);
    expect(result.correctFields).toBe(1);
  });

  it('rejects unknown benchmark cases', () => {
    expect(() =>
      evaluateAIResults([
        { caseId: 'client-supplied-case', model: 'test-model', analysis: {} },
      ]),
    ).toThrow('Unknown AI evaluation case.');
  });

  it('publishes a locked 15-document manifest with no duplicate IDs', () => {
    expect(AI_EVALUATION_CASES).toHaveLength(15);
    expect(new Set(AI_EVALUATION_CASES.map((item) => item.id)).size).toBe(15);
    expect(
      AI_EVALUATION_CASES.some((item) => item.difficulty === 'negative'),
    ).toBe(true);
  });

  it('blocks promotion when critical accuracy regresses beyond the gate', () => {
    const result = evaluateAIResults(
      [
        {
          caseId: 'negative-incomplete-note',
          model: 'candidate-model',
          promptVersion: 'candidate-prompt',
          analysis: {
            contractNumber: field('invented-contract'),
            contractValue: field(999999),
          },
        },
      ],
      { id: 'aieval-approved', criticalAccuracyPercent: 100 },
    );

    expect(result).toMatchObject({
      criticalAccuracyPercent: 66.7,
      regressionDelta: -33.3,
      promotionStatus: 'blocked',
    });
  });
});
