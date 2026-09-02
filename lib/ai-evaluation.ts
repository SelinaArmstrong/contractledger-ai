import { normalizeSupplierName } from '@/lib/supplier-qualification';

export const AI_EVALUATION_DATASET_VERSION = 'contractledger-fictional-2026.09';
export const AI_EVALUATION_FIXTURE_VERSION = '2026.09.1';
export const AI_EXTRACTION_VERSION = 'field-schema-2026.3';
export const AI_REGRESSION_THRESHOLD = -2;

type EvaluatedField = {
  value?: string | number | null;
  confidence?: number;
  sourcePage?: number | null;
  sourceQuote?: string | null;
};

export type EvaluationCaseInput = {
  caseId: string;
  model: string;
  promptVersion?: string;
  extractionVersion?: string;
  analysis?: Record<string, unknown>;
  status?: 'success' | 'failed';
  durationMs?: number;
  failureReason?: string | null;
};

type ExpectedField = {
  fieldName: string;
  label: string;
  expected: string | number | null;
  critical?: boolean;
  matches: (value: unknown) => boolean;
};

type EvaluationKind = 'contract' | 'supplier_document' | 'amendment';

type EvaluationDefinition = {
  id: string;
  title: string;
  fileName: string;
  documentType: string;
  difficulty: 'standard' | 'complex' | 'ambiguous' | 'negative';
  kind: EvaluationKind;
  stage?: 'draft' | 'executed';
  expectedDocumentType?: string;
  fixtureVersion: string;
  fields: ExpectedField[];
};

const primitiveText = (value: unknown) =>
  typeof value === 'string' || typeof value === 'number' ? String(value) : '';

const normalized = (value: unknown) =>
  primitiveText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const exact = (expected: string | number | null) => (value: unknown) => {
  if (expected === null)
    return value === null || value === undefined || value === '';
  return typeof expected === 'number'
    ? Number.isFinite(Number(value)) &&
        Math.abs(Number(value) - expected) < 0.01
    : normalized(value) === normalized(expected);
};

const includes =
  (...expectedParts: string[]) =>
  (value: unknown) => {
    const actual = normalized(value);
    return expectedParts.every((part) => actual.includes(normalized(part)));
  };

const oneOf =
  (...values: Array<string | number | null>) =>
  (value: unknown) =>
    values.some((expected) => exact(expected)(value));

const supplierName = (expected: string) => (value: unknown) =>
  normalizeSupplierName(primitiveText(value)) ===
  normalizeSupplierName(expected);

const field = (
  fieldName: string,
  label: string,
  expected: string | number | null,
  options: {
    critical?: boolean;
    matches?: (value: unknown) => boolean;
  } = {},
): ExpectedField => ({
  fieldName,
  label,
  expected,
  critical: options.critical ?? false,
  matches: options.matches ?? exact(expected),
});

const supplier = (expected: string) =>
  field('supplierLegalName', 'Supplier legal name', expected, {
    critical: true,
    matches: supplierName(expected),
  });

const documentType = (expected: string) =>
  field('documentType', 'Document type', expected, { critical: true });

