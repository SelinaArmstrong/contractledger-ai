import { normalizeSupplierName } from '@/lib/supplier-qualification';

type EvaluatedField = {
  value?: string | number | null;
  confidence?: number;
  sourcePage?: number | null;
  sourceQuote?: string | null;
};

export type EvaluationCaseInput = {
  caseId: string;
  model: string;
  analysis: Record<string, unknown>;
};

type ExpectedField = {
  fieldName: string;
  label: string;
  expected: string | number;
  matches: (value: unknown) => boolean;
};

const primitiveText = (value: unknown) =>
  typeof value === 'string' || typeof value === 'number'
    ? String(value)
    : '';

const normalized = (value: unknown) =>
  primitiveText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const exact = (expected: string | number) => (value: unknown) =>
  typeof expected === 'number'
    ? Math.abs(Number(value) - expected) < 0.01
    : normalized(value) === normalized(expected);

const includes = (...expectedParts: string[]) => (value: unknown) => {
  const actual = normalized(value);
  return expectedParts.every((part) => actual.includes(normalized(part)));
};

const supplierName = (expected: string) => (value: unknown) =>
  normalizeSupplierName(primitiveText(value)) === normalizeSupplierName(expected);

const caseDefinitions: Record<
  string,
  { title: string; fields: ExpectedField[] }
> = {
  'contract-draft': {
    title: 'Draft professional services agreement',
    fields: [
      {
        fieldName: 'supplierLegalName',
        label: 'Supplier legal name',
        expected: 'Westline Engineering Group LLC',
        matches: supplierName('Westline Engineering Group LLC'),
      },
      {
        fieldName: 'contractType',
        label: 'Contract type',
        expected: 'Professional Services Agreement',
        matches: includes('professional services agreement'),
      },
      {
        fieldName: 'contractNumber',
        label: 'Draft reference',
        expected: 'DRAFT-PSA-2026-118',
        matches: exact('DRAFT-PSA-2026-118'),
      },
      {
        fieldName: 'contractValue',
        label: 'Proposed value',
        expected: 585000,
        matches: exact(585000),
      },
      {
        fieldName: 'effectiveDate',
        label: 'Effective date',
        expected: '2026-10-01',
        matches: exact('2026-10-01'),
      },
      {
        fieldName: 'expirationDate',
        label: 'Expiration date',
        expected: '2027-09-30',
        matches: exact('2027-09-30'),
      },
      {
        fieldName: 'renewalType',
        label: 'Renewal type',
        expected: 'automatic',
        matches: exact('automatic'),
      },
      {
        fieldName: 'noticeDays',
        label: 'Notice period',
        expected: 45,
        matches: exact(45),
      },
      {
        fieldName: 'governingLaw',
        label: 'Governing law',
        expected: 'New York',
        matches: includes('new york'),
      },
      {
        fieldName: 'paymentTerms',
        label: 'Payment terms',
        expected: 'Net 60',
        matches: (value) =>
          includes('net 60')(value) || includes('60 days')(value),
      },
    ],
  },
  'contract-executed': {
    title: 'Executed professional services agreement',
    fields: [
      {
        fieldName: 'supplierLegalName',
        label: 'Supplier legal name',
        expected: 'Westline Engineering Group LLC',
        matches: supplierName('Westline Engineering Group LLC'),
      },
      {
        fieldName: 'contractType',
        label: 'Contract type',
        expected: 'Professional Services Agreement',
        matches: includes('professional services agreement'),
      },
      {
        fieldName: 'contractNumber',
        label: 'Contract number',
        expected: 'PSA-2026-118',
        matches: exact('PSA-2026-118'),
      },
      {
        fieldName: 'contractValue',
        label: 'Executed value',
        expected: 475000,
        matches: exact(475000),
      },
      {
        fieldName: 'effectiveDate',
        label: 'Effective date',
        expected: '2026-10-15',
        matches: exact('2026-10-15'),
      },
      {
        fieldName: 'expirationDate',
        label: 'Expiration date',
        expected: '2027-10-14',
        matches: exact('2027-10-14'),
      },
      {
        fieldName: 'renewalType',
        label: 'Renewal type',
        expected: 'automatic',
        matches: exact('automatic'),
      },
      {
        fieldName: 'noticeDays',
        label: 'Notice period',
        expected: 60,
        matches: exact(60),
      },
      {
        fieldName: 'governingLaw',
        label: 'Governing law',
        expected: 'California',
        matches: includes('california'),
      },
      {
        fieldName: 'paymentTerms',
        label: 'Payment terms',
        expected: 'Net 30',
        matches: (value) =>
          includes('net 30')(value) || includes('30 days')(value),
      },
    ],
  },
  'supplier-coi': {
    title: 'Supplier certificate of insurance',
    fields: [
      {
        fieldName: 'supplierLegalName',
        label: 'Named insured',
        expected: 'Harbor Technology Solutions Inc.',
        matches: supplierName('Harbor Technology Solutions Inc.'),
      },
      {
        fieldName: 'documentType',
        label: 'Document type',
        expected: 'insurance_certificate',
        matches: exact('insurance_certificate'),
      },
      {
        fieldName: 'issuer',
        label: 'Producer / issuer',
        expected: 'Bayview Risk Services',
        matches: includes('bayview risk services'),
      },
      {
        fieldName: 'effectiveDate',
        label: 'Effective date',
        expected: '2026-02-01',
        matches: exact('2026-02-01'),
      },
      {
        fieldName: 'expirationDate',
        label: 'Expiration date',
        expected: '2027-01-31',
        matches: exact('2027-01-31'),
      },
      {
        fieldName: 'coverageSummary',
        label: 'Coverage limits',
        expected: 'CGL, Technology E&O and Cyber Liability at $2,000,000',
        matches: (value) => {
          const actual = normalized(value);
          return (
            actual.includes('2 000 000') &&
            (actual.includes('general liability') || actual.includes('cgl')) &&
            actual.includes('cyber')
          );
        },
      },
    ],
  },
};

