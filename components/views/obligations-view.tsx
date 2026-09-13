'use client';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import type { Workspace } from '@/lib/contract-ledger-types';
import {
  CalendarDays,
  FileSpreadsheet,
  LoaderCircle,
  RotateCcw,
} from 'lucide-react';
import { useState } from 'react';
import { ObligationEditor } from '@/components/dialogs/obligation-editor';
import { SupplierComplianceAlert } from '@/components/workspace/alerts';
import {
  alertTiming,
  supplierDocumentLabel,
  valueText,
} from '@/components/workspace/formatters';
import {
  EmptyState,
  PageHeading,
  Panel,
  PanelHeader,
  StatusBadge,
} from '@/components/workspace/primitives';
import { FilterSelect } from '@/components/workspace/table';

export function AlertsExportsView({
  workspace,
  onExport,
  exporting,
  onRefresh,
  onSelectContract,
  onSelectSupplier,
}: {
  workspace: Workspace | null;
  onExport: () => void;
  exporting: boolean;
  onRefresh: () => Promise<void>;
  onSelectContract: (id: string) => void;
  onSelectSupplier: (id: string) => void;
}) {
  const obligations = workspace?.keyDates ?? [];
  const supplierAlerts = workspace?.supplierAlerts ?? [];
  const metrics = workspace?.obligationMetrics;
  const [search, setSearch] = useState('');
  const [ownerFilter, setOwnerFilter] = useState('all');
  const [contractFilter, setContractFilter] = useState('all');
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [dueFilter, setDueFilter] = useState('all');
  const [supplierNameFilter, setSupplierNameFilter] = useState('all');
  const [supplierDocumentFilter, setSupplierDocumentFilter] = useState('all');
  const [supplierAlertFilter, setSupplierAlertFilter] = useState('all');
  const [supplierDueFilter, setSupplierDueFilter] = useState('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const obligationOptionValues = (key: string) =>
    [
      ...new Set(
        obligations
          .map((item) => valueText(item[key]))
          .filter((value) => value !== 'Not found'),
      ),
    ].sort();
  const filteredObligations = obligations.filter((item) => {
    const searchable = [
      item.title,
      item.contract_number,
      item.contract_title,
      item.supplier_name,
      item.owner,
      item.backup_owner,
    ]
      .map((value) => valueText(value).toLowerCase())
      .join(' ');
    if (search && !searchable.includes(search.toLowerCase())) return false;
    if (ownerFilter !== 'all' && item.owner !== ownerFilter) return false;
    if (contractFilter !== 'all' && item.contract_number !== contractFilter)
      return false;
    if (supplierFilter !== 'all' && item.supplier_name !== supplierFilter)
      return false;
    if (statusFilter !== 'all' && item.status !== statusFilter) return false;
    if (priorityFilter !== 'all' && item.priority !== priorityFilter)
      return false;
    const timing = alertTiming(item.due_date);
    if (dueFilter === 'overdue' && item.effective_status !== 'overdue')
      return false;
    if (
      dueFilter === 'next_30' &&
      (!timing || timing.days < 0 || timing.days > 30)
    )
      return false;
    if (
      dueFilter === 'next_90' &&
      (!timing || timing.days < 0 || timing.days > 90)
    )
      return false;
    return true;
  });
  const supplierNames = [
    ...new Set(
      supplierAlerts
        .map((item) => valueText(item.supplier_name))
        .filter((value) => value !== 'Not found'),
    ),
  ].sort();
  const supplierDocumentTypes = [
    ...new Set(
      supplierAlerts
        .map((item) => String(item.item_type ?? ''))
        .filter(Boolean),
    ),
  ]
    .sort()
    .map((value) => ({ value, label: supplierDocumentLabel(value) }));
  const filteredSupplierAlerts = supplierAlerts.filter((item) => {
    if (
      supplierNameFilter !== 'all' &&
      valueText(item.supplier_name) !== supplierNameFilter
    )
      return false;
    if (
      supplierDocumentFilter !== 'all' &&
      item.item_type !== supplierDocumentFilter
    )
      return false;

    const missing = item.source_type === 'missing_record';
    const timing = alertTiming(item.due_date);
    const alertStatus = missing
      ? 'missing'
      : timing && timing.days < 0
        ? 'expired'
        : timing && timing.days <= 30
          ? 'expiring_soon'
          : 'scheduled';
    if (supplierAlertFilter !== 'all' && alertStatus !== supplierAlertFilter)
      return false;
    if (
      supplierDueFilter === 'next_30' &&
      (!timing || timing.days < 0 || timing.days > 30)
    )
      return false;
    if (
      supplierDueFilter === 'next_90' &&
      (!timing || timing.days < 0 || timing.days > 90)
    )
      return false;
    return true;
  });
  const openObligations = filteredObligations.filter(
    (item) => item.status !== 'completed',
  );
  const completedObligations = filteredObligations.filter(
    (item) => item.status === 'completed',
  );
  const supplierCriticalCount = filteredSupplierAlerts.filter((item) => {
    if (item.source_type === 'missing_record') return true;
    const timing = alertTiming(item.due_date);
    return timing && timing.days <= 30;
  }).length;
  const visibleIds = filteredObligations.map((item) => String(item.id));
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
  const toggleSelected = (id: string, checked: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };
  const exportCalendar = () => {
    if (!selectedIds.size) return;
    window.location.href = `/api/obligations?format=ics&ids=${encodeURIComponent(
      [...selectedIds].join(','),
    )}`;
  };
  const clearObligationFilters = () => {
    setSearch('');
    setOwnerFilter('all');
    setContractFilter('all');
    setSupplierFilter('all');
    setStatusFilter('all');
    setPriorityFilter('all');
    setDueFilter('all');
  };
  const clearSupplierFilters = () => {
    setSupplierNameFilter('all');
    setSupplierDocumentFilter('all');
    setSupplierAlertFilter('all');
    setSupplierDueFilter('all');
  };

  return (
    <>
      <PageHeading
        eyebrow="Post-execution control"
        title="Obligation execution & evidence"
        description="Contract alerts become owned work with completion evidence; supplier-document exceptions remain a separate follow-up queue."
        action={
          <Button
            onClick={onExport}
            disabled={!workspace || exporting}
            className="bg-[#173f55] text-white hover:bg-[#123447]"
          >
            {exporting ? (
              <LoaderCircle className="animate-spin" />
            ) : (
              <FileSpreadsheet />
            )}
            Export audited workbook
          </Button>
        }
      />
      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {[
          [
            'Open obligations',
            metrics?.open_obligations ?? 0,
            'Assigned operational work',
          ],
          [
            'Overdue',
            metrics?.overdue_obligations ?? 0,
            `${metrics?.average_overdue_age_days ?? 0} average aging days`,
          ],
          [
            'On-time completion',
            `${metrics?.on_time_completion_rate ?? 0}%`,
            'Measured from saved completion time',
          ],
          [
            'Evidence coverage',
            `${metrics?.completed_with_evidence_rate ?? 0}%`,
            'Completed material obligations',
          ],
          [
            'Median completion',
            `${metrics?.median_completion_hours ?? 0}h`,
            `${metrics?.median_assignment_hours ?? 0}h median to assignment`,
          ],
          [
            'Integration outbox',
            workspace?.integrationMetrics?.pending_events ?? 0,
            `${workspace?.integrationMetrics?.failed_events ?? 0} failed · future delivery only`,
          ],
        ].map(([label, value, note]) => (
          <Panel key={String(label)} className="p-4">
            <p className="text-[11px] font-semibold tracking-[0.12em] text-slate-500 uppercase">
              {label}
            </p>
            <p className="mt-2 text-2xl font-semibold text-[#18394b]">
              {value}
            </p>
            <p className="mt-1 text-[11px] leading-4 text-slate-500">{note}</p>
          </Panel>
        ))}
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.8fr)]">
        <Panel className="overflow-hidden">
          <PanelHeader
            title="Contract alerts & obligations"
            description="Filters and actions in this panel apply only to contract work. Overdue is calculated from the due date."
            action={
              <div className="flex gap-2">
                <StatusBadge tone="blue">
                  {openObligations.length} open
                </StatusBadge>
                {openObligations.some(
                  (item) => item.effective_status === 'overdue',
                ) ? (
                  <StatusBadge tone="rose">
                    {
                      openObligations.filter(
                        (item) => item.effective_status === 'overdue',
                      ).length
                    }{' '}
                    overdue
                  </StatusBadge>
                ) : null}
              </div>
            }
          />
          <div className="border-b border-border bg-muted p-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <label
                htmlFor="obligation-search"
                className="text-[11px] font-medium text-slate-600 xl:col-span-2"
              >
                Search contract obligations
                <Input
                  id="obligation-search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="mt-1 h-9 bg-card text-xs"
                  placeholder="Title, contract, supplier, or owner…"
                />
              </label>
              <FilterSelect
                label="Owner"
                value={ownerFilter}
                onChange={setOwnerFilter}
                options={obligationOptionValues('owner')}
              />
              <FilterSelect
                label="Workflow status"
                value={statusFilter}
                onChange={setStatusFilter}
                options={[
                  'upcoming',
                  'in_progress',
                  'evidence_required',
                  'completed',
                ]}
                titleCaseOptions
              />
              <FilterSelect
                label="Contract"
                value={contractFilter}
                onChange={setContractFilter}
                options={obligationOptionValues('contract_number')}
              />
              <FilterSelect
                label="Supplier"
                value={supplierFilter}
                onChange={setSupplierFilter}
                options={obligationOptionValues('supplier_name')}
              />
              <FilterSelect
                label="Priority"
                value={priorityFilter}
                onChange={setPriorityFilter}
                options={['low', 'medium', 'high', 'critical']}
                titleCaseOptions
              />
              <FilterSelect
                label="Due window"
                value={dueFilter}
                onChange={setDueFilter}
                options={[
                  { value: 'overdue', label: 'Overdue' },
                  { value: 'next_30', label: 'Next 30 days' },
                  { value: 'next_90', label: 'Next 90 days' },
                ]}
              />
            </div>
            <div className="mt-3 flex justify-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearObligationFilters}
                className="text-slate-600"
              >
                <RotateCcw /> Clear contract filters
              </Button>
            </div>
          </div>
          <div className="flex flex-col gap-3 border-b border-border p-4 md:flex-row md:items-center md:justify-between">
            <label className="flex items-center gap-2 text-[11px] font-medium text-slate-600">
              <Checkbox
                checked={allVisibleSelected}
                onCheckedChange={(checked) =>
                  setSelectedIds((current) => {
                    const next = new Set(current);
                    visibleIds.forEach((id) =>
                      checked ? next.add(id) : next.delete(id),
                    );
                    return next;
                  })
                }
              />
              Select all {filteredObligations.length} filtered obligations
            </label>
            <Button
              variant="outline"
              size="sm"
              onClick={exportCalendar}
              disabled={!selectedIds.size}
            >
              <CalendarDays /> Export {selectedIds.size || ''} to calendar
            </Button>
          </div>
          <div className="space-y-3 p-5">
            {openObligations.map((item) => (
              <ObligationEditor
                key={String(item.id)}
                item={item}
                selected={selectedIds.has(String(item.id))}
                onSelectedChange={(checked) =>
                  toggleSelected(String(item.id), checked)
                }
                onSaved={onRefresh}
                onOpenRecord={
                  item.contract_id
                    ? () => onSelectContract(String(item.contract_id))
                    : item.supplier_id
                      ? () => onSelectSupplier(String(item.supplier_id))
                      : undefined
                }
              />
            ))}
            {!openObligations.length && !completedObligations.length ? (
              <EmptyState
                title="No contract obligations match"
                description="Adjust the contract filters or register an executed agreement with key dates."
              />
            ) : null}
            {completedObligations.length ? (
              <details className="rounded-xl border border-border bg-slate-50">
                <summary className="cursor-pointer px-4 py-3 text-xs font-medium text-slate-600">
                  Completed with closeout history ({completedObligations.length}
                  )
                </summary>
                <div className="space-y-3 border-t border-border p-3">
                  {completedObligations.map((item) => (
                    <ObligationEditor
                      key={String(item.id)}
                      item={item}
                      selected={selectedIds.has(String(item.id))}
                      onSelectedChange={(checked) =>
                        toggleSelected(String(item.id), checked)
                      }
                      onSaved={onRefresh}
                      onOpenRecord={
                        item.contract_id
                          ? () => onSelectContract(String(item.contract_id))
                          : item.supplier_id
                            ? () => onSelectSupplier(String(item.supplier_id))
                            : undefined
                      }
                    />
                  ))}
                </div>
              </details>
            ) : null}
          </div>
        </Panel>

        <Panel className="overflow-hidden">
          <PanelHeader
            title="Supplier evidence alerts"
            description="This separate queue tracks missing, expired, and expiring supplier documents."
            action={
              <div className="flex gap-2">
                <StatusBadge tone="blue">
                  {filteredSupplierAlerts.length} of {supplierAlerts.length}
                </StatusBadge>
                {supplierCriticalCount ? (
                  <StatusBadge tone="rose">
                    {supplierCriticalCount} urgent
                  </StatusBadge>
                ) : null}
              </div>
            }
          />
          <div className="border-b border-border bg-muted p-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              <FilterSelect
                label="Supplier"
                value={supplierNameFilter}
                onChange={setSupplierNameFilter}
                options={supplierNames}
                allLabel="All suppliers"
              />
              <FilterSelect
                label="Document type"
                value={supplierDocumentFilter}
                onChange={setSupplierDocumentFilter}
                options={supplierDocumentTypes}
                allLabel="All documents"
              />
              <FilterSelect
                label="Alert status"
                value={supplierAlertFilter}
                onChange={setSupplierAlertFilter}
                options={[
                  { value: 'missing', label: 'Missing' },
                  { value: 'expired', label: 'Expired' },
                  { value: 'expiring_soon', label: 'Expiring in 30 days' },
                  { value: 'scheduled', label: 'More than 30 days' },
                ]}
                allLabel="All alerts"
              />
              <FilterSelect
                label="Due window"
                value={supplierDueFilter}
                onChange={setSupplierDueFilter}
                options={[
                  { value: 'next_30', label: 'Next 30 days' },
                  { value: 'next_90', label: 'Next 90 days' },
                ]}
                allLabel="Any due date"
              />
            </div>
            <div className="mt-3 flex justify-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearSupplierFilters}
                className="text-slate-600"
              >
                <RotateCcw /> Clear supplier filters
              </Button>
            </div>
          </div>
          <div className="space-y-3 p-5">
            {filteredSupplierAlerts.map((item) => (
              <SupplierComplianceAlert
                key={String(item.alert_id)}
                item={item}
                onOpenSupplier={() =>
                  onSelectSupplier(String(item.supplier_id))
                }
              />
            ))}
            {!filteredSupplierAlerts.length ? (
              <EmptyState
                title="No supplier alerts match"
                description="Adjust the supplier filters or update the supplier register with current qualification documents."
              />
            ) : null}
          </div>
        </Panel>
      </div>
    </>
  );
}
