'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type {
  ImportBatchDetails,
  ImportPortfolioMetrics,
  Workspace,
} from '@/lib/contract-ledger-types';
import {
  AlertCircle,
  Check,
  Database,
  Download,
  LoaderCircle,
  RotateCcw,
  Upload,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  buildManagementReport,
  DATA_QUALITY_ISSUES,
  isDataQualityIssue,
} from '@/lib/management-insights';
import type { ManagementAttentionItem } from '@/lib/management-insights';
import {
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
import { TablePagination } from '@/components/workspace/table';

export function BulkImportView({
  workspace,
  onUpdated,
}: {
  workspace: Workspace | null;
  onUpdated: (workspace: Workspace) => void;
}) {
  const [target, setTarget] = useState<'suppliers' | 'contracts'>('suppliers');
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [batches, setBatches] = useState<
    Array<Record<string, string | number | null>>
  >([]);
  const [details, setDetails] = useState<ImportBatchDetails | null>(null);
  const [metrics, setMetrics] = useState<ImportPortfolioMetrics | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [rowPage, setRowPage] = useState(1);
  const [rowPageSize, setRowPageSize] = useState(20);
  const [exceptionLimit, setExceptionLimit] = useState(8);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadBatches = useCallback(async () => {
    try {
      const response = await fetch('/api/imports');
      const body = (await response.json()) as {
        batches?: Array<Record<string, string | number | null>>;
        metrics?: ImportPortfolioMetrics;
        error?: string;
      };
      if (!response.ok)
        throw new Error(body.error || 'Import history could not be loaded.');
      setBatches(body.batches ?? []);
      setMetrics(body.metrics ?? null);
      setError('');
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Import history could not be loaded.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadBatches(), 0);
    return () => window.clearTimeout(timer);
  }, [loadBatches]);

  const applyDetails = (next: ImportBatchDetails) => {
    setDetails(next);
    setMapping(next.batch.mapping);
    setRowPage(1);
  };

  const openBatch = async (batchId: string) => {
    setSaving(true);
    setError('');
    try {
      const response = await fetch(
        `/api/imports?id=${encodeURIComponent(batchId)}`,
      );
      const body = (await response.json()) as ImportBatchDetails & {
        error?: string;
      };
      if (!response.ok)
        throw new Error(body.error || 'Import batch could not be loaded.');
      applyDetails(body);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Import batch could not be loaded.',
      );
    } finally {
      setSaving(false);
    }
  };

  const previewFile = async () => {
    if (!file) {
      setError('Choose a CSV or XLSX file first.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const form = new FormData();
      form.append('target', target);
      form.append('file', file);
      const response = await fetch('/api/imports', {
        method: 'POST',
        body: form,
      });
      const body = (await response.json()) as ImportBatchDetails & {
        error?: string;
      };
      if (!response.ok)
        throw new Error(
          body.error || 'The import preview could not be created.',
        );
      applyDetails(body);
      await loadBatches();
    } catch (previewError) {
      setError(
        previewError instanceof Error
          ? previewError.message
          : 'The import preview could not be created.',
      );
    } finally {
      setSaving(false);
    }
  };

  const patchBatch = async (payload: Record<string, unknown>) => {
    setSaving(true);
    setError('');
    try {
      const response = await fetch('/api/imports', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = (await response.json()) as ImportBatchDetails & {
        workspace?: Workspace;
        error?: string;
      };
      if (!response.ok)
        throw new Error(body.error || 'The import batch could not be updated.');
      applyDetails(body);
      if (body.workspace) onUpdated(body.workspace);
      await loadBatches();
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : 'The import batch could not be updated.',
      );
    } finally {
      setSaving(false);
    }
  };

  const batchId = details ? String(details.batch.id) : '';
  const batchStatus = details ? String(details.batch.status) : '';
  const reviewableRows =
    details?.rows.filter(
      (row) =>
        row.status !== 'invalid' &&
        row.duplicate_type !== 'exact' &&
        row.decision !== 'accept',
    ) ?? [];
  const blockedRows =
    details?.rows.filter(
      (row) =>
        (row.status === 'invalid' || row.duplicate_type === 'exact') &&
        row.decision !== 'skip',
    ) ?? [];
  const pendingRows =
    details?.rows.filter((row) => row.decision === 'pending').length ?? 0;
  // A batch holds up to 150 rows, so the resolution table is paged like the
  // register queues rather than rendered in one run.
  /**
   * The import flow grades rows on the way in; this grades what is already in
   * the registers, using the same deterministic checks the management report
   * runs. It is the "Data Quality" half of this page.
   */
  const registerExceptions = useMemo(() => {
    if (!workspace) return [] as ManagementAttentionItem[];
    const today = new Date().toISOString().slice(0, 10);
    const shared = {
      contracts: workspace.contracts,
      suppliers: workspace.suppliers,
      keyDates: workspace.keyDates,
      supplierAlerts: workspace.supplierAlerts,
      today,
    };
    const items = [
      ...buildManagementReport({ ...shared, scope: 'contracts' })
        .attentionItems,
      ...buildManagementReport({ ...shared, scope: 'suppliers' })
        .attentionItems,
    ];
    const priorityRank = { high: 0, medium: 1, low: 2 } as const;
    return Array.from(
      new Map(
        items
          .filter((item) => isDataQualityIssue(item.issue))
          .map((item) => [item.id, item]),
      ).values(),
    ).sort(
      (left, right) =>
        priorityRank[left.priority] - priorityRank[right.priority] ||
        left.issue.localeCompare(right.issue),
    );
  }, [workspace]);
  const checkResults = [...DATA_QUALITY_ISSUES].map((issue) => ({
    issue,
    count: registerExceptions.filter((item) => item.issue === issue).length,
  }));
  const recordsChecked =
    (workspace?.contracts.length ?? 0) + (workspace?.suppliers.length ?? 0);
  const exceptionsByPriority = {
    high: registerExceptions.filter((item) => item.priority === 'high').length,
    medium: registerExceptions.filter((item) => item.priority === 'medium')
      .length,
    low: registerExceptions.filter((item) => item.priority === 'low').length,
  };

  const rowPageCount = Math.max(
    1,
    Math.ceil((details?.rows.length ?? 0) / rowPageSize),
  );
  const safeRowPage = Math.min(rowPage, rowPageCount);
  const visibleRows =
    details?.rows.slice(
      (safeRowPage - 1) * rowPageSize,
      safeRowPage * rowPageSize,
    ) ?? [];

  return (
    <>
      <PageHeading
        eyebrow="Controlled migration"
        title="Bulk Import & Data Quality"
        description="Map legacy CSV or XLSX columns, normalize values, review every duplicate and validation issue, then commit only explicitly accepted rows with a reversible audit trail."
        action={
          <div className="flex flex-wrap gap-2">
            <a
              href={`/api/imports?template=${target}&format=csv`}
              className="inline-flex h-8 items-center gap-2 rounded-md border border-input bg-card px-3 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
            >
              <Download className="size-3.5" /> CSV template
            </a>
            <a
              href={`/api/imports?template=${target}&format=xlsx`}
              className="inline-flex h-8 items-center gap-2 rounded-md border border-input bg-card px-3 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
            >
              <Download className="size-3.5" /> XLSX template
            </a>
          </div>
        }
      />

      {error ? (
        <Alert variant="destructive" className="mb-5">
          <AlertCircle />
          <AlertTitle>Import action could not be completed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          [
            'Rows assessed',
            metrics ? valueText(metrics.assessedRowCount) : '—',
            `${valueText(metrics?.batchCount)} dry runs`,
          ],
          [
            'Final acceptance',
            metrics?.acceptanceRate === null || !metrics
              ? '—'
              : `${Math.round(metrics.acceptanceRate * 100)}%`,
            `${valueText(metrics?.acceptedRowCount)} of ${valueText(metrics?.finalizedRowCount)} finalized rows`,
          ],
          [
            'Quality flags',
            metrics ? valueText(metrics.duplicateCandidateCount) : '—',
            `${valueText(metrics?.normalizationIssueCount)} normalization issues`,
          ],
          [
            'Median migration',
            metrics?.medianMigrationMinutes === null || !metrics
              ? '—'
              : metrics.medianMigrationMinutes < 1
                ? '<1 min'
                : `${Math.round(metrics.medianMigrationMinutes)} min`,
            metrics
              ? `${metrics.migrationDurationSampleSize} completed batch${metrics.migrationDurationSampleSize === 1 ? '' : 'es'}`
              : 'No completed batches',
          ],
        ].map(([label, value, description]) => (
          <article
            key={label}
            className="rounded-xl border border-border bg-card p-4 shadow-sm"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
              {label}
            </p>
            <p className="mt-2 text-xl font-semibold text-foreground">
              {value}
            </p>
            <p className="mt-1 text-[11px] text-slate-500">{description}</p>
          </article>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          <Panel>
            <PanelHeader
              title="1. Choose a legacy register"
              description="Preview is isolated from official supplier and contract records. Maximum 5 MB and 150 data rows per batch."
            />
            <div className="grid gap-4 p-5 md:grid-cols-[220px_minmax(0,1fr)_auto] md:items-end">
              <label className="text-[11px] font-medium text-slate-600">
                Register type
                <select
                  value={target}
                  onChange={(event) =>
                    setTarget(event.target.value as 'suppliers' | 'contracts')
                  }
                  className="mt-1 block h-10 w-full rounded-md border border-input bg-card px-3 text-xs"
                >
                  <option value="suppliers">Supplier register</option>
                  <option value="contracts">Contract register</option>
                </select>
              </label>
              <div className="text-[11px] font-medium text-slate-600">
                CSV or XLSX file
                <input
                  ref={fileInputRef}
                  id="bulk-import-file"
                  type="file"
                  accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="sr-only"
                  onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                />
                <div className="mt-1 flex h-10 items-center gap-2 rounded-md border border-input bg-card pl-3 pr-1">
                  <span
                    className={`min-w-0 flex-1 truncate text-xs ${file ? 'text-foreground' : 'text-slate-400'}`}
                  >
                    {file ? file.name : 'No file selected'}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 shrink-0 bg-card text-[11px]"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {file ? 'Replace' : 'Browse'}
                  </Button>
                </div>
              </div>
              <Button onClick={previewFile} disabled={!file || saving}>
                {saving ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <Upload className="size-4" />
                )}
                Create dry run
              </Button>
            </div>
          </Panel>

          {details ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
                {[
                  ['Rows', details.batch.total_rows],
                  ['Ready', details.batch.ready_rows],
                  ['Warnings', details.batch.warning_rows],
                  ['Duplicates', details.batch.duplicate_rows],
                  ['Invalid', details.batch.invalid_rows],
                  ['Accepted', details.batch.accepted_rows],
                ].map(([label, value]) => (
                  <article
                    key={String(label)}
                    className="rounded-xl border border-border bg-card p-4 shadow-sm"
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                      {label}
                    </p>
                    <p className="mt-2 text-xl font-semibold text-foreground">
                      {valueText(value)}
                    </p>
                  </article>
                ))}
              </div>

              <Panel>
                <PanelHeader
                  title="2. Confirm column mapping"
                  description={`Mapping version ${valueText(details.batch.mapping_version)} · required fields must have a source column.`}
                  action={
                    batchStatus === 'preview' ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={saving}
                        onClick={() =>
                          void patchBatch({ action: 'remap', batchId, mapping })
                        }
                      >
                        Re-run mapping
                      </Button>
                    ) : null
                  }
                />
                <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-3">
                  {details.fields.map((field) => (
                    <label
                      key={field.key}
                      className="text-[11px] font-medium text-slate-600"
                    >
                      {field.label}{' '}
                      {field.required ? (
                        <span className="text-rose-600">*</span>
                      ) : null}
                      <select
                        value={mapping[field.key] ?? ''}
                        disabled={batchStatus !== 'preview'}
                        onChange={(event) =>
                          setMapping((current) => ({
                            ...current,
                            [field.key]: event.target.value,
                          }))
                        }
                        className="mt-1 block h-9 w-full rounded-md border border-input bg-card px-2 text-[11px]"
                      >
                        <option value="">Not mapped</option>
                        {(details.batch.headers as string[]).map((header) => (
                          <option key={header} value={header}>
                            {header}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
              </Panel>

              <Panel>
                <PanelHeader
                  title="3. Resolve row-level quality results"
                  description="Possible matches require an explicit accept or skip. Exact duplicates and invalid rows must be corrected or skipped."
                  action={
                    batchStatus === 'preview' ? (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!reviewableRows.length || saving}
                          onClick={() =>
                            void patchBatch({
                              action: 'resolve',
                              batchId,
                              rowIds: reviewableRows.map((row) => row.id),
                              decision: 'accept',
                            })
                          }
                        >
                          Accept reviewable ({reviewableRows.length})
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!blockedRows.length || saving}
                          onClick={() =>
                            void patchBatch({
                              action: 'resolve',
                              batchId,
                              rowIds: blockedRows.map((row) => row.id),
                              decision: 'skip',
                            })
                          }
                        >
                          Skip blocked ({blockedRows.length})
                        </Button>
                      </div>
                    ) : null
                  }
                />
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="pl-5">Row / record</TableHead>
                        <TableHead>Normalized preview</TableHead>
                        <TableHead>Quality result</TableHead>
                        <TableHead>Decision</TableHead>
                        <TableHead className="pr-5 text-right">
                          Action
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visibleRows.map((row) => {
                        const recordLabel =
                          valueText(row.normalized.legal_name) ||
                          valueText(row.normalized.contract_number) ||
                          `Source row ${row.row_number}`;
                        const canAccept =
                          row.status !== 'invalid' &&
                          row.duplicate_type !== 'exact';
                        return (
                          <TableRow key={row.id} className="align-top">
                            <TableCell className="pl-5">
                              <p className="text-[11px] font-semibold text-accent-foreground">
                                Row {row.row_number} · {recordLabel}
                              </p>
                              <p className="mt-1 max-w-64 truncate text-[11px] text-slate-500">
                                {valueText(row.normalized.title) ||
                                  valueText(row.normalized.category)}
                              </p>
                            </TableCell>
                            <TableCell className="max-w-72">
                              <p className="text-[11px] leading-4 text-slate-600">
                                {Object.entries(row.normalized)
                                  .filter(
                                    ([, value]) =>
                                      value !== null && value !== '',
                                  )
                                  .slice(0, 5)
                                  .map(
                                    ([key, value]) =>
                                      `${titleCase(key)}: ${valueText(value)}`,
                                  )
                                  .join(' · ')}
                              </p>
                            </TableCell>
                            <TableCell className="max-w-80">
                              <StatusBadge
                                tone={
                                  row.status === 'ready'
                                    ? 'green'
                                    : row.status === 'warning'
                                      ? 'amber'
                                      : 'rose'
                                }
                              >
                                {titleCase(row.status)}
                              </StatusBadge>
                              {row.issues.length ? (
                                <ul className="mt-2 space-y-1 text-[11px] leading-4 text-slate-500">
                                  {row.issues.map((issue, index) => (
                                    <li key={`${issue.code}-${index}`}>
                                      • {issue.message}
                                    </li>
                                  ))}
                                </ul>
                              ) : null}
                            </TableCell>
                            <TableCell>
                              <StatusBadge
                                tone={
                                  row.decision === 'accept'
                                    ? 'green'
                                    : row.decision === 'skip'
                                      ? 'rose'
                                      : 'amber'
                                }
                              >
                                {titleCase(row.decision)}
                              </StatusBadge>
                            </TableCell>
                            <TableCell className="pr-5 text-right">
                              {batchStatus === 'preview' ? (
                                <div className="flex justify-end gap-1">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 px-2 text-[11px]"
                                    disabled={!canAccept || saving}
                                    onClick={() =>
                                      void patchBatch({
                                        action: 'resolve',
                                        batchId,
                                        rowIds: [row.id],
                                        decision: 'accept',
                                      })
                                    }
                                  >
                                    Accept
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 px-2 text-[11px]"
                                    disabled={saving}
                                    onClick={() =>
                                      void patchBatch({
                                        action: 'resolve',
                                        batchId,
                                        rowIds: [row.id],
                                        decision: 'skip',
                                      })
                                    }
                                  >
                                    Skip
                                  </Button>
                                </div>
                              ) : (
                                <span className="text-[11px] text-slate-500">
                                  {row.created_record_id
                                    ? `Created ${row.created_record_id}`
                                    : 'No official record'}
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                <TablePagination
                  label="Import row pagination"
                  page={safeRowPage}
                  pageSize={rowPageSize}
                  total={details.rows.length}
                  onPageChange={setRowPage}
                  onPageSizeChange={(nextPageSize) => {
                    setRowPageSize(nextPageSize);
                    setRowPage(1);
                  }}
                />
                <div className="flex flex-col justify-between gap-3 border-t border-border bg-muted px-5 py-4 sm:flex-row sm:items-center">
                  <div>
                    <p className="text-[11px] font-medium text-slate-700">
                      {pendingRows} unresolved ·{' '}
                      {valueText(details.batch.accepted_rows)} accepted ·{' '}
                      {valueText(details.batch.rejected_rows)} skipped
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      Dry run data remains isolated until commit.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <a
                      href={`/api/imports?id=${encodeURIComponent(batchId)}&format=corrections`}
                      className="inline-flex h-8 items-center gap-2 rounded-md border border-input bg-card px-3 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <Download className="size-3.5" /> Correction report
                    </a>
                    {batchStatus === 'preview' ? (
                      <Button
                        size="sm"
                        disabled={
                          saving ||
                          Boolean(pendingRows) ||
                          !Number(details.batch.accepted_rows)
                        }
                        onClick={() =>
                          void patchBatch({ action: 'commit', batchId })
                        }
                      >
                        <Database className="size-3.5" /> Commit accepted rows
                      </Button>
                    ) : null}
                    {batchStatus === 'committed' ? (
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={saving}
                        onClick={() => {
                          const reason = window.prompt(
                            'Enter the rollback reason (required for the audit trail):',
                          );
                          if (reason?.trim())
                            void patchBatch({
                              action: 'rollback',
                              batchId,
                              reason: reason.trim(),
                            });
                        }}
                      >
                        <RotateCcw className="size-3.5" /> Roll back batch
                      </Button>
                    ) : null}
                  </div>
                </div>
              </Panel>
            </>
          ) : (
            <Panel>
              <EmptyState
                title="No import preview selected"
                description="Upload a legacy register or open a prior batch from the audit history. Previewing never changes official data."
              />
            </Panel>
          )}

          <Panel className="overflow-hidden">
            <PanelHeader
              title="Register data quality"
              description="Deterministic exceptions found in records that are already official — the counterpart to the row checks above."
              action={
                <div className="flex flex-wrap gap-1.5">
                  <StatusBadge tone="rose">
                    {exceptionsByPriority.high} high
                  </StatusBadge>
                  <StatusBadge tone="amber">
                    {exceptionsByPriority.medium} medium
                  </StatusBadge>
                  <StatusBadge tone="blue">
                    {exceptionsByPriority.low} low
                  </StatusBadge>
                </div>
              }
            />
            <div className="grid gap-2 border-b border-border bg-muted p-5 sm:grid-cols-2 xl:grid-cols-3">
              {checkResults.map((check) => (
                <div
                  key={check.issue}
                  className={`flex items-start gap-2 rounded-lg border px-3 py-2 ${check.count ? 'border-amber-200 bg-amber-50' : 'border-[#dce7eb] bg-card'}`}
                >
                  {check.count ? (
                    <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-amber-600" />
                  ) : (
                    <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
                  )}
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium text-foreground">
                      {check.issue}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      {check.count
                        ? `${check.count} record${check.count === 1 ? '' : 's'} flagged`
                        : 'Clear'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            {registerExceptions.length ? (
              <div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-24 pl-5">Priority</TableHead>
                      <TableHead>Exception</TableHead>
                      <TableHead>Record</TableHead>
                      <TableHead className="pr-5">Detail</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {registerExceptions.slice(0, exceptionLimit).map((item) => (
                      <TableRow key={item.id} className="align-top">
                        <TableCell className="pl-5">
                          <StatusBadge
                            tone={
                              item.priority === 'high'
                                ? 'rose'
                                : item.priority === 'medium'
                                  ? 'amber'
                                  : 'blue'
                            }
                          >
                            {titleCase(item.priority)}
                          </StatusBadge>
                        </TableCell>
                        <TableCell className="text-[11px] font-medium text-foreground">
                          {item.issue}
                        </TableCell>
                        <TableCell className="text-[11px]">
                          <div className="font-medium text-accent-foreground">
                            {item.reference}
                          </div>
                          <div className="mt-1 max-w-56 truncate text-[11px] text-slate-500">
                            {item.label} · {titleCase(item.entityType)}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-80 whitespace-normal pr-5 text-[11px] leading-4 text-slate-600">
                          {item.reason}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-muted px-5 py-3 text-[11px] text-slate-500">
                  <span>
                    Showing{' '}
                    {Math.min(exceptionLimit, registerExceptions.length)} of{' '}
                    {registerExceptions.length} exception
                    {registerExceptions.length === 1 ? '' : 's'}.
                  </span>
                  {registerExceptions.length > exceptionLimit ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 bg-card text-[11px]"
                      onClick={() =>
                        setExceptionLimit(registerExceptions.length)
                      }
                    >
                      Show all
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : (
              <p className="px-5 py-4 text-[11px] text-slate-600">
                {workspace
                  ? `All ${checkResults.length} checks passed across ${recordsChecked} official record${recordsChecked === 1 ? '' : 's'}. Time-based follow-up (expiring documents, due obligations) is tracked in Obligations & Evidence.`
                  : 'Register records are still loading.'}
              </p>
            )}
          </Panel>
        </div>

        <Panel className="h-fit overflow-hidden">
          <PanelHeader
            title="Import audit history"
            description="Preview, commit, and rollback states are retained."
          />
          <div className="divide-y divide-[#e7ecef]">
            {loading ? (
              <div className="flex items-center gap-2 p-5 text-xs text-slate-500">
                <LoaderCircle className="size-4 animate-spin" /> Loading
                batches…
              </div>
            ) : batches.length ? (
              batches.map((batch) => (
                <button
                  key={String(batch.id)}
                  type="button"
                  onClick={() => void openBatch(String(batch.id))}
                  className="block w-full p-4 text-left transition hover:bg-[#f6fafb]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-[11px] font-semibold text-foreground">
                      {valueText(batch.file_name)}
                    </p>
                    <StatusBadge tone={toneForStatus(batch.status)}>
                      {titleCase(batch.status)}
                    </StatusBadge>
                  </div>
                  <p className="mt-2 text-[11px] text-slate-500">
                    {titleCase(batch.entity_type)} ·{' '}
                    {valueText(batch.total_rows)} rows ·{' '}
                    {usDateText(batch.created_at)}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    {valueText(batch.accepted_rows)} accepted ·{' '}
                    {valueText(batch.invalid_rows)} invalid ·{' '}
                    {valueText(batch.duplicate_rows)} duplicates
                  </p>
                </button>
              ))
            ) : (
              <EmptyState
                title="No import batches"
                description="Your first dry run will appear here."
              />
            )}
          </div>
        </Panel>
      </div>
    </>
  );
}
