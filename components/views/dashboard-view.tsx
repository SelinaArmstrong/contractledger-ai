'use client';

import { Badge } from '@/components/ui/badge';
import { SUPPLIER_ALERTS_ID } from '@/components/workspace/view-routing';
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
  Wallet,
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
  onSelectIntake,
  onReset,
  resetting,
  canReset,
  canReview,
  canRegister,
  canImport,
}: {
  workspace: Workspace | null;
  onOpen: (stage: IntakeStage) => void;
  onNavigate: (view: ViewName, section?: typeof SUPPLIER_ALERTS_ID) => void;
  onSelectIntake: (id: string) => void;
  onReset: () => void;
  resetting: boolean;
  canReset: boolean;
  canReview: boolean;
  canRegister: boolean;
  canImport: boolean;
}) {
  const metrics = [
    {
      label: 'Current contract value',
      value: workspace
        ? moneyFromCents(workspace.metrics.current_value_cents, true)
        : '—',
      note: 'Executed portfolio · USD',
      icon: Wallet,
      featured: true,
    },
    {
      label: 'Active contracts',
      value: String(workspace?.metrics.active_contracts ?? '—'),
      note: workspace
        ? `${workspace.metrics.total_contracts} executed in register`
        : 'Executed agreements',
      icon: FileText,
    },
    {
      label: 'Active suppliers',
      value: String(workspace?.metrics.active_suppliers ?? '—'),
      note: workspace
        ? `${workspace.metrics.pending_suppliers} pending onboarding`
        : 'Supplier onboarding',
      icon: Building2,
    },
  ];
  const contractRecords = workspace?.contracts ?? [];
  const supplierRecords = workspace?.suppliers ?? [];
  const reviewRecords = workspace?.pendingReviews ?? [];
  const contractAlerts =
    workspace?.keyDates
      .filter((item) => item.status !== 'completed')
      .slice(0, 4) ?? [];
  const allSupplierAlerts = workspace?.supplierAlerts ?? [];
  const supplierAlerts = allSupplierAlerts.slice(0, 4);
  const supplierFollowUpCount =
    workspace?.metrics.supplier_documentation_follow_up ?? '—';
  const attentionItems: Array<{
    label: string;
    value: string;
    note: string;
    icon: typeof FileSearch;
    tone: string;
    view: ViewName;
    section?: typeof SUPPLIER_ALERTS_ID;
  }> = [
    {
      label: 'Records to verify',
      value: String(workspace?.metrics.records_to_verify ?? '—'),
      note: 'Human confirmation required',
      icon: FileSearch,
      tone: 'bg-accent text-accent-foreground',
      view: 'New Contract Review',
    },
    {
      label: 'Open approvals',
      value: String(workspace?.approvalMetrics.open_requests ?? '—'),
      note: workspace
        ? `${workspace.approvalMetrics.overdue_requests} overdue · ${workspace.approvalMetrics.blocked_intakes} blocked intake${workspace.approvalMetrics.blocked_intakes === 1 ? '' : 's'}`
        : 'Review requests and exceptions',
      icon: ShieldCheck,
      tone: 'bg-accent text-accent-foreground',
      view: 'Approvals & Exceptions',
    },
    {
      label: 'Open obligations',
      value: String(workspace?.obligationMetrics.open_obligations ?? '—'),
      note: workspace
        ? `${workspace.obligationMetrics.overdue_obligations} overdue`
        : 'Track dates and evidence',
      icon: AlertTriangle,
      tone: 'bg-amber-50 text-amber-700',
      view: 'Obligations & Evidence',
    },
    {
      label: 'Supplier documents',
      value: workspace ? String(allSupplierAlerts.length) : '—',
      note: workspace
        ? `Across ${new Set(allSupplierAlerts.map((alert) => alert.supplier_id)).size} suppliers`
        : 'Review qualifications',
      icon: Building2,
      tone: 'bg-rose-50 text-rose-700',
      view: 'Obligations & Evidence',
      section: SUPPLIER_ALERTS_ID,
    },
  ];
  const quickActions = [
    {
      title: canRegister ? 'Register a signed contract' : 'Browse contracts',
      description: canRegister
        ? 'Upload and verify an executed agreement'
        : 'Find agreements, amendments, and terms',
      icon: FileCheck2,
      action: canRegister
        ? () => onOpen('executed')
        : () => onNavigate('Contract Register'),
    },
    {
      title: 'Browse suppliers',
      description: 'Check qualifications and supplier files',
      icon: Users,
      action: () => onNavigate('Supplier Register'),
    },
    {
      title: canImport ? 'Import a register' : 'View approval rules',
      description: canImport
        ? 'Stage a CSV or Excel workbook for review'
        : 'Check approval thresholds and owners',
      icon: canImport ? Database : ShieldCheck,
      action: () =>
        onNavigate(
          canImport
            ? 'Bulk Import & Data Quality'
            : 'Playbook & Approval Rules',
        ),
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
        eyebrow="Portfolio overview"
        title="Contract operations"
        description="Review approvals, track obligations, and manage contract and supplier records."
        action={
          <div className="flex flex-wrap items-center gap-2">
            {canReset ? (
              <Button
                variant="outline"
                onClick={onReset}
                disabled={resetting}
                className="h-11 bg-card"
              >
                {resetting ? (
                  <LoaderCircle className="animate-spin" />
                ) : (
                  <RotateCcw />
                )}
                Reset demo
              </Button>
            ) : null}
            <Button
              size="lg"
              onClick={() =>
                canRegister
                  ? onOpen('draft')
                  : onNavigate('New Contract Review')
              }
              className="workspace-primary-action"
            >
              <FileSearch />
              {canRegister
                ? 'Review a draft'
                : canReview
                  ? 'Analyze a draft'
                  : 'View contract reviews'}
            </Button>
          </div>
        }
      />
      {aiBudget && showBudgetWarning ? (
        <div className="mb-4">
          <StatusBadge tone={aiBudget.remainingUnits ? 'amber' : 'rose'}>
            {aiBudget.remainingUnits
              ? `${aiBudget.remainingUnits} shared AI units left today`
              : 'Shared AI budget resets at 00:00 UTC'}
          </StatusBadge>
        </div>
      ) : null}
      <section
        aria-label="Portfolio metrics"
        className="dashboard-metrics mb-6"
      >
        {metrics.map(({ label, value, note, icon: Icon, featured }) => (
          <div
            key={label}
            data-featured={featured || undefined}
            className="dashboard-metric"
          >
            <div className="flex items-center gap-2.5">
              <span className="dashboard-metric-icon">
                <Icon aria-hidden="true" className="size-4" />
              </span>
              <p className="dashboard-metric-label">{label}</p>
            </div>
            <p className="dashboard-metric-value">{value}</p>
            <p className="dashboard-metric-note">{note}</p>
          </div>
        ))}
      </section>

      <div className="dashboard-worklists mb-6 grid gap-4">
        <Panel className="min-w-0 overflow-hidden">
          <PanelHeader title="Needs attention" />
          <ul className="divide-y divide-border">
            {attentionItems.map(
              ({ label, value, note, icon: Icon, tone, view, section }) => (
                <li key={label}>
                  <button
                    type="button"
                    onClick={() => onNavigate(view, section)}
                    className="dashboard-work-row group"
                    aria-label={`${label}: ${value}. ${note}`}
                  >
                    <span className={`dashboard-row-icon ${tone}`}>
                      <Icon aria-hidden="true" className="size-[17px]" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold">
                        {label}
                      </span>
                      <span className="mt-0.5 block text-xs leading-4 text-muted-foreground">
                        {note}
                      </span>
                    </span>
                    <span className="dashboard-row-count" aria-hidden="true">
                      {value}
                    </span>
                    <ArrowRight
                      aria-hidden="true"
                      className="dashboard-row-arrow"
                    />
                  </button>
                </li>
              ),
            )}
          </ul>
        </Panel>
        <Panel className="min-w-0 overflow-hidden">
          <PanelHeader title="Quick actions" />
          <ul className="divide-y divide-border">
            {quickActions.map(({ title, description, icon: Icon, action }) => (
              <li key={title}>
                <button
                  type="button"
                  onClick={action}
                  className="dashboard-work-row group"
                >
                  <span className="dashboard-row-icon bg-muted text-accent-foreground">
                    <Icon aria-hidden="true" className="size-[17px]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{title}</span>
                    <span className="mt-0.5 block text-xs leading-4 text-muted-foreground">
                      {description}
                    </span>
                  </span>
                  <ArrowRight
                    aria-hidden="true"
                    className="dashboard-row-arrow"
                  />
                </button>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <Panel className="mb-7 overflow-hidden">
        <PanelHeader
          title="AI review queue"
          description="Drafts awaiting confirmation or follow-up."
          action={
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onNavigate('New Contract Review')}
              className="text-accent-foreground"
            >
              View all reviews <ArrowRight />
            </Button>
          }
        />
        {workspace ? (
          <IntakeTable intakes={reviewRecords} onSelect={onSelectIntake} />
        ) : (
          <p className="p-5 text-sm text-muted-foreground">Loading reviews…</p>
        )}
      </Panel>

      <Panel className="mb-7 overflow-hidden">
        <PanelHeader title="Registers" />
        <div className="grid gap-4 bg-muted p-5 xl:grid-cols-2">
          <article className="flex min-h-[300px] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-[0_1px_2px_rgb(15_23_42/3%)]">
            <div className="flex items-start justify-between gap-4 border-b border-border bg-muted px-5 py-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-accent-foreground">
                  Executed agreements only
                </p>
                <h3 className="mt-1 text-base font-semibold text-foreground">
                  Contract Register
                </h3>
              </div>
              <span className="flex size-10 items-center justify-center rounded-lg bg-sky-50 text-sky-700">
                <FolderKanban className="size-5" />
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 border-b border-border px-5 py-4">
              <div>
                <p className="text-[11px] text-slate-500">Total records</p>
                <p className="mt-1 text-2xl font-semibold text-foreground">
                  {workspace?.metrics.total_contracts ?? '—'}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-slate-500">Current value</p>
                <p className="mt-1 text-2xl font-semibold text-foreground">
                  {workspace
                    ? moneyFromCents(
                        workspace.metrics.current_value_cents,
                        true,
                      )
                    : '—'}
                </p>
              </div>
            </div>
            <div className="flex-1 divide-y divide-border px-5">
              {contractRecords.slice(0, 3).map((item) => (
                <div
                  key={String(item.id)}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[11px] font-medium text-foreground">
                      {valueText(item.title)}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-slate-500">
                      {valueText(item.contract_number)} ·{' '}
                      {valueText(item.supplier_name)}
                    </p>
                  </div>
                  <span className="text-[11px] font-medium text-slate-600">
                    {moneyFromCents(item.current_value_cents)}
                  </span>
                </div>
              ))}
            </div>
            <div className="border-t border-border px-5 py-4">
              <Button
                onClick={() => onNavigate('Contract Register')}
                className="w-full justify-between bg-primary hover:bg-primary/90"
              >
                Open Contract Register <ArrowRight />
              </Button>
            </div>
          </article>

          <article className="flex min-h-[300px] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-[0_1px_2px_rgb(15_23_42/3%)]">
            <div className="flex items-start justify-between gap-4 border-b border-border bg-muted px-5 py-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-accent-foreground">
                  Supplier lifecycle master
                </p>
                <h3 className="mt-1 text-base font-semibold text-foreground">
                  Supplier Register
                </h3>
              </div>
              <span className="flex size-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                <Users className="size-5" />
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 border-b border-border px-5 py-4">
              <div>
                <p className="text-[11px] text-slate-500">Total suppliers</p>
                <p className="mt-1 text-2xl font-semibold text-foreground">
                  {workspace?.metrics.total_suppliers ?? '—'}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-slate-500">
                  Documentation follow-up
                </p>
                <p className="mt-1 text-2xl font-semibold text-foreground">
                  {supplierFollowUpCount}
                </p>
              </div>
            </div>
            <div className="flex-1 divide-y divide-border px-5">
              {supplierRecords.slice(0, 3).map((item) => (
                <div
                  key={String(item.id)}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[11px] font-medium text-foreground">
                      {valueText(item.legal_name)}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-slate-500">
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
            <div className="border-t border-border px-5 py-4">
              <Button
                onClick={() => onNavigate('Supplier Register')}
                className="w-full justify-between bg-primary hover:bg-primary/90"
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
          action={
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onNavigate('Obligations & Evidence')}
              className="text-accent-foreground"
            >
              Open alerts & obligations <ArrowRight />
            </Button>
          }
        />
        <div className="grid xl:grid-cols-2">
          <section className="border-b border-border xl:border-b-0 xl:border-r">
            <div className="flex items-center justify-between border-b border-border bg-muted px-5 py-3">
              <div>
                <p className="text-[11px] font-semibold text-foreground">
                  Contract alerts & obligations
                </p>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  Renewal, notice, and performance work
                </p>
              </div>
              <StatusBadge tone={contractAlerts.length ? 'amber' : 'green'}>
                {contractAlerts.length} shown
              </StatusBadge>
            </div>
            <KeyDateList items={contractAlerts} />
          </section>
          <section>
            <div className="flex items-center justify-between border-b border-border bg-muted px-5 py-3">
              <div>
                <p className="text-[11px] font-semibold text-foreground">
                  Supplier documentation
                </p>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  Missing and expiring supplier records
                </p>
              </div>
              <StatusBadge tone={supplierAlerts.length ? 'rose' : 'green'}>
                {supplierAlerts.length} shown
              </StatusBadge>
            </div>
            {supplierAlerts.length ? (
              <div className="divide-y divide-border px-5">
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
                    <span className="text-right text-[11px] font-medium text-slate-600">
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
      </Panel>

      <details className="group mb-7 overflow-hidden rounded-xl border border-border bg-card shadow-[0_1px_2px_rgb(15_23_42/3%)]">
        <summary className="flex cursor-pointer list-none flex-col justify-between gap-3 px-5 py-4 marker:hidden hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:flex-row sm:items-center [&::-webkit-details-marker]:hidden">
          <span>
            <span className="block text-sm font-semibold text-foreground">
              Draft-to-executed comparison
            </span>
          </span>
          <span className="flex items-center gap-2 text-xs font-medium text-accent-foreground">
            View comparison
            <ChevronDown className="size-4 transition group-open:rotate-180" />
          </span>
        </summary>
        <div className="border-t border-border [&>section]:!mb-0 [&>section]:rounded-none [&>section]:border-0 [&>section]:shadow-none">
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
      <Panel className="mb-7 overflow-hidden border-border">
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
        <div className="grid gap-3 bg-muted p-5 md:grid-cols-3">
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
              className="rounded-xl border border-border bg-card p-4"
            >
              <span className="flex size-7 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
                {number}
              </span>
              <p className="mt-3 text-xs font-semibold text-foreground">
                {title}
              </p>
              <p className="mt-1 text-[11px] leading-4 text-slate-500">
                {description}
              </p>
            </div>
          ))}
        </div>
      </Panel>
    );

  return (
    <Panel className="mb-7 overflow-hidden border-border">
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
            <TableRow className="bg-muted">
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
                <TableCell className="px-5 py-3 text-xs font-medium text-foreground">
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
              <TableCell className="px-5 py-3 text-xs font-medium text-foreground">
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
      <div className="flex flex-col gap-2 border-t border-border bg-muted px-5 py-3 text-[11px] text-slate-600 sm:flex-row sm:items-center sm:justify-between">
        <span className="flex items-center gap-2">
          <ShieldCheck className="size-3.5 text-accent-foreground" />
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

function IntakeTable({
  intakes,
  onSelect,
}: {
  intakes: Workspace['intakes'];
  onSelect: (id: string) => void;
}) {
  if (!intakes.length)
    return (
      <EmptyState
        title="The queue is clear"
        description="No drafts are awaiting verification."
      />
    );
  return (
    <Table>
      <TableHeader>
        <TableRow className="bg-muted">
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
              <button
                type="button"
                className="text-left font-medium text-accent-foreground hover:underline"
                onClick={() => onSelect(String(item.id))}
              >
                {valueText(item.title)}
              </button>
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
