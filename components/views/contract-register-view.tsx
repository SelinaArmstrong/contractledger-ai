'use client';

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
  ChevronDown,
  FileSpreadsheet,
  LoaderCircle,
  RotateCcw,
  Search,
  Sparkles,
  Upload,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { ManagementInsightsSheet } from '@/components/dialogs/management-insights-sheet';
import {
  moneyFromCents,
  titleCase,
  toneForStatus,
  valueText,
} from '@/components/workspace/formatters';
import {
  PageHeading,
  Panel,
  PanelHeader,
  StatusBadge,
} from '@/components/workspace/primitives';
import {
  DateFilter,
  FilterSelect,
  FloatingTableScrollbar,
  TablePagination,
  useFloatingTableScrollbar,
} from '@/components/workspace/table';
import type { RegisterTruncation } from '@/lib/workspace-limits';

/**
 * `current_value_cents` already includes amendments, and the Original value and
 * Amendment value columns sit far to the right. This note keeps the difference
 * visible next to the headline number.
 */
function amendmentDelta(value: unknown) {
  const cents = Number(value ?? 0);
  if (!Number.isFinite(cents) || cents === 0) return '';
  return `${cents > 0 ? '+' : '\u2212'}${moneyFromCents(Math.abs(cents))} from amendments`;
}

