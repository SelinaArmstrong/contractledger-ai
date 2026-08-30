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
  FileCheck2,
  FileSearch,
  FileSpreadsheet,
  FileText,
  FolderKanban,
  LayoutDashboard,
  LoaderCircle,
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
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
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
  if (normalized.includes('active') || normalized.includes('current') || normalized.includes('complete')) return 'green';
  if (normalized.includes('pending') || normalized.includes('review') || normalized.includes('upcoming')) return 'amber';
  if (normalized.includes('missing') || normalized.includes('expired') || normalized.includes('high')) return 'rose';
  return 'blue';
}

function StatusBadge({ tone, children }: { tone: string; children: ReactNode }) {
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

function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
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
        {description ? <p className="mt-0.5 text-[11px] text-slate-500">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex min-h-52 flex-col items-center justify-center px-6 text-center">
      <FileText className="mb-3 size-7 text-slate-300" />
      <p className="text-sm font-medium text-slate-700">{title}</p>
      <p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">{description}</p>
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
  const [analysisResult, setAnalysisResult] = useState<AnalysisResponse | null>(null);
  const [analysisStatus, setAnalysisStatus] = useState<'idle' | 'analyzing' | 'ready' | 'saving' | 'saved' | 'error'>('idle');
  const [analysisError, setAnalysisError] = useState('');
  const [exporting, setExporting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const loadWorkspace = useCallback(async () => {
    try {
      const response = await fetch('/api/workspace');
      const body = (await response.json()) as Workspace & { error?: string };
      if (!response.ok) throw new Error(body.error || 'The workspace could not be loaded.');
      setWorkspace(body);
      setWorkspaceError('');
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : 'The workspace could not be loaded.');
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
    const fileName = stage === 'draft'
      ? '01_Draft_Professional_Services_Agreement.pdf'
      : '02_Executed_Master_Services_Agreement.pdf';
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
      const response = await fetch('/api/analyze', { method: 'POST', body: form });
      const body = (await response.json()) as AnalysisResponse & { error?: string };
      if (!response.ok) throw new Error(body.error || 'The document could not be analyzed.');
      setAnalysisResult(body);
      setAnalysisStatus('ready');
    } catch (error) {
      setAnalysisError(error instanceof Error ? error.message : 'The document could not be analyzed.');
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
      const body = (await response.json()) as { saved?: boolean; workspace?: Workspace; error?: string };
      if (!response.ok || !body.workspace) throw new Error(body.error || 'The verified record could not be saved.');
      setWorkspace(body.workspace);
      setAnalysisStatus('saved');
    } catch (error) {
      setAnalysisError(error instanceof Error ? error.message : 'The verified record could not be saved.');
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

  const counts = {
    review: workspace?.intakes.filter((item) => item.review_status !== 'complete').length ?? 0,
    executed: workspace?.intakes.filter((item) => item.status === 'executed').length ?? 0,
    alerts: workspace?.keyDates.length ?? 0,
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
      [item.contract_number, item.title, item.supplier_name, item.contract_type, item.department]
        .join(' ')
        .toLowerCase()
        .includes(query),
    );
  }, [search, workspace]);

  const filteredSuppliers = useMemo(() => {
    const query = search.toLowerCase().trim();
    if (!workspace || !query) return workspace?.suppliers ?? [];
    return workspace.suppliers.filter((item) =>
      [item.legal_name, item.category, item.status, item.primary_contact]
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
            <div className="text-[15px] font-semibold tracking-[-0.01em]">ContractLedger AI</div>
            <div className="mt-0.5 text-[11px] text-slate-300">Register automation</div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-5" aria-label="Primary navigation">
          <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Workspace</p>
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
                <Icon className={`size-[17px] ${active ? 'text-[#62c0dc]' : 'text-slate-400'}`} />
                <span className="flex-1">{item.label}</span>
                {count ? <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-slate-200">{count}</span> : null}
              </button>
            );
          })}
        </nav>

        <div className="m-3 rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center gap-2 text-xs font-medium"><ShieldCheck className="size-4 text-[#62c0dc]" />Demo workspace</div>
          <p className="mt-2 text-[11px] leading-5 text-slate-400">All contracts, suppliers, and company policies are fictional.</p>
        </div>
      </aside>

      <div className="lg:pl-[252px]">
        <header className="sticky top-0 z-10 flex h-[78px] items-center justify-between border-b border-[#dce3e8] bg-white/95 px-5 backdrop-blur md:px-8">
          <div className="flex items-center gap-3 lg:hidden">
            <div className="flex size-9 items-center justify-center rounded-lg bg-[#12344a] text-white"><FileCheck2 className="size-4" /></div>
            <span className="text-sm font-semibold">ContractLedger AI</span>
          </div>
          <div className="relative hidden w-full max-w-[440px] lg:block">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Search contracts and suppliers" placeholder="Search contracts, suppliers, values, or dates…" className="h-10 border-[#d7e0e5] bg-[#f7f9fa] pl-9 shadow-none placeholder:text-slate-400" />
          </div>
          <div className="ml-auto flex items-center gap-3">
            <button type="button" onClick={() => setActiveView('Alerts & Exports')} aria-label="Notifications" className="relative flex size-9 items-center justify-center rounded-lg border border-[#dce3e8] bg-white text-slate-600">
              <BellRing className="size-4" />
              {counts.alerts ? <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-semibold text-white">{counts.alerts}</span> : null}
            </button>
            <button type="button" className="flex items-center gap-2 rounded-lg px-1 py-1 text-left">
              <span className="flex size-9 items-center justify-center rounded-lg bg-[#d7ebf2] text-xs font-semibold text-[#17425a]">SA</span>
              <span className="hidden sm:block"><span className="block text-xs font-semibold">Selina Armstrong</span><span className="block text-[10px] text-slate-500">Contract Administrator</span></span>
              <ChevronDown className="hidden size-3.5 text-slate-400 sm:block" />
            </button>
          </div>
        </header>

        <div className="border-b border-[#dce3e8] bg-white px-4 py-2 lg:hidden">
          <div className="flex gap-1 overflow-x-auto">
            {navItems.map((item) => (
              <button key={item.label} onClick={() => setActiveView(item.label)} className={`shrink-0 rounded-md px-3 py-1.5 text-xs ${activeView === item.label ? 'bg-[#e4f2f6] font-medium text-[#1c647e]' : 'text-slate-500'}`}>{item.label}</button>
            ))}
          </div>
        </div>

        <div className="mx-auto max-w-[1500px] px-5 py-7 md:px-8 md:py-9">
          {workspaceError ? <Alert variant="destructive" className="mb-5"><AlertCircle /><AlertTitle>Workspace unavailable</AlertTitle><AlertDescription>{workspaceError}</AlertDescription></Alert> : null}
          {activeView === 'Dashboard' ? (
            <DashboardView workspace={workspace} onOpen={openIntake} onExport={exportRegisters} exporting={exporting} onNavigate={setActiveView} />
          ) : null}
          {activeView === 'New Contract Review' ? <NewContractReviewView workspace={workspace} onOpen={() => openIntake('draft')} /> : null}
          {activeView === 'Executed Intake' ? <ExecutedIntakeView workspace={workspace} onOpen={() => openIntake('executed')} /> : null}
          {activeView === 'Contract Register' ? <ContractRegisterView contracts={filteredContracts} search={search} onSearch={setSearch} onExport={exportRegisters} exporting={exporting} /> : null}
          {activeView === 'Supplier Register' ? <SupplierRegisterView suppliers={filteredSuppliers} search={search} onSearch={setSearch} /> : null}
          {activeView === 'Alerts & Exports' ? <AlertsExportsView workspace={workspace} onExport={exportRegisters} exporting={exporting} /> : null}
        </div>
      </div>

      {dialogOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/25 p-4 backdrop-blur-[2px]" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDialogOpen(false); }}>
          <dialog open aria-modal="true" aria-labelledby="intake-dialog-title" className="relative m-0 max-h-[92vh] w-full max-w-[820px] overflow-y-auto rounded-xl bg-white p-0 text-sm shadow-2xl ring-1 ring-slate-900/10">
          <button type="button" onClick={() => setDialogOpen(false)} aria-label="Close intake dialog" className="absolute right-4 top-4 z-10 flex size-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100">×</button>
          <div className="border-b border-[#e1e7ea] px-6 py-5">
            <div className="mb-1 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#347d96]"><Sparkles className="size-3.5" />DeepSeek document extraction</div>
            <h2 id="intake-dialog-title" className="text-lg font-medium leading-none">{stage === 'draft' ? 'Review a new contract' : 'Register an executed contract'}</h2>
            <p className="mt-2 text-sm text-slate-500">{stage === 'draft' ? 'Extract proposed fields and playbook differences. Nothing will enter the official contract register.' : 'Extract official signed data, verify it, and add the record to the contract and supplier registers.'}</p>
          </div>

          <div className="space-y-5 px-6 py-5">
            {analysisStatus === 'saved' ? (
              <div className="flex min-h-64 flex-col items-center justify-center text-center">
                <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><Check className="size-6" /></span>
                <h3 className="text-base font-semibold">Verified record saved</h3>
                <p className="mt-2 max-w-md text-xs leading-5 text-slate-500">{stage === 'draft' ? 'The draft is now in the review queue and its proposed amount remains outside the official register.' : 'The executed agreement now appears in both the official contract register and its linked supplier record.'}</p>
                <Button className="mt-5" onClick={() => setDialogOpen(false)}>Return to workspace</Button>
              </div>
            ) : (
              <>
                <div className="rounded-xl border-2 border-dashed border-[#c9d8de] bg-[#f8fafb] p-5">
                  <input ref={fileInput} type="file" accept=".pdf,.txt,application/pdf,text/plain" className="sr-only" onChange={(event) => { setSelectedFile(event.target.files?.[0] ?? null); setAnalysisResult(null); setAnalysisStatus('idle'); setAnalysisError(''); }} />
                  <div className="flex flex-col items-center text-center sm:flex-row sm:text-left">
                    <span className="mb-3 flex size-10 items-center justify-center rounded-lg bg-[#e4f2f6] text-[#287693] sm:mb-0 sm:mr-4"><Upload className="size-5" /></span>
                    <div className="flex-1"><p className="text-sm font-medium text-[#203845]">{selectedFile ? selectedFile.name : 'Choose a contract document'}</p><p className="mt-1 text-[11px] text-slate-500">Text-based PDF or TXT · maximum 8 MB · demo files only</p></div>
                    <div className="mt-4 flex gap-2 sm:mt-0">
                      <Button variant="outline" className="bg-white" onClick={loadDemoDocument}>Use demo PDF</Button>
                      <Button variant="outline" className="bg-white" onClick={() => fileInput.current?.click()}>{selectedFile ? 'Replace file' : 'Browse files'}</Button>
                    </div>
                  </div>
                </div>

                {analysisStatus === 'analyzing' ? (
                  <div className="flex min-h-48 flex-col items-center justify-center rounded-xl border border-[#dce3e8] bg-white text-center"><LoaderCircle className="size-7 animate-spin text-[#287d9b]" /><p className="mt-3 text-sm font-medium">Extracting traceable contract fields…</p><p className="mt-1 text-xs text-slate-500">DeepSeek is treating the uploaded document as untrusted source data.</p></div>
                ) : null}

                {analysisError ? <Alert variant="destructive"><AlertCircle /><AlertTitle>Analysis needs attention</AlertTitle><AlertDescription>{analysisError}</AlertDescription></Alert> : null}

                {analysisResult && analysisStatus !== 'analyzing' ? <AnalysisReview result={analysisResult} stage={stage} /> : null}
              </>
            )}
          </div>

          {analysisStatus !== 'saved' ? (
            <div className="flex flex-col-reverse gap-2 border-t border-[#e1e7ea] bg-slate-50 px-6 py-4 sm:flex-row sm:justify-end">
              {analysisResult ? (
                <>
                  <Button variant="outline" onClick={() => { setAnalysisResult(null); setAnalysisStatus('idle'); }}>Start over</Button>
                  <Button onClick={saveVerifiedRecord} disabled={analysisStatus === 'saving'} className="bg-[#1d718f] hover:bg-[#185f78]">{analysisStatus === 'saving' ? <LoaderCircle className="animate-spin" /> : <Database />} {stage === 'draft' ? 'Save to review queue' : 'Add to official registers'}</Button>
                </>
              ) : (
                <Button onClick={analyzeDocument} disabled={!selectedFile || analysisStatus === 'analyzing'} className="bg-[#1d718f] hover:bg-[#185f78]"><Sparkles />Analyze with DeepSeek</Button>
              )}
            </div>
          ) : null}
          </dialog>
        </div>
      ) : null}
    </main>
  );
}

function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return (
    <section className="mb-7 flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
      <div><div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#397d96]"><Sparkles className="size-3.5" />{eyebrow}</div><h1 className="text-[28px] font-semibold tracking-[-0.03em] text-[#142534] md:text-[32px]">{title}</h1><p className="mt-1.5 max-w-2xl text-[13px] leading-6 text-slate-500">{description}</p></div>
      {action}
    </section>
  );
}

function DashboardView({ workspace, onOpen, onExport, exporting, onNavigate }: { workspace: Workspace | null; onOpen: (stage: IntakeStage) => void; onExport: () => void; exporting: boolean; onNavigate: (view: ViewName) => void }) {
  const metrics = [
    { label: 'Active contracts', value: String(workspace?.metrics.active_contracts ?? '—'), note: 'Executed contracts only', icon: FileText, tone: 'blue' },
    { label: 'Current contract value', value: workspace ? moneyFromCents(workspace.metrics.current_value_cents, true) : '—', note: 'No draft amounts included', icon: BookOpenCheck, tone: 'slate' },
    { label: 'Active suppliers', value: String(workspace?.metrics.active_suppliers ?? '—'), note: `${workspace?.metrics.pending_suppliers ?? 0} pending onboarding`, icon: Building2, tone: 'green' },
    { label: 'Records to verify', value: String(workspace?.metrics.records_to_verify ?? '—'), note: 'Human confirmation required', icon: AlertTriangle, tone: 'amber' },
  ];
  const iconColors: Record<string, string> = { blue: 'bg-sky-50 text-sky-700', slate: 'bg-slate-100 text-slate-700', green: 'bg-emerald-50 text-emerald-700', amber: 'bg-amber-50 text-amber-700' };
  return (
    <>
      <PageHeading eyebrow="AI-assisted register operations" title="Contract operations dashboard" description="Turn draft and executed agreements into verified contract and supplier records—without mixing proposed data into the official register." action={<Button variant="outline" size="lg" onClick={onExport} disabled={!workspace || exporting} className="h-10 border-[#cdd9df] bg-white px-4 text-[#244455] shadow-sm">{exporting ? <LoaderCircle className="animate-spin" /> : <Download />}Generate current registers</Button>} />
      <section className="mb-7 grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
        {metrics.map((metric) => { const Icon = metric.icon; return <div key={metric.label} className="rounded-xl border border-[#dce3e8] bg-white p-5 shadow-[0_1px_2px_rgb(15_23_42/3%)]"><div className="flex items-start justify-between gap-4"><div><p className="text-[12px] font-medium text-slate-500">{metric.label}</p><p className="mt-2 text-[28px] font-semibold tracking-[-0.04em] text-[#172a38]">{metric.value}</p></div><span className={`flex size-9 items-center justify-center rounded-lg ${iconColors[metric.tone]}`}><Icon className="size-[17px]" /></span></div><p className="mt-3 text-[11px] text-slate-500">{metric.note}</p></div>; })}
      </section>
      <section className="mb-7 grid gap-4 xl:grid-cols-2">
        <article className="relative overflow-hidden rounded-xl border border-[#b9d9e5] bg-[#edf8fb] p-5"><div className="absolute right-5 top-5 flex size-10 items-center justify-center rounded-lg bg-white/80 text-[#257a98]"><FileSearch className="size-5" /></div><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#43849a]">Pre-execution</p><h2 className="mt-2 text-lg font-semibold text-[#14364a]">Review a new contract</h2><p className="mt-1 max-w-[440px] text-[12px] leading-5 text-[#557280]">Extract proposed terms, compare the draft to the demo playbook, and create a pending supplier. Draft values stay outside the official register.</p><Button onClick={() => onOpen('draft')} className="mt-5 h-9 bg-[#1d718f] hover:bg-[#185f78]"><Upload />Upload draft<ArrowRight /></Button></article>
        <article className="relative overflow-hidden rounded-xl border border-[#cbd8dc] bg-white p-5"><div className="absolute right-5 top-5 flex size-10 items-center justify-center rounded-lg bg-[#eef3f5] text-[#274b5c]"><FileCheck2 className="size-5" /></div><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Post-execution</p><h2 className="mt-2 text-lg font-semibold text-[#1b2e3a]">Register an executed contract</h2><p className="mt-1 max-w-[440px] text-[12px] leading-5 text-slate-500">Verify the signed version, update both official registers, and activate renewal and key-date monitoring.</p><Button onClick={() => onOpen('executed')} variant="outline" className="mt-5 h-9 border-[#bfcdd3] bg-white text-[#244757]"><Upload />Upload executed copy<ArrowRight /></Button></article>
      </section>
      <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_360px]">
        <Panel className="overflow-hidden"><PanelHeader title="AI review queue" description="Human confirmation is required before official records change." action={<Button variant="ghost" size="sm" onClick={() => onNavigate('New Contract Review')} className="text-[#2e7188]">View all</Button>} /><IntakeTable intakes={workspace?.intakes.slice(0, 4) ?? []} /></Panel>
        <Panel><PanelHeader title="Priority alerts" description="Renewal, supplier, and data quality" action={<Clock3 className="size-4 text-slate-400" />} /><KeyDateList items={workspace?.keyDates.slice(0, 4) ?? []} /><div className="mx-5 mb-5 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2.5 text-[11px] text-emerald-800"><CircleCheck className="size-4" />Official records use verified values only</div></Panel>
      </div>
    </>
  );
}

