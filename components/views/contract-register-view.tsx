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
import { ChevronDown, RotateCcw, Upload } from 'lucide-react';
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
  StatusBadge,
} from '@/components/workspace/primitives';
import {
  DateFilter,
  FilterSelect,
  FloatingTableScrollbar,
  RegisterRecord,
  RegisterToolbar,
  RegisterUtilities,
  TablePagination,
  useFloatingTableScrollbar,
} from '@/components/workspace/table';
import { useRegisterPage } from '@/components/workspace/use-register-page';

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
  workspace,
  search,
  onSearch,
  onRegister,
  canExport,
  canUseInsights,
  workspaceUnavailable,
  onExport,
  exporting,
  onSelect,
  onOpenAlerts,
  openInsightsRequest,
  onInsightsRequestHandled,
}: {
  workspace: Workspace | null;
  search: string;
  onSearch: (value: string) => void;
  onRegister?: () => void;
  canExport: boolean;
  canUseInsights: boolean;
  workspaceUnavailable: boolean;
  onExport: () => void;
  exporting: boolean;
  onSelect: (id: string) => void;
  onOpenAlerts: () => void;
  openInsightsRequest: boolean;
  onInsightsRequestHandled: () => void;
}) {
  const contractTableScroll = useFloatingTableScrollbar();
  const [insightsOpen, setInsightsOpen] = useState(false);
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
  const criteria = new URLSearchParams({
    search,
    contract_type: typeFilter,
    supplier_name: supplierFilter,
    department: departmentFilter,
    status: statusFilter,
    amountComparison,
    amountValue,
    effectiveCondition,
    effectiveDate,
    expirationCondition,
    expirationDate,
  }).toString();
  const [pagination, setPagination] = useState({ criteria, page: 1 });
  if (pagination.criteria !== criteria) setPagination({ criteria, page: 1 });
  const setCurrentPage = (page: number) => setPagination({ criteria, page });
  const register = useRegisterPage(
    'contracts',
    workspace,
    criteria,
    pagination.criteria === criteria ? pagination.page : 1,
    pageSize,
  );
  const paginatedContracts = register.page?.rows ?? [];
  const matchCount = register.page?.matchCount ?? 0;
  const totalCount =
    register.page?.totalCount ?? workspace?.metrics.total_contracts ?? 0;
  const activePage = register.page?.page ?? 1;
  const loading = register.loading && !workspaceUnavailable;
  const options = (key: string) => register.options[key] ?? [];
  const recentContracts = workspace?.contracts.slice(0, 5) ?? [];
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
  useEffect(() => {
    if (!openInsightsRequest || loading) return;
    const timer = window.setTimeout(() => {
      setInsightsOpen(true);
      onInsightsRequestHandled();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loading, onInsightsRequestHandled, openInsightsRequest]);
  const filterCount = [
    typeFilter !== 'all',
    supplierFilter !== 'all',
    departmentFilter !== 'all',
    statusFilter !== 'all',
    amountComparison !== 'all',
    effectiveCondition !== 'all' && Boolean(effectiveDate),
    expirationCondition !== 'all' && Boolean(expirationDate),
  ].filter(Boolean).length;

  return (
    <>
      <PageHeading
        eyebrow="Records"
        title="Contract register"
        description="Find executed agreements, track amendments, and review current terms."
        action={
          <div className="flex flex-wrap gap-2">
            {onRegister ? (
              <Button
                onClick={onRegister}
                className="workspace-primary-action h-11"
              >
                <Upload /> Register executed contract
              </Button>
            ) : null}
            <RegisterUtilities
              hasPrimaryAction={Boolean(onRegister)}
              exportLabel="Export workbook"
              onExport={canExport ? onExport : undefined}
              exportDisabled={exporting || !totalCount}
              exporting={exporting}
              onInsights={
                canUseInsights ? () => setInsightsOpen(true) : undefined
              }
              insightsDisabled={!matchCount}
            />
          </div>
        }
      />
      <Panel className="overflow-hidden">
        <RegisterToolbar
          label="Search contracts"
          placeholder="Search contracts…"
          search={search}
          onSearch={onSearch}
          matchCount={matchCount}
          totalCount={totalCount}
          filterCount={filterCount}
          loading={loading}
          unavailable={Boolean(register.error) || workspaceUnavailable}
        >
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
                    onChange={(event) =>
                      setAmountComparison(event.target.value)
                    }
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
                  disabled={
                    !filterCount &&
                    effectiveCondition === 'all' &&
                    expirationCondition === 'all'
                  }
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
        </RegisterToolbar>
        {paginatedContracts.length ? (
          <ul
            className="divide-y divide-border md:hidden"
            aria-label="Contract records"
          >
            {paginatedContracts.map((item) => (
              <RegisterRecord
                key={String(item.id)}
                title={valueText(item.title)}
                subtitle={`${valueText(item.contract_number)} · ${valueText(item.supplier_name)}`}
                onOpen={() => onSelect(String(item.id))}
              >
                <StatusBadge tone={toneForStatus(item.status)}>
                  {titleCase(item.status)}
                </StatusBadge>
                <span className="text-xs font-medium tabular-nums">
                  {moneyFromCents(item.current_value_cents)}
                </span>
              </RegisterRecord>
            ))}
          </ul>
        ) : null}
        <div>
          <Table
            aria-label="Contract records"
            containerClassName="hidden md:block"
            className="register-table min-w-[2160px]"
            containerRef={contractTableScroll.tableScrollerRef}
            onContainerScroll={contractTableScroll.syncTableToFloating}
          >
            <TableHeader>
              <TableRow className="bg-muted">
                <TableHead className="register-key-column">Contract</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Current value</TableHead>
                <TableHead>Status</TableHead>
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
                <TableHead>Last updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedContracts.map((item) => (
                <TableRow key={String(item.id)}>
                  <TableCell className="register-key-column">
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
                    <StatusBadge tone={toneForStatus(item.status)}>
                      {titleCase(item.status)}
                    </StatusBadge>
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
                    {valueText(item.last_updated)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!loading &&
          !register.error &&
          !workspaceUnavailable &&
          !paginatedContracts.length ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">
              {search.trim() || filterCount
                ? 'No contracts match your search or filters.'
                : 'No contracts to display.'}
            </p>
          ) : null}
          {register.error || register.optionsError ? (
            <p
              role="alert"
              className="border-t border-border px-5 py-3 text-sm text-destructive"
            >
              {register.error || register.optionsError}
            </p>
          ) : null}
          {matchCount ? (
            <TablePagination
              label="Contract register pagination"
              page={activePage}
              pageSize={pageSize}
              total={matchCount}
              onPageChange={setCurrentPage}
              onPageSizeChange={(nextPageSize) => {
                setPageSize(nextPageSize);
                setCurrentPage(1);
              }}
              floating={contractTableScroll.floating}
            />
          ) : null}
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
        criteria={criteria}
        matchCount={matchCount}
        totalCount={totalCount}
        onSelectRecord={onSelect}
        onOpenAlerts={onOpenAlerts}
      />
    </>
  );
}
