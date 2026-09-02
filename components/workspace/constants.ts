import type {
  AmendmentAnalysis,
  ContractAnalysis,
} from '@/lib/contract-ledger-types';
import {
  BellRing,
  BookOpenCheck,
  FileSearch,
  FileSpreadsheet,
  FlaskConical,
  FolderKanban,
  LayoutDashboard,
  ShieldCheck,
  Users,
} from 'lucide-react';
import type { ElementType } from 'react';
import type { ViewName } from '@/components/workspace/types';

export const supplierProfileExtractionFields = [
  ['legalName', 'supplierLegalName'],
  ['dbaName', 'dbaName'],
  ['category', 'supplierCategory'],
  ['primaryContact', 'primaryContact'],
  ['email', 'email'],
  ['phone', 'phone'],
  ['website', 'website'],
  ['addressLine1', 'addressLine1'],
  ['addressLine2', 'addressLine2'],
  ['city', 'city'],
  ['state', 'state'],
  ['postalCode', 'postalCode'],
  ['country', 'country'],
  ['taxClassification', 'taxClassification'],
] as const;

export const navigationGroups: Array<{
  label: string;
  items: Array<{ label: ViewName; icon: ElementType }>;
}> = [
  {
    label: 'Workspace',
    items: [
      { label: 'Dashboard', icon: LayoutDashboard },
      { label: 'New Contract Review', icon: FileSearch },
      { label: 'Approvals & Exceptions', icon: ShieldCheck },
      { label: 'Bulk Import & Data Quality', icon: FileSpreadsheet },
      { label: 'Contract Register', icon: FolderKanban },
      { label: 'Supplier Register', icon: Users },
      { label: 'Obligations & Evidence', icon: BellRing },
    ],
  },
  {
    label: 'Portfolio evidence',
    items: [
      { label: 'Portfolio Case Study', icon: BookOpenCheck },
      { label: 'AI Accuracy & Validation', icon: FlaskConical },
    ],
  },
];

export const portfolioReleaseEvidence = [
  {
    release: 'v0.2',
    capability: 'Amendment lifecycle',
    evidence:
      'USD 475,000 original + USD 75,000 verified amendment = USD 550,000 current value, with the original preserved.',
    boundary: 'Reproducible fictional scenario; no legal-outcome claim.',
  },
  {
    release: 'v0.3',
    capability: 'Approval controls',
    evidence:
      'Five versioned rules, immutable decisions, accountable owners, deadlines, and an executed-registration gate.',
    boundary: 'The seeded 26-hour turnaround is fixture evidence.',
  },
  {
    release: 'v0.4',
    capability: 'Legacy migration',
    evidence:
      'CSV/XLSX staging, mapping, normalization, duplicate review, correction export, transactional commit, and audited rollback.',
    boundary: 'No real-company time-savings or duplicate-precision claim.',
  },
  {
    release: 'v0.5',
    capability: 'Obligation execution',
    evidence:
      'Five seeded obligations cover upcoming, overdue, evidence-required, and evidence-backed completion states.',
    boundary: 'Completion metrics expose their small sample.',
  },
  {
    release: 'v0.6',
    capability: 'AI governance',
    evidence:
      'Fifteen controlled fictional cases, field-level ground truth, source coverage, correction evidence, and a regression gate.',
    boundary: 'Accuracy must name its run, version, and sample size.',
  },
  {
    release: 'v0.7',
    capability: 'Quality and permissions',
    evidence:
      'Seven workspace roles, thirteen named permissions, denied-write coverage, and page-level document preflight.',
    boundary: 'Demonstrates policy controls, not enterprise IAM certification.',
  },
  {
    release: 'v0.8',
    capability: 'Operational handoff',
    evidence:
      'Source-aware review PDF, eight-factor supplier risk, and durable integration-outbox events.',
    boundary: 'Integration-ready; external delivery is not active.',
  },
] as const;

