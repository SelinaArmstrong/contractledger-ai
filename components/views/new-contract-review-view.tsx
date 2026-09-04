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
  RotateCcw,
  Search,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import { useMemo, useState } from 'react';
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

const workflowOptions = [
  { value: 'needs_action', label: 'Needs action' },
  { value: 'draft', label: 'New / draft' },
  { value: 'under_review', label: 'Under review' },
  { value: 'waiting_on_business', label: 'Waiting on business' },
  { value: 'waiting_on_legal', label: 'Waiting on legal' },
  { value: 'revision_requested', label: 'Revision requested' },
  { value: 'approved_for_signature', label: 'Approved for signature' },
  { value: 'not_awarded', label: 'Not awarded' },
];

const riskOptions = [
  { value: 'elevated', label: 'Elevated (high + medium)' },
  { value: 'high', label: 'High risk' },
  { value: 'medium', label: 'Medium risk' },
  { value: 'low', label: 'Low risk' },
  { value: 'unassessed', label: 'Not yet assessed' },
];

const contractTypeOptions = [
  { value: 'professional_services', label: 'Professional services' },
  { value: 'master_services', label: 'Master services agreement' },
  { value: 'supply', label: 'Supply / procurement' },
  { value: 'software', label: 'Software / SaaS' },
  { value: 'statement_of_work', label: 'Statement of work' },
  { value: 'amendment', label: 'Amendment / addendum' },
  { value: 'confidentiality', label: 'NDA / confidentiality' },
  { value: 'lease', label: 'Lease / real estate' },
  { value: 'other', label: 'Other contract type' },
];

const approvalOptions = [
  { value: 'action_required', label: 'Action required' },
  { value: 'pending', label: 'Pending approval' },
  { value: 'approved', label: 'Approved' },
  { value: 'declined', label: 'Declined' },
  { value: 'not_required', label: 'Not required' },
];

const targetDateOptions = [
  { value: 'overdue', label: 'Overdue' },
  { value: 'next_7_days', label: 'Due in next 7 days' },
  { value: 'next_30_days', label: 'Due in next 30 days' },
  { value: 'no_target', label: 'No target date' },
];

const sortOptions = [
  { value: 'urgent', label: 'Most urgent' },
  { value: 'newest', label: 'Newest received' },
  { value: 'value', label: 'Highest value' },
  { value: 'supplier', label: 'Supplier A–Z' },
  { value: 'owner', label: 'Owner A–Z' },
];

function contractTypeGroup(value: unknown) {
  const type = valueText(value).toLowerCase();
  if (type.includes('professional')) return 'professional_services';
  if (type.includes('master service') || type === 'msa')
    return 'master_services';
  if (type.includes('software') || type.includes('saas')) return 'software';
  if (type.includes('statement of work') || type === 'sow')
    return 'statement_of_work';
  if (type.includes('amend') || type.includes('addendum')) return 'amendment';
  if (
    type.includes('nda') ||
    type.includes('confidential') ||
    type.includes('non-disclosure')
  )
    return 'confidentiality';
  if (type.includes('lease') || type.includes('real estate')) return 'lease';
  if (
    type.includes('supply') ||
    type.includes('purchase') ||
    type.includes('procurement') ||
    type.includes('vendor')
  )
    return 'supply';
  return 'other';
}

