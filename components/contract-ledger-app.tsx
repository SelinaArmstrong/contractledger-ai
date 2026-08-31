'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ElementType,
  type ReactNode,
} from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BellRing,
  BookOpenCheck,
  Building2,
  Check,
  ChevronDown,
  CircleCheck,
  Clock3,
  Database,
  Download,
  ExternalLink,
  FileCheck2,
  FileSearch,
  FileSpreadsheet,
  FileText,
  FlaskConical,
  FolderKanban,
  LayoutDashboard,
  LoaderCircle,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  Users,
} from 'lucide-react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type {
  AnalysisResponse,
  ContractAnalysis,
  ExtractedField,
  SupplierDocumentAnalysisResponse,
  Workspace,
} from '@/lib/contract-ledger-types';
import { AI_EVALUATION_CASES } from '@/lib/ai-evaluation';
import { exportCurrentRegisters } from '@/lib/export-registers';
import type {
  ManagementChart,
  ManagementInsightResponse,
  ManagementInsightScope,
  ManagementMetric,
  ManagementPriority,
} from '@/lib/management-insights';
import {
  SUPPLIER_DOCUMENT_LABELS,
  SUPPLIER_DOCUMENT_TYPES,
  normalizeSupplierName,
  type SupplierDocumentType,
} from '@/lib/supplier-qualification';

type ViewName =
  | 'Dashboard'
  | 'New Contract Review'
  | 'Contract Register'
  | 'Supplier Register'
  | 'Alerts & Exports'
  | 'AI Evaluation';

type IntakeStage = 'draft' | 'executed';
type DetailSelection = { type: 'contract' | 'supplier'; id: string };
type SupplierOnboardingDocument = {
  id: string;
  documentType: SupplierDocumentType;
  issuer: string;
  documentNumber: string;
  effectiveDate: string;
  expirationDate: string;
  coverageSummary: string;
  file: File | null;
  aiResult: SupplierDocumentAnalysisResponse | null;
  analyzing: boolean;
  aiError: string;
};

type SupplierProfileFieldKey =
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

type SupplierProfileEvidence = {
  fileName: string;
  confidence: number;
  sourcePage: number | null;
};

const supplierProfileExtractionFields = [
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

const navItems: Array<{ label: ViewName; icon: ElementType }> = [
  { label: 'Dashboard', icon: LayoutDashboard },
  { label: 'New Contract Review', icon: FileSearch },
  { label: 'Contract Register', icon: FolderKanban },
  { label: 'Supplier Register', icon: Users },
  { label: 'Alerts & Exports', icon: BellRing },
  { label: 'AI Evaluation', icon: FlaskConical },
];

const extractionFields = [
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

const demoPlaybookRules = [
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

type ExtractionFieldKey = (typeof extractionFields)[number][0];
type FieldReviewStatus = 'pending' | 'accepted' | 'corrected';

function moneyFromCents(value: unknown, compact = false) {
  const cents = typeof value === 'number' ? value : Number(value ?? 0);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: compact ? 'compact' : 'standard',
    maximumFractionDigits: compact ? 2 : 0,
  }).format(cents / 100);
}

function valueText(value: unknown) {
  if (value === null || value === undefined || value === '') return 'Not found';
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  ) {
    return String(value);
  }
  return 'Structured value';
}

function titleCase(value: unknown) {
  return valueText(value)
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function toneForStatus(status: unknown) {
  const normalized = valueText(status).toLowerCase();
  if (
    normalized.includes('active') ||
    normalized.includes('current') ||
    normalized.includes('complete')
  )
    return 'green';
  if (
    normalized.includes('pending') ||
    normalized.includes('review') ||
    normalized.includes('upcoming')
  )
    return 'amber';
  if (
    normalized.includes('missing') ||
    normalized.includes('expired') ||
    normalized.includes('high')
  )
    return 'rose';
  return 'blue';
}

function alertTiming(value: unknown) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return null;
  const dueDate = Date.parse(`${value}T00:00:00Z`);
  const today = Date.parse(
    `${new Date().toISOString().slice(0, 10)}T00:00:00Z`,
  );
  if (Number.isNaN(dueDate)) return null;
  const days = Math.round((dueDate - today) / 86_400_000);
  if (days < 0)
    return {
      days,
      label: `${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} overdue`,
      tone: 'rose',
    };
  if (days === 0) return { days, label: 'Due today', tone: 'rose' };
  if (days <= 30)
    return {
      days,
      label: `${days} day${days === 1 ? '' : 's'} remaining`,
      tone: 'rose',
    };
  if (days <= 90)
    return { days, label: `${days} days remaining`, tone: 'amber' };
  return { days, label: `${days} days remaining`, tone: 'blue' };
}

function supplierDocumentLabel(value: unknown) {
  const key = String(value) as SupplierDocumentType;
  return SUPPLIER_DOCUMENT_LABELS[key] ?? titleCase(value);
}

function StatusBadge({
  tone,
  children,
}: {
  tone: string;
  children: ReactNode;
}) {
  const colors: Record<string, string> = {
    amber: 'border-amber-200 bg-amber-50 text-amber-800',
    blue: 'border-sky-200 bg-sky-50 text-sky-800',
    rose: 'border-rose-200 bg-rose-50 text-rose-800',
    green: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  };
  return (
    <Badge variant="outline" className={colors[tone] ?? colors.blue}>
      {children}
    </Badge>
  );
}

