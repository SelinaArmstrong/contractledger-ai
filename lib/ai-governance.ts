export const CRITICAL_AI_FIELDS = new Set([
  'supplierLegalName',
  'documentType',
  'contractNumber',
  'contractValue',
  'effectiveDate',
  'expirationDate',
  'renewalType',
  'noticeDays',
  'referencedContractNumber',
  'signedDate',
  'valueChange',
  'resultingContractValue',
  'newExpirationDate',
]);

export type SourceField = {
  value: string | number | null;
  sourcePage: number | null;
  sourceQuote: string | null;
};

export function needsSourceOverride(fieldName: string, field: SourceField) {
  const hasValue = field.value !== null && field.value !== '';
  return (
    CRITICAL_AI_FIELDS.has(fieldName) &&
    hasValue &&
    !(field.sourcePage && field.sourceQuote?.trim())
  );
}

export function validatedOverrideReason(
  fieldName: string,
  field: SourceField,
  overrideReason?: string | null,
) {
  if (!needsSourceOverride(fieldName, field)) return null;
  const reason = overrideReason?.trim() ?? '';
  if (reason.length < 12) {
    throw new Error(
      `${fieldName} is a critical saved field without source support. Add a reviewer override reason of at least 12 characters.`,
    );
  }
  return reason;
}