function daysUntil(value: unknown) {
  if (!value) return null;
  const date = new Date(valueText(value));
  if (Number.isNaN(date.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return Math.ceil((date.getTime() - today.getTime()) / 86_400_000);
}

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
  const [approvalFilter, setApprovalFilter] = useState('all');
  const [targetDateFilter, setTargetDateFilter] = useState('all');
  const [sortBy, setSortBy] = useState('urgent');
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);
  const reviewTableScroll = useFloatingTableScrollbar();
  const intakes = (workspace?.intakes ?? []).filter(
    (item) => item.status !== 'executed',
  );
  const ownerOptions = useMemo(
    () => [
      { value: 'unassigned', label: 'Unassigned' },
      ...Array.from(
        new Set(
          intakes
            .map((item) => String(item.owner ?? '').trim())
            .filter(Boolean),
        ),
      )
        .sort((a, b) => a.localeCompare(b))
        .map((owner) => ({ value: owner, label: owner })),
    ],
    [intakes],
  );
  const visibleIntakes = useMemo(() => {
    const riskRank: Record<string, number> = { high: 0, medium: 1, low: 2 };
    const statusRank: Record<string, number> = {
      revision_requested: 0,
      waiting_on_legal: 1,
      waiting_on_business: 2,
      under_review: 3,
      draft: 4,
      approved_for_signature: 5,
      not_awarded: 6,
    };
    return intakes
      .filter((item) => {
        const text = [
          item.intake_number,
          item.title,
          item.proposed_supplier_name,
          item.contract_type,
          item.owner,
          item.required_approval,
        ]
          .map(valueText)
          .join(' ')
          .toLowerCase();
        if (query && !text.includes(query.trim().toLowerCase())) return false;
        if (
          statusFilter === 'needs_action' &&
          ['approved_for_signature', 'not_awarded'].includes(
            String(item.status),
          )
        )
          return false;
        if (
          !['all', 'needs_action'].includes(statusFilter) &&
          item.status !== statusFilter
        )
          return false;
        if (
          riskFilter === 'elevated' &&
          !['high', 'medium'].includes(String(item.risk_level))
        )
          return false;
        if (riskFilter === 'unassessed' && item.risk_level) return false;
        if (
          !['all', 'elevated', 'unassessed'].includes(riskFilter) &&
          item.risk_level !== riskFilter
        )
          return false;
        if (
          typeFilter !== 'all' &&
          contractTypeGroup(item.contract_type) !== typeFilter
        )
          return false;
        if (ownerFilter === 'unassigned' && item.owner) return false;
        if (
          !['all', 'unassigned'].includes(ownerFilter) &&
          item.owner !== ownerFilter
        )
          return false;
        if (
          approvalFilter === 'action_required' &&
          !['pending', 'declined'].includes(String(item.approval_status))
        )
          return false;
        if (
          !['all', 'action_required'].includes(approvalFilter) &&
          item.approval_status !== approvalFilter
        )
          return false;
        const dueInDays = daysUntil(item.target_review_date);
        if (
          targetDateFilter === 'overdue' &&
          !(dueInDays !== null && dueInDays < 0)
        )
          return false;
        if (
          targetDateFilter === 'next_7_days' &&
          !(dueInDays !== null && dueInDays >= 0 && dueInDays <= 7)
        )
          return false;
        if (
          targetDateFilter === 'next_30_days' &&
          !(dueInDays !== null && dueInDays >= 0 && dueInDays <= 30)
        )
          return false;
        if (targetDateFilter === 'no_target' && dueInDays !== null)
          return false;
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'newest')
          return String(b.received_at).localeCompare(String(a.received_at));
        if (sortBy === 'value')
          return (
            Number(b.proposed_value_cents ?? 0) -
            Number(a.proposed_value_cents ?? 0)
          );
        if (sortBy === 'supplier')
          return valueText(a.proposed_supplier_name).localeCompare(
            valueText(b.proposed_supplier_name),
          );
        if (sortBy === 'owner')
          return valueText(a.owner).localeCompare(valueText(b.owner));
        const dueA = daysUntil(a.target_review_date) ?? Number.MAX_SAFE_INTEGER;
        const dueB = daysUntil(b.target_review_date) ?? Number.MAX_SAFE_INTEGER;
        if (dueA !== dueB) return dueA - dueB;
        const riskDifference =
          (riskRank[String(a.risk_level)] ?? 3) -
          (riskRank[String(b.risk_level)] ?? 3);
        if (riskDifference) return riskDifference;
        return (
          (statusRank[String(a.status)] ?? 7) -
          (statusRank[String(b.status)] ?? 7)
        );
      });
  }, [
    approvalFilter,
    intakes,
    ownerFilter,
    query,
    riskFilter,
    sortBy,
    statusFilter,
    targetDateFilter,
    typeFilter,
  ]);
  const activeFilterCount = [
    query,
    statusFilter,
    riskFilter,
    typeFilter,
    ownerFilter,
    approvalFilter,
    targetDateFilter,
  ].filter((value) => value && value !== 'all').length;
  const pageCount = Math.max(1, Math.ceil(visibleIntakes.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageStart = (safePage - 1) * pageSize;
  const pageIntakes = visibleIntakes.slice(pageStart, pageStart + pageSize);

  const clearFilters = () => {
    setQuery('');
    setStatusFilter('all');
    setRiskFilter('all');
    setTypeFilter('all');
    setOwnerFilter('all');
    setApprovalFilter('all');
    setTargetDateFilter('all');
    setPage(1);
  };
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
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">
            <label
              htmlFor="contract-review-search"
              className="text-[11px] font-medium text-slate-600 xl:col-span-2 2xl:col-span-1"
            >
              Search reviews
              <div className="relative mt-1">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="contract-review-search"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setPage(1);
                  }}
                  placeholder="Intake, contract, supplier…"
                  className="bg-white pl-9"
                />
              </div>
            </label>
            <FilterSelect
              label="Workflow status"
              value={statusFilter}
              onChange={(value) => {
                setStatusFilter(value);
                setPage(1);
              }}
              options={workflowOptions}
              allLabel="All workflow statuses"
            />
            <FilterSelect
              label="Risk level"
              value={riskFilter}
              onChange={(value) => {
                setRiskFilter(value);
                setPage(1);
              }}
              options={riskOptions}
              allLabel="All risk levels"
            />
            <FilterSelect
              label="Contract type"
              value={typeFilter}
              onChange={(value) => {
                setTypeFilter(value);
                setPage(1);
              }}
              options={contractTypeOptions}
              allLabel="All contract types"
            />
            <FilterSelect
              label="Review owner"
              value={ownerFilter}
              onChange={(value) => {
                setOwnerFilter(value);
                setPage(1);
              }}
              options={ownerOptions}
              allLabel="All owners"
            />
            <FilterSelect
              label="Approval status"
              value={approvalFilter}
              onChange={(value) => {
                setApprovalFilter(value);
                setPage(1);
              }}
              options={approvalOptions}
              allLabel="All approval statuses"
            />
            <FilterSelect
              label="Target date"
              value={targetDateFilter}
              onChange={(value) => {
                setTargetDateFilter(value);
                setPage(1);
              }}
              options={targetDateOptions}
              allLabel="Any target date"
            />
            <FilterSelect
              label="Sort queue by"
              value={sortBy}
              onChange={(value) => {
                setSortBy(value);
                setPage(1);
              }}
              options={sortOptions}
              includeAll={false}
            />
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-[#e3e9ed] pt-3">
            <p className="text-[10px] text-slate-500">
              Showing {visibleIntakes.length.toLocaleString()} matching review
              {visibleIntakes.length === 1 ? '' : 's'}
              {activeFilterCount
                ? ` · ${activeFilterCount} active filter${activeFilterCount === 1 ? '' : 's'}`
                : ''}
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              disabled={!activeFilterCount}
              className="h-8 text-[11px]"
            >
              <RotateCcw /> Clear filters
            </Button>
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
                {pageIntakes.map((item, index) => {
                  const timing = alertTiming(item.target_review_date);
                  return (
                    <TableRow key={String(item.id)}>
                      <TableCell className="px-4 text-center text-xs font-medium text-slate-500">
                        {pageStart + index + 1}
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
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e3e9ed] bg-[#f8fafb] px-4 py-3 text-[11px] text-slate-500">
              <div className="flex items-center gap-2">
                <span>Rows per page</span>
                <select
                  value={pageSize}
                  onChange={(event) => {
                    setPageSize(Number(event.target.value));
                    setPage(1);
                  }}
                  aria-label="Rows per page"
                  className="h-8 rounded-md border border-input bg-white px-2 text-xs text-slate-700"
                >
                  {[25, 50, 100].map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </div>
              <span>
                {pageStart + 1}–
                {Math.min(pageStart + pageSize, visibleIntakes.length)} of{' '}
                {visibleIntakes.length.toLocaleString()}
              </span>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={safePage === 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  className="h-8"
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={safePage === pageCount}
                  onClick={() =>
                    setPage((current) => Math.min(pageCount, current + 1))
                  }
                  className="h-8"
                >
                  Next
                </Button>
              </div>
            </div>
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
