'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
import type { Workspace } from '@/lib/contract-ledger-types';
import {
  AlertTriangle,
  Check,
  FileSearch,
  Search,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import { useState } from 'react';
import type { ElementType } from 'react';
import {
  alertTiming,
  moneyFromCents,
  titleCase,
  toneForStatus,
  valueText,
} from '@/components/workspace/formatters';
import {
  EmptyState,
  PageHeading,
  Panel,
  PanelHeader,
  StatusBadge,
} from '@/components/workspace/primitives';
import {
  FilterSelect,
  FloatingTableScrollbar,
  useFloatingTableScrollbar,
} from '@/components/workspace/table';

export function NewContractReviewView({
  workspace,
  onOpen,
  onSelectIntake,
}: {
  workspace: Workspace | null;
  onOpen: () => void;
  onSelectIntake: (id: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [riskFilter, setRiskFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [ownerFilter, setOwnerFilter] = useState('all');
  const reviewTableScroll = useFloatingTableScrollbar();
  const intakes = (workspace?.intakes ?? []).filter(
    (item) => item.status !== 'executed',
  );
  const options = (key: string) =>
    Array.from(
      new Set(
        intakes
          .map((item) => valueText(item[key]))
          .filter((value) => value !== 'Not found'),
      ),
    ).sort((a, b) => a.localeCompare(b));
  const visibleIntakes = intakes.filter((item) => {
    const text = [
      item.intake_number,
      item.title,
      item.proposed_supplier_name,
      item.contract_type,
      item.owner,
    ]
      .map(valueText)
      .join(' ')
      .toLowerCase();
    if (query && !text.includes(query.toLowerCase())) return false;
    if (statusFilter !== 'all' && item.status !== statusFilter) return false;
    if (riskFilter !== 'all' && item.risk_level !== riskFilter) return false;
    if (typeFilter !== 'all' && item.contract_type !== typeFilter) return false;
    if (ownerFilter !== 'all' && item.owner !== ownerFilter) return false;
    return true;
  });
  const openReviews = intakes.filter(
    (item) =>
      !['approved_for_signature', 'not_awarded'].includes(String(item.status)),
  ).length;
  const highRisk = intakes.filter((item) => item.risk_level === 'high').length;
  const approvalRequired = intakes.filter(
    (item) =>
      item.required_approval === 'CFO approval' &&
      item.approval_status !== 'approved',
  ).length;
  const approvedForSignature = intakes.filter(
    (item) => item.status === 'approved_for_signature',
  ).length;
  const reviewMetrics: Array<{
    label: string;
    value: number;
    note: string;
    icon: ElementType;
  }> = [
    {
      label: 'Open reviews',
      value: openReviews,
      note: 'Human action in progress',
      icon: FileSearch,
    },
    {
      label: 'High-risk reviews',
      value: highRisk,
      note: 'Open high-severity issues',
      icon: AlertTriangle,
    },
    {
      label: 'Approval required',
      value: approvalRequired,
      note: 'CFO approval not complete',
      icon: ShieldCheck,
    },
    {
      label: 'Approved for signature',
      value: approvedForSignature,
      note: 'Still outside official register',
      icon: Check,
    },
  ];

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
      <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {reviewMetrics.map((metric) => {
          const MetricIcon = metric.icon;
          return (
            <article
              key={metric.label}
              className="rounded-xl border border-[#dce3e8] bg-white p-4 shadow-[0_1px_2px_rgb(15_23_42/3%)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-medium text-slate-500">
                    {metric.label}
                  </p>
                  <p className="mt-1 text-2xl font-semibold text-[#193141]">
                    {metric.value}
                  </p>
                </div>
                <span className="flex size-8 items-center justify-center rounded-lg bg-[#edf7fa] text-[#26718b]">
                  <MetricIcon className="size-4" />
                </span>
              </div>
              <p className="mt-2 text-[10px] text-slate-500">{metric.note}</p>
            </article>
          );
        })}
      </section>
      <Alert className="mb-5 border-sky-200 bg-sky-50 text-sky-900">
        <ShieldCheck />
        <AlertTitle>Pre-execution boundary and supplier linkage</AlertTitle>
        <AlertDescription>
          Draft review records a proposed supplier name but does not create a
          Supplier Register record. Supplier master data is created only from
          supplier files or an executed contract, and proposed value never
          enters the official Contract Register.
        </AlertDescription>
      </Alert>
      <Panel className="overflow-hidden">
        <PanelHeader
          title="Contract review work queue"
          description={`${visibleIntakes.length} of ${intakes.length} pre-execution review${intakes.length === 1 ? '' : 's'} shown`}
        />
        <div className="border-b border-[#e3e9ed] bg-[#f8fafb] p-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <label
              htmlFor="contract-review-search"
              className="text-[11px] font-medium text-slate-600"
            >
              Search reviews
              <div className="relative mt-1">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="contract-review-search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Intake, contract, supplier…"
                  className="bg-white pl-9"
                />
              </div>
            </label>
            <FilterSelect
              label="Workflow status"
              value={statusFilter}
              onChange={setStatusFilter}
              options={options('status')}
              titleCaseOptions
            />
            <FilterSelect
              label="Risk level"
              value={riskFilter}
              onChange={setRiskFilter}
              options={options('risk_level')}
              titleCaseOptions
            />
            <FilterSelect
              label="Contract type"
              value={typeFilter}
              onChange={setTypeFilter}
              options={options('contract_type')}
            />
            <FilterSelect
              label="Review owner"
              value={ownerFilter}
              onChange={setOwnerFilter}
              options={options('owner')}
            />
          </div>
        </div>
        {visibleIntakes.length ? (
          <div>
            <Table
              className="min-w-[1500px]"
              containerRef={reviewTableScroll.tableScrollerRef}
              onContainerScroll={reviewTableScroll.syncTableToFloating}
            >
              <TableHeader>
                <TableRow className="bg-[#f7f9fa]">
                  <TableHead className="w-14 px-4 text-center">No.</TableHead>
                  <TableHead>Review intake</TableHead>
                  <TableHead>Supplier impact</TableHead>
                  <TableHead>Contract type</TableHead>
                  <TableHead>Proposed value</TableHead>
                  <TableHead>Risk / findings</TableHead>
                  <TableHead>Approval gate</TableHead>
                  <TableHead>Owner / target</TableHead>
                  <TableHead>Status / received</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleIntakes.map((item, index) => {
                  const timing = alertTiming(item.target_review_date);
                  return (
                    <TableRow key={String(item.id)}>
                      <TableCell className="px-4 text-center text-xs font-medium text-slate-500">
                        {index + 1}
                      </TableCell>
                      <TableCell className="py-3.5">
                        <button
                          type="button"
                          onClick={() => onSelectIntake(String(item.id))}
                          className="text-left"
                        >
                          <span className="font-medium text-[#1d718f] hover:underline">
                            {valueText(item.title)}
                          </span>
                          <span className="mt-1 block text-[10px] text-slate-500">
                            {valueText(item.intake_number)} · Open review
                            workspace
                          </span>
                        </button>
                      </TableCell>
                      <TableCell className="text-xs">
                        <div className="font-medium">
                          {valueText(item.proposed_supplier_name)}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          <StatusBadge
                            tone={toneForStatus(item.supplier_status)}
                          >
                            {titleCase(item.supplier_status)} supplier
                          </StatusBadge>
                          <span className="text-[10px] text-slate-500">
                            W-9 {titleCase(item.w9_status)} · Insurance{' '}
                            {titleCase(item.insurance_status)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">
                        {valueText(item.contract_type)}
                      </TableCell>
                      <TableCell className="text-xs font-medium">
                        {moneyFromCents(item.proposed_value_cents)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge
                          tone={
                            item.risk_level === 'high'
                              ? 'rose'
                              : item.risk_level === 'medium'
                                ? 'amber'
                                : 'green'
                          }
                        >
                          {titleCase(item.risk_level)} risk
                        </StatusBadge>
                        <div className="mt-1 text-[10px] text-slate-500">
                          {valueText(item.finding_count)} open finding(s)
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">
                        <div className="font-medium">
                          {valueText(item.required_approval)}
                        </div>
                        <div className="mt-1 text-[10px] text-slate-500">
                          {titleCase(item.approval_status)}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">
                        <div className="font-medium">
                          {valueText(item.owner)}
                        </div>
                        <div
                          className={`mt-1 text-[10px] ${timing?.tone === 'rose' ? 'text-rose-600' : 'text-slate-500'}`}
                        >
                          Target {valueText(item.target_review_date)}
                          {timing ? ` · ${timing.label}` : ''}
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge tone={toneForStatus(item.status)}>
                          {titleCase(item.status)}
                        </StatusBadge>
                        <div className="mt-1 text-[10px] text-slate-500">
                          Received {valueText(item.received_at)}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <FloatingTableScrollbar
              label="Contract review queue horizontal scrollbar"
              floating={reviewTableScroll.floating}
              floatingScrollerRef={reviewTableScroll.floatingScrollerRef}
              onScroll={reviewTableScroll.syncFloatingToTable}
            />
          </div>
        ) : (
          <EmptyState
            title="No reviews match the current filters"
            description="Clear one or more filters, or upload a new draft contract."
          />
        )}
      </Panel>
    </>
  );
}
