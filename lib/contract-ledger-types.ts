import type { SupplierRiskProfile } from '@/lib/supplier-risk';

export type ExtractedField = {
  value: string | number | null;
  confidence: number;
  sourcePage: number | null;
  sourceQuote: string | null;
};

export type DocumentQualityReport = {
  version: 'document-preflight-2026.1';
  status: 'ready' | 'needs_review' | 'blocked';
  fileName: string;
  mimeType: string;
  totalPages: number;
  inspectedPages: number;
  textCharacters: number;
  requiresOcr: boolean;
  requiresManualReview: boolean;
  issues: string[];
  pages: Array<{
    pageNumber: number;
    textCharacters: number;
    rotation: number;
    blank: boolean;
    lowTextDensity: boolean;
    requiresOcr: boolean;
    requiresManualReview: boolean;
    issues: string[];
  }>;
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
  /** 'capped' | 'uncapped' | null — null means the document did not say. */
  liabilityCap: ExtractedField;
  findings: Array<{
    /** Stable playbook key when the deviation matched a company standard. */
    ruleKey?: string;
    rule: string;
    observed: string;
    standard: string;
    suggestedRevision: string;
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
  qualityReport: DocumentQualityReport;
  model: string;
};

export type AmendmentAnalysis = {
  amendmentTitle: ExtractedField;
  amendmentNumber: ExtractedField;
  amendmentType: ExtractedField;
  referencedContractNumber: ExtractedField;
  signedDate: ExtractedField;
  effectiveDate: ExtractedField;
  valueChange: ExtractedField;
  resultingContractValue: ExtractedField;
  newExpirationDate: ExtractedField;
  paymentTerms: ExtractedField;
  renewalType: ExtractedField;
  noticeDays: ExtractedField;
  scopeSummary: ExtractedField;
  keyDates: Array<{
    type: string;
    title: string;
    dueDate: string | null;
    sourcePage: number | null;
    sourceQuote: string | null;
  }>;
  warnings: string[];
};

export type AmendmentAnalysisResponse = {
  analysisRunId: string;
  analysis: AmendmentAnalysis;
  document: {
    fileName: string;
    totalPages: number;
    storageKey: string;
    mimeType: string;
  };
  qualityReport: DocumentQualityReport;
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
  qualityReport: DocumentQualityReport;
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

export type ApprovalQueueItem = {
  request_id: string;
  step_id: string;
  intake_id: string;
  intake_number: string;
  intake_title: string;
  proposed_supplier_name: string;
  proposed_value_cents: number | null;
  request_status: string;
  step_status: string;
  reason: string;
  generated_at: string;
  due_at: string;
  completed_at: string | null;
  rule_id: string;
  rule_key: string;
  rule_name: string;
  rule_version: number;
  owner_role: string;
  mandatory: number;
  assigned_reviewer: string | null;
  escalation_level: number;
  source_finding_id: string | null;
  source_document_id: string | null;
  source_page: number | null;
  source_quote: string | null;
  source_file_name: string | null;
  age_days: number;
  overdue: number;
};

export type ApprovalRequestDetails = {
  request: Record<string, string | number | null>;
  steps: Array<Record<string, string | number | null>>;
  history: Array<Record<string, string | number | null>>;
};

export type ImportField = {
  key: string;
  label: string;
  required: boolean;
  aliases: readonly string[];
};

export type ImportBatchDetails = {
  batch: Record<string, string | number | null> & {
    headers: string[];
    mapping: Record<string, string>;
  };
  fields: ImportField[];
  rows: Array<
    Record<string, string | number | null> & {
      id: string;
      row_number: number;
      status: 'ready' | 'warning' | 'duplicate' | 'invalid';
      decision: 'pending' | 'accept' | 'skip';
      duplicate_type: 'exact' | 'possible' | null;
      raw: Record<string, string>;
      normalized: Record<string, string | number | null>;
      issues: Array<{
        code: string;
        severity: 'warning' | 'error';
        message: string;
      }>;
    }
  >;
};

export type ImportPortfolioMetrics = {
  batchCount: number;
  completedBatchCount: number;
  assessedRowCount: number;
  finalizedRowCount: number;
  acceptedRowCount: number;
  rejectedRowCount: number;
  acceptanceRate: number | null;
  rejectionRate: number | null;
  duplicateCandidateCount: number;
  normalizationIssueCount: number;
  medianMigrationMinutes: number | null;
  migrationDurationSampleSize: number;
};

export type ObligationDetails = {
  obligation: Record<string, string | number | null>;
  events: Array<Record<string, string | number | null>>;
  eligibleDocuments: Array<Record<string, string | number | null>>;
};

export type Workspace = {
  metrics: {
    active_contracts: number;
    current_value_cents: number;
    active_suppliers: number;
    pending_suppliers: number;
    records_to_verify: number;
    total_contracts: number;
    total_suppliers: number;
    total_intakes: number;
    total_key_dates: number;
  };
  /** Row cap applied to each register snapshot in this payload. */
  registerLimit: number;
  /** Shared daily ceiling on model-backed calls for this deployment. */
  aiBudget: {
    dailyUnitLimit: number;
    usedUnits: number;
    remainingUnits: number;
    resetsAt: string;
  };
  contracts: Array<Record<string, string | number | null>>;
  suppliers: Array<Record<string, string | number | null>>;
  supplierRiskProfiles?: Record<string, SupplierRiskProfile>;
  intakes: Array<Record<string, string | number | null>>;
  keyDates: Array<Record<string, string | number | null>>;
  obligationMetrics: {
    open_obligations: number;
    overdue_obligations: number;
    average_overdue_age_days: number;
    on_time_completion_rate: number;
    completed_with_evidence_rate: number;
    median_assignment_hours: number;
    median_completion_hours: number;
  };
  supplierAlerts: Array<Record<string, string | number | null>>;
  supplierDocuments: Array<Record<string, string | number | null>>;
  transactionComparisons: AITransactionComparison[];
  evaluationRuns: Array<Record<string, string | number | null>>;
  aiGovernanceMetrics?: Record<string, string | number | null>;
  aiCorrectionByField?: Array<Record<string, string | number | null>>;
  approvalMetrics: {
    open_requests: number;
    overdue_requests: number;
    blocked_intakes: number;
    average_turnaround_hours: number;
    exception_approval_rate: number;
  };
  approvalQueue: ApprovalQueueItem[];
  /** Active approval rule definitions, for the read-only rules reference. */
  approvalRules: Array<Record<string, string | number | null>>;
  integrationMetrics?: {
    total_events: number;
    pending_events: number;
    failed_events: number;
    last_event_at: string | null;
  };
};

export type RecordDetails = {
  documents: Array<Record<string, string | number | null>>;
  aiReviews: Array<Record<string, string | number | null>>;
  amendments: Array<Record<string, string | number | null>>;
  auditLogs: Array<Record<string, string | number | null>>;
  approvalRequests: Array<Record<string, string | number | null>>;
  approvalHistory: Array<Record<string, string | number | null>>;
};

export type IntakeDetails = {
  intake: Record<string, string | number | null>;
  supplier: Record<string, string | number | null> | null;
  documents: Array<Record<string, string | number | null>>;
  findings: Array<Record<string, string | number | null>>;
  analysis: ContractAnalysis | null;
  analysisMeta: Record<string, string | number | null> | null;
  fieldReviews: Array<Record<string, string | number | null>>;
  auditLogs: Array<Record<string, string | number | null>>;
  approvalRequests: Array<Record<string, string | number | null>>;
  approvalHistory: Array<Record<string, string | number | null>>;
};