export const AI_EVALUATION_CASES = [
  {
    id: 'contract-draft',
    title: 'Draft contract extraction',
    fileName: '01_Draft_Professional_Services_Agreement.pdf',
  },
  {
    id: 'contract-executed',
    title: 'Executed contract extraction',
    fileName: '02_Executed_Professional_Services_Agreement.pdf',
  },
  {
    id: 'supplier-coi',
    title: 'Supplier insurance extraction',
    fileName: '05_Harbor_Technology_Demo_Insurance_Certificate.pdf',
  },
] as const;

export function evaluateAIResults(cases: EvaluationCaseInput[]) {
  const details = cases.map((evaluationCase) => {
    const definition = caseDefinitions[evaluationCase.caseId];
    if (!definition) throw new Error('Unknown AI evaluation case.');
    const fields = definition.fields.map((expectedField) => {
      const candidate = evaluationCase.analysis[expectedField.fieldName];
      const actualField =
        candidate && typeof candidate === 'object' && !Array.isArray(candidate)
          ? (candidate as EvaluatedField)
          : {};
      const actual = actualField.value ?? null;
      return {
        fieldName: expectedField.fieldName,
        label: expectedField.label,
        expected: expectedField.expected,
        actual,
        correct: expectedField.matches(actual),
        confidence: Number(actualField.confidence ?? 0),
        sourceBacked: Boolean(
          actualField.sourcePage && actualField.sourceQuote?.trim(),
        ),
      };
    });
    const correctFields = fields.filter((field) => field.correct).length;
    return {
      caseId: evaluationCase.caseId,
      title: definition.title,
      model: evaluationCase.model,
      totalFields: fields.length,
      correctFields,
      accuracyPercent: Number(
        ((correctFields / fields.length) * 100).toFixed(1),
      ),
      fields,
    };
  });
  const allFields = details.flatMap((detail) => detail.fields);
  const correctFields = allFields.filter((field) => field.correct).length;
  const sourceBackedFields = allFields.filter(
    (field) => field.sourceBacked,
  ).length;
  const averageConfidence =
    allFields.reduce((sum, field) => sum + field.confidence, 0) /
    allFields.length;
  return {
    model: [...new Set(cases.map((item) => item.model))].join(' + '),
    caseCount: details.length,
    totalFields: allFields.length,
    correctFields,
    sourceBackedFields,
    accuracyPercent: Number(
      ((correctFields / allFields.length) * 100).toFixed(1),
    ),
    sourceCoveragePercent: Number(
      ((sourceBackedFields / allFields.length) * 100).toFixed(1),
    ),
    averageConfidence: Number((averageConfidence * 100).toFixed(1)),
    details,
  };
}