export function ContractRegisterView({
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
  openInsightsRequest,
  onInsightsRequestHandled,
  truncation,
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
  openInsightsRequest: boolean;
  onInsightsRequestHandled: () => void;
  truncation: RegisterTruncation;
}) {
  const contractTableScroll = useFloatingTableScrollbar();
  const [insightsOpen, setInsightsOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
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
  useEffect(() => {
    if (!openInsightsRequest) return;
    const timer = window.setTimeout(() => {
      setInsightsOpen(true);
      onInsightsRequestHandled();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [onInsightsRequestHandled, openInsightsRequest]);
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
  const pageCount = Math.max(1, Math.ceil(visibleContracts.length / pageSize));
  const activePage = Math.min(currentPage, pageCount);
  const pageStart = (activePage - 1) * pageSize;
  const paginatedContracts = visibleContracts.slice(
    pageStart,
    pageStart + pageSize,
  );
  useEffect(() => {
    const timer = window.setTimeout(() => setCurrentPage(1), 0);
    return () => window.clearTimeout(timer);
  }, [
    amountComparison,
    amountValue,
    departmentFilter,
    effectiveCondition,
    effectiveDate,
    expirationCondition,
    expirationDate,
    search,
    statusFilter,
    supplierFilter,
    typeFilter,
  ]);
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
    setCurrentPage(1);
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
              className="bg-primary hover:bg-primary/90"
            >
              <Upload />
              Register executed contract
            </Button>
            <Button variant="outline" onClick={onExport} className="bg-card">
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
              className="border-input bg-accent text-accent-foreground hover:bg-accent"
            >
              <Sparkles />
              AI management insights
            </Button>
          </div>
        }
      />
      <div className="mb-5 rounded-xl border border-border bg-card px-5 py-4 shadow-[0_1px_2px_rgb(15_23_42/3%)]">
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
              <div className="text-[11px] font-semibold tracking-[0.14em] text-accent-foreground">
                STEP {number}
              </div>
              <div className="mt-1 text-xs font-semibold text-foreground">
                {title}
              </div>
              <div className="mt-0.5 text-[11px] leading-4 text-slate-500">
                {description}
              </div>
            </div>
          ))}
        </div>
      </div>
      <Panel className="overflow-hidden">
        <PanelHeader
          title="Current contract register"
          description={`${visibleContracts.length} of ${contracts.length} verified records match the current view`}
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
        <div className="border-b border-border bg-muted p-4">
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
              Current value
              <div className="mt-1 flex">
                <select
                  value={amountComparison}
                  onChange={(event) => setAmountComparison(event.target.value)}
                  className="h-9 rounded-l-md border border-r-0 border-input bg-card px-2 text-xs"
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
                  aria-label="Current value in US dollars"
                  className="h-9 rounded-l-none bg-card text-xs"
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
                className="h-9 w-full bg-card"
              >
                <RotateCcw />
                Clear filters
              </Button>
            </div>
          </div>
          <p className="mt-3 text-[11px] text-slate-500">
            Amounts use current contract value in USD. Date filters are
            inclusive and use U.S. English order; for example, “on or before
            08/30/2026” includes August 30, 2026.
          </p>
        </div>
        <div>
          <Table
            className="min-w-[2160px]"
            containerRef={contractTableScroll.tableScrollerRef}
            onContainerScroll={contractTableScroll.syncTableToFloating}
          >
            <TableHeader>
              <TableRow className="bg-muted">
                <TableHead className="w-14 px-4 text-center">No.</TableHead>
                <TableHead>Contract</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Current value</TableHead>
                <TableHead>Contract type</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Original value</TableHead>
                <TableHead>Amendment value</TableHead>
                <TableHead>Effective date</TableHead>
                <TableHead>Expiration date</TableHead>
                <TableHead>Renewal terms</TableHead>
                <TableHead>Notice deadline</TableHead>
                <TableHead>Next obligation</TableHead>
                <TableHead>Payment terms</TableHead>
                <TableHead>Governing law</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedContracts.map((item, index) => (
                <TableRow key={String(item.id)}>
                  <TableCell className="px-4 py-3.5 text-center text-xs font-medium text-slate-500">
                    {pageStart + index + 1}
                  </TableCell>
                  <TableCell className="py-3.5">
                    <button
                      type="button"
                      onClick={() => onSelect(String(item.id))}
                      className="text-left"
                    >
                      <span className="font-medium text-accent-foreground hover:underline">
                        {valueText(item.title)}
                      </span>
                      <span className="mt-1 block text-[11px] text-slate-500">
                        {valueText(item.contract_number)} · V
                        {valueText(item.current_version ?? 1)} ·{' '}
                        {valueText(item.amendment_count ?? 0)} amendment
                        {Number(item.amendment_count ?? 0) === 1
                          ? ''
                          : 's'} ·
                        View lifecycle
                      </span>
                    </button>
                  </TableCell>
                  <TableCell className="text-xs">
                    {valueText(item.supplier_name)}
                  </TableCell>
                  <TableCell className="text-xs font-medium">
                    {moneyFromCents(item.current_value_cents)}
                    {amendmentDelta(item.amendment_value_cents) ? (
                      <div className="mt-1 font-normal text-[11px] text-slate-500">
                        {amendmentDelta(item.amendment_value_cents)}
                      </div>
                    ) : null}
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
                    {titleCase(item.renewal_type)}
                    {item.notice_days === null || item.notice_days === undefined
                      ? ''
                      : ` · ${valueText(item.notice_days)} days`}
                  </TableCell>
                  <TableCell className="text-xs">
                    {valueText(item.notice_deadline)}
                  </TableCell>
                  <TableCell className="text-xs">
                    <div>{valueText(item.next_obligation_date)}</div>
                    <div className="mt-1 text-[11px] text-slate-500">
                      {valueText(item.open_obligation_count)} open
                    </div>
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
              {!paginatedContracts.length ? (
                <TableRow>
                  <TableCell
                    colSpan={18}
                    className="h-36 text-center text-xs text-slate-500"
                  >
                    No contracts match the current search and filters.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
          {truncation.truncated ? (
            <p className="border-t border-border px-5 py-3 text-xs text-amber-700">
              {truncation.message}
            </p>
          ) : null}
          <TablePagination
            label="Contract register pagination"
            page={activePage}
            pageSize={pageSize}
            total={visibleContracts.length}
            onPageChange={setCurrentPage}
            onPageSizeChange={(nextPageSize) => {
              setPageSize(nextPageSize);
              setCurrentPage(1);
            }}
            floating={contractTableScroll.floating}
          />
          <FloatingTableScrollbar
            label="Contract register horizontal scrollbar"
            floating={contractTableScroll.floating}
            floatingScrollerRef={contractTableScroll.floatingScrollerRef}
            onScroll={contractTableScroll.syncFloatingToTable}
          />
        </div>
      </Panel>
      <details className="group mt-5 overflow-hidden rounded-xl border border-border bg-card shadow-[0_1px_2px_rgb(15_23_42/3%)]">
        <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4">
          <div>
            <h2 className="text-[14px] font-semibold text-foreground">
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
        <div className="grid gap-3 border-t border-border bg-muted p-4 md:grid-cols-2 xl:grid-cols-3">
          {recentContracts.map((item) => (
            <button
              key={String(item.id)}
              type="button"
              onClick={() => onSelect(String(item.id))}
              className="rounded-lg border border-border bg-card p-4 text-left hover:border-[#9fc4d1] hover:bg-accent/40"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="text-xs font-semibold text-accent-foreground">
                  {valueText(item.contract_number)}
                </span>
                <StatusBadge tone={toneForStatus(item.status)}>
                  {titleCase(item.status)}
                </StatusBadge>
              </div>
              <div className="mt-2 text-xs font-medium text-foreground">
                {valueText(item.title)}
              </div>
              <div className="mt-1 text-[11px] text-slate-500">
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
