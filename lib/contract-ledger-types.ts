export type ExtractedField = {
  value: string | number | null;
  confidence: number;
  sourcePage: number | null;
  sourceQuote: string | null;
};

export type ContractAnalysis = {
  documentTitle: ExtractedField;
  supplierLegalName: ExtractedField;
  contractType: ExtractedField;
  contractNumber: ExtractedField;
  contractValue: ExtractedField;
  effectiveDate: ExtractedField;
  expirationDate: ExtractedField;
  renewalType: ExtractedField;
  noticeDays: ExtractedField;
  governingLaw: ExtractedField;
  paymentTerms: ExtractedField;
  findings: Array<{
    rule: string;
    observed: string;
    standard: string;
    severity: 'info' | 'low' | 'medium' | 'high';
    sourcePage: number | null;
  }>;
  keyDates: Array<{
    type: string;
    title: string;
    dueDate: string | null;
    sourcePage: number | null;
    sourceQuote: string | null;
  }>;
  warnings: string[];
};

export type AnalysisResponse = {
  analysisRunId: string;
  analysis: ContractAnalysis;
  document: {
    fileName: string;
    totalPages: number;
    stage: 'draft' | 'executed';
    storageKey: string;
    mimeType: string;
  };
  model: string;
};

export type SupplierDocumentAnalysis = {
  supplierLegalName: ExtractedField;
  dbaName: ExtractedField;
  supplierCategory: ExtractedField;
  primaryContact: ExtractedField;
  email: ExtractedField;
  phone: ExtractedField;
  website: ExtractedField;
  addressLine1: ExtractedField;
  addressLine2: ExtractedField;
  city: ExtractedField;
  state: ExtractedField;
  postalCode: ExtractedField;
  country: ExtractedField;
  taxClassification: ExtractedField;
  documentType: ExtractedField;
  issuer: ExtractedField;
  documentNumber: ExtractedField;
  effectiveDate: ExtractedField;
  expirationDate: ExtractedField;
  coverageSummary: ExtractedField;
  findings: Array<{
    title: string;
    severity: 'low' | 'medium' | 'high';
    detail: string;
    sourcePage: number | null;
  }>;
  warnings: string[];
};

export type SupplierDocumentAnalysisResponse = {
  analysisRunId: string;
  analysis: SupplierDocumentAnalysis;
  document: {
    fileName: string;
    totalPages: number;
    storageKey: string;
    mimeType: string;
  };
  model: string;
};

export type AITransactionComparison = {
  id: string;
  supplierId: string;
  supplierName: string;
  intakeId: string;
  contractId: string;
  draftFileName: string;
  executedFileName: string;
  draftReviewedAt: string;
  executedReviewedAt: string;
  draftFindingCount: number;
  executedFindingCount: number;
  changes: Array<{
    fieldName: string;
    label: string;
    draftValue: string | number | null;
    executedValue: string | number | null;
    changed: boolean;
  }>;
};

export type Workspace = {
  metrics: {
    active_contracts: number;
    current_value_cents: number;
    active_suppliers: number;
    pending_suppliers: number;
    records_to_verify: number;
  };
  contracts: Array<Record<string, string | number | null>>;
  suppliers: Array<Record<string, string | number | null>>;
  intakes: Array<Record<string, string | number | null>>;
  keyDates: Array<Record<string, string | number | null>>;
  supplierAlerts: Array<Record<string, string | number | null>>;
  aiReviews: Array<Record<string, string | number | null>>;
  transactionComparisons: AITransactionComparison[];
  evaluationRuns: Array<Record<string, string | number | null>>;
  documents: Array<Record<string, string | number | null>>;
  auditLogs: Array<Record<string, string | number | null>>;
};
