'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { Workspace } from '@/lib/contract-ledger-types';
import {
  AlertTriangle,
  ArrowRight,
  BookOpenCheck,
  Building2,
  ChevronDown,
  CircleCheck,
  Database,
  FileCheck2,
  FileSearch,
  FileText,
  FolderKanban,
  LoaderCircle,
  RotateCcw,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { KeyDateList } from '@/components/workspace/alerts';
import {
  moneyFromCents,
  supplierDocumentLabel,
  titleCase,
  toneForStatus,
  usDateText,
  valueText,
} from '@/components/workspace/formatters';
import {
  EmptyState,
  PageHeading,
  Panel,
  PanelHeader,
  StatusBadge,
} from '@/components/workspace/primitives';
import type { IntakeStage, ViewName } from '@/components/workspace/types';

export function DashboardView({
  workspace,
  onOpen,
  onNavigate,
  onReset,
  resetting,
  canReset,
}: {
  workspace: Workspace | null;
  onOpen: (stage: IntakeStage) => void;
  onNavigate: (view: ViewName) => void;
  onReset: () => void;
  resetting: boolean;
  canReset: boolean;
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
  const contractRecords = workspace?.contracts ?? [];
  const supplierRecords = workspace?.suppliers ?? [];
  const reviewRecords = workspace?.intakes.slice(0, 4) ?? [];
  const contractAlerts =
    workspace?.keyDates
      .filter((item) => item.status !== 'completed')
      .slice(0, 4) ?? [];
  const allSupplierAlerts = workspace?.supplierAlerts ?? [];
  const supplierAlerts = allSupplierAlerts.slice(0, 4);
  const supplierFollowUpCount = supplierRecords.filter(
    (item) => item.qualification_status !== 'complete',
  ).length;
  const attentionItems: Array<{
    label: string;
    value: string;
    note: string;
    icon: typeof FileSearch;
    tone: string;
    view: ViewName;
  }> = [
    {
      label: 'Records to verify',
      value: String(workspace?.metrics.records_to_verify ?? '—'),
      note: 'Human confirmation required',
      icon: FileSearch,
      tone: 'bg-sky-50 text-sky-700',
      view: 'New Contract Review',
    },
    {
      label: 'Open approvals',
      value: String(workspace?.approvalMetrics.open_requests ?? '—'),
      note: `${workspace?.approvalMetrics.overdue_requests ?? 0} overdue · ${workspace?.approvalMetrics.blocked_intakes ?? 0} blocked`,
      icon: ShieldCheck,
      tone: 'bg-violet-50 text-violet-700',
      view: 'Approvals & Exceptions',
    },
    {
      label: 'Open obligations',
      value: String(workspace?.obligationMetrics.open_obligations ?? '—'),
      note: `${workspace?.obligationMetrics.overdue_obligations ?? 0} calculated overdue`,
      icon: AlertTriangle,
      tone: 'bg-amber-50 text-amber-700',
      view: 'Obligations & Evidence',
    },
    {
      label: 'Supplier documents',
      value: String(allSupplierAlerts.length),
      note: `${supplierFollowUpCount} suppliers need follow-up`,
      icon: Building2,
      tone: 'bg-rose-50 text-rose-700',
      view: 'Supplier Register',
    },
  ];
  const startWorkItems: Array<{
    eyebrow: string;
    title: string;
    description: string;
    icon: typeof FileSearch;
    action: () => void;
    featured?: boolean;
  }> = [
    {
      eyebrow: 'Pre-execution',
      title: 'Review a draft',
      description: 'Extract proposed terms without changing official records.',
      icon: FileSearch,
      action: () => onOpen('draft'),
      featured: true,
    },
    {
      eyebrow: 'Post-execution',
      title: 'Register a signed contract',
      description: 'Verify the source of truth and activate monitoring.',
      icon: FileCheck2,
      action: () => onOpen('executed'),
    },
    {
      eyebrow: 'Legacy data',
      title: 'Import a register',
      description: 'Stage, normalize, and resolve data-quality exceptions.',
      icon: Database,
      action: () => onNavigate('Bulk Import & Data Quality'),
    },
  ];
  const aiBudget = workspace?.aiBudget;
  const showBudgetWarning =
    aiBudget &&
    aiBudget.remainingUnits <=
      Math.max(15, Math.ceil(aiBudget.dailyUnitLimit * 0.2));
  return (
    <>
      <PageHeading
        eyebrow="AI-assisted register operations"
        title="Contract operations dashboard"
        description="Turn draft and executed agreements into verified contract and supplier records—without mixing proposed data into the official register."
        action={
          canReset || showBudgetWarning ? (
            <div className="flex flex-wrap items-center gap-2">
              {aiBudget && showBudgetWarning ? (
                <StatusBadge tone={aiBudget.remainingUnits ? 'amber' : 'rose'}>
                  {aiBudget.remainingUnits
                    ? `${aiBudget.remainingUnits} shared AI units left today`
                    : 'Shared AI budget resets at 00:00 UTC'}
                </StatusBadge>
              ) : null}
              {canReset ? (
                <Button
                  variant="outline"
                  onClick={onReset}
                  disabled={resetting}
                  className="h-9 border-[#cdd9df] bg-white px-3 text-slate-600 shadow-sm"
                >
                  {resetting ? (
                    <LoaderCircle className="animate-spin" />
                  ) : (
                    <RotateCcw />
                  )}
                  Reset demo
                </Button>
              ) : null}
            </div>
          ) : null
        }
      />
      <section className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <div
              key={metric.label}
              className="rounded-xl border border-[#dce3e8] bg-white p-4 shadow-[0_1px_2px_rgb(15_23_42/3%)] sm:p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[12px] font-medium text-slate-500">
                    {metric.label}
                  </p>
                  <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[#172a38] sm:text-[28px]">
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
      <Panel className="mb-5 overflow-hidden border-[#c9dbe2]">
        <PanelHeader
          title="Needs attention"
          description="Move directly from portfolio signals to the queue that needs a decision."
        />
        <div className="grid grid-cols-2 gap-px bg-[#dce5e9] xl:grid-cols-4">
          {attentionItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                type="button"
                onClick={() => onNavigate(item.view)}
                className="group min-h-32 bg-white p-4 text-left transition hover:bg-[#f7fbfc] focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#5b9cb3] sm:p-5"
                aria-label={`Open ${item.label}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <span
                    className={`flex size-9 items-center justify-center rounded-lg ${item.tone}`}
                  >
                    <Icon className="size-[17px]" />
                  </span>
                  <ArrowRight className="size-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-[#2e7188]" />
                </div>
                <p className="mt-4 text-2xl font-semibold tracking-tight text-[#183040]">
                  {item.value}
                </p>
                <p className="mt-1 text-sm font-semibold text-[#294454]">
                  {item.label}
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  {item.note}
                </p>
              </button>
            );
          })}
        </div>
      </Panel>

      <Panel className="mb-5 overflow-hidden">
        <PanelHeader
          title="Start work"
          description="Choose the source and keep drafts, executed records, and legacy data in the right workflow."
        />
        <div className="grid gap-3 bg-[#f8fafb] p-4 sm:grid-cols-3 sm:p-5">
          {startWorkItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.title}
                type="button"
                onClick={item.action}
                className={`group flex min-h-36 flex-col rounded-xl border p-4 text-left shadow-[0_1px_2px_rgb(15_23_42/3%)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5b9cb3] ${
                  item.featured
                    ? 'border-[#a9cfdd] bg-[#edf8fb] hover:border-[#79afc2]'
                    : 'border-[#d7e1e6] bg-white hover:border-[#a9c6d1] hover:bg-[#fbfdfe]'
                }`}
              >
                <div className="flex w-full items-start justify-between gap-3">
                  <span
                    className={`flex size-9 items-center justify-center rounded-lg ${item.featured ? 'bg-white text-[#257a98]' : 'bg-slate-100 text-slate-600'}`}
                  >
                    <Icon className="size-[17px]" />
                  </span>
                  <ArrowRight className="size-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-[#2e7188]" />
                </div>
                <p className="mt-4 text-xs font-semibold uppercase tracking-[0.1em] text-[#43849a]">
                  {item.eyebrow}
                </p>
                <h3 className="mt-1 text-sm font-semibold text-[#173344]">
                  {item.title}
                </h3>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  {item.description}
                </p>
              </button>
            );
          })}
        </div>
      </Panel>

      <Panel className="mb-7 overflow-hidden">
        <PanelHeader
          title="AI review queue"
          description="Draft analyses waiting for human confirmation, correction, or follow-up."
          action={
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onNavigate('New Contract Review')}
              className="text-[#2e7188]"
            >
              View all reviews <ArrowRight />
            </Button>
          }
        />
        <IntakeTable intakes={reviewRecords} />
      </Panel>

      <Panel className="mb-7 overflow-hidden">
        <div className="border-b border-[#e3e9ed] px-5 py-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#43849a]">
              Official records
            </p>
            <h2 className="mt-1 text-lg font-semibold text-[#1b2e3a]">
              Registers
            </h2>
            <p className="mt-1 text-[11px] text-slate-500">
              Executed contracts and lifecycle supplier records are maintained
              separately but linked by supplier.
            </p>
          </div>
        </div>
        <div className="grid gap-4 bg-[#f8fafb] p-5 xl:grid-cols-2">
          <article className="flex min-h-[300px] flex-col overflow-hidden rounded-xl border border-[#c8dbe2] bg-white shadow-[0_1px_2px_rgb(15_23_42/3%)]">
            <div className="flex items-start justify-between gap-4 border-b border-[#e3e9ed] bg-[#f7fbfc] px-5 py-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#43849a]">
                  Executed agreements only
                </p>
                <h3 className="mt-1 text-base font-semibold text-[#173344]">
                  Contract Register
                </h3>
              </div>
              <span className="flex size-10 items-center justify-center rounded-lg bg-sky-50 text-sky-700">
                <FolderKanban className="size-5" />
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 border-b border-[#edf1f3] px-5 py-4">
              <div>
                <p className="text-[10px] text-slate-500">Total records</p>
                <p className="mt-1 text-2xl font-semibold text-[#1b2e3a]">
                  {contractRecords.length}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500">Current value</p>
                <p className="mt-1 text-2xl font-semibold text-[#1b2e3a]">
                  {workspace
                    ? moneyFromCents(
                        workspace.metrics.current_value_cents,
                        true,
                      )
                    : '—'}
                </p>
              </div>
            </div>
            <div className="flex-1 divide-y divide-[#edf1f3] px-5">
              {contractRecords.slice(0, 3).map((item) => (
                <div
                  key={String(item.id)}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[11px] font-medium text-[#294454]">
                      {valueText(item.title)}
                    </p>
                    <p className="mt-0.5 truncate text-[9px] text-slate-500">
                      {valueText(item.contract_number)} ·{' '}
                      {valueText(item.supplier_name)}
                    </p>
                  </div>
                  <span className="text-[10px] font-medium text-slate-600">
                    {moneyFromCents(item.current_value_cents)}
                  </span>
                </div>
              ))}
            </div>
            <div className="border-t border-[#e3e9ed] px-5 py-4">
              <Button
                onClick={() => onNavigate('Contract Register')}
                className="w-full justify-between bg-[#1d718f] hover:bg-[#185f78]"
              >
                Open Contract Register <ArrowRight />
              </Button>
            </div>
          </article>

          <article className="flex min-h-[300px] flex-col overflow-hidden rounded-xl border border-[#c8dbe2] bg-white shadow-[0_1px_2px_rgb(15_23_42/3%)]">
            <div className="flex items-start justify-between gap-4 border-b border-[#e3e9ed] bg-[#f7fbfc] px-5 py-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#43849a]">
                  Supplier lifecycle master
                </p>
                <h3 className="mt-1 text-base font-semibold text-[#173344]">
                  Supplier Register
                </h3>
              </div>
              <span className="flex size-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                <Users className="size-5" />
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 border-b border-[#edf1f3] px-5 py-4">
              <div>
                <p className="text-[10px] text-slate-500">Total suppliers</p>
                <p className="mt-1 text-2xl font-semibold text-[#1b2e3a]">
                  {supplierRecords.length}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500">
                  Documentation follow-up
                </p>
                <p className="mt-1 text-2xl font-semibold text-[#1b2e3a]">
                  {supplierFollowUpCount}
                </p>
              </div>
            </div>
            <div className="flex-1 divide-y divide-[#edf1f3] px-5">
              {supplierRecords.slice(0, 3).map((item) => (
                <div
                  key={String(item.id)}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[11px] font-medium text-[#294454]">
                      {valueText(item.legal_name)}
                    </p>
                    <p className="mt-0.5 truncate text-[9px] text-slate-500">
                      {valueText(item.vendor_number)} ·{' '}
                      {valueText(item.category)}
                    </p>
                  </div>
                  <StatusBadge tone={toneForStatus(item.qualification_status)}>
                    {titleCase(item.qualification_status)}
                  </StatusBadge>
                </div>
              ))}
            </div>
            <div className="border-t border-[#e3e9ed] px-5 py-4">
              <Button
                onClick={() => onNavigate('Supplier Register')}
                className="w-full justify-between bg-[#1d718f] hover:bg-[#185f78]"
              >
                Open Supplier Register <ArrowRight />
              </Button>
            </div>
          </article>
        </div>
      </Panel>

      <Panel className="mb-7 overflow-hidden">
        <PanelHeader
          title="Priority alerts"
          description="Contract obligations and supplier-document exceptions are separated for faster follow-up."
          action={
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onNavigate('Obligations & Evidence')}
              className="text-[#2e7188]"
            >
              Open alerts <ArrowRight />
            </Button>
          }
        />
        <div className="grid xl:grid-cols-2">
          <section className="border-b border-[#e3e9ed] xl:border-b-0 xl:border-r">
            <div className="flex items-center justify-between border-b border-[#edf1f3] bg-[#f8fafb] px-5 py-3">
              <div>
                <p className="text-[11px] font-semibold text-[#294454]">
                  Contract obligations
                </p>
                <p className="mt-0.5 text-[9px] text-slate-500">
                  Renewal, notice, and performance dates
                </p>
              </div>
              <StatusBadge tone={contractAlerts.length ? 'amber' : 'green'}>
                {contractAlerts.length} shown
              </StatusBadge>
            </div>
            <KeyDateList items={contractAlerts} />
          </section>
          <section>
            <div className="flex items-center justify-between border-b border-[#edf1f3] bg-[#f8fafb] px-5 py-3">
              <div>
                <p className="text-[11px] font-semibold text-[#294454]">
                  Supplier documentation
                </p>
                <p className="mt-0.5 text-[9px] text-slate-500">
                  Missing and expiring supplier records
                </p>
              </div>
              <StatusBadge tone={supplierAlerts.length ? 'rose' : 'green'}>
                {supplierAlerts.length} shown
              </StatusBadge>
            </div>
            {supplierAlerts.length ? (
              <div className="divide-y divide-[#e8edef] px-5">
                {supplierAlerts.map((item) => (
                  <div
                    key={String(item.alert_id)}
                    className="flex items-start gap-3 py-4"
                  >
                    <span className="mt-1 size-2 shrink-0 rounded-full bg-rose-500" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12px] font-medium text-[#263c49]">
                        {valueText(item.supplier_name)}
                      </p>
                      <p className="mt-1 truncate text-[11px] text-slate-500">
                        {supplierDocumentLabel(item.item_type)} ·{' '}
                        {valueText(item.title)}
                      </p>
                    </div>
                    <span className="text-right text-[10px] font-medium text-slate-600">
                      {item.due_date ? usDateText(item.due_date) : 'Follow up'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                title="No supplier-document alerts"
                description="Missing and expiring supplier records will appear here."
              />
            )}
          </section>
        </div>
        <div className="flex items-center gap-2 border-t border-[#e3e9ed] bg-emerald-50 px-5 py-3 text-[11px] text-emerald-800">
          <CircleCheck className="size-4" />
          Official records and alerts use verified values only.
        </div>
      </Panel>

      <details className="group mb-7 overflow-hidden rounded-xl border border-[#dce3e8] bg-white shadow-[0_1px_2px_rgb(15_23_42/3%)]">
        <summary className="flex cursor-pointer list-none flex-col justify-between gap-3 px-5 py-4 marker:hidden hover:bg-[#fbfdfe] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#5b9cb3] sm:flex-row sm:items-center [&::-webkit-details-marker]:hidden">
          <span>
            <span className="block text-sm font-semibold text-[#1b2e3a]">
              Draft-to-executed comparison
            </span>
            <span className="mt-1 block text-xs leading-5 text-slate-500">
              Expand the human-verified comparison when presenting the demo
              evidence.
            </span>
          </span>
          <span className="flex items-center gap-2 text-xs font-medium text-[#2e7188]">
            View comparison
            <ChevronDown className="size-4 transition group-open:rotate-180" />
          </span>
        </summary>
        <div className="border-t border-[#e3e9ed] [&>section]:!mb-0 [&>section]:rounded-none [&>section]:border-0 [&>section]:shadow-none">
          <DemoTransactionComparison
            comparison={workspace?.transactionComparisons[0]}
          />
        </div>
      </details>
    </>
  );
}

export function DemoTransactionComparison({
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

export function IntakeTable({ intakes }: { intakes: Workspace['intakes'] }) {
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
