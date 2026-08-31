import { describe, expect, it } from 'vitest';

import { evaluateAIResults } from '@/lib/ai-evaluation';

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
        caseId: 'supplier-coi',
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
});
