import type { ContractAnalysis } from './contract-ledger-types';
import { normalizeSupplierName } from './supplier-qualification';

// Bind approval to verified business values, not mutable client evidence or
// just a threshold rule. Source identity is retained separately in the snapshot.
export function approvedTerms(analysis: ContractAnalysis) {
  const text = (value: string | number | null) =>
    value === null
      ? ''
      : String(value).trim().replace(/\s+/g, ' ').toLowerCase();
  const number = (value: string | number | null) =>
    value === null || value === ''
      ? null
      : Number(String(value).replace(/[^0-9.-]/g, ''));
  return {
    documentTitle: text(analysis.documentTitle.value),
    supplierLegalName: normalizeSupplierName(
      String(analysis.supplierLegalName.value ?? ''),
    ),
    contractType: text(analysis.contractType.value),
    contractNumber: text(analysis.contractNumber.value),
    contractValue: number(analysis.contractValue.value),
    effectiveDate: text(analysis.effectiveDate.value),
    expirationDate: text(analysis.expirationDate.value),
    renewalType: text(analysis.renewalType.value),
    noticeDays: number(analysis.noticeDays.value),
    governingLaw: text(analysis.governingLaw.value),
    paymentTerms: text(analysis.paymentTerms.value),
    liabilityCap: text(analysis.liabilityCap.value),
  };
}

export function approvalCoversTerms(
  snapshotJson: string,
  terms: ReturnType<typeof approvedTerms>,
) {
  try {
    const snapshot = JSON.parse(snapshotJson) as {
      reviewedTerms?: Record<string, unknown>;
      sourceAnalysisRunId?: string;
    };
    return (
      Boolean(snapshot.sourceAnalysisRunId) &&
      Object.entries(terms).every(
        ([key, value]) => snapshot.reviewedTerms?.[key] === value,
      )
    );
  } catch {
    return false;
  }
}