const evaluationDefinitions: EvaluationDefinition[] = [
  {
    id: 'contract-draft',
    title: 'Draft professional services agreement',
    fileName: '01_Draft_Professional_Services_Agreement.pdf',
    documentType: 'Draft services agreement',
    difficulty: 'complex',
    kind: 'contract',
    stage: 'draft',
    fixtureVersion: AI_EVALUATION_FIXTURE_VERSION,
    fields: [
      supplier('Westline Engineering Group LLC'),
      field(
        'contractType',
        'Contract type',
        'Professional Services Agreement',
        {
          matches: includes('professional services agreement'),
        },
      ),
      field('contractNumber', 'Draft reference', 'DRAFT-PSA-2026-118', {
        critical: true,
      }),
      field('contractValue', 'Proposed value', 585000, { critical: true }),
      field('effectiveDate', 'Effective date', '2026-10-01', {
        critical: true,
      }),
      field('expirationDate', 'Expiration date', '2027-09-30', {
        critical: true,
      }),
      field('renewalType', 'Renewal type', 'automatic', { critical: true }),
      field('noticeDays', 'Notice period', 45, { critical: true }),
      field('governingLaw', 'Governing law', 'New York', {
        matches: includes('new york'),
      }),
      field('paymentTerms', 'Payment terms', 'Net 60', {
        matches: (value) =>
          includes('net 60')(value) || includes('60 days')(value),
      }),
    ],
  },
  {
    id: 'contract-executed',
    title: 'Executed professional services agreement',
    fileName: '02_Executed_Professional_Services_Agreement.pdf',
    documentType: 'Executed services agreement',
    difficulty: 'complex',
    kind: 'contract',
    stage: 'executed',
    fixtureVersion: AI_EVALUATION_FIXTURE_VERSION,
    fields: [
      supplier('Westline Engineering Group LLC'),
      field(
        'contractType',
        'Contract type',
        'Professional Services Agreement',
        {
          matches: includes('professional services agreement'),
        },
      ),
      field('contractNumber', 'Contract number', 'PSA-2026-118', {
        critical: true,
      }),
      field('contractValue', 'Executed value', 475000, { critical: true }),
      field('effectiveDate', 'Effective date', '2026-10-15', {
        critical: true,
      }),
      field('expirationDate', 'Expiration date', '2027-10-14', {
        critical: true,
      }),
      field('renewalType', 'Renewal type', 'automatic', { critical: true }),
      field('noticeDays', 'Notice period', 60, { critical: true }),
      field('governingLaw', 'Governing law', 'California', {
        matches: includes('california'),
      }),
      field('paymentTerms', 'Payment terms', 'Net 30', {
        matches: (value) =>
          includes('net 30')(value) || includes('30 days')(value),
      }),
    ],
  },
  {
    id: 'contract-technology-support',
    title: 'Executed technology support agreement',
    fileName: '03_Executed_Technology_Support_Services_Agreement.pdf',
    documentType: 'Executed technology agreement',
    difficulty: 'complex',
    kind: 'contract',
    stage: 'executed',
    fixtureVersion: AI_EVALUATION_FIXTURE_VERSION,
    fields: [
      supplier('Harbor Technology Solutions Inc.'),
      field(
        'contractType',
        'Contract type',
        'Technology Support Services Agreement',
        { matches: includes('technology support services agreement') },
      ),
      field('contractNumber', 'Contract number', 'CT-2025-018', {
        critical: true,
      }),
      field('contractValue', 'Contract value', 720000, { critical: true }),
      field('effectiveDate', 'Effective date', '2025-01-01', {
        critical: true,
      }),
      field('expirationDate', 'Expiration date', '2026-12-31', {
        critical: true,
      }),
      field('renewalType', 'Renewal type', 'automatic', { critical: true }),
      field('noticeDays', 'Notice period', 60, { critical: true }),
      field('governingLaw', 'Governing law', 'California', {
        matches: includes('california'),
      }),
      field('paymentTerms', 'Payment terms', 'Net 30', {
        matches: (value) =>
          includes('net 30')(value) || includes('30 days')(value),
      }),
    ],
  },
  {
    id: 'supplier-harbor-w9',
    title: 'Harbor supplier tax record',
    fileName: '04_Harbor_Technology_Demo_W9.pdf',
    documentType: 'W-9',
    difficulty: 'standard',
    kind: 'supplier_document',
    expectedDocumentType: 'w9',
    fixtureVersion: AI_EVALUATION_FIXTURE_VERSION,
    fields: [
      supplier('Harbor Technology Solutions Inc.'),
      documentType('w9'),
      field('dbaName', 'Business name', 'Harbor Technology Solutions'),
      field('taxClassification', 'Tax classification', 'C Corporation', {
        matches: includes('c corporation'),
      }),
      field('addressLine1', 'Address', '455 Market Plaza', {
        matches: includes('455 market plaza'),
      }),
      field('city', 'City', 'San Francisco'),
      field('state', 'State', 'CA', {
        matches: oneOf('CA', 'California'),
      }),
      field('postalCode', 'Postal code', '94105'),
    ],
  },
  {
    id: 'supplier-harbor-coi',
    title: 'Harbor certificate of insurance',
    fileName: '05_Harbor_Technology_Demo_Insurance_Certificate.pdf',
    documentType: 'Certificate of insurance',
    difficulty: 'complex',
    kind: 'supplier_document',
    expectedDocumentType: 'insurance_certificate',
    fixtureVersion: AI_EVALUATION_FIXTURE_VERSION,
    fields: [
      supplier('Harbor Technology Solutions Inc.'),
      documentType('insurance_certificate'),
      field('issuer', 'Producer / issuer', 'Bayview Risk Services', {
        matches: includes('bayview risk services'),
      }),
      field('effectiveDate', 'Effective date', '2026-02-01', {
        critical: true,
      }),
      field('expirationDate', 'Expiration date', '2027-01-31', {
        critical: true,
      }),
      field(
        'coverageSummary',
        'Coverage limits',
        'CGL, Technology E&O and Cyber Liability at $2,000,000',
        {
          matches: (value) =>
            includes('2 000 000')(value) &&
            (includes('general liability')(value) || includes('cgl')(value)) &&
            includes('cyber')(value),
        },
      ),
    ],
  },
  {
    id: 'supplier-harbor-license',
    title: 'Harbor business license',
    fileName: '06_Harbor_Technology_Demo_Business_License.pdf',
    documentType: 'Business license',
    difficulty: 'standard',
    kind: 'supplier_document',
    expectedDocumentType: 'business_license',
    fixtureVersion: AI_EVALUATION_FIXTURE_VERSION,
    fields: [
      supplier('Harbor Technology Solutions Inc.'),
      documentType('business_license'),
      field(
        'issuer',
        'Issuing authority',
        'City and County Business Tax Office',
        {
          matches: includes('city', 'county', 'business tax'),
        },
      ),
      field('documentNumber', 'License number', 'BL-DEMO-2026-0148', {
        critical: true,
      }),
      field('effectiveDate', 'Issue date', '2026-01-01'),
      field('expirationDate', 'Expiration date', '2026-12-31', {
        critical: true,
      }),
    ],
  },
  {
    id: 'supplier-harbor-standing',
    title: 'Harbor good-standing record',
    fileName: '07_Harbor_Technology_Demo_Good_Standing_Record.pdf',
    documentType: 'Good-standing record',
    difficulty: 'ambiguous',
    kind: 'supplier_document',
    expectedDocumentType: 'good_standing',
    fixtureVersion: AI_EVALUATION_FIXTURE_VERSION,
    fields: [
      supplier('Harbor Technology Solutions Inc.'),
      documentType('good_standing'),
      field('issuer', 'Jurisdiction', 'California', {
        matches: includes('california'),
      }),
      field('documentNumber', 'Entity number', 'C-DEMO-482019', {
        critical: true,
      }),
      field('effectiveDate', 'Verification date', '2026-01-18', {
        critical: true,
      }),
      field('coverageSummary', 'Standing', 'Active / Good Standing', {
        matches: includes('good standing'),
      }),
    ],
  },
  {
    id: 'supplier-harbor-cyber',
    title: 'Harbor cybersecurity assessment',
    fileName: '08_Harbor_Technology_Demo_Cybersecurity_Assessment.pdf',
    documentType: 'Cybersecurity assessment',
    difficulty: 'complex',
    kind: 'supplier_document',
    expectedDocumentType: 'cybersecurity_assessment',
    fixtureVersion: AI_EVALUATION_FIXTURE_VERSION,
    fields: [
      supplier('Harbor Technology Solutions Inc.'),
      documentType('cybersecurity_assessment'),
      field('issuer', 'Reviewer', 'Northstar Information Security', {
        matches: includes('northstar information security'),
      }),
      field('documentNumber', 'Assessment ID', 'SEC-DEMO-2026-1005', {
        critical: true,
      }),
      field('effectiveDate', 'Assessment date', '2026-01-19'),
      field('expirationDate', 'Next review', '2027-01-19', {
        critical: true,
      }),
      field('coverageSummary', 'Outcome', 'Approved with annual review', {
        matches: includes('approved', 'annual review'),
      }),
    ],
  },
  {
    id: 'supplier-harbor-exclusion',
    title: 'Harbor exclusion screening',
    fileName: '09_Harbor_Technology_Demo_SAM_Exclusion_Screening.pdf',
    documentType: 'Sanctions / debarment check',
    difficulty: 'ambiguous',
    kind: 'supplier_document',
    expectedDocumentType: 'sanctions_debarment_check',
    fixtureVersion: AI_EVALUATION_FIXTURE_VERSION,
    fields: [
      supplier('Harbor Technology Solutions Inc.'),
      documentType('sanctions_debarment_check'),
      field('effectiveDate', 'Search date', '2026-01-18', { critical: true }),
      field(
        'coverageSummary',
        'Exclusion result',
        'No active exclusion identified',
        {
          matches: includes('no active exclusion'),
        },
      ),
    ],
  },
  {
    id: 'supplier-westline-license',
    title: 'Westline professional license',
    fileName: '10_Westline_Engineering_Demo_Professional_License.pdf',
    documentType: 'Professional license',
    difficulty: 'standard',
    kind: 'supplier_document',
    expectedDocumentType: 'professional_license',
    fixtureVersion: AI_EVALUATION_FIXTURE_VERSION,
    fields: [
      supplier('Westline Engineering Group LLC'),
      documentType('professional_license'),
      field('issuer', 'Jurisdiction', 'California', {
        matches: includes('california'),
      }),
      field('documentNumber', 'License number', 'PEF-DEMO-28417', {
        critical: true,
      }),
      field('effectiveDate', 'Issue date', '2025-10-11'),
      field('expirationDate', 'Expiration date', '2027-10-10', {
        critical: true,
      }),
    ],
  },
  {
    id: 'supplier-canyon-w9',
    title: 'Canyon Ridge supplier tax record',
    fileName: '11_Canyon_Ridge_Demo_W9.pdf',
    documentType: 'W-9',
    difficulty: 'standard',
    kind: 'supplier_document',
    expectedDocumentType: 'w9',
    fixtureVersion: AI_EVALUATION_FIXTURE_VERSION,
    fields: [
      supplier('Canyon Ridge Data Services LLC'),
      documentType('w9'),
      field('dbaName', 'Business name', 'Canyon Ridge Data Services'),
      field('taxClassification', 'Tax classification', 'LLC - C Corporation', {
        matches: includes('llc', 'c corporation'),
      }),
      field('addressLine1', 'Address', '880 Innovation Way', {
        matches: includes('880 innovation way'),
      }),
      field('city', 'City', 'Sacramento'),
      field('state', 'State', 'CA', {
        matches: oneOf('CA', 'California'),
      }),
      field('postalCode', 'Postal code', '95814'),
    ],
  },
  {
    id: 'supplier-canyon-coi',
    title: 'Canyon Ridge certificate of insurance',
    fileName: '12_Canyon_Ridge_Demo_Insurance_Certificate.pdf',
    documentType: 'Certificate of insurance',
    difficulty: 'complex',
    kind: 'supplier_document',
    expectedDocumentType: 'insurance_certificate',
    fixtureVersion: AI_EVALUATION_FIXTURE_VERSION,
    fields: [
      supplier('Canyon Ridge Data Services LLC'),
      documentType('insurance_certificate'),
      field('issuer', 'Producer / issuer', 'Capitol Risk Partners', {
        matches: includes('capitol risk partners'),
      }),
      field('effectiveDate', 'Effective date', '2026-08-01', {
        critical: true,
      }),
      field('expirationDate', 'Expiration date', '2027-07-31', {
        critical: true,
      }),
      field(
        'coverageSummary',
        'Coverage limits',
        'CGL and Technology E&O at $2,000,000; Cyber at $1,000,000',
        {
          matches: (value) =>
            includes('2 000 000')(value) &&
            includes('1 000 000')(value) &&
            includes('cyber')(value),
        },
      ),
    ],
  },
  {
    id: 'supplier-canyon-license',
    title: 'Canyon Ridge business license',
    fileName: '13_Canyon_Ridge_Demo_Business_License.pdf',
    documentType: 'Business license',
    difficulty: 'standard',
    kind: 'supplier_document',
    expectedDocumentType: 'business_license',
    fixtureVersion: AI_EVALUATION_FIXTURE_VERSION,
    fields: [
      supplier('Canyon Ridge Data Services LLC'),
      documentType('business_license'),
      field(
        'issuer',
        'Issuing authority',
        'City of Sacramento Business Operations Office',
        { matches: includes('city of sacramento', 'business operations') },
      ),
      field('documentNumber', 'License number', 'BL-DEMO-2026-0872', {
        critical: true,
      }),
      field('effectiveDate', 'Issue date', '2026-08-01'),
      field('expirationDate', 'Expiration date', '2027-07-31', {
        critical: true,
      }),
      field('primaryContact', 'Primary contact', 'Maya Chen', {
        matches: includes('maya chen'),
      }),
    ],
  },
  {
    id: 'amendment-apex-2',
    title: 'Apex equipment amendment no. 2',
    fileName: '14_Apex_Equipment_Amendment_No_2.pdf',
    documentType: 'Contract amendment',
    difficulty: 'complex',
    kind: 'amendment',
    fixtureVersion: AI_EVALUATION_FIXTURE_VERSION,
    fields: [
      field('amendmentNumber', 'Amendment number', '2', {
        critical: true,
        matches: oneOf('2', 'Amendment No. 2', 2),
      }),
      field('amendmentType', 'Amendment type', 'amendment'),
      field('referencedContractNumber', 'Referenced contract', 'CT-2026-004', {
        critical: true,
      }),
      field('signedDate', 'Signed date', '2026-08-28', { critical: true }),
      field('effectiveDate', 'Effective date', '2026-09-01', {
        critical: true,
      }),
      field('valueChange', 'Value change', 75000, { critical: true }),
      field('resultingContractValue', 'Resulting value', 550000, {
        critical: true,
      }),
      field('newExpirationDate', 'New expiration', '2027-06-30', {
        critical: true,
      }),
      field('paymentTerms', 'Payment terms', 'Net 30', {
        matches: (value) =>
          includes('net 30')(value) || includes('30 days')(value),
      }),
      field('renewalType', 'Renewal type', 'none', { critical: true }),
      field('noticeDays', 'Notice period', 30, { critical: true }),
    ],
  },
  {
    id: 'negative-incomplete-note',
    title: 'Incomplete supplier relationship note',
    fileName: '15_Ambiguous_Incomplete_Supplier_Note.txt',
    documentType: 'Negative / unsupported contract input',
    difficulty: 'negative',
    kind: 'contract',
    stage: 'draft',
    fixtureVersion: AI_EVALUATION_FIXTURE_VERSION,
    fields: [
      field('contractNumber', 'Contract number', null, { critical: true }),
      field('contractValue', 'Contract value', null, { critical: true }),
      field('effectiveDate', 'Effective date', null, { critical: true }),
      field('expirationDate', 'Expiration date', null, { critical: true }),
      field('renewalType', 'Renewal type', null, { critical: true }),
      field('noticeDays', 'Notice period', null, { critical: true }),
      field('governingLaw', 'Governing law', null),
      field('paymentTerms', 'Payment terms', null),
    ],
  },
];

