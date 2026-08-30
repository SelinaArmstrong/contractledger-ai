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
};