function NewContractReviewView({ workspace, onOpen }: { workspace: Workspace | null; onOpen: () => void }) {
  return <><PageHeading eyebrow="Pre-execution workspace" title="New contract review" description="Drafts are reviewed against a fictional company playbook. Proposed values and dates remain separate from the official contract register." action={<Button onClick={onOpen} className="bg-[#1d718f] hover:bg-[#185f78]"><Upload />Upload draft</Button>} /><Alert className="mb-5 border-sky-200 bg-sky-50 text-sky-900"><ShieldCheck /><AlertTitle>Clear data boundary</AlertTitle><AlertDescription>A pending supplier may be created during draft intake, but the contract amount is not counted until an executed copy is verified.</AlertDescription></Alert><Panel className="overflow-hidden"><PanelHeader title="Draft review queue" description="Open findings and proposed records awaiting human action" /><IntakeTable intakes={(workspace?.intakes ?? []).filter((item) => item.status !== 'executed')} /></Panel></>;
}

function ExecutedIntakeView({ workspace, onOpen }: { workspace: Workspace | null; onOpen: () => void }) {
  const executed = (workspace?.intakes ?? []).filter((item) => item.status === 'executed');
  return <><PageHeading eyebrow="Post-execution intake" title="Executed contract registration" description="The signed version becomes the source of truth for official contract value, dates, supplier status, and renewal monitoring." action={<Button onClick={onOpen} className="bg-[#1d718f] hover:bg-[#185f78]"><Upload />Upload executed copy</Button>} /><div className="mb-5 grid gap-4 md:grid-cols-3"><WorkflowCard number="01" title="Extract" description="Read official values and dates from the signed copy." /><WorkflowCard number="02" title="Verify" description="Confirm confidence, source page, and supplier match." /><WorkflowCard number="03" title="Register" description="Update both registers and activate key dates." /></div><Panel className="overflow-hidden"><PanelHeader title="Executed intake queue" description="Signed documents ready for, or recently added to, the official register" />{executed.length ? <IntakeTable intakes={executed} /> : <EmptyState title="No executed intake items" description="Upload an executed copy to demonstrate the official registration workflow." />}</Panel></>;
}