export const AI_EVALUATION_CASES = evaluationDefinitions.map(
  ({ id, title, fileName, documentType, difficulty, fixtureVersion }) => ({
    id,
    title,
    fileName,
    documentType,
    difficulty,
    fixtureVersion,
  }),
);

export const AI_EVALUATION_EXECUTION_CASES = evaluationDefinitions.map(
  ({ fields: _fields, ...definition }) => definition,
);

export type EvaluationBaseline = {
  id: string;
  criticalAccuracyPercent: number;
};

const percent = (numerator: number, denominator: number) =>
  denominator ? Number(((numerator / denominator) * 100).toFixed(1)) : 0;

const median = (values: number[]) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
};

export function evaluateAIResults(
  cases: EvaluationCaseInput[],
  baseline?: EvaluationBaseline | null,
) {
  const details = cases.map((evaluationCase) => {
    const definition = evaluationDefinitions.find(
      (candidate) => candidate.id === evaluationCase.caseId,
    );
    if (!definition) throw new Error('Unknown AI evaluation case.');
    const succeeded = evaluationCase.status !== 'failed';
    const fields = definition.fields.map((expectedField) => {
      const candidate = evaluationCase.analysis?.[expectedField.fieldName];
      const actualField =
        candidate && typeof candidate === 'object' && !Array.isArray(candidate)
          ? (candidate as EvaluatedField)
          : {};
      const actual = actualField.value ?? null;
      const hasValue = actual !== null && actual !== undefined && actual !== '';
      const sourceBacked = Boolean(
        hasValue && actualField.sourcePage && actualField.sourceQuote?.trim(),
      );
      return {
        fieldName: expectedField.fieldName,
        label: expectedField.label,
        expected: expectedField.expected,
        actual,
        critical: Boolean(expectedField.critical),
        correct: succeeded && expectedField.matches(actual),
        confidence: Number(actualField.confidence ?? 0),
        sourceBacked,
        unsupported: hasValue && !sourceBacked,
      };
    });
    const correctFields = fields.filter((item) => item.correct).length;
    return {
      caseId: evaluationCase.caseId,
      title: definition.title,
      fileName: definition.fileName,
      documentType: definition.documentType,
      difficulty: definition.difficulty,
      fixtureVersion: definition.fixtureVersion,
      model: evaluationCase.model,
      promptVersion: evaluationCase.promptVersion ?? 'unknown',
      extractionVersion:
        evaluationCase.extractionVersion ?? AI_EXTRACTION_VERSION,
      status: succeeded ? ('success' as const) : ('failed' as const),
      durationMs: Math.max(0, Math.round(evaluationCase.durationMs ?? 0)),
      failureReason: succeeded
        ? null
        : evaluationCase.failureReason || 'Analysis failed.',
      totalFields: fields.length,
      correctFields,
      accuracyPercent: percent(correctFields, fields.length),
      fields,
    };
  });
  const allFields = details.flatMap((detail) => detail.fields);
  const valuedFields = allFields.filter(
    (item) =>
      item.actual !== null && item.actual !== undefined && item.actual !== '',
  );
  const criticalFields = allFields.filter((item) => item.critical);
  const correctFields = allFields.filter((item) => item.correct).length;
  const sourceBackedFields = valuedFields.filter(
    (item) => item.sourceBacked,
  ).length;
  const unsupportedFields = valuedFields.filter(
    (item) => item.unsupported,
  ).length;
  const correctCriticalFields = criticalFields.filter(
    (item) => item.correct,
  ).length;
  const successfulCases = details.filter(
    (item) => item.status === 'success',
  ).length;
  const durations = details
    .filter((item) => item.status === 'success')
    .map((item) => item.durationMs);
  const criticalAccuracyPercent = percent(
    correctCriticalFields,
    criticalFields.length,
  );
  const regressionDelta = baseline
    ? Number(
        (criticalAccuracyPercent - baseline.criticalAccuracyPercent).toFixed(1),
      )
    : null;
  const promotionStatus = baseline
    ? regressionDelta !== null && regressionDelta < AI_REGRESSION_THRESHOLD
      ? ('blocked' as const)
      : ('eligible' as const)
    : ('baseline_required' as const);
  return {
    datasetVersion: AI_EVALUATION_DATASET_VERSION,
    fixtureVersion: AI_EVALUATION_FIXTURE_VERSION,
    extractionVersion: AI_EXTRACTION_VERSION,
    promptVersion: [...new Set(details.map((item) => item.promptVersion))].join(
      ' + ',
    ),
    model: [...new Set(details.map((item) => item.model))].join(' + '),
    caseCount: details.length,
    successfulCases,
    failedCases: details.length - successfulCases,
    processingSuccessPercent: percent(successfulCases, details.length),
    medianDurationMs: median(durations),
    totalFields: allFields.length,
    correctFields,
    criticalFields: criticalFields.length,
    correctCriticalFields,
    sourceBackedFields,
    unsupportedFields,
    accuracyPercent: percent(correctFields, allFields.length),
    criticalAccuracyPercent,
    sourceCoveragePercent: percent(sourceBackedFields, valuedFields.length),
    unsupportedValuePercent: percent(unsupportedFields, valuedFields.length),
    averageConfidence: valuedFields.length
      ? Number(
          (
            (valuedFields.reduce((sum, item) => sum + item.confidence, 0) /
              valuedFields.length) *
            100
          ).toFixed(1),
        )
      : 0,
    baselineRunId: baseline?.id ?? null,
    regressionDelta,
    regressionThreshold: AI_REGRESSION_THRESHOLD,
    promotionStatus,
    details,
  };
}