export const portfolioDemoChapters: Array<{
  time: string;
  view: ViewName;
  title: string;
  proof: string;
}> = [
  {
    time: '0:00',
    view: 'Portfolio Case Study',
    title: 'Frame the operating problem',
    proof: 'Operational review aid, fictional data, and explicit non-goals.',
  },
  {
    time: '0:45',
    view: 'Bulk Import & Data Quality',
    title: 'Stage legacy data safely',
    proof:
      'Mapping, normalization, duplicate decisions, and reversible commit.',
  },
  {
    time: '1:35',
    view: 'New Contract Review',
    title: 'Verify AI-assisted extraction',
    proof: 'Model and reviewer values remain separate and source-linked.',
  },
  {
    time: '2:40',
    view: 'Approvals & Exceptions',
    title: 'Control policy exceptions',
    proof: 'Versioned rules, accountable decisions, and execution gates.',
  },
  {
    time: '3:30',
    view: 'Contract Register',
    title: 'Show official lifecycle data',
    proof: 'Executed-only totals, draft comparison, and preserved approvals.',
  },
  {
    time: '4:20',
    view: 'Contract Register',
    title: 'Reproduce effective terms',
    proof: 'Original agreement, amendment delta, and current value lineage.',
  },
  {
    time: '5:10',
    view: 'Supplier Register',
    title: 'Explain supplier risk',
    proof: 'Eight visible factors expose rules, points, and evidence.',
  },
  {
    time: '6:05',
    view: 'Obligations & Evidence',
    title: 'Close work with evidence',
    proof: 'Calculated overdue state and immutable completion history.',
  },
  {
    time: '7:05',
    view: 'AI Accuracy & Validation',
    title: 'Measure AI quality',
    proof:
      'Fifteen cases, field metrics, source coverage, and regression gate.',
  },
  {
    time: '8:10',
    view: 'Portfolio Case Study',
    title: 'Export and close honestly',
    proof: 'Review package, workbook, calendar, evidence, and limitations.',
  },
];

export const navItems = navigationGroups.flatMap((group) => group.items);

export const extractionFields = [
  ['documentTitle', 'Document title'],
  ['supplierLegalName', 'Supplier legal name'],
  ['contractType', 'Contract type'],
  ['contractNumber', 'Contract number'],
  ['contractValue', 'Contract value'],
  ['effectiveDate', 'Effective date'],
  ['expirationDate', 'Expiration date'],
  ['renewalType', 'Renewal type'],
  ['noticeDays', 'Notice period'],
  ['governingLaw', 'Governing law'],
  ['paymentTerms', 'Payment terms'],
] as const satisfies ReadonlyArray<readonly [keyof ContractAnalysis, string]>;

export const amendmentExtractionFields = [
  ['amendmentTitle', 'Amendment title'],
  ['amendmentNumber', 'Amendment number'],
  ['amendmentType', 'Amendment type'],
  ['referencedContractNumber', 'Referenced contract'],
  ['signedDate', 'Signed date'],
  ['effectiveDate', 'Effective date'],
  ['valueChange', 'Value change (USD)'],
  ['resultingContractValue', 'Resulting contract value (USD)'],
  ['newExpirationDate', 'New expiration date'],
  ['paymentTerms', 'New payment terms'],
  ['renewalType', 'New renewal type'],
  ['noticeDays', 'New notice period (days)'],
  ['scopeSummary', 'Scope / change summary'],
] as const satisfies ReadonlyArray<readonly [keyof AmendmentAnalysis, string]>;

export type AmendmentFieldKey = (typeof amendmentExtractionFields)[number][0];

export const demoPlaybookRules = [
  {
    id: 'PAY-001',
    rule: 'Payment terms',
    standard: 'Net 30 preferred',
    appliesTo: 'All supplier contracts',
    risk: 'Medium',
  },
  {
    id: 'LAW-001',
    rule: 'Governing law',
    standard: 'California preferred',
    appliesTo: 'All contracts',
    risk: 'Medium',
  },
  {
    id: 'APR-001',
    rule: 'CFO approval threshold',
    standard: 'Required above $500,000',
    appliesTo: 'Executed and proposed value',
    risk: 'High',
  },
  {
    id: 'REN-001',
    rule: 'Automatic renewal',
    standard: 'Human decision before notice deadline',
    appliesTo: 'Auto-renewing contracts',
    risk: 'High',
  },
  {
    id: 'INS-001',
    rule: 'Supplier insurance',
    standard: 'CGL $2M; professional $2M; cyber $1M when applicable',
    appliesTo: 'Services and data access',
    risk: 'High',
  },
  {
    id: 'TERM-001',
    rule: 'Termination for convenience',
    standard: '30-day customer right without early termination fee',
    appliesTo: 'Service agreements',
    risk: 'Medium',
  },
  {
    id: 'SEC-001',
    rule: 'Security incident notice',
    standard: 'Confirmed incidents reported within 72 hours',
    appliesTo: 'Data-access agreements',
    risk: 'High',
  },
  {
    id: 'CHG-001',
    rule: 'Change control',
    standard: 'Signed change order for scope, fees, or schedule',
    appliesTo: 'Project and service contracts',
    risk: 'Medium',
  },
] as const;

export type ExtractionFieldKey = (typeof extractionFields)[number][0];

export const assistantExamples = [
  'Show active contracts over $100,000 that expire before December 31, 2026.',
  'Which supplier qualification documents expire in the next 90 days?',
  'Find all suppliers with a missing W-9.',
  'Which mandatory approvals are overdue or still pending?',
] as const;

export const approvalActionLabels = {
  start_review: 'Start review',
  approve: 'Approve',
  decline: 'Decline',
  request_revision: 'Request revision',
  approve_exception: 'Approve exception',
  escalate: 'Escalate',
  cancel: 'Cancel request',
} as const;