function WorkflowCard({ number, title, description }: { number: string; title: string; description: string }) {
  return <div className="rounded-xl border border-[#dce3e8] bg-white p-5"><span className="text-[10px] font-semibold tracking-[0.14em] text-[#43849a]">STEP {number}</span><h3 className="mt-2 text-sm font-semibold">{title}</h3><p className="mt-1 text-xs leading-5 text-slate-500">{description}</p></div>;
}

function ContractRegisterView({ contracts, search, onSearch, onExport, exporting }: { contracts: Workspace['contracts']; search: string; onSearch: (value: string) => void; onExport: () => void; exporting: boolean }) {
  return <><PageHeading eyebrow="Official records only" title="Contract register" description="Executed, active, expired, terminated, and closed contracts. Drafts and proposed values never appear here." action={<Button variant="outline" onClick={onExport}>{exporting ? <LoaderCircle className="animate-spin" /> : <FileSpreadsheet />}Export workbook</Button>} /><Panel className="overflow-hidden"><PanelHeader title="Current contract register" description={`${contracts.length} verified record${contracts.length === 1 ? '' : 's'}`} action={<div className="relative w-full sm:w-72"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><Input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Filter register…" className="pl-9" /></div>} /><Table><TableHeader><TableRow className="bg-[#f7f9fa]"><TableHead className="px-5">Contract</TableHead><TableHead>Supplier</TableHead><TableHead>Current value</TableHead><TableHead>Expiration</TableHead><TableHead>Renewal</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>{contracts.map((item) => <TableRow key={String(item.id)}><TableCell className="px-5 py-3.5"><div className="font-medium text-[#1d3443]">{valueText(item.contract_number)}</div><div className="mt-1 text-[11px] text-slate-500">{valueText(item.title)} · {valueText(item.contract_type)}</div></TableCell><TableCell className="text-xs">{valueText(item.supplier_name)}</TableCell><TableCell className="text-xs font-medium">{moneyFromCents(item.current_value_cents)}</TableCell><TableCell className="text-xs">{valueText(item.expiration_date)}</TableCell><TableCell className="text-xs">{titleCase(item.renewal_type)}</TableCell><TableCell><StatusBadge tone={toneForStatus(item.status)}>{titleCase(item.status)}</StatusBadge></TableCell></TableRow>)}</TableBody></Table></Panel></>;
}

function SupplierRegisterView({ suppliers, search, onSearch }: { suppliers: Workspace['suppliers']; search: string; onSearch: (value: string) => void }) {
  return <><PageHeading eyebrow="Linked supplier master" title="Supplier register" description="Suppliers may enter as Pending during draft intake and become Active only when onboarding is complete or an executed contract is registered." /><Panel className="overflow-hidden"><PanelHeader title="Supplier master data" description={`${suppliers.length} supplier record${suppliers.length === 1 ? '' : 's'}`} action={<div className="relative w-full sm:w-72"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><Input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Filter suppliers…" className="pl-9" /></div>} /><Table><TableHeader><TableRow className="bg-[#f7f9fa]"><TableHead className="px-5">Supplier</TableHead><TableHead>Category</TableHead><TableHead>Contracts</TableHead><TableHead>Total current value</TableHead><TableHead>W-9</TableHead><TableHead>Insurance</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>{suppliers.map((item) => <TableRow key={String(item.id)}><TableCell className="px-5 py-3.5"><div className="font-medium text-[#1d3443]">{valueText(item.legal_name)}</div><div className="mt-1 text-[11px] text-slate-500">{valueText(item.primary_contact)} · {valueText(item.email)}</div></TableCell><TableCell className="text-xs">{valueText(item.category)}</TableCell><TableCell className="text-xs">{valueText(item.active_contract_count)}</TableCell><TableCell className="text-xs font-medium">{moneyFromCents(item.total_contract_value_cents)}</TableCell><TableCell><StatusBadge tone={toneForStatus(item.w9_status)}>{titleCase(item.w9_status)}</StatusBadge></TableCell><TableCell><div className="text-xs">{titleCase(item.insurance_status)}</div><div className="mt-1 text-[10px] text-slate-500">{valueText(item.insurance_expiration)}</div></TableCell><TableCell><StatusBadge tone={toneForStatus(item.status)}>{titleCase(item.status)}</StatusBadge></TableCell></TableRow>)}</TableBody></Table></Panel></>;
}

function AlertsExportsView({ workspace, onExport, exporting }: { workspace: Workspace | null; onExport: () => void; exporting: boolean }) {
  return <><PageHeading eyebrow="Operational follow-through" title="Alerts & exports" description="A lightweight post-execution view for renewal decisions, supplier document expiry, and data-quality exceptions—not a full CLM obligation engine." /><div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]"><Panel><PanelHeader title="Key dates and exceptions" description="Dates extracted from verified records and supplier documents" /><KeyDateList items={workspace?.keyDates ?? []} /></Panel><Panel><PanelHeader title="Current register package" description="Generated live from the database at download time" /><div className="p-5"><div className="rounded-xl bg-[#0f3044] p-5 text-white"><FileSpreadsheet className="size-7 text-[#65c5df]" /><h3 className="mt-4 text-sm font-semibold">ContractLedger Register Package</h3><p className="mt-2 text-xs leading-5 text-slate-300">One Excel workbook with Contract Register, Supplier Register, and Data Quality Exceptions.</p><Button onClick={onExport} disabled={!workspace || exporting} className="mt-5 w-full bg-white text-[#12384c] hover:bg-slate-100">{exporting ? <LoaderCircle className="animate-spin" /> : <Download />}Generate current registers</Button></div><div className="mt-4 space-y-2 text-xs text-slate-600"><div className="flex items-center gap-2"><Check className="size-3.5 text-emerald-600" />Executed values only</div><div className="flex items-center gap-2"><Check className="size-3.5 text-emerald-600" />Amendment values shown separately</div><div className="flex items-center gap-2"><Check className="size-3.5 text-emerald-600" />Timestamped workbook</div></div></div></Panel></div></>;
}

function IntakeTable({ intakes }: { intakes: Workspace['intakes'] }) {
  if (!intakes.length) return <EmptyState title="The queue is clear" description="Upload a draft to create a pending review item." />;
  return <Table><TableHeader><TableRow className="bg-[#f7f9fa]"><TableHead className="px-5">Intake</TableHead><TableHead>Proposed value</TableHead><TableHead>Stage</TableHead><TableHead>Findings</TableHead><TableHead className="pr-5 text-right">Received</TableHead></TableRow></TableHeader><TableBody>{intakes.map((item) => <TableRow key={String(item.id)}><TableCell className="px-5 py-3.5"><div className="font-medium text-[#1d3443]">{valueText(item.title)}</div><div className="mt-1 text-[11px] text-slate-500">{valueText(item.intake_number)} · {valueText(item.proposed_supplier_name)}</div></TableCell><TableCell className="text-xs font-medium">{moneyFromCents(item.proposed_value_cents)}</TableCell><TableCell><StatusBadge tone={toneForStatus(item.status)}>{titleCase(item.status)}</StatusBadge></TableCell><TableCell className="text-xs">{valueText(item.finding_count)}</TableCell><TableCell className="pr-5 text-right text-xs text-slate-500">{valueText(item.received_at)}</TableCell></TableRow>)}</TableBody></Table>;
}

function KeyDateList({ items }: { items: Workspace['keyDates'] }) {
  if (!items.length) return <EmptyState title="No current alerts" description="Verified renewal and supplier-document dates will appear here." />;
  return <div className="divide-y divide-[#e8edef] px-5">{items.map((item) => <div key={String(item.id)} className="flex items-start gap-3 py-4"><span className={`mt-1 size-2 shrink-0 rounded-full ${item.type === 'non_renewal_notice' ? 'bg-rose-500' : item.type === 'insurance_expiration' ? 'bg-amber-500' : 'bg-sky-500'}`} /><div className="min-w-0 flex-1"><p className="text-[12px] font-medium text-[#263c49]">{valueText(item.title)}</p><p className="mt-1 truncate text-[11px] text-slate-500">{valueText(item.contract_number ?? item.supplier_name)}</p></div><div className="text-right"><span className="text-[10px] font-medium text-slate-600">{valueText(item.due_date)}</span>{item.source_page ? <p className="mt-1 text-[9px] text-slate-400">Source p. {item.source_page}</p> : null}</div></div>)}</div>;
}

function AnalysisReview({ result, stage }: { result: AnalysisResponse; stage: IntakeStage }) {
  return <div className="space-y-5"><div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="text-sm font-semibold text-[#1b3442]">Extracted fields</h3><p className="mt-1 text-[11px] text-slate-500">Verify every field against its source before saving.</p></div><Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-800">{result.model}</Badge></div><div className="grid gap-3 md:grid-cols-2">{extractionFields.map(([key, label]) => { const field = result.analysis[key] as ExtractedField; return <div key={key} className="rounded-lg border border-[#dce3e8] bg-white p-3"><div className="flex items-center justify-between gap-3"><span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">{label}</span><FieldConfidence field={field} /></div><p className="mt-2 text-sm font-medium text-[#203845]">{key === 'contractValue' && typeof field.value === 'number' ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(field.value) : valueText(field.value)}</p><div className="mt-2 flex items-start gap-2 text-[10px] leading-4 text-slate-500"><BookOpenCheck className="mt-0.5 size-3 shrink-0" /><span>{field.sourcePage ? `Page ${field.sourcePage}` : 'No page'}{field.sourceQuote ? ` · “${field.sourceQuote}”` : ' · No supporting quote found'}</span></div></div>; })}</div>{result.analysis.findings.length ? <div><h3 className="text-sm font-semibold text-[#1b3442]">{stage === 'draft' ? 'Playbook differences' : 'Operational exceptions'}</h3><div className="mt-3 space-y-2">{result.analysis.findings.map((finding, index) => <div key={`${finding.rule}-${index}`} className="flex items-start gap-3 rounded-lg border border-[#dce3e8] p-3"><AlertTriangle className={`mt-0.5 size-4 shrink-0 ${finding.severity === 'high' ? 'text-rose-600' : 'text-amber-600'}`} /><div className="flex-1"><div className="flex items-center justify-between gap-3"><p className="text-xs font-medium">{finding.rule}</p><StatusBadge tone={finding.severity === 'high' ? 'rose' : 'amber'}>{titleCase(finding.severity)}</StatusBadge></div><p className="mt-1 text-[11px] text-slate-600">Observed: {finding.observed}</p><p className="mt-1 text-[11px] text-slate-500">Demo standard: {finding.standard}{finding.sourcePage ? ` · Page ${finding.sourcePage}` : ''}</p></div></div>)}</div></div> : null}{result.analysis.warnings.length ? <Alert><AlertCircle /><AlertTitle>Fields needing manual attention</AlertTitle><AlertDescription>{result.analysis.warnings.join(' ')}</AlertDescription></Alert> : null}</div>;
}
