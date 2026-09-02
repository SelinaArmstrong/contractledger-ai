import type { AssistantResponse } from '@/lib/ai-assistant';
import type { SupplierDocumentAnalysisResponse } from '@/lib/contract-ledger-types';
import type { SupplierDocumentType } from '@/lib/supplier-qualification';

export type ViewName =
  | 'Dashboard'
  | 'New Contract Review'
  | 'Approvals & Exceptions'
  | 'Bulk Import & Data Quality'
  | 'Contract Register'
  | 'Supplier Register'
  | 'Obligations & Evidence'
  | 'Portfolio Case Study'
  | 'AI Accuracy & Validation';

export type IntakeStage = 'draft' | 'executed';

export type DetailSelection = { type: 'contract' | 'supplier'; id: string };

export type SupplierOnboardingDocument = {
  id: string;
  documentType: SupplierDocumentType;
  issuer: string;
  documentNumber: string;
  effectiveDate: string;
  expirationDate: string;
  coverageSummary: string;
  overrideReason: string;
  file: File | null;
  aiResult: SupplierDocumentAnalysisResponse | null;
  analyzing: boolean;
  aiError: string;
};

export type SupplierProfileFieldKey =
  | 'legalName'
  | 'dbaName'
  | 'category'
  | 'primaryContact'
  | 'email'
  | 'phone'
  | 'website'
  | 'addressLine1'
  | 'addressLine2'
  | 'city'
  | 'state'
  | 'postalCode'
  | 'country'
  | 'taxClassification';

export type SupplierProfileEvidence = {
  fileName: string;
  confidence: number;
  sourcePage: number | null;
};

export type FieldReviewStatus = 'pending' | 'accepted' | 'corrected';

export type AssistantConversationMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  response?: AssistantResponse;
};

export type EvaluationDetail = {
  caseId: string;
  title: string;
  fileName: string;
  documentType: string;
  difficulty: string;
  fixtureVersion: string;
  model: string;
  promptVersion: string;
  extractionVersion: string;
  status: 'success' | 'failed';
  durationMs: number;
  failureReason: string | null;
  totalFields: number;
  correctFields: number;
  accuracyPercent: number;
  fields: Array<{
    fieldName: string;
    label: string;
    expected: string | number;
    actual: string | number | null;
    critical: boolean;
    correct: boolean;
    confidence: number;
    sourceBacked: boolean;
    unsupported: boolean;
  }>;
};
