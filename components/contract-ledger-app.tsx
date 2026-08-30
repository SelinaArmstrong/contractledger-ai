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
  FolderKanban,
  LayoutDashboard,
  LoaderCircle,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Upload,
  Users,
} from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  Workspace,
} from '@/lib/contract-ledger-types';
import { exportCurrentRegisters } from '@/lib/export-registers';

type ViewName =
  | 'Dashboard'
  | 'New Contract Review'
  | 'Executed Intake'
  | 'Contract Register'
  | 'Supplier Register'
  | 'Alerts & Exports';

type IntakeStage = 'draft' | 'executed';
type DetailSelection = { type: 'contract' | 'supplier'; id: string };

const navItems: Array<{ label: ViewName; icon: ElementType }> = [
  { label: 'Dashboard', icon: LayoutDashboard },
  { label: 'New Contract Review', icon: FileSearch },
  { label: 'Executed Intake', icon: FileCheck2 },
  { label: 'Contract Register', icon: FolderKanban },
  { label: 'Supplier Register', icon: Users },
  { label: 'Alerts & Exports', icon: BellRing },
];

const extractionFields: Array<[keyof ContractAnalysis, string]> = [
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
];

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
  const [analysisStatus, setAnalysisStatus] = useState<
    'idle' | 'analyzing' | 'ready' | 'saving' | 'saved' | 'error'
  >('idle');
  const [analysisError, setAnalysisError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [detail, setDetail] = useState<DetailSelection | null>(null);
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

  const saveVerifiedRecord = async () => {
    if (!analysisResult) return;
    setAnalysisStatus('saving');
    setAnalysisError('');
    try {
      const response = await fetch('/api/workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stage,
          analysis: analysisResult.analysis,
          document: analysisResult.document,
        }),
      });
      const body = (await response.json()) as {
        saved?: boolean;
        workspace?: Workspace;
        error?: string;
      };
      if (!response.ok || !body.workspace)
        throw new Error(
          body.error || 'The verified record could not be saved.',
        );
      setWorkspace(body.workspace);
      setAnalysisStatus('saved');
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
    executed:
      workspace?.intakes.filter((item) => item.status === 'executed').length ??
      0,
    alerts:
      workspace?.keyDates.filter((item) => item.status !== 'completed')
        .length ?? 0,
  };

  const navCount = (label: ViewName) => {
    if (label === 'New Contract Review') return counts.review;
    if (label === 'Executed Intake') return counts.executed;
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
        item.linked_contracts,
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
          {activeView === 'Executed Intake' ? (
            <ExecutedIntakeView
              workspace={workspace}
              onOpen={() => openIntake('executed')}
            />
          ) : null}
          {activeView === 'Contract Register' ? (
            <ContractRegisterView
              contracts={filteredContracts}
              search={search}
              onSearch={setSearch}
              onExport={exportRegisters}
              exporting={exporting}
              onSelect={(id) => setDetail({ type: 'contract', id })}
            />
          ) : null}
          {activeView === 'Supplier Register' ? (
            <SupplierRegisterView
              suppliers={filteredSuppliers}
              search={search}
              onSearch={setSearch}
              onSelect={(id) => setDetail({ type: 'supplier', id })}
            />
          ) : null}
          {activeView === 'Alerts & Exports' ? (
            <AlertsExportsView
              workspace={workspace}
              onExport={exportRegisters}
              exporting={exporting}
              onRefresh={loadWorkspace}
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
                    <AnalysisReview result={analysisResult} stage={stage} />
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
                        setAnalysisStatus('idle');
                      }}
                    >
                      Start over
                    </Button>
                    <Button
                      onClick={saveVerifiedRecord}
                      disabled={analysisStatus === 'saving'}
                      className="bg-[#1d718f] hover:bg-[#185f78]"
                    >
                      {analysisStatus === 'saving' ? (
                        <LoaderCircle className="animate-spin" />
                      ) : (
                        <Database />
                      )}{' '}
                      {stage === 'draft'
                        ? 'Save to review queue'
                        : 'Add to official registers'}
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
      <DemoTransactionComparison />
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

function DemoTransactionComparison() {
  const changes = [
    ['Contract value', '$585,000 proposed', '$475,000 official'],
    ['Payment terms', 'Net 60', 'Net 30'],
    ['Governing law', 'New York', 'California'],
    ['Renewal notice', 'Automatic · 45 days', 'Automatic · 60 days'],
    ['Supplier status', 'Pending', 'Active after verification'],
    ['Official register impact', '$0', '+$475,000'],
    ['Human review', '15 playbook differences', '1 renewal decision'],
  ];
  return (
    <Panel className="mb-7 overflow-hidden border-[#c9dbe2]">
      <PanelHeader
        title="Fictional transaction — negotiation outcome"
        description="The same Westline project moves from proposed data to an executed source of truth."
        action={
          <Badge
            variant="outline"
            className="border-sky-200 bg-sky-50 text-sky-800"
          >
            Same supplier · Same project
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
            {changes.map(([label, draft, executed]) => (
              <TableRow key={label}>
                <TableCell className="px-5 py-3 text-xs font-medium text-[#294454]">
                  {label}
                </TableCell>
                <TableCell className="text-xs text-slate-500">
                  {draft}
                </TableCell>
                <TableCell className="text-xs font-medium text-[#1f5f4c]">
                  {executed}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex flex-col gap-2 border-t border-[#e3e9ed] bg-[#f7fbfc] px-5 py-3 text-[11px] text-slate-600 sm:flex-row sm:items-center sm:justify-between">
        <span className="flex items-center gap-2">
          <ShieldCheck className="size-3.5 text-[#2f7b94]" />
          Draft terms support review and supplier onboarding only.
        </span>
        <span className="flex items-center gap-2">
          <CircleCheck className="size-3.5 text-emerald-600" />
          Only the verified executed copy updates official totals and alerts.
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

function ExecutedIntakeView({
  workspace,
  onOpen,
}: {
  workspace: Workspace | null;
  onOpen: () => void;
}) {
  const executed = (workspace?.intakes ?? []).filter(
    (item) => item.status === 'executed',
  );
  return (
    <>
      <PageHeading
        eyebrow="Post-execution intake"
        title="Executed contract registration"
        description="The signed version becomes the source of truth for official contract value, dates, supplier status, and renewal monitoring."
        action={
          <Button onClick={onOpen} className="bg-[#1d718f] hover:bg-[#185f78]">
            <Upload />
            Upload executed copy
          </Button>
        }
      />
      <div className="mb-5 grid gap-4 md:grid-cols-3">
        <WorkflowCard
          number="01"
          title="Extract"
          description="Read official values and dates from the signed copy."
        />
        <WorkflowCard
          number="02"
          title="Verify"
          description="Confirm confidence, source page, and supplier match."
        />
        <WorkflowCard
          number="03"
          title="Register"
          description="Update both registers and activate key dates."
        />
      </div>
      <Panel className="overflow-hidden">
        <PanelHeader
          title="Executed intake queue"
          description="Signed documents ready for, or recently added to, the official register"
        />
        {executed.length ? (
          <IntakeTable intakes={executed} />
        ) : (
          <EmptyState
            title="No executed intake items"
            description="Upload an executed copy to demonstrate the official registration workflow."
          />
        )}
      </Panel>
    </>
  );
}

function WorkflowCard({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-[#dce3e8] bg-white p-5">
      <span className="text-[10px] font-semibold tracking-[0.14em] text-[#43849a]">
        STEP {number}
      </span>
      <h3 className="mt-2 text-sm font-semibold">{title}</h3>
      <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
    </div>
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
  search,
  onSearch,
  onExport,
  exporting,
  onSelect,
}: {
  contracts: Workspace['contracts'];
  search: string;
  onSearch: (value: string) => void;
  onExport: () => void;
  exporting: boolean;
  onSelect: (id: string) => void;
}) {
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
          <Button variant="outline" onClick={onExport}>
            {exporting ? (
              <LoaderCircle className="animate-spin" />
            ) : (
              <FileSpreadsheet />
            )}
            Export workbook
          </Button>
        }
      />
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
    </>
  );
}

function SupplierRegisterView({
  suppliers,
  search,
  onSearch,
  onSelect,
}: {
  suppliers: Workspace['suppliers'];
  search: string;
  onSearch: (value: string) => void;
  onSelect: (id: string) => void;
}) {
  return (
    <>
      <PageHeading
        eyebrow="Linked supplier master"
        title="Supplier register"
        description="Suppliers may enter as Pending during draft intake and become Active only when onboarding is complete or an executed contract is registered."
      />
      <Panel className="overflow-hidden">
        <PanelHeader
          title="Supplier master data"
          description={`${suppliers.length} supplier record${suppliers.length === 1 ? '' : 's'}`}
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
                <TableHead>Linked contracts</TableHead>
                <TableHead>Total contract value</TableHead>
                <TableHead>W-9</TableHead>
                <TableHead>Insurance status</TableHead>
                <TableHead>Insurance expiration</TableHead>
                <TableHead>Qualification files</TableHead>
                <TableHead>Last updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {suppliers.map((item) => (
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
                      Reviewed {valueText(item.qualification_review_date)}
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
                    <StatusBadge tone={toneForStatus(item.status)}>
                      {titleCase(item.status)}
                    </StatusBadge>
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
                    {typeof item.linked_contracts === 'string' ? (
                      <div className="space-y-1">
                        {item.linked_contracts.split('||').map((contract) => (
                          <div
                            key={contract}
                            className="rounded bg-slate-50 px-2 py-1 text-[10px] text-slate-600"
                          >
                            {contract}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-slate-400">
                        No executed contracts
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
                      Next expiry {valueText(item.next_document_expiration)}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs">
                    {valueText(item.updated_at)}
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
}: {
  workspace: Workspace | null;
  onExport: () => void;
  exporting: boolean;
  onRefresh: () => Promise<void>;
}) {
  return (
    <>
      <PageHeading
        eyebrow="Operational follow-through"
        title="Obligation & renewal management"
        description="Assign ownership, record renewal decisions, close obligations, and export the latest registers—without expanding this focused portfolio into a full CLM."
      />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Panel>
          <PanelHeader
            title="Obligations and renewal decisions"
            description="Operational actions linked to verified contract and supplier records"
          />
          <div className="space-y-3 p-5">
            {(workspace?.keyDates ?? []).map((item) => (
              <ObligationEditor
                key={String(item.id)}
                item={item}
                onSaved={onRefresh}
              />
            ))}
          </div>
        </Panel>
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
}: {
  item: Workspace['keyDates'][number];
  onSaved: () => Promise<void>;
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
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-[#203845]">
              {valueText(item.title)}
            </p>
            <StatusBadge tone={toneForStatus(status)}>
              {titleCase(status)}
            </StatusBadge>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            {valueText(item.contract_number ?? item.supplier_name)} · Due{' '}
            {valueText(item.due_date)}
            {item.source_page ? ` · Source p. ${item.source_page}` : ''}
          </p>
        </div>
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
                        {valueText(selectedDocument.document_number)} · Expires{' '}
                        {valueText(selectedDocument.expiration_date)}
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
                    ? 'This legacy register record has no digital file attached. Register an executed contract through Executed Intake and its verified PDF will open here as the source of truth.'
                    : 'The status may come from a legacy register, but no digital file is attached. Upload the applicable W-9, insurance, registration, license, or risk-review evidence below.'}
                </p>
              </div>
            )}
          </section>

          {selection.type === 'supplier' && supplier ? (
            <SupplierDocumentUpload
              supplierId={String(supplier.id)}
              onUploaded={onRefresh}
            />
          ) : null}
        </div>
      </dialog>
    </div>
  );
}

function SupplierDocumentUpload({
  supplierId,
  onUploaded,
}: {
  supplierId: string;
  onUploaded: () => Promise<void>;
}) {
  const [documentType, setDocumentType] = useState('w9');
  const [expirationDate, setExpirationDate] = useState('');
  const [issuer, setIssuer] = useState('');
  const [documentNumber, setDocumentNumber] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const upload = async () => {
    if (!file) return setMessage('Choose a PDF, PNG, or JPEG file.');
    setSaving(true);
    setMessage('');
    try {
      const form = new FormData();
      form.append('supplierId', supplierId);
      form.append('documentType', documentType);
      form.append('expirationDate', expirationDate);
      form.append('issuer', issuer);
      form.append('documentNumber', documentNumber);
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
      setIssuer('');
      setDocumentNumber('');
      setExpirationDate('');
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
        diversity, and other qualification evidence. Upload creates a pending
        human review record; it does not automatically approve the supplier.
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <select
          value={documentType}
          onChange={(event) => setDocumentType(event.target.value)}
          className="h-9 rounded-md border border-input bg-white px-3 text-xs"
        >
          <option value="w9">W-9</option>
          <option value="insurance_certificate">Insurance certificate</option>
          <option value="business_license">Business license</option>
          <option value="business_registration">Business registration</option>
          <option value="good_standing">
            Certificate / record of good standing
          </option>
          <option value="professional_license">
            Professional or occupational license
          </option>
          <option value="diversity_certification">
            Diversity / small-business certification
          </option>
          <option value="safety_qualification">Safety qualification</option>
          <option value="cybersecurity_assessment">
            Cybersecurity assessment
          </option>
          <option value="sanctions_debarment_check">
            Sanctions / debarment check
          </option>
          <option value="quality_certification">Quality certification</option>
          <option value="other_qualification">
            Other qualification document
          </option>
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
          value={expirationDate}
          onChange={(event) => setExpirationDate(event.target.value)}
          aria-label="Qualification document expiration date"
          className="h-9 bg-white text-xs"
        />
        <Input
          type="file"
          accept="application/pdf,image/png,image/jpeg"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          className="h-9 bg-white text-xs file:mr-3 file:border-0 file:bg-transparent"
        />
        <Button
          size="sm"
          onClick={upload}
          disabled={saving}
          className="xl:col-start-4"
        >
          {saving ? <LoaderCircle className="animate-spin" /> : <Upload />}
          Upload
        </Button>
      </div>
      {message ? (
        <p
          className={`mt-2 text-[11px] ${message.startsWith('Document saved') ? 'text-emerald-700' : 'text-rose-600'}`}
        >
          {message}
        </p>
      ) : null}
    </section>
  );
}

function AnalysisReview({
  result,
  stage,
}: {
  result: AnalysisResponse;
  stage: IntakeStage;
}) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-[#1b3442]">
            Extracted fields
          </h3>
          <p className="mt-1 text-[11px] text-slate-500">
            Verify every field against its source before saving.
          </p>
        </div>
        <Badge
          variant="outline"
          className="border-sky-200 bg-sky-50 text-sky-800"
        >
          {result.model}
        </Badge>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {extractionFields.map(([key, label]) => {
          const field = result.analysis[key] as ExtractedField;
          return (
            <div
              key={key}
              className="rounded-lg border border-[#dce3e8] bg-white p-3"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                  {label}
                </span>
                <FieldConfidence field={field} />
              </div>
              <p className="mt-2 text-sm font-medium text-[#203845]">
                {key === 'contractValue' && typeof field.value === 'number'
                  ? new Intl.NumberFormat('en-US', {
                      style: 'currency',
                      currency: 'USD',
                      maximumFractionDigits: 0,
                    }).format(field.value)
                  : valueText(field.value)}
              </p>
              <div className="mt-2 flex items-start gap-2 text-[10px] leading-4 text-slate-500">
                <BookOpenCheck className="mt-0.5 size-3 shrink-0" />
                <span>
                  {field.sourcePage ? `Page ${field.sourcePage}` : 'No page'}
                  {field.sourceQuote
                    ? ` · “${field.sourceQuote}”`
                    : ' · No supporting quote found'}
                </span>
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
