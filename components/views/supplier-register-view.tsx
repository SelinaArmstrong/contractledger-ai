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
  FileSpreadsheet,
  LoaderCircle,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { ManagementInsightsSheet } from '@/components/dialogs/management-insights-sheet';
import {
  moneyFromCents,
  titleCase,
  toneForStatus,
  usDateText,
  valueText,
} from '@/components/workspace/formatters';
import {
  PageHeading,
  Panel,
  PanelHeader,
  StatusBadge,
} from '@/components/workspace/primitives';
import {
  FilterSelect,
  FloatingTableScrollbar,
  TablePagination,
  useFloatingTableScrollbar,
} from '@/components/workspace/table';
import type { RegisterTruncation } from '@/lib/workspace-limits';

export function SupplierRegisterView({
  suppliers,
  allSuppliers,
  riskProfiles,
  search,
  onSearch,
  onSelect,
  onAdd,
  onExport,
  exporting,
  onOpenAlerts,
  openInsightsRequest,
  onInsightsRequestHandled,
  truncation,
}: {
  suppliers: Workspace['suppliers'];
  allSuppliers: Workspace['suppliers'];
  riskProfiles: NonNullable<Workspace['supplierRiskProfiles']>;
  search: string;
  onSearch: (value: string) => void;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onExport: () => void;
  exporting: boolean;
  onOpenAlerts: () => void;
  openInsightsRequest: boolean;
  onInsightsRequestHandled: () => void;
  truncation: RegisterTruncation;
}) {
  const supplierTableScroll = useFloatingTableScrollbar();
  const [insightsOpen, setInsightsOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [relationshipFilter, setRelationshipFilter] = useState('all');
  const [supplierStatusFilter, setSupplierStatusFilter] = useState('all');
  const [qualificationFilter, setQualificationFilter] = useState('all');
  const [riskFilter, setRiskFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [stateFilter, setStateFilter] = useState('all');
  const [w9Filter, setW9Filter] = useState('all');
  const [insuranceFilter, setInsuranceFilter] = useState('all');
  const [documentExpiryFilter, setDocumentExpiryFilter] = useState('all');
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
    if (
      riskFilter !== 'all' &&
      riskProfiles[String(item.id)]?.level !== riskFilter
    )
      return false;
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
  const pageCount = Math.max(1, Math.ceil(visibleSuppliers.length / pageSize));
  const activePage = Math.min(currentPage, pageCount);
  const pageStart = (activePage - 1) * pageSize;
  const paginatedSuppliers = visibleSuppliers.slice(
    pageStart,
    pageStart + pageSize,
  );
  useEffect(() => {
    const timer = window.setTimeout(() => setCurrentPage(1), 0);
    return () => window.clearTimeout(timer);
  }, [
    categoryFilter,
    documentExpiryFilter,
    insuranceFilter,
    qualificationFilter,
    relationshipFilter,
    riskFilter,
    search,
    stateFilter,
    supplierStatusFilter,
    w9Filter,
  ]);
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
    setCurrentPage(1);
  };

  return (
    <>
      <PageHeading
        eyebrow="Lifecycle supplier master"
        title="Supplier register"
        description="Supplier records originate from uploaded supplier files or executed contracts. A supplier does not need an active contract to remain in this lifecycle master."
        action={
          <div className="flex flex-wrap gap-2">
            <Button onClick={onAdd} className="bg-primary hover:bg-primary/90">
              <Plus />
              Create supplier from files
            </Button>
            <Button
              variant="outline"
              onClick={onExport}
              disabled={exporting || !allSuppliers.length}
              className="bg-card"
            >
              {exporting ? (
                <LoaderCircle className="animate-spin" />
              ) : (
                <FileSpreadsheet />
              )}
              Export all suppliers
            </Button>
            <Button
              variant="outline"
              onClick={() => setInsightsOpen(true)}
              disabled={!visibleSuppliers.length}
              className="border-input bg-accent text-accent-foreground hover:bg-accent"
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
          description={`${visibleSuppliers.length} of ${suppliers.length} supplier record${suppliers.length === 1 ? '' : 's'} match the current view`}
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
        <div className="border-b border-border bg-muted p-4">
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
              label="Documentation status"
              value={qualificationFilter}
              onChange={setQualificationFilter}
              options={options('qualification_status')}
              titleCaseOptions
            />
            <FilterSelect
              label="Risk tier"
              value={riskFilter}
              onChange={setRiskFilter}
              options={Array.from(
                new Set(
                  suppliers
                    .map((item) => riskProfiles[String(item.id)]?.level)
                    .filter((value): value is 'low' | 'medium' | 'high' =>
                      Boolean(value),
                    ),
                ),
              ).sort()}
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
              label="Supplier file / insurance expiry"
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
                className="h-9 w-full bg-card"
              >
                <RotateCcw />
                Clear filters
              </Button>
            </div>
          </div>
          <p className="mt-3 text-[11px] text-slate-500">
            Filters can be combined with keyword search. “Expiring 90 days” uses
            the earliest dated supplier or insurance record on each supplier.
            Dates are displayed in U.S. English format (MM/DD/YYYY).
          </p>
        </div>
        <div>
          <Table
            className="min-w-[2260px]"
            containerRef={supplierTableScroll.tableScrollerRef}
            onContainerScroll={supplierTableScroll.syncTableToFloating}
          >
            <TableHeader>
              <TableRow className="bg-muted">
                <TableHead className="w-14 px-4 text-center">No.</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Vendor number</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Tax classification</TableHead>
                <TableHead>Risk / documentation</TableHead>
                <TableHead>Business address</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Primary contact</TableHead>
                <TableHead>Contract relationships</TableHead>
                <TableHead>Total contract value</TableHead>
                <TableHead>W-9</TableHead>
                <TableHead>Insurance status</TableHead>
                <TableHead>Insurance expiration</TableHead>
                <TableHead>Supplier files</TableHead>
                <TableHead>Last updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedSuppliers.map((item, index) => (
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
                      {titleCase(riskProfiles[String(item.id)]?.level)} risk ·{' '}
                      {riskProfiles[String(item.id)]?.score ?? 0} points
                    </div>
                    <div className="mt-1">
                      <StatusBadge
                        tone={toneForStatus(item.qualification_status)}
                      >
                        {titleCase(item.qualification_status)}
                      </StatusBadge>
                    </div>
                    <div className="mt-1 text-[11px] text-slate-500">
                      Review date {usDateText(item.qualification_review_date)}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs">
                    <div>{valueText(item.address_line1)}</div>
                    {item.address_line2 ? (
                      <div>{valueText(item.address_line2)}</div>
                    ) : null}
                    <div className="mt-1 text-[11px] text-slate-500">
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
                    <div className="mt-1 text-[11px] font-medium text-slate-500">
                      {titleCase(item.relationship_stage)} relationship
                    </div>
                  </TableCell>
                  <TableCell className="text-xs">
                    <div className="font-medium">
                      {valueText(item.primary_contact)}
                    </div>
                    <div className="mt-1 text-[11px] text-slate-500">
                      {valueText(item.email)} · {valueText(item.phone)}
                    </div>
                    {item.website ? (
                      <a
                        href={String(item.website)}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 block text-[11px] text-accent-foreground hover:underline"
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
                                className="rounded bg-amber-50 px-2 py-1 text-[11px] text-amber-800"
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
                                  className="rounded bg-slate-50 px-2 py-1 text-[11px] text-slate-600"
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
                    <div className="mt-1 text-[11px] text-slate-500">
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
                    {usDateText(item.insurance_expiration)}
                  </TableCell>
                  <TableCell className="text-xs">
                    <div className="font-medium">
                      {valueText(item.qualification_document_count)} files
                    </div>
                    <div className="mt-1 text-[11px] text-slate-500">
                      Next expiry {usDateText(item.next_compliance_expiration)}
                    </div>
                    {Number(item.expired_qualification_document_count ?? 0) >
                    0 ? (
                      <div className="mt-1 text-[11px] font-medium text-rose-600">
                        {valueText(item.expired_qualification_document_count)}{' '}
                        expired
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-xs">
                    {usDateText(item.updated_at)}
                  </TableCell>
                </TableRow>
              ))}
              {!paginatedSuppliers.length ? (
                <TableRow>
                  <TableCell
                    colSpan={16}
                    className="h-36 text-center text-xs text-slate-500"
                  >
                    No suppliers match the current search and filters.
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
            label="Supplier register pagination"
            page={activePage}
            pageSize={pageSize}
            total={visibleSuppliers.length}
            onPageChange={setCurrentPage}
            onPageSizeChange={(nextPageSize) => {
              setPageSize(nextPageSize);
              setCurrentPage(1);
            }}
            floating={supplierTableScroll.floating}
          />
          <FloatingTableScrollbar
            label="Supplier register horizontal scrollbar"
            floating={supplierTableScroll.floating}
            floatingScrollerRef={supplierTableScroll.floatingScrollerRef}
            onScroll={supplierTableScroll.syncFloatingToTable}
          />
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