function Panel({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-xl border border-[#dce3e8] bg-white shadow-[0_1px_2px_rgb(15_23_42/3%)] ${className}`}
    >
      {children}
    </section>
  );
}

function PanelHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col justify-between gap-3 border-b border-[#e3e9ed] px-5 py-4 sm:flex-row sm:items-center">
      <div>
        <h2 className="text-[14px] font-semibold text-[#1b2e3a]">{title}</h2>
        {description ? (
          <p className="mt-0.5 text-[11px] text-slate-500">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex min-h-52 flex-col items-center justify-center px-6 text-center">
      <FileText className="mb-3 size-7 text-slate-300" />
      <p className="text-sm font-medium text-slate-700">{title}</p>
      <p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">
        {description}
      </p>
    </div>
  );
}

function FieldConfidence({ field }: { field: ExtractedField }) {
  const percent = Math.round(field.confidence * 100);
  const tone = percent >= 90 ? 'green' : percent >= 75 ? 'amber' : 'rose';
  return <StatusBadge tone={tone}>{percent}%</StatusBadge>;
}

export function ContractLedgerApp() {
  const [activeView, setActiveView] = useState<ViewName>('Dashboard');
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [workspaceError, setWorkspaceError] = useState('');
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [stage, setStage] = useState<IntakeStage>('draft');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResponse | null>(
    null,
  );
  const [originalAnalysis, setOriginalAnalysis] =
    useState<ContractAnalysis | null>(null);
  const [fieldReviews, setFieldReviews] = useState<
    Partial<Record<ExtractionFieldKey, FieldReviewStatus>>
  >({});
  const [analysisStatus, setAnalysisStatus] = useState<
    'idle' | 'analyzing' | 'ready' | 'saving' | 'saved' | 'error'
  >('idle');
  const [analysisError, setAnalysisError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [detail, setDetail] = useState<DetailSelection | null>(null);
  const [supplierDialogOpen, setSupplierDialogOpen] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const loadWorkspace = useCallback(async () => {
    try {
      const response = await fetch('/api/workspace');
      const body = (await response.json()) as Workspace & { error?: string };
      if (!response.ok)
        throw new Error(body.error || 'The workspace could not be loaded.');
      setWorkspace(body);
      setWorkspaceError('');
    } catch (error) {
      setWorkspaceError(
        error instanceof Error
          ? error.message
          : 'The workspace could not be loaded.',
      );
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadWorkspace(), 0);
    return () => window.clearTimeout(timer);
  }, [loadWorkspace]);

  const openIntake = (nextStage: IntakeStage) => {
    setStage(nextStage);
    setSelectedFile(null);
    setAnalysisResult(null);
    setOriginalAnalysis(null);
    setFieldReviews({});
    setAnalysisError('');
    setAnalysisStatus('idle');
    setDialogOpen(true);
  };

  const loadDemoDocument = async () => {
    const fileName =
      stage === 'draft'
        ? '01_Draft_Professional_Services_Agreement.pdf'
        : '02_Executed_Professional_Services_Agreement.pdf';
    const response = await fetch(`/demo-documents/${fileName}`);
    const blob = await response.blob();
    setSelectedFile(new File([blob], fileName, { type: 'application/pdf' }));
    setAnalysisResult(null);
    setOriginalAnalysis(null);
    setFieldReviews({});
    setAnalysisStatus('idle');
    setAnalysisError('');
  };

  const analyzeDocument = async () => {
    if (!selectedFile) {
      setAnalysisError('Choose a text-based PDF or TXT contract first.');
      setAnalysisStatus('error');
      return;
    }
    setAnalysisStatus('analyzing');
    setAnalysisError('');
    try {
      const form = new FormData();
      form.append('file', selectedFile);
      form.append('stage', stage);
      const response = await fetch('/api/analyze', {
        method: 'POST',
        body: form,
      });
      const body = (await response.json()) as AnalysisResponse & {
        error?: string;
      };
      if (!response.ok)
        throw new Error(body.error || 'The document could not be analyzed.');
      setAnalysisResult(body);
      setOriginalAnalysis(structuredClone(body.analysis));
      setFieldReviews(
        Object.fromEntries(
          extractionFields.map(([key]) => [key, 'pending']),
        ) as Record<ExtractionFieldKey, FieldReviewStatus>,
      );
      setAnalysisStatus('ready');
    } catch (error) {
      setAnalysisError(
        error instanceof Error
          ? error.message
          : 'The document could not be analyzed.',
      );
      setAnalysisStatus('error');
    }
  };

  const updateReviewedField = (
    fieldName: ExtractionFieldKey,
    value: string | number | null,
  ) => {
    setAnalysisResult((current) => {
      if (!current) return current;
      const field = current.analysis[fieldName] as ExtractedField;
      return {
        ...current,
        analysis: {
          ...current.analysis,
          [fieldName]: { ...field, value },
        },
      };
    });
    setFieldReviews((current) => ({
      ...current,
      [fieldName]: 'corrected',
    }));
  };

  const confirmReviewedField = (fieldName: ExtractionFieldKey) => {
    if (!analysisResult || !originalAnalysis) return;
    const originalValue = (originalAnalysis[fieldName] as ExtractedField).value;
    const verifiedValue = (analysisResult.analysis[fieldName] as ExtractedField)
      .value;
    setFieldReviews((current) => ({
      ...current,
      [fieldName]:
        JSON.stringify(originalValue) === JSON.stringify(verifiedValue)
          ? 'accepted'
          : 'corrected',
    }));
  };

  const confirmAllUnchangedFields = () => {
    if (!analysisResult || !originalAnalysis) return;
    setFieldReviews((current) => ({
      ...current,
      ...Object.fromEntries(
        extractionFields.map(([fieldName]) => {
          if (current[fieldName] === 'corrected')
            return [fieldName, 'corrected'];
          const originalValue = (originalAnalysis[fieldName] as ExtractedField)
            .value;
          const verifiedValue = (
            analysisResult.analysis[fieldName] as ExtractedField
          ).value;
          return [
            fieldName,
            JSON.stringify(originalValue) === JSON.stringify(verifiedValue)
              ? 'accepted'
              : 'corrected',
          ];
        }),
      ),
    }));
  };

  const pendingReviewCount = extractionFields.filter(
    ([fieldName]) =>
      !fieldReviews[fieldName] || fieldReviews[fieldName] === 'pending',
  ).length;

  const saveVerifiedRecord = async () => {
    if (!analysisResult) return;
    if (pendingReviewCount) {
      setAnalysisError(
        `Confirm the remaining ${pendingReviewCount} extracted field${pendingReviewCount === 1 ? '' : 's'} before saving.`,
      );
      setAnalysisStatus('error');
      return;
    }
    setAnalysisStatus('saving');
    setAnalysisError('');
    try {
      const response = await fetch('/api/workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysisRunId: analysisResult.analysisRunId,
          stage,
          analysis: analysisResult.analysis,
          document: analysisResult.document,
          review: {
            fields: extractionFields.map(([fieldName]) => ({
              fieldName,
              status: fieldReviews[fieldName],
            })),
          },
        }),
      });
      const body = (await response.json()) as {
        saved?: boolean;
        workspace?: Workspace;
        registeredContract?: { id: string; contractNumber: string } | null;
        error?: string;
      };
      if (!response.ok || !body.workspace)
        throw new Error(
          body.error || 'The verified record could not be saved.',
        );
      setWorkspace(body.workspace);
      if (stage === 'executed' && body.registeredContract) {
        setActiveView('Contract Register');
        setSearch(body.registeredContract.contractNumber);
        setDialogOpen(false);
        setAnalysisStatus('idle');
      } else {
        setAnalysisStatus('saved');
      }
    } catch (error) {
      setAnalysisError(
        error instanceof Error
          ? error.message
          : 'The verified record could not be saved.',
      );
      setAnalysisStatus('error');
    }
  };

  const exportRegisters = async () => {
    if (!workspace) return;
    setExporting(true);
    try {
      await exportCurrentRegisters(workspace);
    } finally {
      setExporting(false);
    }
  };

  const resetDemo = async () => {
    if (
      !window.confirm(
        'Reset all local demo changes and restore the original fictional records?',
      )
    )
      return;
    setResetting(true);
    setWorkspaceError('');
    try {
      const response = await fetch('/api/workspace/reset', { method: 'POST' });
      const body = (await response.json()) as {
        workspace?: Workspace;
        error?: string;
      };
      if (!response.ok || !body.workspace)
        throw new Error(body.error || 'The demo could not be reset.');
      setWorkspace(body.workspace);
      setDetail(null);
      setSearch('');
    } catch (error) {
      setWorkspaceError(
        error instanceof Error ? error.message : 'The demo could not be reset.',
      );
    } finally {
      setResetting(false);
    }
  };

  const counts = {
    review:
      workspace?.intakes.filter((item) => item.review_status !== 'complete')
        .length ?? 0,
    alerts:
      (workspace?.keyDates.filter((item) => item.status !== 'completed')
        .length ?? 0) + (workspace?.supplierAlerts.length ?? 0),
  };

  const navCount = (label: ViewName) => {
    if (label === 'New Contract Review') return counts.review;
    if (label === 'Alerts & Exports') return counts.alerts;
    return 0;
  };

  const filteredContracts = useMemo(() => {
    const query = search.toLowerCase().trim();
    if (!workspace || !query) return workspace?.contracts ?? [];
    return workspace.contracts.filter((item) =>
      [
        item.contract_number,
        item.title,
        item.supplier_name,
        item.contract_type,
        item.department,
        item.owner,
        item.status,
        item.effective_date,
        item.expiration_date,
        item.payment_terms,
        item.governing_law,
        typeof item.current_value_cents === 'number'
          ? String(item.current_value_cents / 100)
          : '',
      ]
        .join(' ')
        .toLowerCase()
        .includes(query),
    );
  }, [search, workspace]);

  const filteredSuppliers = useMemo(() => {
    const query = search.toLowerCase().trim();
    if (!workspace || !query) return workspace?.suppliers ?? [];
    return workspace.suppliers.filter((item) =>
      [
        item.vendor_number,
        item.legal_name,
        item.dba_name,
        item.category,
        item.status,
        item.primary_contact,
        item.email,
        item.phone,
        item.city,
        item.state,
        item.tax_classification,
        item.risk_tier,
        item.qualification_status,
        item.relationship_stage,
        item.linked_contracts,
        item.linked_intakes,
        typeof item.total_contract_value_cents === 'number'
          ? String(item.total_contract_value_cents / 100)
          : '',
      ]
        .join(' ')
        .toLowerCase()
        .includes(query),
    );
  }, [search, workspace]);

  return (
    <main className="min-h-screen bg-[#f3f6f8] text-[#17212b]">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-[252px] border-r border-[#dce3e8] bg-[#0d2638] text-white lg:flex lg:flex-col">
        <div className="flex h-[78px] items-center gap-3 border-b border-white/10 px-6">
          <div className="flex size-10 items-center justify-center rounded-xl bg-[#2f86a6] shadow-lg shadow-black/10">
            <FileCheck2 className="size-5" />
          </div>
          <div>
            <div className="text-[15px] font-semibold tracking-[-0.01em]">
              ContractLedger AI
            </div>
            <div className="mt-0.5 text-[11px] text-slate-300">
              Register automation
            </div>
          </div>
        </div>

        <nav
          className="flex-1 space-y-1 px-3 py-5"
          aria-label="Primary navigation"
        >
          <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            Workspace
          </p>
          {navItems.map((item) => {
            const Icon = item.icon;
            const count = navCount(item.label);
            const active = activeView === item.label;
            return (
              <button
                key={item.label}
                type="button"
                onClick={() => {
                  setActiveView(item.label);
                  setSearch('');
                }}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13px] transition ${
                  active
                    ? 'bg-white/12 font-medium text-white shadow-sm'
                    : 'text-slate-300 hover:bg-white/7 hover:text-white'
                }`}
              >
                <Icon
                  className={`size-[17px] ${active ? 'text-[#62c0dc]' : 'text-slate-400'}`}
                />
                <span className="flex-1">{item.label}</span>
                {count ? (
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-slate-200">
                    {count}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>

        <div className="m-3 rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center gap-2 text-xs font-medium">
            <ShieldCheck className="size-4 text-[#62c0dc]" />
            Demo workspace
          </div>
          <p className="mt-2 text-[11px] leading-5 text-slate-400">
            All contracts, suppliers, and company policies are fictional.
          </p>
        </div>
      </aside>

      <div className="lg:pl-[252px]">
        <header className="sticky top-0 z-10 flex h-[78px] items-center justify-between border-b border-[#dce3e8] bg-white/95 px-5 backdrop-blur md:px-8">
          <div className="flex items-center gap-3 lg:hidden">
            <div className="flex size-9 items-center justify-center rounded-lg bg-[#12344a] text-white">
              <FileCheck2 className="size-4" />
            </div>
            <span className="text-sm font-semibold">ContractLedger AI</span>
          </div>
          <div className="relative hidden w-full max-w-[440px] lg:block">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Search contracts and suppliers"
              placeholder="Search contracts, suppliers, values, or dates…"
              className="h-10 border-[#d7e0e5] bg-[#f7f9fa] pl-9 shadow-none placeholder:text-slate-400"
            />
          </div>
          <div className="ml-auto flex items-center gap-3">
            <button
              type="button"
              onClick={() => setActiveView('Alerts & Exports')}
              aria-label="Notifications"
              className="relative flex size-9 items-center justify-center rounded-lg border border-[#dce3e8] bg-white text-slate-600"
            >
              <BellRing className="size-4" />
              {counts.alerts ? (
                <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-semibold text-white">
                  {counts.alerts}
                </span>
              ) : null}
            </button>
            <button
              type="button"
              className="flex items-center gap-2 rounded-lg px-1 py-1 text-left"
            >
              <span className="flex size-9 items-center justify-center rounded-lg bg-[#d7ebf2] text-xs font-semibold text-[#17425a]">
                SA
              </span>
              <span className="hidden sm:block">
                <span className="block text-xs font-semibold">
                  Selina Armstrong
                </span>
                <span className="block text-[10px] text-slate-500">
                  Contract Administrator
                </span>
              </span>
              <ChevronDown className="hidden size-3.5 text-slate-400 sm:block" />
            </button>
          </div>
        </header>

        <div className="border-b border-[#dce3e8] bg-white px-4 py-2 lg:hidden">
          <div className="flex gap-1 overflow-x-auto">
            {navItems.map((item) => (
              <button
                key={item.label}
                onClick={() => setActiveView(item.label)}
                className={`shrink-0 rounded-md px-3 py-1.5 text-xs ${activeView === item.label ? 'bg-[#e4f2f6] font-medium text-[#1c647e]' : 'text-slate-500'}`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mx-auto max-w-[1500px] px-5 py-7 md:px-8 md:py-9">
          {workspaceError ? (
            <Alert variant="destructive" className="mb-5">
              <AlertCircle />
              <AlertTitle>Workspace unavailable</AlertTitle>
              <AlertDescription>{workspaceError}</AlertDescription>
            </Alert>
          ) : null}
          {activeView === 'Dashboard' ? (
            <DashboardView
              workspace={workspace}
              onOpen={openIntake}
              onExport={exportRegisters}
              exporting={exporting}
              onNavigate={setActiveView}
              onReset={resetDemo}
              resetting={resetting}
            />
          ) : null}
          {activeView === 'New Contract Review' ? (
            <NewContractReviewView
              workspace={workspace}
              onOpen={() => openIntake('draft')}
            />
          ) : null}
          {activeView === 'Contract Register' ? (
            <ContractRegisterView
              contracts={filteredContracts}
              allContracts={workspace?.contracts ?? []}
              recentContracts={workspace?.contracts.slice(0, 5) ?? []}
              search={search}
              onSearch={setSearch}
              onRegister={() => openIntake('executed')}
              onExport={exportRegisters}
              exporting={exporting}
              onSelect={(id) => setDetail({ type: 'contract', id })}
              onOpenAlerts={() => setActiveView('Alerts & Exports')}
            />
          ) : null}
          {activeView === 'Supplier Register' ? (
            <SupplierRegisterView
              suppliers={filteredSuppliers}
              allSuppliers={workspace?.suppliers ?? []}
              search={search}
              onSearch={setSearch}
              onSelect={(id) => setDetail({ type: 'supplier', id })}
              onAdd={() => setSupplierDialogOpen(true)}
              onOpenAlerts={() => setActiveView('Alerts & Exports')}
            />
          ) : null}
          {activeView === 'Alerts & Exports' ? (
            <AlertsExportsView
              workspace={workspace}
              onExport={exportRegisters}
              exporting={exporting}
              onRefresh={loadWorkspace}
              onSelectContract={(id) => setDetail({ type: 'contract', id })}
              onSelectSupplier={(id) => setDetail({ type: 'supplier', id })}
            />
          ) : null}
          {activeView === 'AI Evaluation' ? (
            <AIEvaluationView
              workspace={workspace}
              onCompleted={(nextWorkspace) => setWorkspace(nextWorkspace)}
            />
          ) : null}
        </div>
      </div>

      {dialogOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/25 p-4 backdrop-blur-[2px]"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setDialogOpen(false);
          }}
        >
          <dialog
            open
            aria-modal="true"
            aria-labelledby="intake-dialog-title"
            className="relative m-0 max-h-[92vh] w-full max-w-[820px] overflow-y-auto rounded-xl bg-white p-0 text-sm shadow-2xl ring-1 ring-slate-900/10"
          >
            <button
              type="button"
              onClick={() => setDialogOpen(false)}
              aria-label="Close intake dialog"
              className="absolute right-4 top-4 z-10 flex size-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
            >
              ×
            </button>
            <div className="border-b border-[#e1e7ea] px-6 py-5">
              <div className="mb-1 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#347d96]">
                <Sparkles className="size-3.5" />
                DeepSeek document extraction
              </div>
              <h2
                id="intake-dialog-title"
                className="text-lg font-medium leading-none"
              >
                {stage === 'draft'
                  ? 'Review a new contract'
                  : 'Register an executed contract'}
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                {stage === 'draft'
                  ? 'Extract proposed fields and playbook differences. Nothing will enter the official contract register.'
                  : 'Extract official signed data, verify it, and add the record to the contract and supplier registers.'}
              </p>
            </div>

            <div className="space-y-5 px-6 py-5">
              {analysisStatus === 'saved' ? (
                <div className="flex min-h-64 flex-col items-center justify-center text-center">
                  <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                    <Check className="size-6" />
                  </span>
                  <h3 className="text-base font-semibold">
                    Verified record saved
                  </h3>
                  <p className="mt-2 max-w-md text-xs leading-5 text-slate-500">
                    {stage === 'draft'
                      ? 'The draft is now in the review queue and its proposed amount remains outside the official register.'
                      : 'The executed agreement now appears in both the official contract register and its linked supplier record.'}
                  </p>
                  <Button className="mt-5" onClick={() => setDialogOpen(false)}>
                    Return to workspace
                  </Button>
                </div>
              ) : (
                <>
                  <div className="rounded-xl border-2 border-dashed border-[#c9d8de] bg-[#f8fafb] p-5">
                    <input
                      ref={fileInput}
                      type="file"
                      accept=".pdf,.txt,application/pdf,text/plain"
                      className="sr-only"
                      onChange={(event) => {
                        setSelectedFile(event.target.files?.[0] ?? null);
                        setAnalysisResult(null);
                        setOriginalAnalysis(null);
                        setFieldReviews({});
                        setAnalysisStatus('idle');
                        setAnalysisError('');
                      }}
                    />
                    <div className="flex flex-col items-center text-center sm:flex-row sm:text-left">
                      <span className="mb-3 flex size-10 items-center justify-center rounded-lg bg-[#e4f2f6] text-[#287693] sm:mb-0 sm:mr-4">
                        <Upload className="size-5" />
                      </span>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-[#203845]">
                          {selectedFile
                            ? selectedFile.name
                            : 'Choose a contract document'}
                        </p>
                        <p className="mt-1 text-[11px] text-slate-500">
                          Text-based PDF or TXT · maximum 8 MB · demo files only
                        </p>
                      </div>
                      <div className="mt-4 flex gap-2 sm:mt-0">
                        <Button
                          variant="outline"
                          className="bg-white"
                          onClick={loadDemoDocument}
                        >
                          Use demo PDF
                        </Button>
                        <Button
                          variant="outline"
                          className="bg-white"
                          onClick={() => fileInput.current?.click()}
                        >
                          {selectedFile ? 'Replace file' : 'Browse files'}
                        </Button>
                      </div>
                    </div>
                  </div>

                  {analysisStatus === 'analyzing' ? (
                    <div className="flex min-h-48 flex-col items-center justify-center rounded-xl border border-[#dce3e8] bg-white text-center">
                      <LoaderCircle className="size-7 animate-spin text-[#287d9b]" />
                      <p className="mt-3 text-sm font-medium">
                        Extracting traceable contract fields…
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        DeepSeek is treating the uploaded document as untrusted
                        source data.
                      </p>
                    </div>
                  ) : null}

                  {analysisError ? (
                    <Alert variant="destructive">
                      <AlertCircle />
                      <AlertTitle>Analysis needs attention</AlertTitle>
                      <AlertDescription>{analysisError}</AlertDescription>
                    </Alert>
                  ) : null}

                  {analysisResult && analysisStatus !== 'analyzing' ? (
                    <AnalysisReview
                      result={analysisResult}
                      originalAnalysis={originalAnalysis}
                      stage={stage}
                      fieldReviews={fieldReviews}
                      onFieldChange={updateReviewedField}
                      onConfirmField={confirmReviewedField}
                      onConfirmAll={confirmAllUnchangedFields}
                    />
                  ) : null}
                </>
              )}
            </div>

            {analysisStatus !== 'saved' ? (
              <div className="flex flex-col-reverse gap-2 border-t border-[#e1e7ea] bg-slate-50 px-6 py-4 sm:flex-row sm:justify-end">
                {analysisResult ? (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setAnalysisResult(null);
                        setOriginalAnalysis(null);
                        setFieldReviews({});
                        setAnalysisStatus('idle');
                      }}
                    >
                      Start over
                    </Button>
                    <Button
                      onClick={saveVerifiedRecord}
                      disabled={
                        analysisStatus === 'saving' || pendingReviewCount > 0
                      }
                      className="bg-[#1d718f] hover:bg-[#185f78]"
                    >
                      {analysisStatus === 'saving' ? (
                        <LoaderCircle className="animate-spin" />
                      ) : (
                        <Database />
                      )}{' '}
                      {stage === 'draft'
                        ? pendingReviewCount
                          ? `Confirm ${pendingReviewCount} fields to save`
                          : 'Save reviewed intake'
                        : pendingReviewCount
                          ? `Confirm ${pendingReviewCount} fields to save`
                          : 'Add verified data to registers'}
                    </Button>
                  </>
                ) : (
                  <Button
                    onClick={analyzeDocument}
                    disabled={!selectedFile || analysisStatus === 'analyzing'}
                    className="bg-[#1d718f] hover:bg-[#185f78]"
                  >
                    <Sparkles />
                    Analyze with DeepSeek
                  </Button>
                )}
              </div>
            ) : null}
          </dialog>
        </div>
      ) : null}
      <SupplierOnboardingDialog
        open={supplierDialogOpen}
        onOpenChange={setSupplierDialogOpen}
        onCreated={(nextWorkspace, supplierName) => {
          setWorkspace(nextWorkspace);
          setSearch(supplierName);
        }}
      />
      {detail && workspace ? (
        <RecordDetailDialog
          workspace={workspace}
          selection={detail}
          onClose={() => setDetail(null)}
          onRefresh={loadWorkspace}
        />
      ) : null}
    </main>
  );
}

function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <section className="mb-7 flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
      <div>
        <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#397d96]">
          <Sparkles className="size-3.5" />
          {eyebrow}
        </div>
        <h1 className="text-[28px] font-semibold tracking-[-0.03em] text-[#142534] md:text-[32px]">
          {title}
        </h1>
        <p className="mt-1.5 max-w-2xl text-[13px] leading-6 text-slate-500">
          {description}
        </p>
      </div>
      {action}
    </section>
  );
}

function DashboardView({
  workspace,
  onOpen,
  onExport,
  exporting,
  onNavigate,
  onReset,
  resetting,
}: {
  workspace: Workspace | null;
  onOpen: (stage: IntakeStage) => void;
  onExport: () => void;
  exporting: boolean;
  onNavigate: (view: ViewName) => void;
  onReset: () => void;
  resetting: boolean;
}) {
  const metrics = [
    {
      label: 'Active contracts',
      value: String(workspace?.metrics.active_contracts ?? '—'),
      note: 'Executed contracts only',
      icon: FileText,
      tone: 'blue',
    },
    {
      label: 'Current contract value',
      value: workspace
        ? moneyFromCents(workspace.metrics.current_value_cents, true)
        : '—',
      note: 'No draft amounts included',
      icon: BookOpenCheck,
      tone: 'slate',
    },
    {
      label: 'Active suppliers',
      value: String(workspace?.metrics.active_suppliers ?? '—'),
      note: `${workspace?.metrics.pending_suppliers ?? 0} pending onboarding`,
      icon: Building2,
      tone: 'green',
    },
    {
      label: 'Records to verify',
      value: String(workspace?.metrics.records_to_verify ?? '—'),
      note: 'Human confirmation required',
      icon: AlertTriangle,
      tone: 'amber',
    },
  ];
  const iconColors: Record<string, string> = {
    blue: 'bg-sky-50 text-sky-700',
    slate: 'bg-slate-100 text-slate-700',
    green: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
  };
  return (
    <>
      <PageHeading
        eyebrow="AI-assisted register operations"
        title="Contract operations dashboard"
        description="Turn draft and executed agreements into verified contract and supplier records—without mixing proposed data into the official register."
        action={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="lg"
              onClick={onReset}
              disabled={resetting}
              className="h-10 border-[#cdd9df] bg-white px-4 text-slate-600 shadow-sm"
            >
              {resetting ? (
                <LoaderCircle className="animate-spin" />
              ) : (
                <RotateCcw />
              )}
              Reset demo
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={onExport}
              disabled={!workspace || exporting}
              className="h-10 border-[#cdd9df] bg-white px-4 text-[#244455] shadow-sm"
            >
              {exporting ? (
                <LoaderCircle className="animate-spin" />
              ) : (
                <Download />
              )}
              Generate current registers
            </Button>
          </div>
        }
      />
      <section className="mb-7 grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <div
              key={metric.label}
              className="rounded-xl border border-[#dce3e8] bg-white p-5 shadow-[0_1px_2px_rgb(15_23_42/3%)]"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[12px] font-medium text-slate-500">
                    {metric.label}
                  </p>
                  <p className="mt-2 text-[28px] font-semibold tracking-[-0.04em] text-[#172a38]">
                    {metric.value}
                  </p>
                </div>
                <span
                  className={`flex size-9 items-center justify-center rounded-lg ${iconColors[metric.tone]}`}
                >
                  <Icon className="size-[17px]" />
                </span>
              </div>
              <p className="mt-3 text-[11px] text-slate-500">{metric.note}</p>
            </div>
          );
        })}
      </section>
      <section className="mb-7 grid gap-4 xl:grid-cols-2">
        <article className="relative overflow-hidden rounded-xl border border-[#b9d9e5] bg-[#edf8fb] p-5">
          <div className="absolute right-5 top-5 flex size-10 items-center justify-center rounded-lg bg-white/80 text-[#257a98]">
            <FileSearch className="size-5" />
          </div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#43849a]">
            Pre-execution
          </p>
          <h2 className="mt-2 text-lg font-semibold text-[#14364a]">
            Review a new contract
          </h2>
          <p className="mt-1 max-w-[440px] text-[12px] leading-5 text-[#557280]">
            Extract proposed terms, compare the draft to the demo playbook, and
            create a pending supplier. Draft values stay outside the official
            register.
          </p>
          <Button
            onClick={() => onOpen('draft')}
            className="mt-5 h-9 bg-[#1d718f] hover:bg-[#185f78]"
          >
            <Upload />
            Upload draft
            <ArrowRight />
          </Button>
        </article>
        <article className="relative overflow-hidden rounded-xl border border-[#cbd8dc] bg-white p-5">
          <div className="absolute right-5 top-5 flex size-10 items-center justify-center rounded-lg bg-[#eef3f5] text-[#274b5c]">
            <FileCheck2 className="size-5" />
          </div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            Post-execution
          </p>
          <h2 className="mt-2 text-lg font-semibold text-[#1b2e3a]">
            Register an executed contract
          </h2>
          <p className="mt-1 max-w-[440px] text-[12px] leading-5 text-slate-500">
            Verify the signed version, update both official registers, and
            activate renewal and key-date monitoring.
          </p>
          <Button
            onClick={() => onOpen('executed')}
            variant="outline"
            className="mt-5 h-9 border-[#bfcdd3] bg-white text-[#244757]"
          >
            <Upload />
            Upload executed copy
            <ArrowRight />
          </Button>
        </article>
      </section>
      <DemoTransactionComparison
        comparison={workspace?.transactionComparisons[0]}
      />
      <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_360px]">
        <Panel className="overflow-hidden">
          <PanelHeader
            title="AI review queue"
            description="Human confirmation is required before official records change."
            action={
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onNavigate('New Contract Review')}
                className="text-[#2e7188]"
              >
                View all
              </Button>
            }
          />
          <IntakeTable intakes={workspace?.intakes.slice(0, 4) ?? []} />
        </Panel>
        <Panel>
          <PanelHeader
            title="Priority alerts"
            description="Renewal, supplier, and data quality"
            action={<Clock3 className="size-4 text-slate-400" />}
          />
          <KeyDateList
            items={
              workspace?.keyDates
                .filter((item) => item.status !== 'completed')
                .slice(0, 4) ?? []
            }
          />
          <div className="mx-5 mb-5 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2.5 text-[11px] text-emerald-800">
            <CircleCheck className="size-4" />
            Official records use verified values only
          </div>
        </Panel>
      </div>
    </>
  );
}

function DemoTransactionComparison({
  comparison,
}: {
  comparison?: Workspace['transactionComparisons'][number];
}) {
  const displayValue = (fieldName: string, value: string | number | null) => {
    if (value === null || value === '') return 'Not found';
    if (fieldName === 'contractValue')
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
      }).format(Number(value));
    if (fieldName === 'noticeDays') return `${value} days`;
    if (fieldName === 'renewalType') return titleCase(value);
    return String(value);
  };

  if (!comparison)
    return (
      <Panel className="mb-7 overflow-hidden border-[#c9dbe2]">
        <PanelHeader
          title="AI draft-to-executed comparison"
          description="Generated only from two human-verified analyses for the same supplier—not from fixed dashboard text."
          action={
            <Badge
              variant="outline"
              className="border-sky-200 bg-sky-50 text-sky-800"
            >
              Ready for live demo
            </Badge>
          }
        />
        <div className="grid gap-3 bg-[#f8fafb] p-5 md:grid-cols-3">
          {[
            [
              '1',
              'Review the draft',
              'AI extracts proposed terms and records playbook differences.',
            ],
            [
              '2',
              'Register the signed copy',
              'AI extracts the executed source of truth after human verification.',
            ],
            [
              '3',
              'Compare automatically',
              'The dashboard shows actual value and clause-field changes between both files.',
            ],
          ].map(([number, title, description]) => (
            <div
              key={number}
              className="rounded-xl border border-[#dce3e8] bg-white p-4"
            >
              <span className="flex size-7 items-center justify-center rounded-full bg-[#e4f2f6] text-xs font-semibold text-[#287693]">
                {number}
              </span>
              <p className="mt-3 text-xs font-semibold text-[#203845]">
                {title}
              </p>
              <p className="mt-1 text-[10px] leading-4 text-slate-500">
                {description}
              </p>
            </div>
          ))}
        </div>
      </Panel>
    );

  return (
    <Panel className="mb-7 overflow-hidden border-[#c9dbe2]">
      <PanelHeader
        title="AI draft-to-executed comparison"
        description={`${comparison.supplierName} · ${comparison.draftFileName} compared with ${comparison.executedFileName}`}
        action={
          <Badge
            variant="outline"
            className="border-emerald-200 bg-emerald-50 text-emerald-800"
          >
            AI generated · Human verified
          </Badge>
        }
      />
      <div className="overflow-x-auto">
        <Table className="min-w-[700px]">
          <TableHeader>
            <TableRow className="bg-[#f7f9fa]">
              <TableHead className="w-[28%] px-5">Control point</TableHead>
              <TableHead className="w-[36%]">
                <span className="mr-2 inline-block size-2 rounded-full bg-amber-500" />
                Draft · pre-execution
              </TableHead>
              <TableHead className="w-[36%]">
                <span className="mr-2 inline-block size-2 rounded-full bg-emerald-500" />
                Executed · source of truth
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {comparison.changes.map((change) => (
              <TableRow key={change.fieldName}>
                <TableCell className="px-5 py-3 text-xs font-medium text-[#294454]">
                  <span>{change.label}</span>
                  {change.changed ? (
                    <StatusBadge tone="amber">Changed</StatusBadge>
                  ) : (
                    <StatusBadge tone="green">Unchanged</StatusBadge>
                  )}
                </TableCell>
                <TableCell className="text-xs text-slate-500">
                  {displayValue(change.fieldName, change.draftValue)}
                </TableCell>
                <TableCell className="text-xs font-medium text-[#1f5f4c]">
                  {displayValue(change.fieldName, change.executedValue)}
                </TableCell>
              </TableRow>
            ))}
            <TableRow>
              <TableCell className="px-5 py-3 text-xs font-medium text-[#294454]">
                Playbook findings
              </TableCell>
              <TableCell className="text-xs text-slate-500">
                {comparison.draftFindingCount} draft differences
              </TableCell>
              <TableCell className="text-xs font-medium text-[#1f5f4c]">
                {comparison.executedFindingCount} executed exceptions
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
      <div className="flex flex-col gap-2 border-t border-[#e3e9ed] bg-[#f7fbfc] px-5 py-3 text-[11px] text-slate-600 sm:flex-row sm:items-center sm:justify-between">
        <span className="flex items-center gap-2">
          <ShieldCheck className="size-3.5 text-[#2f7b94]" />
          Comparison uses the saved, human-verified AI values—not temporary
          model output.
        </span>
        <span className="flex items-center gap-2">
          <CircleCheck className="size-3.5 text-emerald-600" />
          Only the executed side updates official totals and alerts.
        </span>
      </div>
    </Panel>
  );
}

function NewContractReviewView({
  workspace,
  onOpen,
}: {
  workspace: Workspace | null;
  onOpen: () => void;
}) {
  return (
    <>
      <PageHeading
        eyebrow="Pre-execution workspace"
        title="New contract review"
        description="Drafts are reviewed against a fictional company playbook. Proposed values and dates remain separate from the official contract register."
        action={
          <Button onClick={onOpen} className="bg-[#1d718f] hover:bg-[#185f78]">
            <Upload />
            Upload draft
          </Button>
        }
      />
      <Alert className="mb-5 border-sky-200 bg-sky-50 text-sky-900">
        <ShieldCheck />
        <AlertTitle>Clear data boundary</AlertTitle>
        <AlertDescription>
          A pending supplier may be created during draft intake, but the
          contract amount is not counted until an executed copy is verified.
        </AlertDescription>
      </Alert>
      <Panel className="overflow-hidden">
        <PanelHeader
          title="Draft review queue"
          description="Open findings and proposed records awaiting human action"
        />
        <IntakeTable
          intakes={(workspace?.intakes ?? []).filter(
            (item) => item.status !== 'executed',
          )}
        />
      </Panel>
    </>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  titleCaseOptions = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  titleCaseOptions?: boolean;
}) {
  return (
    <label className="text-[11px] font-medium text-slate-600">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 h-9 w-full rounded-md border border-input bg-white px-3 text-xs"
      >
        <option value="all">All</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {titleCaseOptions ? titleCase(option) : option}
          </option>
        ))}
      </select>
    </label>
  );
}

function DateFilter({
  label,
  condition,
  onConditionChange,
  date,
  onDateChange,
}: {
  label: string;
  condition: string;
  onConditionChange: (value: string) => void;
  date: string;
  onDateChange: (value: string) => void;
}) {
  return (
    <label className="text-[11px] font-medium text-slate-600">
      {label}
      <div className="mt-1 flex">
        <select
          value={condition}
          onChange={(event) => onConditionChange(event.target.value)}
          className="h-9 rounded-l-md border border-r-0 border-input bg-white px-2 text-xs"
        >
          <option value="all">Any date</option>
          <option value="on_or_before">On or before</option>
          <option value="on_or_after">On or after</option>
        </select>
        <Input
          type="date"
          value={date}
          onChange={(event) => onDateChange(event.target.value)}
          aria-label={`${label} filter date`}
          className="h-9 rounded-l-none bg-white text-xs"
        />
      </div>
    </label>
  );
}

function ContractRegisterView({
  contracts,
  allContracts,
  recentContracts,
  search,
  onSearch,
  onRegister,
  onExport,
  exporting,
  onSelect,
  onOpenAlerts,
}: {
  contracts: Workspace['contracts'];
  allContracts: Workspace['contracts'];
  recentContracts: Workspace['contracts'];
  search: string;
  onSearch: (value: string) => void;
  onRegister: () => void;
  onExport: () => void;
  exporting: boolean;
  onSelect: (id: string) => void;
  onOpenAlerts: () => void;
}) {
  const [insightsOpen, setInsightsOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState('all');
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [amountComparison, setAmountComparison] = useState('all');
  const [amountValue, setAmountValue] = useState('100000');
  const [effectiveCondition, setEffectiveCondition] = useState('all');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [expirationCondition, setExpirationCondition] = useState('all');
  const [expirationDate, setExpirationDate] = useState('');
  const options = (key: string) =>
    Array.from(
      new Set(
        contracts
          .map((item) => valueText(item[key]))
          .filter((value) => value !== 'Not found'),
      ),
    ).sort((a, b) => a.localeCompare(b));
  const visibleContracts = contracts.filter((item) => {
    if (typeFilter !== 'all' && item.contract_type !== typeFilter) return false;
    if (supplierFilter !== 'all' && item.supplier_name !== supplierFilter)
      return false;
    if (departmentFilter !== 'all' && item.department !== departmentFilter)
      return false;
    if (statusFilter !== 'all' && item.status !== statusFilter) return false;
    const thresholdCents = Number(amountValue) * 100;
    const currentCents = Number(item.current_value_cents ?? 0);
    if (amountComparison === 'greater' && currentCents <= thresholdCents)
      return false;
    if (amountComparison === 'less' && currentCents >= thresholdCents)
      return false;
    const matchesDate = (
      value: unknown,
      condition: string,
      filterDate: string,
    ) => {
      if (condition === 'all' || !filterDate) return true;
      const dateValue = typeof value === 'string' ? value : '';
      if (!dateValue) return false;
      return condition === 'on_or_before'
        ? dateValue <= filterDate
        : dateValue >= filterDate;
    };
    return (
      matchesDate(item.effective_date, effectiveCondition, effectiveDate) &&
      matchesDate(item.expiration_date, expirationCondition, expirationDate)
    );
  });
  const clearFilters = () => {
    setTypeFilter('all');
    setSupplierFilter('all');
    setDepartmentFilter('all');
    setStatusFilter('all');
    setAmountComparison('all');
    setAmountValue('100000');
    setEffectiveCondition('all');
    setEffectiveDate('');
    setExpirationCondition('all');
    setExpirationDate('');
  };
  return (
    <>
      <PageHeading
        eyebrow="Official records only"
        title="Contract register"
        description="Executed, active, expired, terminated, and closed contracts. Drafts and proposed values never appear here."
        action={
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={onRegister}
              className="bg-[#1d718f] hover:bg-[#185f78]"
            >
              <Upload />
              Register executed contract
            </Button>
            <Button variant="outline" onClick={onExport}>
              {exporting ? (
                <LoaderCircle className="animate-spin" />
              ) : (
                <FileSpreadsheet />
              )}
              Export workbook
            </Button>
            <Button
              variant="outline"
              onClick={() => setInsightsOpen(true)}
              disabled={!visibleContracts.length}
              className="border-[#9bc6d5] bg-[#edf8fb] text-[#1d657f] hover:bg-[#e1f2f7]"
            >
              <Sparkles />
              AI management insights
            </Button>
          </div>
        }
      />
      <div className="mb-5 rounded-xl border border-[#c9dbe2] bg-white px-5 py-4 shadow-[0_1px_2px_rgb(15_23_42/3%)]">
        <div className="grid gap-3 md:grid-cols-4">
          {[
            ['01', 'Signed agreement', 'Upload the executed source copy'],
            ['02', 'AI extraction', 'Read official values, dates, and terms'],
            ['03', 'Human verification', 'Confirm fields and source pages'],
            ['04', 'Official register', 'Update supplier, dates, and totals'],
          ].map(([number, title, description], index) => (
            <div
              key={number}
              className={`relative rounded-lg px-3 py-2 ${index ? 'md:border-l md:border-[#dce4e8] md:pl-5' : ''}`}
            >
              <div className="text-[9px] font-semibold tracking-[0.14em] text-[#43849a]">
                STEP {number}
              </div>
              <div className="mt-1 text-xs font-semibold text-[#203845]">
                {title}
              </div>
              <div className="mt-0.5 text-[10px] leading-4 text-slate-500">
                {description}
              </div>
            </div>
          ))}
        </div>
      </div>
      <Panel className="overflow-hidden">
        <PanelHeader
          title="Current contract register"
          description={`${visibleContracts.length} of ${contracts.length} verified records shown`}
          action={
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(event) => onSearch(event.target.value)}
                placeholder="Filter register…"
                className="pl-9"
              />
            </div>
          }
        />
        <div className="border-b border-[#e3e9ed] bg-[#f8fafb] p-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">
            <FilterSelect
              label="Contract type"
              value={typeFilter}
              onChange={setTypeFilter}
              options={options('contract_type')}
            />
            <FilterSelect
              label="Supplier"
              value={supplierFilter}
              onChange={setSupplierFilter}
              options={options('supplier_name')}
            />
            <FilterSelect
              label="Department"
              value={departmentFilter}
              onChange={setDepartmentFilter}
              options={options('department')}
            />
            <FilterSelect
              label="Status"
              value={statusFilter}
              onChange={setStatusFilter}
              options={options('status')}
              titleCaseOptions
            />
            <label className="text-[11px] font-medium text-slate-600">
              Contract amount
              <div className="mt-1 flex">
                <select
                  value={amountComparison}
                  onChange={(event) => setAmountComparison(event.target.value)}
                  className="h-9 rounded-l-md border border-r-0 border-input bg-white px-2 text-xs"
                >
                  <option value="all">Any amount</option>
                  <option value="greater">Greater than</option>
                  <option value="less">Less than</option>
                </select>
                <Input
                  type="number"
                  min="0"
                  step="1000"
                  value={amountValue}
                  onChange={(event) => setAmountValue(event.target.value)}
                  aria-label="Contract amount in US dollars"
                  className="h-9 rounded-l-none bg-white text-xs"
                />
              </div>
            </label>
            <DateFilter
              label="Effective date"
              condition={effectiveCondition}
              onConditionChange={setEffectiveCondition}
              date={effectiveDate}
              onDateChange={setEffectiveDate}
            />
            <DateFilter
              label="Expiration date"
              condition={expirationCondition}
              onConditionChange={setExpirationCondition}
              date={expirationDate}
              onDateChange={setExpirationDate}
            />
            <div className="flex items-end">
              <Button
                type="button"
                variant="outline"
                onClick={clearFilters}
                className="h-9 w-full bg-white"
              >
                <RotateCcw />
                Clear filters
              </Button>
            </div>
          </div>
          <p className="mt-3 text-[10px] text-slate-500">
            Amounts use current contract value in USD. Date filters are
            inclusive; for example, “on or before 2026-08-30” includes August
            30.
          </p>
        </div>
        <div className="overflow-x-auto">
          <Table className="min-w-[1940px]">
            <TableHeader>
              <TableRow className="bg-[#f7f9fa]">
                <TableHead className="px-5">Contract</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Contract amount</TableHead>
                <TableHead>Contract type</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Original value</TableHead>
                <TableHead>Amendments</TableHead>
                <TableHead>Effective date</TableHead>
                <TableHead>Expiration date</TableHead>
                <TableHead>Renewal terms</TableHead>
                <TableHead>Notice deadline</TableHead>
                <TableHead>Payment terms</TableHead>
                <TableHead>Governing law</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleContracts.map((item) => (
                <TableRow key={String(item.id)}>
                  <TableCell className="px-5 py-3.5">
                    <button
                      type="button"
                      onClick={() => onSelect(String(item.id))}
                      className="text-left"
                    >
                      <span className="font-medium text-[#1d718f] hover:underline">
                        {valueText(item.title)}
                      </span>
                      <span className="mt-1 block text-[11px] text-slate-500">
                        {valueText(item.contract_number)} · View source document
                      </span>
                    </button>
                  </TableCell>
                  <TableCell className="text-xs">
                    {valueText(item.supplier_name)}
                  </TableCell>
                  <TableCell className="text-xs font-medium">
                    {moneyFromCents(item.current_value_cents)}
                  </TableCell>
                  <TableCell className="text-xs">
                    {valueText(item.contract_type)}
                  </TableCell>
                  <TableCell className="text-xs">
                    {valueText(item.department)}
                  </TableCell>
                  <TableCell className="text-xs">
                    {valueText(item.owner)}
                  </TableCell>
                  <TableCell className="text-xs">
                    {moneyFromCents(item.original_value_cents)}
                  </TableCell>
                  <TableCell className="text-xs">
                    {moneyFromCents(item.amendment_value_cents)}
                  </TableCell>
                  <TableCell className="text-xs">
                    {valueText(item.effective_date)}
                  </TableCell>
                  <TableCell className="text-xs">
                    {valueText(item.expiration_date)}
                  </TableCell>
                  <TableCell className="text-xs">
                    {titleCase(item.renewal_type)} ·{' '}
                    {valueText(item.notice_days)} days
                  </TableCell>
                  <TableCell className="text-xs">
                    {valueText(item.notice_deadline)}
                  </TableCell>
                  <TableCell className="text-xs">
                    {valueText(item.payment_terms)}
                  </TableCell>
                  <TableCell className="text-xs">
                    {valueText(item.governing_law)}
                  </TableCell>
                  <TableCell className="text-xs">
                    <StatusBadge tone={toneForStatus(item.status)}>
                      {titleCase(item.status)}
                    </StatusBadge>
                  </TableCell>
                  <TableCell className="text-xs">
                    {valueText(item.last_updated)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Panel>
      <details className="group mt-5 overflow-hidden rounded-xl border border-[#dce3e8] bg-white shadow-[0_1px_2px_rgb(15_23_42/3%)]">
        <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4">
          <div>
            <h2 className="text-[14px] font-semibold text-[#1b2e3a]">
              Recent registrations
            </h2>
            <p className="mt-0.5 text-[11px] text-slate-500">
              Most recently updated official contract records
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            {recentContracts.length} records
            <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
          </div>
        </summary>
        <div className="grid gap-3 border-t border-[#e3e9ed] bg-[#f8fafb] p-4 md:grid-cols-2 xl:grid-cols-3">
          {recentContracts.map((item) => (
            <button
              key={String(item.id)}
              type="button"
              onClick={() => onSelect(String(item.id))}
              className="rounded-lg border border-[#dce3e8] bg-white p-4 text-left hover:border-[#9fc4d1] hover:bg-[#fbfdfe]"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="text-xs font-semibold text-[#1d718f]">
                  {valueText(item.contract_number)}
                </span>
                <StatusBadge tone={toneForStatus(item.status)}>
                  {titleCase(item.status)}
                </StatusBadge>
              </div>
              <div className="mt-2 text-xs font-medium text-[#203845]">
                {valueText(item.title)}
              </div>
              <div className="mt-1 text-[10px] text-slate-500">
                {valueText(item.supplier_name)} · Registered{' '}
                {valueText(item.last_updated)}
              </div>
            </button>
          ))}
        </div>
      </details>
      <ManagementInsightsSheet
        open={insightsOpen}
        onOpenChange={setInsightsOpen}
        scope="contracts"
        currentRecordIds={visibleContracts.map((item) => String(item.id))}
        allRecordIds={allContracts.map((item) => String(item.id))}
        onSelectRecord={onSelect}
        onOpenAlerts={onOpenAlerts}
      />
    </>
  );
}

function newSupplierDocument(): SupplierOnboardingDocument {
  return {
    id: crypto.randomUUID(),
    documentType: 'w9',
    issuer: '',
    documentNumber: '',
    effectiveDate: '',
    expirationDate: '',
    coverageSummary: '',
    file: null,
    aiResult: null,
    analyzing: false,
    aiError: '',
  };
}

function SupplierOnboardingDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (workspace: Workspace, supplierName: string) => void;
}) {
  const initialSupplier = {
    legalName: '',
    dbaName: '',
    category: '',
    primaryContact: '',
    email: '',
    phone: '',
    website: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    postalCode: '',
    country: '',
    taxClassification: 'Pending verification',
    riskTier: 'medium',
  };
  const [supplier, setSupplier] = useState(initialSupplier);
  const [documents, setDocuments] = useState<SupplierOnboardingDocument[]>(
    () => [newSupplierDocument()],
  );
  const [saving, setSaving] = useState(false);
  const [packageAnalyzing, setPackageAnalyzing] = useState(false);
  const [profileGenerated, setProfileGenerated] = useState(false);
  const [profileEvidence, setProfileEvidence] = useState<
    Partial<Record<SupplierProfileFieldKey, SupplierProfileEvidence>>
  >({});
  const [profileWarnings, setProfileWarnings] = useState<string[]>([]);
  const [error, setError] = useState('');

  const updateSupplier = (field: keyof typeof initialSupplier, value: string) =>
    setSupplier((current) => ({ ...current, [field]: value }));
  const updateDocument = (
    id: string,
    changes: Partial<SupplierOnboardingDocument>,
  ) =>
    setDocuments((current) =>
      current.map((item) => (item.id === id ? { ...item, ...changes } : item)),
    );
  const reset = () => {
    setSupplier(initialSupplier);
    setDocuments([newSupplierDocument()]);
    setPackageAnalyzing(false);
    setProfileGenerated(false);
    setProfileEvidence({});
    setProfileWarnings([]);
    setError('');
  };

  const extractedText = (field: ExtractedField) => {
    if (field.value === null || field.value === undefined) return '';
    return String(field.value).trim();
  };

  const analysisDocumentChanges = (
    document: SupplierOnboardingDocument,
    result: SupplierDocumentAnalysisResponse,
  ): Partial<SupplierOnboardingDocument> => {
    const extractedType = result.analysis.documentType.value;
    return {
      aiResult: result,
      analyzing: false,
      aiError: '',
      documentType:
        typeof extractedType === 'string' &&
        SUPPLIER_DOCUMENT_TYPES.includes(extractedType as SupplierDocumentType)
          ? (extractedType as SupplierDocumentType)
          : document.documentType,
      issuer: extractedText(result.analysis.issuer),
      documentNumber: extractedText(result.analysis.documentNumber),
      effectiveDate: extractedText(result.analysis.effectiveDate),
      expirationDate: extractedText(result.analysis.expirationDate),
      coverageSummary: extractedText(result.analysis.coverageSummary),
    };
  };

  const generateSupplierProfile = (
    results: SupplierDocumentAnalysisResponse[],
  ) => {
    const evidence: Partial<
      Record<SupplierProfileFieldKey, SupplierProfileEvidence>
    > = {};
    const nextSupplier = { ...initialSupplier };
    const warnings: string[] = [];

    for (const [profileKey, analysisKey] of supplierProfileExtractionFields) {
      const candidates = results
        .map((result) => ({
          result,
          field: result.analysis[analysisKey] as ExtractedField,
        }))
        .filter(({ field }) => extractedText(field))
        .sort((left, right) => right.field.confidence - left.field.confidence);
      const selected = candidates[0];
      if (!selected) continue;
      nextSupplier[profileKey] = extractedText(selected.field);
      evidence[profileKey] = {
        fileName: selected.result.document.fileName,
        confidence: selected.field.confidence,
        sourcePage: selected.field.sourcePage,
      };
      const distinctValues = new Set(
        candidates.map(({ field }) => extractedText(field).toLowerCase()),
      );
      if (distinctValues.size > 1)
        warnings.push(
          `${profileKey.replace(/([A-Z])/g, ' $1').toLowerCase()} differs across uploaded files; the highest-confidence value was selected for review.`,
        );
    }

    if (!nextSupplier.category) nextSupplier.category = 'Unclassified';
    if (!nextSupplier.taxClassification)
      nextSupplier.taxClassification = 'Pending verification';
    setSupplier(nextSupplier);
    setProfileEvidence(evidence);
    setProfileWarnings([...new Set(warnings)]);
    setProfileGenerated(true);
  };

  const requestDocumentAnalysis = async (
    document: SupplierOnboardingDocument,
  ) => {
    if (!document.file)
      throw new Error('Choose a PDF, PNG, or JPEG file first.');
    const form = new FormData();
    form.append('file', document.file);
    form.append('expectedDocumentType', document.documentType);
    const response = await fetch('/api/analyze-supplier-document', {
      method: 'POST',
      body: form,
    });
    const body = (await response.json()) as SupplierDocumentAnalysisResponse & {
      error?: string;
    };
    if (!response.ok)
      throw new Error(body.error || 'Unable to analyze this supplier file.');
    return body;
  };

  const analyzeDocument = async (document: SupplierOnboardingDocument) => {
    if (!document.file) {
      updateDocument(document.id, {
        aiError: 'Choose a PDF, PNG, or JPEG file first.',
      });
      return;
    }
    updateDocument(document.id, { analyzing: true, aiError: '' });
    try {
      const body = await requestDocumentAnalysis(document);
      updateDocument(document.id, analysisDocumentChanges(document, body));
      generateSupplierProfile([
        ...documents
          .filter((item) => item.id !== document.id)
          .flatMap((item) => (item.aiResult ? [item.aiResult] : [])),
        body,
      ]);
    } catch (analysisError) {
      updateDocument(document.id, {
        analyzing: false,
        aiError:
          analysisError instanceof Error
            ? analysisError.message
            : 'Unable to analyze this supplier file.',
      });
    }
  };

  const analyzePackage = async () => {
    if (!documents.length || documents.some((item) => !item.file)) {
      setError(
        'Upload a qualification file in every file card before generating the supplier register.',
      );
      return;
    }
    setPackageAnalyzing(true);
    setError('');
    const results = new Map<string, SupplierDocumentAnalysisResponse>();
    const failures: string[] = [];
    for (const document of documents) {
      if (document.aiResult) {
        results.set(document.id, document.aiResult);
        continue;
      }
      updateDocument(document.id, { analyzing: true, aiError: '' });
      try {
        const result = await requestDocumentAnalysis(document);
        results.set(document.id, result);
        updateDocument(document.id, analysisDocumentChanges(document, result));
      } catch (analysisError) {
        const message =
          analysisError instanceof Error
            ? analysisError.message
            : 'Unable to analyze this supplier file.';
        failures.push(
          document.file?.name ?? `Qualification file ${document.id}`,
        );
        updateDocument(document.id, { analyzing: false, aiError: message });
      }
    }
    if (results.size) generateSupplierProfile([...results.values()]);
    if (failures.length)
      setError(
        `AI could not analyze ${failures.join(', ')}. Successful files were merged; review the remaining file errors.`,
      );
    setPackageAnalyzing(false);
  };

  const loadDemoSupplierPackage = async () => {
    setPackageAnalyzing(true);
    setError('');
    try {
      const demoFiles = [
        ['11_Canyon_Ridge_Demo_W9.pdf', 'w9'],
        [
          '12_Canyon_Ridge_Demo_Insurance_Certificate.pdf',
          'insurance_certificate',
        ],
        ['13_Canyon_Ridge_Demo_Business_License.pdf', 'business_license'],
      ] as const;
      const loaded = await Promise.all(
        demoFiles.map(async ([fileName, documentType]) => {
          const response = await fetch(`/demo-documents/${fileName}`);
          if (!response.ok) throw new Error(`Unable to load ${fileName}.`);
          const blob = await response.blob();
          return {
            ...newSupplierDocument(),
            documentType,
            file: new File([blob], fileName, { type: 'application/pdf' }),
          };
        }),
      );
      setDocuments(loaded);
      setSupplier(initialSupplier);
      setProfileGenerated(false);
      setProfileEvidence({});
      setProfileWarnings([]);
    } catch (demoError) {
      setError(
        demoError instanceof Error
          ? demoError.message
          : 'Unable to load the demo qualification package.',
      );
    } finally {
      setPackageAnalyzing(false);
    }
  };

  const submit = async () => {
    if (!profileGenerated || documents.some((item) => !item.aiResult)) {
      setError(
        'Analyze the complete qualification package before creating the supplier register record.',
      );
      return;
    }
    const requiredFields = [
      supplier.legalName,
      supplier.category,
      supplier.addressLine1,
      supplier.city,
      supplier.state,
      supplier.postalCode,
      supplier.country,
    ];
    if (requiredFields.some((value) => !value.trim())) {
      setError(
        'AI could not confirm every required register field. Review or complete the legal name, category, business address, city, state, postal code, and country.',
      );
      return;
    }
    if (documents.some((item) => !item.file)) {
      setError('Choose a file for every qualification record.');
      return;
    }
    if (
      documents.some(
        (item) =>
          item.documentType === 'insurance_certificate' && !item.expirationDate,
      )
    ) {
      setError('Enter an expiration date for every insurance certificate.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const form = new FormData();
      form.append('supplier', JSON.stringify(supplier));
      form.append(
        'documents',
        JSON.stringify(
          documents.map((item, index) => ({
            fileField: `document-${index}`,
            analysisRunId: item.aiResult?.analysisRunId ?? '',
            documentType: item.documentType,
            issuer: item.issuer,
            documentNumber: item.documentNumber,
            effectiveDate: item.effectiveDate,
            expirationDate: item.expirationDate,
            coverageSummary: item.coverageSummary,
          })),
        ),
      );
      documents.forEach((item, index) => {
        if (item.file) form.append(`document-${index}`, item.file);
      });
      const response = await fetch('/api/suppliers', {
        method: 'POST',
        body: form,
      });
      const body = (await response.json()) as {
        workspace?: Workspace;
        error?: string;
      };
      if (!response.ok || !body.workspace)
        throw new Error(body.error || 'Unable to create the supplier record.');
      onCreated(body.workspace, supplier.legalName);
      onOpenChange(false);
      reset();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Unable to create the supplier record.',
      );
    } finally {
      setSaving(false);
    }
  };

  const profileLocked = !profileGenerated || packageAnalyzing || saving;
  const extractedProfileCount = Object.keys(profileEvidence).length;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!saving) {
          onOpenChange(nextOpen);
          if (!nextOpen) reset();
        }
      }}
    >
      <DialogContent className="h-[84vh] min-h-[620px] w-[96vw] max-w-none grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-[1440px]">
        <DialogHeader className="border-b border-[#e1e7ea] px-6 py-4">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#347d96]">
            <Building2 className="size-3.5" />
            Independent supplier onboarding
          </div>
          <DialogTitle className="text-xl text-[#183040]">
            Create supplier from qualification files
          </DialogTitle>
          <DialogDescription className="max-w-3xl text-xs leading-5">
            Upload the supplier&apos;s W-9, business license, insurance
            certificate, or other qualification evidence. AI consolidates the
            files into a proposed supplier master for human verification before
            the database changes.
          </DialogDescription>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {[
              ['01', 'Upload files', 'Qualification evidence first'],
              ['02', 'AI builds profile', 'Merge supported supplier fields'],
              ['03', 'Verify & create', 'Human-confirmed register update'],
            ].map(([number, title, description]) => (
              <div
                key={number}
                className="rounded-lg border border-[#d9e6eb] bg-[#f8fbfc] px-3 py-2"
              >
                <span className="text-[9px] font-semibold text-[#43849a]">
                  STEP {number}
                </span>
                <span className="ml-2 text-[10px] font-semibold text-[#203845]">
                  {title}
                </span>
                <span className="ml-2 text-[9px] text-slate-500">
                  {description}
                </span>
              </div>
            ))}
          </div>
        </DialogHeader>

        <div className="grid min-h-0 overflow-hidden xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <section className="order-2 min-h-0 overflow-y-auto border-t border-[#e1e7ea] px-6 py-5 xl:border-l xl:border-t-0">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-[#203845]">
                  AI-generated supplier master
                </h3>
                <p className="mt-1 text-[11px] text-slate-500">
                  {profileGenerated
                    ? `${extractedProfileCount} fields were supported by uploaded files. Review or correct the proposed record.`
                    : 'The register preview remains locked until the qualification package is analyzed.'}
                </p>
              </div>
              <StatusBadge tone={profileGenerated ? 'green' : 'amber'}>
                {profileGenerated
                  ? 'Ready for verification'
                  : 'Waiting for files'}
              </StatusBadge>
            </div>
            {profileGenerated ? (
              <div className="mt-3 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2.5 text-[10px] leading-4 text-sky-900">
                AI values remain editable because uploaded files may be
                incomplete or inconsistent. Vendor number, Pending status, In
                Review qualification status, and the initial medium risk tier
                are applied by system rules—not invented from the documents.
              </div>
            ) : (
              <div className="mt-3 flex min-h-28 flex-col items-center justify-center rounded-xl border border-dashed border-[#c9dbe2] bg-[#f8fafb] px-5 text-center">
                <FileSearch className="size-6 text-[#6da8bb]" />
                <p className="mt-2 text-xs font-medium text-[#294354]">
                  Upload qualification files first
                </p>
                <p className="mt-1 max-w-sm text-[10px] leading-4 text-slate-500">
                  Select Generate register from files and AI will populate the
                  supplier master automatically.
                </p>
              </div>
            )}
            {profileWarnings.length ? (
              <Alert className="mt-3 border-amber-200 bg-amber-50 text-amber-900">
                <AlertTriangle />
                <AlertTitle>
                  Cross-document differences require review
                </AlertTitle>
                <AlertDescription>{profileWarnings.join(' ')}</AlertDescription>
              </Alert>
            ) : null}
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <Input
                value={supplier.legalName}
                disabled={profileLocked}
                onChange={(event) =>
                  updateSupplier('legalName', event.target.value)
                }
                placeholder="Legal name *"
                aria-label="Supplier legal name"
              />
              <Input
                value={supplier.dbaName}
                disabled={profileLocked}
                onChange={(event) =>
                  updateSupplier('dbaName', event.target.value)
                }
                placeholder="DBA name"
                aria-label="Supplier DBA name"
              />
              <Input
                value={supplier.category}
                disabled={profileLocked}
                onChange={(event) =>
                  updateSupplier('category', event.target.value)
                }
                placeholder="Category *"
                aria-label="Supplier category"
              />
              <select
                value={supplier.riskTier}
                disabled={profileLocked}
                onChange={(event) =>
                  updateSupplier('riskTier', event.target.value)
                }
                aria-label="Supplier risk tier"
                className="h-9 rounded-md border border-input bg-white px-3 text-xs"
              >
                <option value="low">Low risk</option>
                <option value="medium">Medium risk</option>
                <option value="high">High risk</option>
              </select>
              <Input
                value={supplier.primaryContact}
                disabled={profileLocked}
                onChange={(event) =>
                  updateSupplier('primaryContact', event.target.value)
                }
                placeholder="Primary contact"
                aria-label="Primary contact"
              />
              <Input
                type="email"
                value={supplier.email}
                disabled={profileLocked}
                onChange={(event) =>
                  updateSupplier('email', event.target.value)
                }
                placeholder="Email"
                aria-label="Supplier email"
              />
              <Input
                value={supplier.phone}
                disabled={profileLocked}
                onChange={(event) =>
                  updateSupplier('phone', event.target.value)
                }
                placeholder="Phone"
                aria-label="Supplier phone"
              />
              <Input
                type="url"
                value={supplier.website}
                disabled={profileLocked}
                onChange={(event) =>
                  updateSupplier('website', event.target.value)
                }
                placeholder="Website (https://…)"
                aria-label="Supplier website"
              />
              <Input
                value={supplier.addressLine1}
                disabled={profileLocked}
                onChange={(event) =>
                  updateSupplier('addressLine1', event.target.value)
                }
                placeholder="Business address *"
                aria-label="Supplier business address"
                className="md:col-span-2"
              />
              <Input
                value={supplier.addressLine2}
                disabled={profileLocked}
                onChange={(event) =>
                  updateSupplier('addressLine2', event.target.value)
                }
                placeholder="Suite / unit"
                aria-label="Supplier address line 2"
              />
              <Input
                value={supplier.city}
                disabled={profileLocked}
                onChange={(event) => updateSupplier('city', event.target.value)}
                placeholder="City *"
                aria-label="Supplier city"
              />
              <Input
                value={supplier.state}
                disabled={profileLocked}
                onChange={(event) =>
                  updateSupplier('state', event.target.value)
                }
                placeholder="State / province *"
                aria-label="Supplier state or province"
              />
              <Input
                value={supplier.postalCode}
                disabled={profileLocked}
                onChange={(event) =>
                  updateSupplier('postalCode', event.target.value)
                }
                placeholder="Postal code *"
                aria-label="Supplier postal code"
              />
              <Input
                value={supplier.country}
                disabled={profileLocked}
                onChange={(event) =>
                  updateSupplier('country', event.target.value)
                }
                placeholder="Country *"
                aria-label="Supplier country"
              />
              <Input
                value={supplier.taxClassification}
                disabled={profileLocked}
                onChange={(event) =>
                  updateSupplier('taxClassification', event.target.value)
                }
                placeholder="Federal tax classification"
                aria-label="Supplier tax classification"
              />
            </div>
            {profileGenerated && Object.keys(profileEvidence).length ? (
              <details className="mt-4 rounded-lg border border-[#dce3e8] bg-[#f8fafb]">
                <summary className="cursor-pointer px-3 py-2 text-[10px] font-semibold text-[#2c667b]">
                  View AI field sources ({Object.keys(profileEvidence).length})
                </summary>
                <div className="grid gap-2 border-t border-[#e3e9ed] p-3 sm:grid-cols-2">
                  {Object.entries(profileEvidence).map(([field, evidence]) => (
                    <div
                      key={field}
                      className="rounded-md bg-white px-2.5 py-2 text-[9px] text-slate-600"
                    >
                      <span className="font-semibold text-[#294354]">
                        {titleCase(field)}
                      </span>
                      <span className="mt-0.5 block">
                        {evidence.fileName} ·{' '}
                        {Math.round(evidence.confidence * 100)}%
                        {evidence.sourcePage
                          ? ` · page ${evidence.sourcePage}`
                          : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </details>
            ) : null}
          </section>

          <section className="order-1 min-h-0 overflow-y-auto px-6 py-5">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
              <div>
                <h3 className="text-sm font-semibold text-[#203845]">
                  Start here: qualification package
                </h3>
                <p className="mt-1 text-[11px] text-slate-500">
                  Upload one or more PDF, PNG, or JPEG files. AI will read and
                  consolidate them into the supplier master shown on the right.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void loadDemoSupplierPackage()}
                  disabled={packageAnalyzing || saving}
                >
                  <FileText />
                  Load demo package
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setDocuments((current) => [
                      ...current,
                      newSupplierDocument(),
                    ]);
                    setProfileGenerated(false);
                    setProfileEvidence({});
                  }}
                  disabled={
                    documents.length >= 10 || packageAnalyzing || saving
                  }
                >
                  <Plus />
                  Add another file
                </Button>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {documents.map((document, index) => (
                <div
                  key={document.id}
                  className="rounded-xl border border-[#d8e2e7] bg-[#f8fafb] p-4"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-xs font-semibold text-[#294354]">
                      Qualification file {index + 1}
                    </p>
                    {documents.length > 1 ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Remove qualification file ${index + 1}`}
                        onClick={() => {
                          setDocuments((current) =>
                            current.filter((item) => item.id !== document.id),
                          );
                          setProfileGenerated(false);
                          setProfileEvidence({});
                        }}
                      >
                        <Trash2 />
                      </Button>
                    ) : null}
                  </div>
                  <div className="grid gap-3 md:grid-cols-[220px_minmax(0,1fr)_auto]">
                    <select
                      value={document.documentType}
                      onChange={(event) => {
                        updateDocument(document.id, {
                          documentType: event.target
                            .value as SupplierDocumentType,
                          aiResult: null,
                        });
                        setProfileGenerated(false);
                        setProfileEvidence({});
                      }}
                      disabled={
                        document.analyzing || packageAnalyzing || saving
                      }
                      aria-label={`Qualification file ${index + 1} type`}
                      className="h-9 rounded-md border border-input bg-white px-3 text-xs"
                    >
                      {SUPPLIER_DOCUMENT_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {SUPPLIER_DOCUMENT_LABELS[type]}
                        </option>
                      ))}
                    </select>
                    <Input
                      key={document.id}
                      type="file"
                      accept="application/pdf,image/png,image/jpeg"
                      onChange={(event) => {
                        updateDocument(document.id, {
                          file: event.target.files?.[0] ?? null,
                          aiResult: null,
                          aiError: '',
                        });
                        setSupplier(initialSupplier);
                        setProfileGenerated(false);
                        setProfileEvidence({});
                        setProfileWarnings([]);
                      }}
                      disabled={
                        document.analyzing || packageAnalyzing || saving
                      }
                      aria-label={`Qualification file ${index + 1}`}
                      className="bg-white text-xs file:mr-2 file:border-0 file:bg-transparent"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => analyzeDocument(document)}
                      disabled={
                        !document.file ||
                        document.analyzing ||
                        packageAnalyzing ||
                        saving ||
                        Boolean(document.aiResult)
                      }
                      className="bg-white"
                    >
                      {document.analyzing ? (
                        <LoaderCircle className="animate-spin" />
                      ) : document.aiResult ? (
                        <Check />
                      ) : (
                        <Sparkles />
                      )}
                      {document.aiResult ? 'AI analyzed' : 'Analyze this file'}
                    </Button>
                  </div>
                  {document.aiResult ? (
                    <div className="mt-3 grid gap-3 rounded-lg border border-sky-100 bg-white p-3 md:grid-cols-2 xl:grid-cols-4">
                      <Input
                        value={document.issuer}
                        onChange={(event) =>
                          updateDocument(document.id, {
                            issuer: event.target.value,
                          })
                        }
                        placeholder="Issuer / source"
                        aria-label={`Qualification file ${index + 1} issuer`}
                        className="bg-white text-xs"
                      />
                      <Input
                        value={document.documentNumber}
                        onChange={(event) =>
                          updateDocument(document.id, {
                            documentNumber: event.target.value,
                          })
                        }
                        placeholder="Document number"
                        aria-label={`Qualification file ${index + 1} number`}
                        className="bg-white text-xs"
                      />
                      <Input
                        type="date"
                        value={document.effectiveDate}
                        onChange={(event) =>
                          updateDocument(document.id, {
                            effectiveDate: event.target.value,
                          })
                        }
                        aria-label={`Qualification file ${index + 1} effective date`}
                        className="bg-white text-xs"
                      />
                      <Input
                        type="date"
                        value={document.expirationDate}
                        onChange={(event) =>
                          updateDocument(document.id, {
                            expirationDate: event.target.value,
                          })
                        }
                        aria-label={`Qualification file ${index + 1} expiration date`}
                        className="bg-white text-xs"
                      />
                      <Input
                        value={document.coverageSummary}
                        onChange={(event) =>
                          updateDocument(document.id, {
                            coverageSummary: event.target.value,
                          })
                        }
                        placeholder="Coverage / qualification summary"
                        aria-label={`Qualification file ${index + 1} coverage or qualification summary`}
                        className="bg-white text-xs md:col-span-2 xl:col-span-4"
                      />
                    </div>
                  ) : (
                    <p className="mt-2 text-[10px] text-slate-500">
                      The document metadata and supplier master fields will
                      appear after AI analysis.
                    </p>
                  )}
                  {document.documentType === 'insurance_certificate' ? (
                    <p className="mt-2 text-[10px] text-amber-700">
                      Insurance expiration date is required.
                    </p>
                  ) : null}
                  {document.aiResult ? (
                    <SupplierDocumentAIReview
                      result={document.aiResult}
                      supplierName={
                        supplier.legalName ||
                        valueText(
                          document.aiResult.analysis.supplierLegalName.value,
                        )
                      }
                    />
                  ) : null}
                  {document.aiError ? (
                    <p className="mt-2 text-[10px] text-rose-700">
                      {document.aiError}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
            {error ? (
              <Alert variant="destructive" className="mt-4">
                <AlertCircle />
                <AlertTitle>Supplier record needs attention</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
          </section>
        </div>

        <DialogFooter className="mx-0 mb-0 px-6 py-4">
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              reset();
            }}
            disabled={saving || packageAnalyzing}
          >
            Cancel
          </Button>
          {profileGenerated && documents.every((item) => item.aiResult) ? (
            <Button
              onClick={submit}
              disabled={saving || packageAnalyzing}
              className="bg-[#1d718f] hover:bg-[#185f78]"
            >
              {saving ? (
                <LoaderCircle className="animate-spin" />
              ) : (
                <Database />
              )}
              Create supplier from verified AI data
            </Button>
          ) : (
            <Button
              onClick={() => void analyzePackage()}
              disabled={
                saving ||
                packageAnalyzing ||
                documents.some((item) => !item.file)
              }
              className="bg-[#1d718f] hover:bg-[#185f78]"
            >
              {packageAnalyzing ? (
                <LoaderCircle className="animate-spin" />
              ) : (
                <Sparkles />
              )}
              Generate supplier register from files
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SupplierRegisterView({
  suppliers,
  allSuppliers,
  search,
  onSearch,
  onSelect,
  onAdd,
  onOpenAlerts,
}: {
  suppliers: Workspace['suppliers'];
  allSuppliers: Workspace['suppliers'];
  search: string;
  onSearch: (value: string) => void;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onOpenAlerts: () => void;
}) {
  const [insightsOpen, setInsightsOpen] = useState(false);
  const [relationshipFilter, setRelationshipFilter] = useState('all');
  const [supplierStatusFilter, setSupplierStatusFilter] = useState('all');
  const [qualificationFilter, setQualificationFilter] = useState('all');
  const [riskFilter, setRiskFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [stateFilter, setStateFilter] = useState('all');
  const [w9Filter, setW9Filter] = useState('all');
  const [insuranceFilter, setInsuranceFilter] = useState('all');
  const [documentExpiryFilter, setDocumentExpiryFilter] = useState('all');
  const options = (key: string) =>
    Array.from(
      new Set(
        suppliers
          .map((item) => valueText(item[key]))
          .filter((value) => value !== 'Not found'),
      ),
    ).sort((a, b) => a.localeCompare(b));
  const today = new Date().toISOString().slice(0, 10);
  const expiryCutoffDate = new Date(`${today}T12:00:00Z`);
  expiryCutoffDate.setUTCDate(expiryCutoffDate.getUTCDate() + 90);
  const expiryCutoff = expiryCutoffDate.toISOString().slice(0, 10);
  const visibleSuppliers = suppliers.filter((item) => {
    if (
      relationshipFilter !== 'all' &&
      item.relationship_stage !== relationshipFilter
    )
      return false;
    if (supplierStatusFilter !== 'all' && item.status !== supplierStatusFilter)
      return false;
    if (
      qualificationFilter !== 'all' &&
      item.qualification_status !== qualificationFilter
    )
      return false;
    if (riskFilter !== 'all' && item.risk_tier !== riskFilter) return false;
    if (categoryFilter !== 'all' && item.category !== categoryFilter)
      return false;
    if (stateFilter !== 'all' && item.state !== stateFilter) return false;
    if (w9Filter !== 'all' && item.w9_status !== w9Filter) return false;
    if (insuranceFilter !== 'all' && item.insurance_status !== insuranceFilter)
      return false;
    const nextExpiry =
      typeof item.next_compliance_expiration === 'string'
        ? item.next_compliance_expiration
        : '';
    if (documentExpiryFilter === 'expiring_90_days')
      return Boolean(
        nextExpiry && nextExpiry >= today && nextExpiry <= expiryCutoff,
      );
    const hasExpiredCompliance = Number(item.has_expired_compliance ?? 0) > 0;
    if (documentExpiryFilter === 'expired') return hasExpiredCompliance;
    if (documentExpiryFilter === 'no_expiration')
      return !nextExpiry && !hasExpiredCompliance;
    return true;
  });
  const clearFilters = () => {
    setRelationshipFilter('all');
    setSupplierStatusFilter('all');
    setQualificationFilter('all');
    setRiskFilter('all');
    setCategoryFilter('all');
    setStateFilter('all');
    setW9Filter('all');
    setInsuranceFilter('all');
    setDocumentExpiryFilter('all');
  };

  return (
    <>
      <PageHeading
        eyebrow="Lifecycle supplier master"
        title="Supplier register"
        description="Every supplier relationship is retained from onboarding through pre-contract review and executed work. A supplier does not need an active contract to appear here."
        action={
          <div className="flex flex-wrap gap-2">
            <Button onClick={onAdd} className="bg-[#1d718f] hover:bg-[#185f78]">
              <Plus />
              Create supplier from files
            </Button>
            <Button
              variant="outline"
              onClick={() => setInsightsOpen(true)}
              disabled={!visibleSuppliers.length}
              className="border-[#9bc6d5] bg-[#edf8fb] text-[#1d657f] hover:bg-[#e1f2f7]"
            >
              <Sparkles />
              AI management insights
            </Button>
          </div>
        }
      />
      <Panel className="overflow-hidden">
        <PanelHeader
          title="Supplier master data"
          description={`${visibleSuppliers.length} of ${suppliers.length} supplier record${suppliers.length === 1 ? '' : 's'} shown`}
          action={
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(event) => onSearch(event.target.value)}
                placeholder="Filter suppliers…"
                className="pl-9"
              />
            </div>
          }
        />
        <div className="border-b border-[#e3e9ed] bg-[#f8fafb] p-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <FilterSelect
              label="Relationship stage"
              value={relationshipFilter}
              onChange={setRelationshipFilter}
              options={options('relationship_stage')}
              titleCaseOptions
            />
            <FilterSelect
              label="Supplier status"
              value={supplierStatusFilter}
              onChange={setSupplierStatusFilter}
              options={options('status')}
              titleCaseOptions
            />
            <FilterSelect
              label="Qualification status"
              value={qualificationFilter}
              onChange={setQualificationFilter}
              options={options('qualification_status')}
              titleCaseOptions
            />
            <FilterSelect
              label="Risk tier"
              value={riskFilter}
              onChange={setRiskFilter}
              options={options('risk_tier')}
              titleCaseOptions
            />
            <FilterSelect
              label="Category"
              value={categoryFilter}
              onChange={setCategoryFilter}
              options={options('category')}
            />
            <FilterSelect
              label="State"
              value={stateFilter}
              onChange={setStateFilter}
              options={options('state')}
            />
            <FilterSelect
              label="W-9 status"
              value={w9Filter}
              onChange={setW9Filter}
              options={options('w9_status')}
              titleCaseOptions
            />
            <FilterSelect
              label="Insurance status"
              value={insuranceFilter}
              onChange={setInsuranceFilter}
              options={options('insurance_status')}
              titleCaseOptions
            />
            <FilterSelect
              label="Qualification / insurance expiry"
              value={documentExpiryFilter}
              onChange={setDocumentExpiryFilter}
              options={['expiring_90_days', 'expired', 'no_expiration']}
              titleCaseOptions
            />
            <div className="flex items-end">
              <Button
                type="button"
                variant="outline"
                onClick={clearFilters}
                className="h-9 w-full bg-white"
              >
                <RotateCcw />
                Clear filters
              </Button>
            </div>
          </div>
          <p className="mt-3 text-[10px] text-slate-500">
            Filters can be combined with keyword search. “Expiring 90 days” uses
            the earliest dated qualification or insurance record on each
            supplier.
          </p>
        </div>
        <div className="overflow-x-auto">
          <Table className="min-w-[2200px]">
            <TableHeader>
              <TableRow className="bg-[#f7f9fa]">
                <TableHead className="px-5">Supplier</TableHead>
                <TableHead>Vendor number</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Tax classification</TableHead>
                <TableHead>Risk / qualification</TableHead>
                <TableHead>Business address</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Primary contact</TableHead>
                <TableHead>Contract relationships</TableHead>
                <TableHead>Total contract value</TableHead>
                <TableHead>W-9</TableHead>
                <TableHead>Insurance status</TableHead>
                <TableHead>Insurance expiration</TableHead>
                <TableHead>Qualification files</TableHead>
                <TableHead>Last updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleSuppliers.map((item) => (
                <TableRow key={String(item.id)}>
                  <TableCell className="px-5 py-3.5">
                    <button
                      type="button"
                      onClick={() => onSelect(String(item.id))}
                      className="text-left"
                    >
                      <span className="font-medium text-[#1d718f] hover:underline">
                        {valueText(item.legal_name)}
                      </span>
                      <span className="mt-1 block text-[11px] text-slate-500">
                        {item.dba_name
                          ? `DBA ${valueText(item.dba_name)} · `
                          : ''}
                        View supplier files
                      </span>
                    </button>
                  </TableCell>
                  <TableCell className="text-xs">
                    {valueText(item.vendor_number)}
                  </TableCell>
                  <TableCell className="text-xs">
                    {valueText(item.category)}
                  </TableCell>
                  <TableCell className="text-xs">
                    {valueText(item.tax_classification)}
                  </TableCell>
                  <TableCell>
                    <div className="text-xs font-medium">
                      {titleCase(item.risk_tier)} risk
                    </div>
                    <div className="mt-1">
                      <StatusBadge
                        tone={toneForStatus(item.qualification_status)}
                      >
                        {titleCase(item.qualification_status)}
                      </StatusBadge>
                    </div>
                    <div className="mt-1 text-[10px] text-slate-500">
                      Review date {valueText(item.qualification_review_date)}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs">
                    <div>{valueText(item.address_line1)}</div>
                    {item.address_line2 ? (
                      <div>{valueText(item.address_line2)}</div>
                    ) : null}
                    <div className="mt-1 text-[10px] text-slate-500">
                      {valueText(item.city)}, {valueText(item.state)}{' '}
                      {valueText(item.postal_code)} · {valueText(item.country)}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs">
                    <div>
                      <StatusBadge tone={toneForStatus(item.status)}>
                        {titleCase(item.status)}
                      </StatusBadge>
                    </div>
                    <div className="mt-1 text-[10px] font-medium text-slate-500">
                      {titleCase(item.relationship_stage)} relationship
                    </div>
                  </TableCell>
                  <TableCell className="text-xs">
                    <div className="font-medium">
                      {valueText(item.primary_contact)}
                    </div>
                    <div className="mt-1 text-[10px] text-slate-500">
                      {valueText(item.email)} · {valueText(item.phone)}
                    </div>
                    {item.website ? (
                      <a
                        href={String(item.website)}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 block text-[10px] text-[#287693] hover:underline"
                      >
                        Website
                      </a>
                    ) : null}
                  </TableCell>
                  <TableCell className="max-w-[290px] text-xs">
                    {typeof item.linked_contracts === 'string' ||
                    typeof item.linked_intakes === 'string' ? (
                      <div className="space-y-1">
                        {typeof item.linked_intakes === 'string'
                          ? item.linked_intakes.split('||').map((intake) => (
                              <div
                                key={intake}
                                className="rounded bg-amber-50 px-2 py-1 text-[10px] text-amber-800"
                              >
                                Intake · {intake}
                              </div>
                            ))
                          : null}
                        {typeof item.linked_contracts === 'string'
                          ? item.linked_contracts
                              .split('||')
                              .map((contract) => (
                                <div
                                  key={contract}
                                  className="rounded bg-slate-50 px-2 py-1 text-[10px] text-slate-600"
                                >
                                  Contract · {contract}
                                </div>
                              ))
                          : null}
                      </div>
                    ) : (
                      <span className="text-slate-400">
                        Onboarding only · no contract activity yet
                      </span>
                    )}
                    <div className="mt-1 text-[10px] text-slate-500">
                      {valueText(item.active_contract_count)} active
                    </div>
                  </TableCell>
                  <TableCell className="text-xs font-medium">
                    {moneyFromCents(item.total_contract_value_cents)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge tone={toneForStatus(item.w9_status)}>
                      {titleCase(item.w9_status)}
                    </StatusBadge>
                  </TableCell>
                  <TableCell>
                    <StatusBadge tone={toneForStatus(item.insurance_status)}>
                      {titleCase(item.insurance_status)}
                    </StatusBadge>
                  </TableCell>
                  <TableCell className="text-xs">
                    {valueText(item.insurance_expiration)}
                  </TableCell>
                  <TableCell className="text-xs">
                    <div className="font-medium">
                      {valueText(item.qualification_document_count)} files
                    </div>
                    <div className="mt-1 text-[10px] text-slate-500">
                      Next expiry {valueText(item.next_compliance_expiration)}
                    </div>
                    {Number(item.expired_qualification_document_count ?? 0) >
                    0 ? (
                      <div className="mt-1 text-[10px] font-medium text-rose-600">
                        {valueText(item.expired_qualification_document_count)}{' '}
                        expired
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-xs">
                    {valueText(item.updated_at)}
                  </TableCell>
                </TableRow>
              ))}
              {!visibleSuppliers.length ? (
                <TableRow>
                  <TableCell
                    colSpan={15}
                    className="h-36 text-center text-xs text-slate-500"
                  >
                    No suppliers match the current search and filters.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      </Panel>
      <ManagementInsightsSheet
        open={insightsOpen}
        onOpenChange={setInsightsOpen}
        scope="suppliers"
        currentRecordIds={visibleSuppliers.map((item) => String(item.id))}
        allRecordIds={allSuppliers.map((item) => String(item.id))}
        onSelectRecord={onSelect}
        onOpenAlerts={onOpenAlerts}
      />
    </>
  );
}

const managementChartConfig = {
  value: {
    label: 'Value',
    color: '#2c7f9b',
  },
} satisfies ChartConfig;

function managementMetricValue(metric: ManagementMetric) {
  if (metric.format === 'currency') return moneyFromCents(metric.value, true);
  if (metric.format === 'percent') return `${metric.value}%`;
  return new Intl.NumberFormat('en-US').format(metric.value);
}

function priorityClasses(priority: ManagementPriority) {
  if (priority === 'high') return 'border-rose-200 bg-rose-50 text-rose-800';
  if (priority === 'medium')
    return 'border-amber-200 bg-amber-50 text-amber-800';
  return 'border-sky-200 bg-sky-50 text-sky-800';
}

function ManagementChartCard({ chart }: { chart: ManagementChart }) {
  const data = chart.data.map((item) => ({
    ...item,
    value: chart.valueFormat === 'currency' ? item.value / 100 : item.value,
  }));
  return (
    <article className="rounded-xl border border-[#dce3e8] bg-white p-4">
      <h3 className="text-xs font-semibold text-[#203845]">{chart.title}</h3>
      <p className="mt-1 text-[10px] leading-4 text-slate-500">
        {chart.description}
      </p>
      {data.length ? (
        <ChartContainer
          config={managementChartConfig}
          className="mt-3 h-[220px] w-full aspect-auto"
          initialDimension={{ width: 480, height: 220 }}
        >
          <BarChart
            accessibilityLayer
            data={data}
            layout="vertical"
            margin={{ left: 0, right: 18, top: 4, bottom: 4 }}
          >
            <CartesianGrid horizontal={false} strokeDasharray="3 3" />
            <XAxis
              type="number"
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) =>
                chart.valueFormat === 'currency'
                  ? new Intl.NumberFormat('en-US', {
                      style: 'currency',
                      currency: 'USD',
                      notation: 'compact',
                      maximumFractionDigits: 1,
                    }).format(Number(value))
                  : String(value)
              }
            />
            <YAxis
              type="category"
              dataKey="label"
              tickLine={false}
              axisLine={false}
              width={126}
              tick={{ fontSize: 10 }}
            />
            <ChartTooltip
              cursor={{ fill: '#edf4f6' }}
              content={<ChartTooltipContent hideLabel />}
            />
            <Bar
              dataKey="value"
              fill="var(--color-value)"
              radius={[0, 4, 4, 0]}
              maxBarSize={28}
            />
          </BarChart>
        </ChartContainer>
      ) : (
        <div className="mt-3 flex h-[220px] items-center justify-center rounded-lg bg-[#f8fafb] text-xs text-slate-500">
          No dated records are available for this chart.
        </div>
      )}
    </article>
  );
}

function ManagementInsightsSheet({
  open,
  onOpenChange,
  scope,
  currentRecordIds,
  allRecordIds,
  onSelectRecord,
  onOpenAlerts,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scope: ManagementInsightScope;
  currentRecordIds: string[];
  allRecordIds: string[];
  onSelectRecord: (id: string) => void;
  onOpenAlerts: () => void;
}) {
  const [selection, setSelection] = useState<'current' | 'all'>('current');
  const [result, setResult] = useState<ManagementInsightResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const requestSequence = useRef(0);
  const previousOpen = useRef(false);
  const currentIdsKey = currentRecordIds.join('\u001f');
  const allIdsKey = allRecordIds.join('\u001f');
  const label = scope === 'contracts' ? 'Contract' : 'Supplier';

  const runAnalysis = useCallback(
    async (nextSelection: 'current' | 'all') => {
      const ids = (nextSelection === 'current' ? currentIdsKey : allIdsKey)
        .split('\u001f')
        .filter(Boolean);
      if (!ids.length) {
        setError('No records are available in this analysis scope.');
        return;
      }
      const requestId = ++requestSequence.current;
      setSelection(nextSelection);
      setLoading(true);
      setError('');
      try {
        const now = new Date();
        const asOfDate = [
          now.getFullYear(),
          String(now.getMonth() + 1).padStart(2, '0'),
          String(now.getDate()).padStart(2, '0'),
        ].join('-');
        const response = await fetch('/api/management-insights', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scope, recordIds: ids, asOfDate }),
        });
        const body = (await response.json()) as ManagementInsightResponse & {
          error?: string;
        };
        if (!response.ok)
          throw new Error(
            body.error || 'Unable to generate management insights.',
          );
        if (requestId === requestSequence.current) setResult(body);
      } catch (analysisError) {
        if (requestId === requestSequence.current)
          setError(
            analysisError instanceof Error
              ? analysisError.message
              : 'Unable to generate management insights.',
          );
      } finally {
        if (requestId === requestSequence.current) setLoading(false);
      }
    },
    [allIdsKey, currentIdsKey, scope],
  );

  useEffect(() => {
    const justOpened = open && !previousOpen.current;
    previousOpen.current = open;
    if (!open) {
      requestSequence.current += 1;
      return;
    }
    if (!justOpened) return;
    const timer = window.setTimeout(() => void runAnalysis('current'), 0);
    return () => window.clearTimeout(timer);
  }, [open, runAnalysis]);

  const openRecord = (id: string) => {
    onOpenChange(false);
    onSelectRecord(id);
  };
  const openActionCenter = () => {
    onOpenChange(false);
    onOpenAlerts();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[96vw] max-w-[1180px] gap-0 overflow-hidden p-0 sm:max-w-[1180px]">
        <SheetHeader className="border-b border-[#dce3e8] bg-white px-6 py-5 pr-14">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#347d96]">
            <Sparkles className="size-3.5" />
            AI-assisted management analysis
          </div>
          <SheetTitle className="mt-1 text-xl text-[#183040]">
            {label} management insights
          </SheetTitle>
          <SheetDescription className="max-w-3xl text-xs leading-5">
            Program-calculated facts and shared alert rules are interpreted by
            AI. The complete operational queue remains in Alerts &amp; Exports.
          </SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#f3f6f8]">
          <div className="flex flex-col justify-between gap-3 border-b border-[#dce3e8] bg-white px-6 py-3 md:flex-row md:items-center">
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant={selection === 'current' ? 'default' : 'outline'}
                onClick={() => void runAnalysis('current')}
                disabled={loading || !currentRecordIds.length}
                className={
                  selection === 'current'
                    ? 'bg-[#1d718f] hover:bg-[#185f78]'
                    : 'bg-white'
                }
              >
                Current view · {currentRecordIds.length}
              </Button>
              <Button
                size="sm"
                variant={selection === 'all' ? 'default' : 'outline'}
                onClick={() => void runAnalysis('all')}
                disabled={loading || !allRecordIds.length}
                className={
                  selection === 'all'
                    ? 'bg-[#1d718f] hover:bg-[#185f78]'
                    : 'bg-white'
                }
              >
                Entire register · {allRecordIds.length}
              </Button>
            </div>
            {result ? (
              <div className="text-[10px] text-slate-500">
                Generated {new Date(result.generatedAt).toLocaleString('en-US')}{' '}
                · {result.model}
              </div>
            ) : null}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            {loading ? (
              <div className="flex min-h-[420px] flex-col items-center justify-center text-center">
                <LoaderCircle className="size-8 animate-spin text-[#2b819f]" />
                <p className="mt-4 text-sm font-medium text-[#203845]">
                  Calculating facts and generating management insights…
                </p>
                <p className="mt-1 max-w-md text-xs leading-5 text-slate-500">
                  Counts, dates, values, and exceptions are calculated by
                  program rules before the structured results are sent to AI.
                </p>
              </div>
            ) : error ? (
              <Alert variant="destructive">
                <AlertCircle />
                <AlertTitle>Analysis unavailable</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : result ? (
              <div className="space-y-5">
                <section>
                  <div className="mb-3 flex items-end justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-semibold text-[#203845]">
                        Portfolio overview
                      </h2>
                      <p className="mt-0.5 text-[10px] text-slate-500">
                        Deterministic database calculations as of{' '}
                        {result.report.asOfDate}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className="bg-white text-slate-600"
                    >
                      {result.report.recordCount} verified records
                    </Badge>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {result.report.metrics.map((metric) => (
                      <div
                        key={metric.key}
                        className="rounded-xl border border-[#dce3e8] bg-white px-4 py-3"
                      >
                        <p className="text-[10px] font-medium text-slate-500">
                          {metric.label}
                        </p>
                        <p className="mt-1 text-xl font-semibold tracking-[-0.03em] text-[#183040]">
                          {managementMetricValue(metric)}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="grid gap-4 xl:grid-cols-2">
                  {result.report.charts.map((chart) => (
                    <ManagementChartCard key={chart.key} chart={chart} />
                  ))}
                </section>

                <section className="rounded-xl border border-[#dce3e8] bg-white">
                  <div className="flex flex-col justify-between gap-3 border-b border-[#e3e9ed] px-5 py-4 sm:flex-row sm:items-center">
                    <div>
                      <h2 className="text-sm font-semibold text-[#203845]">
                        Priority attention preview
                      </h2>
                      <p className="mt-0.5 text-[10px] text-slate-500">
                        Top 3 of {result.report.attentionCount} rule-generated
                        items
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={openActionCenter}
                    >
                      <BellRing />
                      View all in Alerts &amp; Exports
                    </Button>
                  </div>
                  <div className="divide-y divide-[#edf1f3]">
                    {result.report.attentionItems.slice(0, 3).map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => openRecord(item.entityId)}
                        className="flex w-full flex-col gap-2 px-5 py-4 text-left hover:bg-[#f8fafb] sm:flex-row sm:items-start sm:justify-between"
                      >
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-semibold text-[#1d718f]">
                              {item.reference || item.label}
                            </span>
                            <Badge
                              variant="outline"
                              className={priorityClasses(item.priority)}
                            >
                              {titleCase(item.priority)}
                            </Badge>
                          </div>
                          <p className="mt-1 text-xs font-medium text-[#203845]">
                            {item.issue}
                          </p>
                          <p className="mt-1 text-[10px] leading-4 text-slate-500">
                            {item.label} · {item.reason}
                          </p>
                        </div>
                        <span className="shrink-0 text-[10px] text-slate-500">
                          {item.dueDate ?? 'No due date'}
                        </span>
                      </button>
                    ))}
                    {!result.report.attentionItems.length ? (
                      <div className="px-5 py-8 text-center text-xs text-slate-500">
                        No current rule-based attention items in this scope.
                      </div>
                    ) : null}
                  </div>
                </section>

                <section className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(300px,0.75fr)]">
                  <article className="rounded-xl border border-[#b9d9e5] bg-[#edf8fb] p-5">
                    <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#347d96]">
                      <Sparkles className="size-3.5" />
                      AI management insights
                    </div>
                    <p className="mt-3 text-sm leading-6 text-[#244757]">
                      {result.ai.executiveSummary}
                    </p>
                    <div className="mt-4 space-y-3">
                      {result.ai.insights.map((insight) => (
                        <div
                          key={`${insight.title}-${insight.explanation}`}
                          className="rounded-lg border border-[#c9e1e9] bg-white/80 p-4"
                        >
                          <h3 className="text-xs font-semibold text-[#203845]">
                            {insight.title}
                          </h3>
                          <p className="mt-1 text-[11px] leading-5 text-slate-600">
                            {insight.explanation}
                          </p>
                          {insight.supportingRecordIds.length ? (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {insight.supportingRecordIds.map((id) => (
                                <button
                                  key={id}
                                  type="button"
                                  onClick={() => openRecord(id)}
                                  className="rounded-md border border-[#b9d9e5] bg-white px-2 py-1 text-[9px] font-medium text-[#1d718f] hover:bg-[#edf8fb]"
                                >
                                  Open supporting record
                                </button>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </article>

                  <article className="rounded-xl border border-[#dce3e8] bg-white p-5">
                    <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                      <CircleCheck className="size-3.5" />
                      Recommended actions
                    </div>
                    <div className="mt-3 space-y-3">
                      {result.ai.recommendedActions.map((action) => (
                        <div
                          key={`${action.action}-${action.reason}`}
                          className="rounded-lg border border-[#e1e7ea] p-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <h3 className="text-xs font-semibold text-[#203845]">
                              {action.action}
                            </h3>
                            <Badge
                              variant="outline"
                              className={priorityClasses(action.priority)}
                            >
                              {titleCase(action.priority)}
                            </Badge>
                          </div>
                          <p className="mt-1 text-[10px] leading-4 text-slate-500">
                            {action.reason}
                          </p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 rounded-lg bg-slate-50 px-3 py-3 text-[10px] leading-4 text-slate-500">
                      Decision support only. AI does not change register data,
                      approve suppliers, make legal determinations, or decide
                      renewal and termination actions.
                    </div>
                    {result.ai.dataLimitations.length ? (
                      <div className="mt-3 text-[10px] leading-4 text-slate-500">
                        <span className="font-semibold text-slate-600">
                          Data limitations:{' '}
                        </span>
                        {result.ai.dataLimitations.join(' ')}
                      </div>
                    ) : null}
                  </article>
                </section>
              </div>
            ) : null}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

type EvaluationDetail = {
  caseId: string;
  title: string;
  model: string;
  totalFields: number;
  correctFields: number;
  accuracyPercent: number;
  fields: Array<{
    fieldName: string;
    label: string;
    expected: string | number;
    actual: string | number | null;
    correct: boolean;
    confidence: number;
    sourceBacked: boolean;
  }>;
};

function AIEvaluationView({
  workspace,
  onCompleted,
}: {
  workspace: Workspace | null;
  onCompleted: (workspace: Workspace) => void;
}) {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const latest = workspace?.evaluationRuns[0];
  let details: EvaluationDetail[] = [];
  if (typeof latest?.details_json === 'string') {
    try {
      details = JSON.parse(latest.details_json) as EvaluationDetail[];
    } catch {
      details = [];
    }
  }

  const runEvaluation = async () => {
    setRunning(true);
    setError('');
    try {
      const results: Array<{
        caseId: string;
        model: string;
        analysis: Record<string, unknown>;
      }> = [];
      for (const [index, evaluationCase] of AI_EVALUATION_CASES.entries()) {
        setProgress(
          `Analyzing ${index + 1} of ${AI_EVALUATION_CASES.length}: ${evaluationCase.title}`,
        );
        const fileResponse = await fetch(
          `/demo-documents/${evaluationCase.fileName}`,
        );
        if (!fileResponse.ok)
          throw new Error(`Unable to load ${evaluationCase.fileName}.`);
        const file = new File(
          [await fileResponse.blob()],
          evaluationCase.fileName,
          {
            type: 'application/pdf',
          },
        );
        const form = new FormData();
        form.append('file', file);
        form.append('purpose', 'evaluation');
        const supplierCase = evaluationCase.id === 'supplier-coi';
        if (supplierCase) {
          form.append('expectedDocumentType', 'insurance_certificate');
        } else {
          form.append(
            'stage',
            evaluationCase.id === 'contract-executed' ? 'executed' : 'draft',
          );
        }
        const response = await fetch(
          supplierCase ? '/api/analyze-supplier-document' : '/api/analyze',
          { method: 'POST', body: form },
        );
        const body = (await response.json()) as {
          analysis?: Record<string, unknown>;
          model?: string;
          error?: string;
        };
        if (!response.ok || !body.analysis || !body.model)
          throw new Error(
            body.error || `Unable to evaluate ${evaluationCase.title}.`,
          );
        results.push({
          caseId: evaluationCase.id,
          model: body.model,
          analysis: body.analysis,
        });
      }
      setProgress('Comparing AI output with verified ground truth…');
      const response = await fetch('/api/evaluations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cases: results }),
      });
      const body = (await response.json()) as {
        workspace?: Workspace;
        error?: string;
      };
      if (!response.ok || !body.workspace)
        throw new Error(body.error || 'Unable to save the evaluation result.');
      onCompleted(body.workspace);
      setProgress('Evaluation completed and saved.');
    } catch (runError) {
      setError(
        runError instanceof Error
          ? runError.message
          : 'Unable to complete the AI evaluation.',
      );
      setProgress('');
    } finally {
      setRunning(false);
    }
  };

  return (
    <>
      <PageHeading
        eyebrow="Evidence, not a claim"
        title="AI evaluation"
        description="Run the same three fictional documents against a locked ground-truth set. Accuracy, source traceability, and confidence are calculated from the live model output and saved for interview evidence."
        action={
          <Button
            onClick={runEvaluation}
            disabled={running}
            className="bg-[#1d718f] hover:bg-[#185f78]"
          >
            {running ? (
              <LoaderCircle className="animate-spin" />
            ) : (
              <FlaskConical />
            )}
            Run 3-document evaluation
          </Button>
        }
      />
      <Alert className="mb-5 border-amber-200 bg-amber-50 text-amber-900">
        <AlertTriangle />
        <AlertTitle>Portfolio evidence—not a production benchmark</AlertTitle>
        <AlertDescription>
          This intentionally small locked set proves that the evaluation is
          repeatable and measurable. Production validation would require a
          larger, more varied, access-controlled document corpus.
        </AlertDescription>
      </Alert>

      {progress ? (
        <Alert className="mb-5 border-sky-200 bg-sky-50 text-sky-900">
          {running ? (
            <LoaderCircle className="animate-spin" />
          ) : (
            <CircleCheck />
          )}
          <AlertTitle>
            {running ? 'Evaluation in progress' : 'Evaluation saved'}
          </AlertTitle>
          <AlertDescription>{progress}</AlertDescription>
        </Alert>
      ) : null}
      {error ? (
        <Alert variant="destructive" className="mb-5">
          <AlertCircle />
          <AlertTitle>Evaluation needs attention</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {latest ? (
        <>
          <section className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              [
                'Field accuracy',
                `${valueText(latest.accuracy_percent)}%`,
                `${valueText(latest.correct_fields)} of ${valueText(latest.total_fields)} ground-truth fields`,
              ],
              [
                'Source coverage',
                `${valueText(latest.source_coverage_percent)}%`,
                `${valueText(latest.source_backed_fields)} fields include page and quote`,
              ],
              [
                'Average confidence',
                `${valueText(latest.average_confidence)}%`,
                'Model confidence shown separately from measured accuracy',
              ],
              [
                'Evaluation set',
                `${valueText(latest.case_count)} documents`,
                `Latest run ${valueText(latest.created_at)}`,
              ],
            ].map(([label, metric, note]) => (
              <article
                key={label}
                className="rounded-xl border border-[#dce3e8] bg-white p-5"
              >
                <p className="text-[11px] font-medium text-slate-500">
                  {label}
                </p>
                <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[#173246]">
                  {metric}
                </p>
                <p className="mt-2 text-[10px] leading-4 text-slate-500">
                  {note}
                </p>
              </article>
            ))}
          </section>

          <Panel className="overflow-hidden">
            <PanelHeader
              title="Latest evaluation evidence"
              description={`${valueText(latest.model)} · Results are compared server-side with fixed expected values`}
              action={<StatusBadge tone="green">Persisted result</StatusBadge>}
            />
            <div className="divide-y divide-[#e3e9ed]">
              {details.map((detail) => (
                <details key={detail.caseId} className="group">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4">
                    <div>
                      <p className="text-xs font-semibold text-[#203845]">
                        {detail.title}
                      </p>
                      <p className="mt-1 text-[10px] text-slate-500">
                        {detail.correctFields} of {detail.totalFields} fields
                        matched
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge
                        tone={detail.accuracyPercent >= 90 ? 'green' : 'amber'}
                      >
                        {detail.accuracyPercent}% accuracy
                      </StatusBadge>
                      <ChevronDown className="size-4 text-slate-400 transition-transform group-open:rotate-180" />
                    </div>
                  </summary>
                  <div className="overflow-x-auto border-t border-[#e3e9ed] bg-[#f8fafb]">
                    <Table className="min-w-[820px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="px-5">Field</TableHead>
                          <TableHead>Expected</TableHead>
                          <TableHead>AI result</TableHead>
                          <TableHead>Accuracy</TableHead>
                          <TableHead>Confidence</TableHead>
                          <TableHead className="pr-5">
                            Source evidence
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detail.fields.map((field) => (
                          <TableRow key={field.fieldName}>
                            <TableCell className="px-5 text-xs font-medium">
                              {field.label}
                            </TableCell>
                            <TableCell className="text-xs text-slate-500">
                              {valueText(field.expected)}
                            </TableCell>
                            <TableCell className="text-xs">
                              {valueText(field.actual)}
                            </TableCell>
                            <TableCell>
                              <StatusBadge
                                tone={field.correct ? 'green' : 'rose'}
                              >
                                {field.correct ? 'Match' : 'Mismatch'}
                              </StatusBadge>
                            </TableCell>
                            <TableCell className="text-xs">
                              {Math.round(field.confidence * 100)}%
                            </TableCell>
                            <TableCell className="pr-5">
                              <StatusBadge
                                tone={field.sourceBacked ? 'green' : 'rose'}
                              >
                                {field.sourceBacked
                                  ? 'Page + quote'
                                  : 'Missing source'}
                              </StatusBadge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </details>
              ))}
            </div>
          </Panel>
        </>
      ) : (
        <Panel>
          <PanelHeader
            title="Locked fictional evaluation set"
            description="No saved run yet. Running the evaluation calls the live AI but does not add these test files to operational registers."
          />
          <div className="grid gap-3 p-5 md:grid-cols-3">
            {AI_EVALUATION_CASES.map((evaluationCase, index) => (
              <article
                key={evaluationCase.id}
                className="rounded-xl border border-[#dce3e8] bg-[#f8fafb] p-4"
              >
                <span className="flex size-8 items-center justify-center rounded-lg bg-[#e4f2f6] text-xs font-semibold text-[#287693]">
                  {index + 1}
                </span>
                <p className="mt-3 text-xs font-semibold text-[#203845]">
                  {evaluationCase.title}
                </p>
                <p className="mt-1 text-[10px] text-slate-500">
                  {evaluationCase.fileName}
                </p>
              </article>
            ))}
          </div>
        </Panel>
      )}

      <Panel className="mt-5 overflow-hidden">
        <PanelHeader
          title="Versioned fictional U.S. contract playbook"
          description="The AI compares documents with explicit operational rules. These are portfolio-demo standards, not legal advice or real company policy."
          action={
            <Badge
              variant="outline"
              className="border-sky-200 bg-sky-50 text-sky-800"
            >
              Version 2026.1
            </Badge>
          }
        />
        <div className="overflow-x-auto">
          <Table className="min-w-[850px]">
            <TableHeader>
              <TableRow className="bg-[#f7f9fa]">
                <TableHead className="px-5">Rule ID</TableHead>
                <TableHead>Control</TableHead>
                <TableHead>Demo standard</TableHead>
                <TableHead>Applies to</TableHead>
                <TableHead className="pr-5">Risk</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {demoPlaybookRules.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell className="px-5 font-mono text-[10px] text-[#287693]">
                    {rule.id}
                  </TableCell>
                  <TableCell className="text-xs font-medium text-[#203845]">
                    {rule.rule}
                  </TableCell>
                  <TableCell className="max-w-[320px] text-xs text-slate-600">
                    {rule.standard}
                  </TableCell>
                  <TableCell className="text-xs text-slate-500">
                    {rule.appliesTo}
                  </TableCell>
                  <TableCell className="pr-5">
                    <StatusBadge tone={rule.risk === 'High' ? 'rose' : 'amber'}>
                      {rule.risk}
                    </StatusBadge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Panel>
    </>
  );
}

function AlertsExportsView({
  workspace,
  onExport,
  exporting,
  onRefresh,
  onSelectContract,
  onSelectSupplier,
}: {
  workspace: Workspace | null;
  onExport: () => void;
  exporting: boolean;
  onRefresh: () => Promise<void>;
  onSelectContract: (id: string) => void;
  onSelectSupplier: (id: string) => void;
}) {
  const contractAlerts = (workspace?.keyDates ?? []).filter(
    (item) => item.contract_id && item.status !== 'completed',
  );
  const completedContractAlerts = (workspace?.keyDates ?? []).filter(
    (item) => item.contract_id && item.status === 'completed',
  );
  const supplierAlerts = workspace?.supplierAlerts ?? [];
  const contractCriticalCount = contractAlerts.filter((item) => {
    const timing = alertTiming(item.due_date);
    return timing && timing.days <= 30;
  }).length;
  const supplierCriticalCount = supplierAlerts.filter((item) => {
    if (item.source_type === 'missing_record') return true;
    const timing = alertTiming(item.due_date);
    return timing && timing.days <= 30;
  }).length;

  return (
    <>
      <PageHeading
        eyebrow="Operational follow-through"
        title="Obligation & renewal management"
        description="Assign ownership, record renewal decisions, close obligations, and export the latest registers—without expanding this focused portfolio into a full CLM."
      />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-5">
          <Panel>
            <PanelHeader
              title="Contract register alerts"
              description="Contract expirations, notice deadlines, renewals, and assigned follow-up"
              action={
                <div className="flex gap-2">
                  <StatusBadge tone="blue">
                    {contractAlerts.length} active
                  </StatusBadge>
                  {contractCriticalCount ? (
                    <StatusBadge tone="rose">
                      {contractCriticalCount} urgent
                    </StatusBadge>
                  ) : null}
                </div>
              }
            />
            <div className="space-y-3 p-5">
              {contractAlerts.map((item) => (
                <ObligationEditor
                  key={String(item.id)}
                  item={item}
                  onSaved={onRefresh}
                  onOpenRecord={() =>
                    onSelectContract(String(item.contract_id))
                  }
                />
              ))}
              {!contractAlerts.length ? (
                <EmptyState
                  title="No open contract alerts"
                  description="Upcoming contract deadlines will appear here after an executed agreement is registered."
                />
              ) : null}
              {completedContractAlerts.length ? (
                <details className="rounded-xl border border-[#dce3e8] bg-slate-50">
                  <summary className="cursor-pointer px-4 py-3 text-xs font-medium text-slate-600">
                    Completed contract actions ({completedContractAlerts.length}
                    )
                  </summary>
                  <div className="space-y-3 border-t border-[#dce3e8] p-3">
                    {completedContractAlerts.map((item) => (
                      <ObligationEditor
                        key={String(item.id)}
                        item={item}
                        onSaved={onRefresh}
                        onOpenRecord={() =>
                          onSelectContract(String(item.contract_id))
                        }
                      />
                    ))}
                  </div>
                </details>
              ) : null}
            </div>
          </Panel>

          <Panel>
            <PanelHeader
              title="Supplier compliance alerts"
              description="Expiring qualification evidence and missing core supplier records"
              action={
                <div className="flex gap-2">
                  <StatusBadge tone="blue">
                    {supplierAlerts.length} records
                  </StatusBadge>
                  {supplierCriticalCount ? (
                    <StatusBadge tone="rose">
                      {supplierCriticalCount} urgent
                    </StatusBadge>
                  ) : null}
                </div>
              }
            />
            <div className="space-y-3 p-5">
              {supplierAlerts.map((item) => (
                <SupplierComplianceAlert
                  key={String(item.alert_id)}
                  item={item}
                  onOpenSupplier={() =>
                    onSelectSupplier(String(item.supplier_id))
                  }
                />
              ))}
              {!supplierAlerts.length ? (
                <EmptyState
                  title="No supplier compliance alerts"
                  description="Documents with expiration dates and missing W-9 or insurance records will appear here."
                />
              ) : null}
            </div>
          </Panel>
        </div>
        <Panel>
          <PanelHeader
            title="Current register package"
            description="Generated live from the database at download time"
          />
          <div className="p-5">
            <div className="rounded-xl bg-[#0f3044] p-5 text-white">
              <FileSpreadsheet className="size-7 text-[#65c5df]" />
              <h3 className="mt-4 text-sm font-semibold">
                ContractLedger Register Package
              </h3>
              <p className="mt-2 text-xs leading-5 text-slate-300">
                One Excel workbook with Contract Register, Supplier Register,
                and obligation exceptions.
              </p>
              <Button
                onClick={onExport}
                disabled={!workspace || exporting}
                className="mt-5 w-full bg-white text-[#12384c] hover:bg-slate-100"
              >
                {exporting ? (
                  <LoaderCircle className="animate-spin" />
                ) : (
                  <Download />
                )}
                Generate current registers
              </Button>
            </div>
            <div className="mt-4 space-y-2 text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <Check className="size-3.5 text-emerald-600" />
                Executed values only
              </div>
              <div className="flex items-center gap-2">
                <Check className="size-3.5 text-emerald-600" />
                Renewal decision and owner included
              </div>
              <div className="flex items-center gap-2">
                <Check className="size-3.5 text-emerald-600" />
                Timestamped workbook
              </div>
            </div>
          </div>
        </Panel>
      </div>
    </>
  );
}

function ObligationEditor({
  item,
  onSaved,
  onOpenRecord,
}: {
  item: Workspace['keyDates'][number];
  onSaved: () => Promise<void>;
  onOpenRecord?: () => void;
}) {
  const [status, setStatus] = useState(valueText(item.status));
  const [owner, setOwner] = useState(
    valueText(item.owner) === 'Not found' ? '' : valueText(item.owner),
  );
  const [decision, setDecision] = useState(
    valueText(item.decision) === 'Not found' ? '' : valueText(item.decision),
  );
  const [notes, setNotes] = useState(
    valueText(item.notes) === 'Not found' ? '' : valueText(item.notes),
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const renewalItem =
    item.type === 'non_renewal_notice' || item.type === 'renewal';
  const timing = alertTiming(item.due_date);

  const save = async () => {
    setSaving(true);
    setMessage('');
    try {
      const response = await fetch('/api/obligations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: item.id,
          status,
          owner: owner || null,
          decision: decision || null,
          notes: notes || null,
        }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok)
        throw new Error(body.error || 'Unable to update obligation.');
      setMessage('Saved');
      await onSaved();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Unable to update obligation.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <article
      className={`rounded-xl border p-4 ${status === 'completed' ? 'border-emerald-200 bg-emerald-50/40' : 'border-[#dce3e8] bg-white'}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-[#203845]">
              {valueText(item.title)}
            </p>
            <StatusBadge tone={toneForStatus(status)}>
              {titleCase(status)}
            </StatusBadge>
            {timing ? (
              <StatusBadge tone={timing.tone}>{timing.label}</StatusBadge>
            ) : null}
          </div>
          <p className="mt-1 text-xs font-medium text-[#335565]">
            {valueText(item.contract_number)} · {valueText(item.contract_title)}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            Supplier: {valueText(item.supplier_name)} · Due{' '}
            {valueText(item.due_date)}
            {item.source_page ? ` · Source p. ${item.source_page}` : ''}
          </p>
        </div>
        {onOpenRecord ? (
          <Button variant="outline" size="sm" onClick={onOpenRecord}>
            <FileText /> Open contract
          </Button>
        ) : null}
      </div>
      <div
        className={`mt-4 grid gap-3 ${renewalItem ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}
      >
        <label
          htmlFor={`obligation-owner-${String(item.id)}`}
          className="text-[11px] font-medium text-slate-600"
        >
          Owner
          <Input
            id={`obligation-owner-${String(item.id)}`}
            value={owner}
            onChange={(event) => setOwner(event.target.value)}
            className="mt-1 h-9 bg-white text-xs"
          />
        </label>
        <label className="text-[11px] font-medium text-slate-600">
          Status
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="mt-1 h-9 w-full rounded-md border border-input bg-white px-3 text-xs"
          >
            <option value="upcoming">Upcoming</option>
            <option value="due">Due</option>
            <option value="completed">Completed</option>
          </select>
        </label>
        {renewalItem ? (
          <label className="text-[11px] font-medium text-slate-600">
            Renewal decision
            <select
              value={decision}
              onChange={(event) => setDecision(event.target.value)}
              className="mt-1 h-9 w-full rounded-md border border-input bg-white px-3 text-xs"
            >
              <option value="">Select decision</option>
              <option value="under_review">Under review</option>
              <option value="renew">Renew</option>
              <option value="do_not_renew">Do not renew</option>
              <option value="not_applicable">Not applicable</option>
            </select>
          </label>
        ) : null}
      </div>
      <label className="mt-3 block text-[11px] font-medium text-slate-600">
        Notes
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={2}
          className="mt-1 w-full rounded-md border border-input bg-white px-3 py-2 text-xs"
          placeholder="Record follow-up, confirmation, or decision rationale…"
        />
      </label>
      <div className="mt-3 flex items-center justify-end gap-3">
        <span
          className={`text-[11px] ${message === 'Saved' ? 'text-emerald-700' : 'text-rose-600'}`}
        >
          {message}
        </span>
        <Button size="sm" onClick={save} disabled={saving}>
          {saving ? <LoaderCircle className="animate-spin" /> : <Check />}Save
          obligation
        </Button>
      </div>
    </article>
  );
}

function SupplierComplianceAlert({
  item,
  onOpenSupplier,
}: {
  item: Workspace['supplierAlerts'][number];
  onOpenSupplier: () => void;
}) {
  const missing = item.source_type === 'missing_record';
  const timing = alertTiming(item.due_date);
  const tone = missing ? 'rose' : (timing?.tone ?? 'blue');

  return (
    <article
      className={`rounded-xl border p-4 ${tone === 'rose' ? 'border-rose-200 bg-rose-50/40' : tone === 'amber' ? 'border-amber-200 bg-amber-50/30' : 'border-[#dce3e8] bg-white'}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-[#203845]">
              {valueText(item.supplier_name)}
            </p>
            <StatusBadge tone={tone}>
              {missing ? 'Missing record' : (timing?.label ?? 'Date pending')}
            </StatusBadge>
          </div>
          <p className="mt-1 text-xs font-medium text-[#335565]">
            {supplierDocumentLabel(item.item_type)} · {valueText(item.title)}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            Vendor {valueText(item.vendor_number)}
            {item.due_date ? ` · Expires ${valueText(item.due_date)}` : ''}
            {item.document_number
              ? ` · Document ${valueText(item.document_number)}`
              : ''}
            {item.issuer ? ` · Issuer ${valueText(item.issuer)}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {item.document_id ? (
            <a
              href={`/api/document?id=${encodeURIComponent(String(item.document_id))}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#d4dfe4] bg-white px-3 text-[11px] font-medium text-[#27657c]"
            >
              <ExternalLink className="size-3.5" /> Open file
            </a>
          ) : null}
          <Button variant="outline" size="sm" onClick={onOpenSupplier}>
            <Building2 /> Open supplier
          </Button>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-current/10 pt-3 text-[10px] text-slate-500">
        <span>Review status: {titleCase(item.review_status)}</span>
        <span>
          {missing
            ? 'Qualification file required'
            : item.document_id
              ? 'Qualification document'
              : 'Supplier register record'}
        </span>
      </div>
    </article>
  );
}

function IntakeTable({ intakes }: { intakes: Workspace['intakes'] }) {
  if (!intakes.length)
    return (
      <EmptyState
        title="The queue is clear"
        description="Upload a draft to create a pending review item."
      />
    );
  return (
    <Table>
      <TableHeader>
        <TableRow className="bg-[#f7f9fa]">
          <TableHead className="px-5">Intake</TableHead>
          <TableHead>Proposed value</TableHead>
          <TableHead>Stage</TableHead>
          <TableHead>Findings</TableHead>
          <TableHead className="pr-5 text-right">Received</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {intakes.map((item) => (
          <TableRow key={String(item.id)}>
            <TableCell className="px-5 py-3.5">
              <div className="font-medium text-[#1d3443]">
                {valueText(item.title)}
              </div>
              <div className="mt-1 text-[11px] text-slate-500">
                {valueText(item.intake_number)} ·{' '}
                {valueText(item.proposed_supplier_name)}
              </div>
            </TableCell>
            <TableCell className="text-xs font-medium">
              {moneyFromCents(item.proposed_value_cents)}
            </TableCell>
            <TableCell>
              <StatusBadge tone={toneForStatus(item.status)}>
                {titleCase(item.status)}
              </StatusBadge>
            </TableCell>
            <TableCell className="text-xs">
              {valueText(item.finding_count)}
            </TableCell>
            <TableCell className="pr-5 text-right text-xs text-slate-500">
              {valueText(item.received_at)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function KeyDateList({ items }: { items: Workspace['keyDates'] }) {
  if (!items.length)
    return (
      <EmptyState
        title="No current alerts"
        description="Verified renewal and supplier-document dates will appear here."
      />
    );
  return (
    <div className="divide-y divide-[#e8edef] px-5">
      {items.map((item) => (
        <div key={String(item.id)} className="flex items-start gap-3 py-4">
          <span
            className={`mt-1 size-2 shrink-0 rounded-full ${item.type === 'non_renewal_notice' ? 'bg-rose-500' : item.type === 'insurance_expiration' ? 'bg-amber-500' : 'bg-sky-500'}`}
          />
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-medium text-[#263c49]">
              {valueText(item.title)}
            </p>
            <p className="mt-1 truncate text-[11px] text-slate-500">
              {valueText(item.contract_number ?? item.supplier_name)}
            </p>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-medium text-slate-600">
              {valueText(item.due_date)}
            </span>
            {item.source_page ? (
              <p className="mt-1 text-[9px] text-slate-400">
                Source p. {item.source_page}
              </p>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

function RecordDetailDialog({
  workspace,
  selection,
  onClose,
  onRefresh,
}: {
  workspace: Workspace;
  selection: DetailSelection;
  onClose: () => void;
  onRefresh: () => Promise<void>;
}) {
  const contract =
    selection.type === 'contract'
      ? workspace.contracts.find((item) => item.id === selection.id)
      : null;
  const supplier =
    selection.type === 'supplier'
      ? workspace.suppliers.find((item) => item.id === selection.id)
      : workspace.suppliers.find((item) => item.id === contract?.supplier_id);
  const record = selection.type === 'contract' ? contract : supplier;
  const documents = workspace.documents.filter((item) =>
    selection.type === 'contract'
      ? item.contract_id === selection.id
      : item.supplier_id === selection.id &&
        item.lifecycle_stage === 'supplier_record',
  );
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(
    documents[0] ? String(documents[0].id) : null,
  );
  if (!record) return null;
  const selectedDocument =
    documents.find((item) => String(item.id) === selectedDocumentId) ??
    documents[0];
  const aiReviews = selectedDocument
    ? workspace.aiReviews.filter(
        (item) => item.document_id === selectedDocument.id,
      )
    : [];
  const title =
    selection.type === 'contract'
      ? valueText(contract?.title)
      : valueText(supplier?.legal_name);
  const subtitle =
    selection.type === 'contract'
      ? valueText(contract?.contract_number)
      : `${valueText(supplier?.category)} supplier`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/25 p-4 backdrop-blur-[2px]"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <dialog
        open
        aria-modal="true"
        aria-labelledby="detail-dialog-title"
        className="relative m-0 max-h-[94vh] w-full max-w-[1280px] overflow-y-auto rounded-xl bg-white p-0 text-sm shadow-2xl ring-1 ring-slate-900/10"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close details"
          className="absolute right-4 top-4 z-10 flex size-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
        >
          ×
        </button>
        <div className="border-b border-[#e1e7ea] px-6 py-5">
          <div className="mb-1 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#347d96]">
            {selection.type === 'contract' ? (
              <FileCheck2 className="size-3.5" />
            ) : (
              <Building2 className="size-3.5" />
            )}
            {selection.type === 'contract'
              ? 'Contract source document'
              : 'Supplier qualification files'}
          </div>
          <h2
            id="detail-dialog-title"
            className="pr-10 text-xl font-semibold text-[#183040]"
          >
            {title}
          </h2>
          <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
        </div>
        <div className="space-y-6 p-6">
          {aiReviews.length ? <AIReviewTrail items={aiReviews} /> : null}
          <section>
            {documents.length && selectedDocument ? (
              <div className="grid overflow-hidden rounded-xl border border-[#d7e1e6] bg-[#f6f8f9] lg:grid-cols-[250px_minmax(0,1fr)]">
                <aside className="border-b border-[#d7e1e6] bg-white p-3 lg:border-b-0 lg:border-r">
                  <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                    Available files
                  </p>
                  <div className="space-y-1">
                    {documents.map((item) => {
                      const active =
                        String(item.id) === String(selectedDocument.id);
                      return (
                        <button
                          key={String(item.id)}
                          type="button"
                          onClick={() => setSelectedDocumentId(String(item.id))}
                          className={`flex w-full items-start gap-2 rounded-lg px-2.5 py-2.5 text-left ${active ? 'bg-[#e7f3f7] text-[#174f68]' : 'text-slate-600 hover:bg-slate-50'}`}
                        >
                          <FileText className="mt-0.5 size-4 shrink-0" />
                          <span className="min-w-0">
                            <span className="block truncate text-xs font-medium">
                              {valueText(item.file_name)}
                            </span>
                            <span className="mt-0.5 block text-[10px] opacity-70">
                              {titleCase(item.file_type)} ·{' '}
                              {valueText(item.review_status)}
                            </span>
                            {item.issuer || item.document_number ? (
                              <span className="mt-0.5 block truncate text-[10px] opacity-70">
                                {valueText(item.issuer)} ·{' '}
                                {valueText(item.document_number)}
                              </span>
                            ) : null}
                            {item.expiration_date ? (
                              <span className="mt-0.5 block text-[10px] opacity-70">
                                Expires {valueText(item.expiration_date)}
                              </span>
                            ) : null}
                            {item.coverage_summary ? (
                              <span className="mt-0.5 block line-clamp-2 text-[10px] opacity-70">
                                {valueText(item.coverage_summary)}
                              </span>
                            ) : null}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </aside>
                <div className="min-w-0 bg-[#eef2f4]">
                  <div className="flex items-center justify-between gap-3 border-b border-[#d7e1e6] bg-white px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-[#203845]">
                        {valueText(selectedDocument.file_name)}
                      </p>
                      <p className="mt-0.5 text-[10px] text-slate-500">
                        Original file content ·{' '}
                        {titleCase(selectedDocument.mime_type)}
                      </p>
                      <p className="mt-0.5 text-[10px] text-slate-500">
                        {titleCase(selectedDocument.file_type)} · Review{' '}
                        {titleCase(selectedDocument.review_status)} · Issuer{' '}
                        {valueText(selectedDocument.issuer)} · Document no.{' '}
                        {valueText(selectedDocument.document_number)} ·
                        Effective {valueText(selectedDocument.effective_date)} ·
                        Expires {valueText(selectedDocument.expiration_date)} ·
                        Summary {valueText(selectedDocument.coverage_summary)}
                      </p>
                    </div>
                    <a
                      href={`/api/document?id=${encodeURIComponent(String(selectedDocument.id))}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-[#d4dfe4] bg-white px-3 py-1.5 text-[11px] font-medium text-[#27657c]"
                    >
                      <ExternalLink className="size-3.5" />
                      Open separately
                    </a>
                  </div>
                  <iframe
                    title={valueText(selectedDocument.file_name)}
                    src={`/api/document?id=${encodeURIComponent(String(selectedDocument.id))}`}
                    className="h-[62vh] min-h-[520px] w-full bg-white"
                  />
                </div>
              </div>
            ) : (
              <div className="flex min-h-[360px] flex-col items-center justify-center rounded-xl border border-dashed border-[#cbd7dd] bg-[#f8fafb] px-6 text-center">
                <span className="flex size-12 items-center justify-center rounded-full bg-[#e8f2f5] text-[#347d96]">
                  <FileText className="size-6" />
                </span>
                <h3 className="mt-4 text-sm font-semibold text-[#203845]">
                  {selection.type === 'contract'
                    ? 'No executed source document linked'
                    : 'No supplier qualification file linked'}
                </h3>
                <p className="mt-2 max-w-md text-xs leading-5 text-slate-500">
                  {selection.type === 'contract'
                    ? 'This legacy register record has no digital file attached. Use Register executed contract from the Contract Register and its verified PDF will open here as the source of truth.'
                    : 'The status may come from a legacy register, but no digital file is attached. Upload the applicable W-9, insurance, registration, license, or risk-review evidence below.'}
                </p>
              </div>
            )}
          </section>

          {selection.type === 'supplier' && supplier ? (
            <SupplierDocumentUpload
              supplierId={String(supplier.id)}
              supplierName={String(supplier.legal_name)}
              onUploaded={onRefresh}
            />
          ) : null}
        </div>
      </dialog>
    </div>
  );
}

function storedReviewValue(value: unknown) {
  if (typeof value !== 'string') return valueText(value);
  try {
    return valueText(JSON.parse(value));
  } catch {
    return valueText(value);
  }
}

function AIReviewTrail({ items }: { items: Workspace['aiReviews'] }) {
  const run = items[0];
  const labelByField: Record<string, string> = {
    ...Object.fromEntries(extractionFields),
    supplierLegalName: 'Supplier legal name',
    documentType: 'Document type',
    issuer: 'Issuer / authority',
    documentNumber: 'Document / policy number',
    effectiveDate: 'Effective date',
    expirationDate: 'Expiration date',
    coverageSummary: 'Coverage / qualification summary',
  };
  const orderedItems = [...items].sort((a, b) => {
    const order = [
      ...extractionFields.map(([fieldName]) => fieldName),
      'documentType',
      'issuer',
      'documentNumber',
      'coverageSummary',
    ];
    return (
      order.indexOf(String(a.field_name) as ExtractionFieldKey) -
      order.indexOf(String(b.field_name) as ExtractionFieldKey)
    );
  });

  return (
    <section className="overflow-hidden rounded-xl border border-[#bdd7e0] bg-[#f7fbfc]">
      <div className="flex flex-col justify-between gap-3 border-b border-[#d6e4e9] px-5 py-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Sparkles className="size-4 text-[#287d9b]" />
            <h3 className="text-sm font-semibold text-[#1b3442]">
              {run.stage === 'supplier_document'
                ? 'AI supplier-document audit trail'
                : 'AI contract extraction audit trail'}
            </h3>
            <StatusBadge
              tone={Number(run.correction_count ?? 0) ? 'amber' : 'green'}
            >
              {valueText(run.correction_count)} human corrections
            </StatusBadge>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            {valueText(run.model)} · Playbook {valueText(run.prompt_version)} ·
            Reviewed by {valueText(run.reviewed_by)} on{' '}
            {valueText(run.reviewed_at)}
          </p>
        </div>
        <StatusBadge tone="green">Human verified</StatusBadge>
      </div>
      <div className="overflow-x-auto">
        <Table className="min-w-[900px]">
          <TableHeader>
            <TableRow className="bg-white">
              <TableHead className="px-5">Field</TableHead>
              <TableHead>AI original</TableHead>
              <TableHead>Verified value</TableHead>
              <TableHead>Decision</TableHead>
              <TableHead>Confidence</TableHead>
              <TableHead className="pr-5">Source</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orderedItems.map((item) => (
              <TableRow key={String(item.id)}>
                <TableCell className="px-5 text-xs font-medium text-[#294454]">
                  {labelByField[String(item.field_name)] ??
                    titleCase(item.field_name)}
                </TableCell>
                <TableCell className="max-w-[190px] text-xs text-slate-500">
                  {storedReviewValue(item.original_value_json)}
                </TableCell>
                <TableCell className="max-w-[190px] text-xs font-medium text-[#203845]">
                  {storedReviewValue(item.verified_value_json)}
                </TableCell>
                <TableCell>
                  <StatusBadge
                    tone={
                      item.review_status === 'corrected' ? 'amber' : 'green'
                    }
                  >
                    {titleCase(item.review_status)}
                  </StatusBadge>
                </TableCell>
                <TableCell className="text-xs">
                  {Math.round(Number(item.confidence ?? 0) * 100)}%
                </TableCell>
                <TableCell className="max-w-[280px] pr-5 text-[10px] leading-4 text-slate-500">
                  {item.source_page ? `Page ${item.source_page}` : 'No page'}
                  {item.source_quote ? ` · “${item.source_quote}”` : ''}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}

function SupplierDocumentUpload({
  supplierId,
  supplierName,
  onUploaded,
}: {
  supplierId: string;
  supplierName: string;
  onUploaded: () => Promise<void>;
}) {
  const [documentType, setDocumentType] = useState('w9');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [expirationDate, setExpirationDate] = useState('');
  const [issuer, setIssuer] = useState('');
  const [documentNumber, setDocumentNumber] = useState('');
  const [coverageSummary, setCoverageSummary] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [aiResult, setAiResult] =
    useState<SupplierDocumentAnalysisResponse | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const analyze = async () => {
    if (!file) return setMessage('Choose a PDF, PNG, or JPEG file.');
    setAnalyzing(true);
    setMessage('');
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('expectedDocumentType', documentType);
      const response = await fetch('/api/analyze-supplier-document', {
        method: 'POST',
        body: form,
      });
      const body =
        (await response.json()) as SupplierDocumentAnalysisResponse & {
          error?: string;
        };
      if (!response.ok)
        throw new Error(body.error || 'Unable to analyze the supplier file.');
      setAiResult(body);
      const extractedType = body.analysis.documentType.value;
      if (
        typeof extractedType === 'string' &&
        SUPPLIER_DOCUMENT_TYPES.includes(extractedType as SupplierDocumentType)
      )
        setDocumentType(extractedType);
      setIssuer(valueText(body.analysis.issuer.value).replace('Not found', ''));
      setDocumentNumber(
        valueText(body.analysis.documentNumber.value).replace('Not found', ''),
      );
      setEffectiveDate(
        valueText(body.analysis.effectiveDate.value).replace('Not found', ''),
      );
      setExpirationDate(
        valueText(body.analysis.expirationDate.value).replace('Not found', ''),
      );
      setCoverageSummary(
        valueText(body.analysis.coverageSummary.value).replace('Not found', ''),
      );
      setMessage('AI suggestions loaded. Review the metadata before upload.');
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Unable to analyze the supplier file.',
      );
    } finally {
      setAnalyzing(false);
    }
  };

  const upload = async () => {
    if (!file) return setMessage('Choose a PDF, PNG, or JPEG file.');
    setSaving(true);
    setMessage('');
    try {
      const form = new FormData();
      form.append('supplierId', supplierId);
      form.append('analysisRunId', aiResult?.analysisRunId ?? '');
      form.append('documentType', documentType);
      form.append('effectiveDate', effectiveDate);
      form.append('expirationDate', expirationDate);
      form.append('issuer', issuer);
      form.append('documentNumber', documentNumber);
      form.append('coverageSummary', coverageSummary);
      form.append('file', file);
      const response = await fetch('/api/supplier-documents', {
        method: 'POST',
        body: form,
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok)
        throw new Error(body.error || 'Unable to upload the document.');
      setMessage('Document saved to the supplier record.');
      setFile(null);
      setAiResult(null);
      setIssuer('');
      setDocumentNumber('');
      setEffectiveDate('');
      setExpirationDate('');
      setCoverageSummary('');
      await onUploaded();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Unable to upload the document.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-xl border border-[#bcd8e2] bg-[#f0f8fa] p-4">
      <div className="flex items-center gap-2">
        <Upload className="size-4 text-[#287693]" />
        <h3 className="text-sm font-semibold text-[#203845]">
          Add supplier qualification document
        </h3>
      </div>
      <p className="mt-1 text-[11px] text-slate-500">
        Store tax, insurance, business registration, licensing, risk, safety,
        diversity, and other qualification evidence. AI can extract the
        metadata, but upload still creates a pending human-review record and
        never approves the supplier automatically.
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <select
          value={documentType}
          onChange={(event) => setDocumentType(event.target.value)}
          className="h-9 rounded-md border border-input bg-white px-3 text-xs"
        >
          {SUPPLIER_DOCUMENT_TYPES.map((type) => (
            <option key={type} value={type}>
              {SUPPLIER_DOCUMENT_LABELS[type]}
            </option>
          ))}
        </select>
        <Input
          value={issuer}
          onChange={(event) => setIssuer(event.target.value)}
          placeholder="Issuer or verification source"
          className="h-9 bg-white text-xs"
        />
        <Input
          value={documentNumber}
          onChange={(event) => setDocumentNumber(event.target.value)}
          placeholder="License / document number"
          className="h-9 bg-white text-xs"
        />
        <Input
          type="date"
          value={effectiveDate}
          onChange={(event) => setEffectiveDate(event.target.value)}
          aria-label="Qualification document effective date"
          className="h-9 bg-white text-xs"
        />
        <Input
          type="date"
          value={expirationDate}
          onChange={(event) => setExpirationDate(event.target.value)}
          aria-label="Qualification document expiration date"
          className="h-9 bg-white text-xs"
        />
        <Input
          value={coverageSummary}
          onChange={(event) => setCoverageSummary(event.target.value)}
          placeholder="Coverage / qualification summary"
          className="h-9 bg-white text-xs md:col-span-2"
        />
        <Input
          type="file"
          accept="application/pdf,image/png,image/jpeg"
          onChange={(event) => {
            setFile(event.target.files?.[0] ?? null);
            setAiResult(null);
            setMessage('');
          }}
          className="h-9 bg-white text-xs file:mr-3 file:border-0 file:bg-transparent"
        />
        <div className="flex gap-2 xl:col-start-4 xl:justify-end">
          <Button
            size="sm"
            variant="outline"
            onClick={analyze}
            disabled={!file || analyzing || saving}
            className="bg-white"
          >
            {analyzing ? (
              <LoaderCircle className="animate-spin" />
            ) : (
              <Sparkles />
            )}
            Analyze with AI
          </Button>
          <Button size="sm" onClick={upload} disabled={saving || analyzing}>
            {saving ? <LoaderCircle className="animate-spin" /> : <Upload />}
            Upload reviewed file
          </Button>
        </div>
      </div>
      {aiResult ? (
        <SupplierDocumentAIReview
          result={aiResult}
          supplierName={supplierName}
        />
      ) : null}
      {message ? (
        <p
          className={`mt-2 text-[11px] ${message.startsWith('Document saved') || message.startsWith('AI suggestions') ? 'text-emerald-700' : 'text-rose-600'}`}
        >
          {message}
        </p>
      ) : null}
    </section>
  );
}

function SupplierDocumentAIReview({
  result,
  supplierName,
}: {
  result: SupplierDocumentAnalysisResponse;
  supplierName: string;
}) {
  const extractedName = valueText(result.analysis.supplierLegalName.value);
  const supplierMatch =
    extractedName !== 'Not found' &&
    normalizeSupplierName(extractedName) ===
      normalizeSupplierName(supplierName);
  const fields = (
    [
      ['Legal name', result.analysis.supplierLegalName],
      ['DBA / trade name', result.analysis.dbaName],
      ['Supplier category', result.analysis.supplierCategory],
      ['Primary contact', result.analysis.primaryContact],
      ['Email', result.analysis.email],
      ['Phone', result.analysis.phone],
      ['Website', result.analysis.website],
      ['Address', result.analysis.addressLine1],
      ['Address line 2', result.analysis.addressLine2],
      ['City', result.analysis.city],
      ['State', result.analysis.state],
      ['Postal code', result.analysis.postalCode],
      ['Country', result.analysis.country],
      ['Tax classification', result.analysis.taxClassification],
      ['Detected type', result.analysis.documentType],
      ['Issuer', result.analysis.issuer],
      ['Document number', result.analysis.documentNumber],
      ['Effective date', result.analysis.effectiveDate],
      ['Expiration date', result.analysis.expirationDate],
      ['Coverage / qualification', result.analysis.coverageSummary],
    ] satisfies Array<[string, ExtractedField]>
  ).filter(([, field]) => field.value !== null && field.value !== '');

  return (
    <div className="mt-4 rounded-xl border border-[#bdd7e0] bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Sparkles className="size-4 text-[#287d9b]" />
            <h4 className="text-xs font-semibold text-[#203845]">
              AI qualification-document extraction
            </h4>
            <StatusBadge tone={supplierMatch ? 'green' : 'rose'}>
              {supplierMatch ? 'Supplier name matched' : 'Name needs review'}
            </StatusBadge>
          </div>
          <p className="mt-1 text-[10px] text-slate-500">
            File identifies {extractedName}; current record is {supplierName}.
          </p>
        </div>
        <Badge
          variant="outline"
          className="border-sky-200 bg-sky-50 text-sky-800"
        >
          {result.model}
        </Badge>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {fields.map(([label, field]) => (
          <div
            key={label}
            className="rounded-lg border border-[#e0e7ea] bg-[#f8fafb] p-3"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                {label}
              </span>
              <FieldConfidence field={field} />
            </div>
            <p className="mt-1.5 text-[11px] font-medium text-[#294354]">
              {valueText(field.value)}
            </p>
            <p className="mt-1 line-clamp-2 text-[9px] leading-4 text-slate-500">
              {field.sourcePage ? `Page ${field.sourcePage}` : 'No page'}
              {field.sourceQuote ? ` · “${field.sourceQuote}”` : ''}
            </p>
          </div>
        ))}
      </div>
      {result.analysis.findings.length || result.analysis.warnings.length ? (
        <div className="mt-3 space-y-2">
          {result.analysis.findings.map((finding, index) => (
            <div
              key={`${finding.title}-${index}`}
              className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-[10px] text-amber-900"
            >
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              <span>
                <strong>{finding.title}:</strong> {finding.detail}
              </span>
            </div>
          ))}
          {result.analysis.warnings.map((warning) => (
            <div
              key={warning}
              className="flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2 text-[10px] text-rose-800"
            >
              <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
              {warning}
            </div>
          ))}
        </div>
      ) : null}
      <p className="mt-3 text-[10px] text-slate-500">
        These source-backed values feed the proposed supplier master and
        document metadata. Review or correct them before creating the database
        record.
      </p>
    </div>
  );
}

function AnalysisReview({
  result,
  originalAnalysis,
  stage,
  fieldReviews,
  onFieldChange,
  onConfirmField,
  onConfirmAll,
}: {
  result: AnalysisResponse;
  originalAnalysis: ContractAnalysis | null;
  stage: IntakeStage;
  fieldReviews: Partial<Record<ExtractionFieldKey, FieldReviewStatus>>;
  onFieldChange: (
    fieldName: ExtractionFieldKey,
    value: string | number | null,
  ) => void;
  onConfirmField: (fieldName: ExtractionFieldKey) => void;
  onConfirmAll: () => void;
}) {
  const confirmedCount = extractionFields.filter(
    ([fieldName]) =>
      fieldReviews[fieldName] === 'accepted' ||
      fieldReviews[fieldName] === 'corrected',
  ).length;
  const correctedCount = extractionFields.filter(
    ([fieldName]) => fieldReviews[fieldName] === 'corrected',
  ).length;

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-[#bdd7e0] bg-[#f0f8fa] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-[#1b3442]">
                Human verification required
              </h3>
              <Badge
                variant="outline"
                className="border-sky-200 bg-white text-sky-800"
              >
                {result.model}
              </Badge>
            </div>
            <p className="mt-1 text-[11px] text-slate-600">
              Confirm or correct every AI-extracted field before database values
              can change.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onConfirmAll}
            disabled={confirmedCount === extractionFields.length}
            className="bg-white"
          >
            <Check /> Confirm all unchanged
          </Button>
        </div>
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white">
          <div
            className="h-full rounded-full bg-[#287d9b] transition-all"
            style={{
              width: `${(confirmedCount / extractionFields.length) * 100}%`,
            }}
          />
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-600">
          <span>
            {confirmedCount} of {extractionFields.length} fields reviewed
          </span>
          <span>
            {correctedCount
              ? `${correctedCount} human correction${correctedCount === 1 ? '' : 's'} recorded`
              : 'No corrections recorded yet'}
          </span>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {extractionFields.map(([key, label]) => {
          const field = result.analysis[key] as ExtractedField;
          const originalField = (originalAnalysis?.[key] ??
            field) as ExtractedField;
          const reviewStatus = fieldReviews[key] ?? 'pending';
          const lowConfidence = field.confidence < 0.75;
          const inputValue = field.value === null ? '' : String(field.value);
          const updateValue = (rawValue: string) => {
            if (key === 'contractValue' || key === 'noticeDays') {
              onFieldChange(key, rawValue === '' ? null : Number(rawValue));
              return;
            }
            onFieldChange(key, rawValue === '' ? null : rawValue);
          };
          return (
            <div
              key={key}
              className={`rounded-lg border bg-white p-3 ${reviewStatus === 'corrected' ? 'border-amber-300' : reviewStatus === 'accepted' ? 'border-emerald-200' : lowConfidence ? 'border-rose-300' : 'border-[#dce3e8]'}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                  {label}
                </span>
                <div className="flex items-center gap-1.5">
                  <FieldConfidence field={originalField} />
                  <StatusBadge
                    tone={
                      reviewStatus === 'accepted'
                        ? 'green'
                        : reviewStatus === 'corrected'
                          ? 'amber'
                          : lowConfidence
                            ? 'rose'
                            : 'blue'
                    }
                  >
                    {reviewStatus === 'pending'
                      ? lowConfidence
                        ? 'Needs review'
                        : 'Pending'
                      : titleCase(reviewStatus)}
                  </StatusBadge>
                </div>
              </div>
              {key === 'renewalType' ? (
                <select
                  aria-label={label}
                  value={inputValue}
                  onChange={(event) => updateValue(event.target.value)}
                  className="mt-2 h-9 w-full rounded-md border border-input bg-white px-3 text-xs font-medium text-[#203845]"
                >
                  <option value="">Not found</option>
                  <option value="automatic">Automatic</option>
                  <option value="optional">Optional</option>
                  <option value="none">None</option>
                </select>
              ) : (
                <Input
                  aria-label={label}
                  type={
                    key === 'effectiveDate' || key === 'expirationDate'
                      ? 'date'
                      : key === 'contractValue' || key === 'noticeDays'
                        ? 'number'
                        : 'text'
                  }
                  min={
                    key === 'contractValue' || key === 'noticeDays'
                      ? '0'
                      : undefined
                  }
                  step={key === 'contractValue' ? '0.01' : undefined}
                  value={inputValue}
                  onChange={(event) => updateValue(event.target.value)}
                  placeholder="Not found in document"
                  className="mt-2 h-9 bg-white text-xs font-medium text-[#203845]"
                />
              )}
              {reviewStatus === 'corrected' ? (
                <p className="mt-2 rounded bg-amber-50 px-2 py-1 text-[10px] text-amber-800">
                  AI original: {valueText(originalField.value)}
                </p>
              ) : null}
              <div className="mt-2 flex items-start gap-2 text-[10px] leading-4 text-slate-500">
                <BookOpenCheck className="mt-0.5 size-3 shrink-0" />
                <span>
                  {originalField.sourcePage
                    ? `Page ${originalField.sourcePage}`
                    : 'No page'}
                  {originalField.sourceQuote
                    ? ` · “${originalField.sourceQuote}”`
                    : ' · No supporting quote found'}
                </span>
              </div>
              <div className="mt-3 flex justify-end">
                <Button
                  type="button"
                  size="sm"
                  variant={reviewStatus === 'pending' ? 'default' : 'outline'}
                  onClick={() => onConfirmField(key)}
                  className="h-7 px-2.5 text-[10px]"
                >
                  <Check />
                  {reviewStatus === 'pending'
                    ? 'Confirm field'
                    : reviewStatus === 'corrected'
                      ? 'Correction recorded'
                      : 'Confirmed'}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
      {result.analysis.findings.length ? (
        <div>
          <h3 className="text-sm font-semibold text-[#1b3442]">
            {stage === 'draft'
              ? 'Playbook differences'
              : 'Operational exceptions'}
          </h3>
          <div className="mt-3 space-y-2">
            {result.analysis.findings.map((finding, index) => (
              <div
                key={`${finding.rule}-${index}`}
                className="flex items-start gap-3 rounded-lg border border-[#dce3e8] p-3"
              >
                <AlertTriangle
                  className={`mt-0.5 size-4 shrink-0 ${finding.severity === 'high' ? 'text-rose-600' : 'text-amber-600'}`}
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-medium">{finding.rule}</p>
                    <StatusBadge
                      tone={finding.severity === 'high' ? 'rose' : 'amber'}
                    >
                      {titleCase(finding.severity)}
                    </StatusBadge>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-600">
                    Observed: {finding.observed}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Demo standard: {finding.standard}
                    {finding.sourcePage ? ` · Page ${finding.sourcePage}` : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {result.analysis.warnings.length ? (
        <Alert>
          <AlertCircle />
          <AlertTitle>Fields needing manual attention</AlertTitle>
          <AlertDescription>
            {result.analysis.warnings.join(' ')}
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
