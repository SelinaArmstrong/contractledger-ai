'use client';

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
import { Plus, RotateCcw } from 'lucide-react';
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
  StatusBadge,
} from '@/components/workspace/primitives';
import {
  FilterSelect,
  FloatingTableScrollbar,
  RegisterRecord,
  RegisterToolbar,
  RegisterUtilities,
  TablePagination,
  useFloatingTableScrollbar,
} from '@/components/workspace/table';
import { useRegisterPage } from '@/components/workspace/use-register-page';

export function SupplierRegisterView({
  workspace,
  search,
  onSearch,
  onSelect,
  onAdd,
  canExport,
  canUseInsights,
  workspaceUnavailable,
  onExport,
  exporting,
  onOpenAlerts,
  openInsightsRequest,
  onInsightsRequestHandled,
}: {
  workspace: Workspace | null;
  search: string;
  onSearch: (value: string) => void;
  onSelect: (id: string) => void;
  onAdd?: () => void;
  canExport: boolean;
  canUseInsights: boolean;
  workspaceUnavailable: boolean;
  onExport: () => void;
  exporting: boolean;
  onOpenAlerts: () => void;
  openInsightsRequest: boolean;
  onInsightsRequestHandled: () => void;
}) {
  const supplierTableScroll = useFloatingTableScrollbar();
  const [insightsOpen, setInsightsOpen] = useState(false);
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
  const criteria = new URLSearchParams({
    search,
    relationship_stage: relationshipFilter,
    status: supplierStatusFilter,
    qualification_status: qualificationFilter,
    risk: riskFilter,
    category: categoryFilter,
    state: stateFilter,
    w9_status: w9Filter,
    insurance_status: insuranceFilter,
    documentExpiry: documentExpiryFilter,
  }).toString();
  const [pagination, setPagination] = useState({ criteria, page: 1 });
  if (pagination.criteria !== criteria) setPagination({ criteria, page: 1 });
  const setCurrentPage = (page: number) => setPagination({ criteria, page });
  const register = useRegisterPage(
    'suppliers',
    workspace,
    criteria,
    pagination.criteria === criteria ? pagination.page : 1,
    pageSize,
  );
  const paginatedSuppliers = register.page?.rows ?? [];
  const matchCount = register.page?.matchCount ?? 0;
  const totalCount =
    register.page?.totalCount ?? workspace?.metrics.total_suppliers ?? 0;
  const activePage = register.page?.page ?? 1;
  const loading = register.loading && !workspaceUnavailable;
  const options = (key: string) => register.options[key] ?? [];
  const riskProfiles = register.page?.riskProfiles ?? {};
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

  useEffect(() => {
    if (!openInsightsRequest || loading) return;
    const timer = window.setTimeout(() => {
      setInsightsOpen(true);
      onInsightsRequestHandled();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loading, onInsightsRequestHandled, openInsightsRequest]);
  const filterCount = [
    relationshipFilter !== 'all',
    supplierStatusFilter !== 'all',
    qualificationFilter !== 'all',
    riskFilter !== 'all',
    categoryFilter !== 'all',
    stateFilter !== 'all',
    w9Filter !== 'all',
    insuranceFilter !== 'all',
    documentExpiryFilter !== 'all',
  ].filter(Boolean).length;

  return (
    <>
      <PageHeading
        eyebrow="Records"
        title="Supplier register"
        description="Find supplier records, qualification status, and supporting documents."
        action={
          <div className="flex flex-wrap gap-2">
            {onAdd ? (
              <Button onClick={onAdd} className="workspace-primary-action h-11">
                <Plus /> Create supplier from files
              </Button>
            ) : null}
            <RegisterUtilities
              hasPrimaryAction={Boolean(onAdd)}
              exportLabel="Export all suppliers"
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
          label="Search suppliers"
          placeholder="Search suppliers…"
          search={search}
          onSearch={onSearch}
          matchCount={matchCount}
          totalCount={totalCount}
          filterCount={filterCount}
          loading={loading}
          unavailable={Boolean(register.error) || workspaceUnavailable}
        >
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
                options={['high', 'low', 'medium']}
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
                  disabled={!filterCount}
                >
                  <RotateCcw />
                  Clear filters
                </Button>
              </div>
            </div>
            <p className="mt-3 text-[11px] text-slate-500">
              Filters can be combined with keyword search. “Expiring 90 days”
              uses the earliest dated supplier or insurance record on each
              supplier. Dates are displayed in U.S. English format (MM/DD/YYYY).
            </p>
          </div>
        </RegisterToolbar>
        {paginatedSuppliers.length ? (
          <ul
            className="divide-y divide-border md:hidden"
            aria-label="Supplier records"
          >
            {paginatedSuppliers.map((item) => (
              <RegisterRecord
                key={String(item.id)}
                title={valueText(item.legal_name)}
                subtitle={`${valueText(item.vendor_number)} · ${valueText(item.category)}`}
                onOpen={() => onSelect(String(item.id))}
              >
                <StatusBadge tone={toneForStatus(item.qualification_status)}>
                  {titleCase(item.qualification_status)}
                </StatusBadge>
                {riskProfiles[String(item.id)] ? (
                  <span className="text-xs font-medium">
                    {titleCase(riskProfiles[String(item.id)].level)} risk
                  </span>
                ) : null}
              </RegisterRecord>
            ))}
          </ul>
        ) : null}
        <div>
          <Table
            aria-label="Supplier records"
            containerClassName="hidden md:block"
            className="register-table min-w-[2260px]"
            containerRef={supplierTableScroll.tableScrollerRef}
            onContainerScroll={supplierTableScroll.syncTableToFloating}
          >
            <TableHeader>
              <TableRow className="bg-muted">
                <TableHead className="register-key-column">Supplier</TableHead>
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
              {paginatedSuppliers.map((item) => (
                <TableRow key={String(item.id)}>
                  <TableCell className="register-key-column">
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
            </TableBody>
          </Table>
          {!loading &&
          !register.error &&
          !workspaceUnavailable &&
          !paginatedSuppliers.length ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">
              {search.trim() || filterCount
                ? 'No suppliers match your search or filters.'
                : 'No suppliers to display.'}
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
              label="Supplier register pagination"
              page={activePage}
              pageSize={pageSize}
              total={matchCount}
              onPageChange={setCurrentPage}
              onPageSizeChange={(nextPageSize) => {
                setPageSize(nextPageSize);
                setCurrentPage(1);
              }}
              floating={supplierTableScroll.floating}
            />
          ) : null}
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
        criteria={criteria}
        matchCount={matchCount}
        totalCount={totalCount}
        onSelectRecord={onSelect}
        onOpenAlerts={onOpenAlerts}
      />
    </>
  );
}
