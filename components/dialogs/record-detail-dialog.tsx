'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
import type { RecordDetails, Workspace } from '@/lib/contract-ledger-types';
import {
  AlertCircle,
  Building2,
  Download,
  ExternalLink,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  LoaderCircle,
  Plus,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AmendmentDialog } from '@/components/dialogs/amendment-dialog';
import {
  amendmentExtractionFields,
  dialogSurfaceClass,
  extractionFields,
} from '@/components/workspace/constants';
import type { ExtractionFieldKey } from '@/components/workspace/constants';
import {
  moneyFromCents,
  storedReviewValue,
  titleCase,
  toneForStatus,
  usDateText,
  valueText,
} from '@/components/workspace/formatters';
import { StatusBadge } from '@/components/workspace/primitives';
import { SupplierDocumentUpload } from '@/components/workspace/supplier-document-upload';
import type { DetailSelection } from '@/components/workspace/types';
import { useDraggableDialog } from '@/components/workspace/use-draggable-dialog';

export function RecordDetailDialog({
  workspace,
  selection,
  onClose,
  onRefresh,
}: {
  workspace: Workspace;
  selection: DetailSelection;
  onClose: () => void;
  onRefresh: () => Promise<void>;
}) {
  const contract =
    selection.type === 'contract'
      ? workspace.contracts.find((item) => item.id === selection.id)
      : null;
  const supplier =
    selection.type === 'supplier'
      ? workspace.suppliers.find((item) => item.id === selection.id)
      : workspace.suppliers.find((item) => item.id === contract?.supplier_id);
  const record = selection.type === 'contract' ? contract : supplier;
  const supplierRiskProfile = supplier
    ? workspace.supplierRiskProfiles?.[String(supplier.id)]
    : undefined;
  const [details, setDetails] = useState<RecordDetails>({
    documents: [],
    aiReviews: [],
    amendments: [],
    auditLogs: [],
    approvalRequests: [],
    approvalHistory: [],
  });
  const [detailsLoading, setDetailsLoading] = useState(true);
  const [detailsError, setDetailsError] = useState('');
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(
    null,
  );
  const [amendmentOpen, setAmendmentOpen] = useState(false);
  const [reviewPackageExporting, setReviewPackageExporting] = useState(false);
  const [reviewPackageError, setReviewPackageError] = useState('');
  const dialogRef = useRef<HTMLDialogElement>(null);
  const draggable = useDraggableDialog({ surfaceRef: dialogRef });
  const exportReviewPackage = async () => {
    if (!contract) return;
    setReviewPackageExporting(true);
    setReviewPackageError('');
    try {
      const response = await fetch('/api/review-package', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contractId: contract.id }),
      });
      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error || 'Unable to generate the review package.');
      }
      const blob = await response.blob();
      const disposition = response.headers.get('content-disposition') ?? '';
      const fileName =
        disposition.match(/filename="([^"]+)"/)?.[1] ??
        'ContractLedger_Operational_Review_Package.pdf';
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = fileName;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setReviewPackageError(
        error instanceof Error
          ? error.message
          : 'Unable to generate the review package.',
      );
    } finally {
      setReviewPackageExporting(false);
    }
  };
  const loadDetails = useCallback(async () => {
    setDetailsLoading(true);
    setDetailsError('');
    try {
      const response = await fetch(
        `/api/record-details?type=${encodeURIComponent(selection.type)}&id=${encodeURIComponent(selection.id)}`,
      );
      const body = (await response.json()) as RecordDetails & {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(body.error || 'Unable to load record details.');
      }
      setDetails(body);
      setSelectedDocumentId((current) => {
        const currentStillExists = body.documents.some(
          (item) => String(item.id) === current,
        );
        return currentStillExists
          ? current
          : body.documents[0]
            ? String(body.documents[0].id)
            : null;
      });
    } catch (error) {
      setDetails({
        documents: [],
        aiReviews: [],
        amendments: [],
        auditLogs: [],
        approvalRequests: [],
        approvalHistory: [],
      });
      setSelectedDocumentId(null);
      setDetailsError(
        error instanceof Error
          ? error.message
          : 'Unable to load record details.',
      );
    } finally {
      setDetailsLoading(false);
    }
  }, [selection.id, selection.type, setSelectedDocumentId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadDetails(), 0);
    return () => window.clearTimeout(timer);
  }, [loadDetails]);

  const documents = details.documents;
  if (!record) return null;
  const selectedDocument =
    documents.find((item) => String(item.id) === selectedDocumentId) ??
    documents[0];
  const aiReviews = selectedDocument
    ? details.aiReviews.filter(
        (item) => item.document_id === selectedDocument.id,
      )
    : [];
  const title =
    selection.type === 'contract'
      ? valueText(contract?.title)
      : valueText(supplier?.legal_name);
  const subtitle =
    selection.type === 'contract'
      ? valueText(contract?.contract_number)
      : `${valueText(supplier?.category)} supplier`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/25 p-4 backdrop-blur-[2px]"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <dialog
        ref={dialogRef}
        style={draggable.surfaceStyle}
        onPointerDown={draggable.onPointerDown}
        onPointerMove={draggable.onPointerMove}
        onPointerUp={draggable.onPointerUp}
        onPointerCancel={draggable.onPointerCancel}
        open
        aria-modal="true"
        aria-labelledby="detail-dialog-title"
        className={`${dialogSurfaceClass} overflow-y-auto`}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close details"
          className="absolute right-4 top-4 z-10 flex size-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
        >
          ×
        </button>
        <div
          data-dialog-drag-handle
          title="Drag to move dialog"
          className="cursor-move touch-none select-none border-b border-border px-6 py-5"
        >
          <div className="mb-1 flex items-center gap-2 pr-8 text-[11px] font-semibold uppercase tracking-[0.12em] text-accent-foreground">
            {selection.type === 'contract' ? (
              <FileCheck2 className="size-3.5" />
            ) : (
              <Building2 className="size-3.5" />
            )}
            {selection.type === 'contract'
              ? 'Contract source document'
              : 'Supplier qualification files'}
          </div>
          <div className="flex flex-col justify-between gap-3 pr-10 sm:flex-row sm:items-end">
            <div>
              <h2
                id="detail-dialog-title"
                className="text-xl font-semibold text-foreground"
              >
                {title}
              </h2>
              <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
            </div>
            {selection.type === 'contract' && contract ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void exportReviewPackage()}
                  disabled={reviewPackageExporting}
                >
                  {reviewPackageExporting ? (
                    <LoaderCircle className="animate-spin" />
                  ) : (
                    <Download />
                  )}
                  Review package PDF
                </Button>
                <Button
                  type="button"
                  onClick={() => setAmendmentOpen(true)}
                  className="bg-primary hover:bg-primary/90"
                >
                  <Plus /> Add amendment
                </Button>
              </div>
            ) : null}
          </div>
        </div>
        <div className="space-y-6 p-6">
          {detailsError ? (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertTitle>Record details unavailable</AlertTitle>
              <AlertDescription>{detailsError}</AlertDescription>
            </Alert>
          ) : null}
          {reviewPackageError ? (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertTitle>Review package unavailable</AlertTitle>
              <AlertDescription>{reviewPackageError}</AlertDescription>
            </Alert>
          ) : null}
          {selection.type === 'supplier' && supplierRiskProfile ? (
            <SupplierRiskProfilePanel profile={supplierRiskProfile} />
          ) : null}
          {selection.type === 'contract' && contract ? (
            <ContractVersionPanel
              contract={contract}
              amendments={details.amendments}
              auditLogs={details.auditLogs}
              loading={detailsLoading}
              onAddAmendment={() => setAmendmentOpen(true)}
            />
          ) : null}
          {selection.type === 'contract' && details.approvalRequests.length ? (
            <ExecutedApprovalHistory
              requests={details.approvalRequests}
              history={details.approvalHistory}
            />
          ) : null}
          {aiReviews.length ? <AIReviewTrail items={aiReviews} /> : null}
          <section>
            {detailsLoading ? (
              <div className="flex min-h-[360px] items-center justify-center rounded-xl border border-border bg-muted text-xs text-slate-500">
                <LoaderCircle className="mr-2 size-4 animate-spin" />
                Loading source files and AI review history…
              </div>
            ) : documents.length && selectedDocument ? (
              <div className="grid overflow-hidden rounded-xl border border-border bg-muted lg:grid-cols-[250px_minmax(0,1fr)]">
                <aside className="border-b border-border bg-card p-3 lg:border-b-0 lg:border-r">
                  <p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                    Available files
                  </p>
                  <div className="space-y-1">
                    {documents.map((item) => {
                      const active =
                        String(item.id) === String(selectedDocument.id);
                      return (
                        <button
                          key={String(item.id)}
                          type="button"
                          onClick={() => setSelectedDocumentId(String(item.id))}
                          className={`flex w-full items-start gap-2 rounded-lg px-2.5 py-2.5 text-left ${active ? 'bg-accent text-accent-foreground' : 'text-slate-600 hover:bg-slate-50'}`}
                        >
                          <FileText className="mt-0.5 size-4 shrink-0" />
                          <span className="min-w-0">
                            <span className="block truncate text-xs font-medium">
                              {valueText(item.file_name)}
                            </span>
                            <span className="mt-0.5 block text-[11px] opacity-70">
                              {titleCase(item.file_type)} ·{' '}
                              {valueText(item.review_status)}
                            </span>
                            {item.issuer || item.document_number ? (
                              <span className="mt-0.5 block truncate text-[11px] opacity-70">
                                {valueText(item.issuer)} ·{' '}
                                {valueText(item.document_number)}
                              </span>
                            ) : null}
                            {item.expiration_date ? (
                              <span className="mt-0.5 block text-[11px] opacity-70">
                                Expires {valueText(item.expiration_date)}
                              </span>
                            ) : null}
                            {item.coverage_summary ? (
                              <span className="mt-0.5 block line-clamp-2 text-[11px] opacity-70">
                                {valueText(item.coverage_summary)}
                              </span>
                            ) : null}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </aside>
                <div className="min-w-0 bg-muted">
                  <div className="flex items-center justify-between gap-3 border-b border-border bg-card px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-foreground">
                        {valueText(selectedDocument.file_name)}
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        Original file content ·{' '}
                        {titleCase(selectedDocument.mime_type)}
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        {titleCase(selectedDocument.file_type)} · Review{' '}
                        {titleCase(selectedDocument.review_status)} · Issuer{' '}
                        {valueText(selectedDocument.issuer)} · Document no.{' '}
                        {valueText(selectedDocument.document_number)} ·
                        Effective {valueText(selectedDocument.effective_date)} ·
                        Expires {valueText(selectedDocument.expiration_date)} ·
                        Summary {valueText(selectedDocument.coverage_summary)}
                      </p>
                    </div>
                    <a
                      href={`/api/document?id=${encodeURIComponent(String(selectedDocument.id))}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-[11px] font-medium text-accent-foreground"
                    >
                      <ExternalLink className="size-3.5" />
                      Open separately
                    </a>
                  </div>
                  <iframe
                    title={valueText(selectedDocument.file_name)}
                    src={`/api/document?id=${encodeURIComponent(String(selectedDocument.id))}`}
                    className="h-[62vh] min-h-[520px] w-full bg-card"
                  />
                </div>
              </div>
            ) : (
              <div className="flex min-h-[360px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted px-6 text-center">
                <span className="flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
                  <FileText className="size-6" />
                </span>
                <h3 className="mt-4 text-sm font-semibold text-foreground">
                  {selection.type === 'contract'
                    ? 'No executed source document linked'
                    : 'No supplier qualification file linked'}
                </h3>
                <p className="mt-2 max-w-md text-xs leading-5 text-slate-500">
                  {selection.type === 'contract'
                    ? 'This legacy register record has no digital file attached. Use Register executed contract from the Contract Register and its verified PDF will open here as the source of truth.'
                    : 'The status may come from a legacy register, but no digital file is attached. Upload the applicable W-9, insurance, registration, license, or risk-review evidence below.'}
                </p>
              </div>
            )}
          </section>

          {selection.type === 'supplier' && supplier ? (
            <SupplierDocumentUpload
              supplierId={String(supplier.id)}
              supplierName={String(supplier.legal_name)}
              documents={details?.documents ?? []}
              onUploaded={async () => {
                await onRefresh();
                await loadDetails();
              }}
            />
          ) : null}
        </div>
      </dialog>
      {selection.type === 'contract' && contract ? (
        <AmendmentDialog
          open={amendmentOpen}
          contract={contract}
          onOpenChange={setAmendmentOpen}
          onApplied={async () => {
            await onRefresh();
            await loadDetails();
          }}
        />
      ) : null}
    </div>
  );
}

export function SupplierRiskProfilePanel({
  profile,
}: {
  profile: NonNullable<Workspace['supplierRiskProfiles']>[string];
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-[#cbdcdf] bg-card">
      <div className="flex flex-col justify-between gap-3 border-b border-border bg-muted px-5 py-4 sm:flex-row sm:items-start">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-accent-foreground" />
            <h3 className="text-sm font-semibold text-foreground">
              Explainable supplier risk profile
            </h3>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            Deterministic {profile.version} rules as of {profile.asOfDate}; no
            model-generated score.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge
            tone={
              profile.level === 'high'
                ? 'rose'
                : profile.level === 'medium'
                  ? 'amber'
                  : 'green'
            }
          >
            {titleCase(profile.level)} risk
          </StatusBadge>
          <Badge variant="outline">{profile.score} points</Badge>
        </div>
      </div>
      <div className="p-4">
        <p className="mb-3 text-[11px] text-slate-600">{profile.summary}</p>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {profile.factors.map((factor) => (
            <article
              key={factor.key}
              className="rounded-lg border border-border p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-[11px] font-semibold text-foreground">
                  {factor.label}
                </p>
                <StatusBadge
                  tone={
                    factor.status === 'high_risk'
                      ? 'rose'
                      : factor.status === 'attention'
                        ? 'amber'
                        : factor.status === 'satisfied'
                          ? 'green'
                          : 'slate'
                  }
                >
                  +{factor.points}
                </StatusBadge>
              </div>
              <p className="mt-2 text-[11px] leading-4 text-slate-600">
                {factor.explanation}
              </p>
              <p className="mt-2 border-t border-border pt-2 text-[11px] leading-4 text-slate-500">
                Evidence: {factor.evidence}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function ExecutedApprovalHistory({
  requests,
  history,
}: {
  requests: RecordDetails['approvalRequests'];
  history: RecordDetails['approvalHistory'];
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-[#cbdcdf] bg-card">
      <div className="flex items-start justify-between gap-3 border-b border-border bg-muted px-5 py-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-accent-foreground" />
            <h3 className="text-sm font-semibold text-foreground">
              Pre-execution approval history
            </h3>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            Approval evidence remains attached after the agreement enters the
            official register.
          </p>
        </div>
        <Badge variant="outline">{requests.length} control(s)</Badge>
      </div>
      <div className="grid gap-3 p-4 lg:grid-cols-2">
        {requests.map((request) => {
          const latestDecision = history.find(
            (item) => item.request_id === request.request_id,
          );
          return (
            <article
              key={String(request.request_id)}
              className="rounded-lg border border-border p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold text-foreground">
                    {valueText(request.rule_name)}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Rule {valueText(request.rule_key)} v
                    {valueText(request.rule_version)} ·{' '}
                    {valueText(request.owner_role)}
                  </p>
                </div>
                <StatusBadge tone={toneForStatus(request.request_status)}>
                  {titleCase(request.request_status)}
                </StatusBadge>
              </div>
              <p className="mt-2 text-[11px] leading-4 text-slate-600">
                {valueText(request.reason)}
              </p>
              {latestDecision ? (
                <p className="mt-2 border-t border-border pt-2 text-[11px] text-slate-500">
                  Latest: {titleCase(latestDecision.action)} by{' '}
                  {valueText(latestDecision.actor)} (
                  {valueText(latestDecision.actor_role)}) ·{' '}
                  {valueText(latestDecision.created_at)}
                </p>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}

export function ContractVersionPanel({
  contract,
  amendments,
  auditLogs,
  loading,
  onAddAmendment,
}: {
  contract: Record<string, string | number | null>;
  amendments: RecordDetails['amendments'];
  auditLogs: RecordDetails['auditLogs'];
  loading: boolean;
  onAddAmendment: () => void;
}) {
  const ordered = [...amendments].sort(
    (a, b) => Number(a.version_number) - Number(b.version_number),
  );
  const amendmentAudits = auditLogs.filter(
    (item) => item.action === 'amendment_applied',
  );
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-muted">
      <div className="flex flex-col justify-between gap-3 border-b border-[#d6e4e9] px-5 py-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <FileSpreadsheet className="size-4 text-accent-foreground" />
            <h3>Contract version lifecycle</h3>
            <StatusBadge tone="blue">
              Version {valueText(contract.current_version ?? 1)}
            </StatusBadge>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            Original agreement, verified amendments, current effective terms,
            and change history.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={onAddAmendment}
          className="bg-primary hover:bg-primary/90"
        >
          <Plus /> Add amendment
        </Button>
      </div>
      <div className="grid gap-3 border-b border-[#dbe6ea] bg-card p-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['Original value', moneyFromCents(contract.original_value_cents)],
          ['Amendment value', moneyFromCents(contract.amendment_value_cents)],
          ['Current value', moneyFromCents(contract.current_value_cents)],
          ['Current expiration', usDateText(contract.expiration_date)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg bg-muted px-3 py-3">
            <p className="text-[11px] text-slate-500">{label}</p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {value}
            </p>
          </div>
        ))}
      </div>
      <div className="p-4">
        <div className="relative space-y-3 before:absolute before:bottom-5 before:left-[17px] before:top-5 before:w-px before:bg-[#c8dce3]">
          <div className="relative flex gap-3 rounded-lg border border-border bg-card p-3">
            <span className="z-10 flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-accent-foreground">
              V1
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold text-foreground">
                  Original executed agreement
                </p>
                <StatusBadge tone={ordered.length ? 'slate' : 'green'}>
                  {ordered.length ? 'Superseded terms' : 'Current terms'}
                </StatusBadge>
              </div>
              <p className="mt-1 text-[11px] text-slate-500">
                Effective {usDateText(contract.effective_date)} · Original value{' '}
                {moneyFromCents(contract.original_value_cents)}
              </p>
            </div>
          </div>
          {ordered.map((item) => (
            <div
              key={String(item.id)}
              className="relative flex gap-3 rounded-lg border border-border bg-card p-3"
            >
              <span className="z-10 flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-accent-foreground">
                V{valueText(item.version_number)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold text-foreground">
                      {valueText(item.amendment_number)} ·{' '}
                      {titleCase(item.amendment_type)}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      Signed {usDateText(item.signed_date)} · Applied by{' '}
                      {valueText(item.created_by)}
                    </p>
                  </div>
                  <StatusBadge
                    tone={item.version_status === 'current' ? 'green' : 'slate'}
                  >
                    {titleCase(item.version_status)}
                  </StatusBadge>
                </div>
                <div className="mt-3 grid gap-2 text-[11px] sm:grid-cols-3">
                  <div className="rounded-md bg-muted px-2.5 py-2">
                    <span className="text-slate-500">Value</span>
                    <span className="ml-2 font-semibold text-foreground">
                      {moneyFromCents(item.previous_value_cents)} →{' '}
                      {moneyFromCents(item.resulting_value_cents)}
                    </span>
                  </div>
                  <div className="rounded-md bg-muted px-2.5 py-2">
                    <span className="text-slate-500">Expiration</span>
                    <span className="ml-2 font-semibold text-foreground">
                      {usDateText(item.previous_expiration_date)} →{' '}
                      {usDateText(item.new_expiration_date)}
                    </span>
                  </div>
                  <div className="rounded-md bg-muted px-2.5 py-2">
                    <span className="text-slate-500">Net change</span>
                    <span className="ml-2 font-semibold text-foreground">
                      {moneyFromCents(item.value_change_cents)}
                    </span>
                  </div>
                </div>
                {item.scope_summary ? (
                  <p className="mt-2 text-[11px] leading-4 text-slate-500">
                    {valueText(item.scope_summary)}
                  </p>
                ) : null}
              </div>
            </div>
          ))}
        </div>
        {!loading && !ordered.length ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-[#bdd4dc] bg-card px-4 py-3">
            <p className="text-[11px] text-slate-500">
              No amendment has been recorded for this contract.
            </p>
            <Button variant="outline" size="sm" onClick={onAddAmendment}>
              <Plus /> Record the first amendment
            </Button>
          </div>
        ) : null}
        {amendmentAudits.length ? (
          <p className="mt-3 text-[11px] text-slate-500">
            {amendmentAudits.length} amendment audit event
            {amendmentAudits.length === 1 ? '' : 's'} retained.
          </p>
        ) : null}
      </div>
    </section>
  );
}

export function AIReviewTrail({
  items,
}: {
  items: RecordDetails['aiReviews'];
}) {
  const grouped = new Map<string, RecordDetails['aiReviews']>();
  items.forEach((item) => {
    const key = String(item.analysis_run_id);
    grouped.set(key, [...(grouped.get(key) ?? []), item]);
  });

  return (
    <div className="space-y-4">
      {[...grouped.entries()].map(([analysisRunId, runItems]) => (
        <AIReviewRunTrail key={analysisRunId} items={runItems} />
      ))}
    </div>
  );
}

export function AIReviewRunTrail({
  items,
}: {
  items: RecordDetails['aiReviews'];
}) {
  const run = items[0];
  const labelByField: Record<string, string> = {
    ...Object.fromEntries(extractionFields),
    ...Object.fromEntries(amendmentExtractionFields),
    supplierLegalName: 'Supplier legal name',
    documentType: 'Document type',
    issuer: 'Issuer / authority',
    documentNumber: 'Document / policy number',
    effectiveDate: 'Effective date',
    expirationDate: 'Expiration date',
    coverageSummary: 'Coverage / qualification summary',
  };
  const orderedItems = [...items].sort((a, b) => {
    const order = [
      ...extractionFields.map(([fieldName]) => fieldName),
      ...amendmentExtractionFields.map(([fieldName]) => fieldName),
      'documentType',
      'issuer',
      'documentNumber',
      'coverageSummary',
    ];
    return (
      order.indexOf(String(a.field_name) as ExtractionFieldKey) -
      order.indexOf(String(b.field_name) as ExtractionFieldKey)
    );
  });

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-muted">
      <div className="flex flex-col justify-between gap-3 border-b border-[#d6e4e9] px-5 py-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Sparkles className="size-4 text-accent-foreground" />
            <h3 className="text-sm font-semibold text-foreground">
              {run.stage === 'supplier_document'
                ? 'AI supplier-document audit trail'
                : run.stage === 'amendment'
                  ? 'AI amendment delta audit trail'
                  : 'AI contract extraction audit trail'}
            </h3>
            <StatusBadge
              tone={Number(run.correction_count ?? 0) ? 'amber' : 'green'}
            >
              {valueText(run.correction_count)} human corrections
            </StatusBadge>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            {valueText(run.model)} · Playbook {valueText(run.prompt_version)} ·
            Reviewed by {valueText(run.reviewed_by)} on{' '}
            {valueText(run.reviewed_at)}
          </p>
        </div>
        <StatusBadge tone="green">Human verified</StatusBadge>
      </div>
      <div className="overflow-x-auto">
        <Table className="min-w-[900px]">
          <TableHeader>
            <TableRow className="bg-card">
              <TableHead className="px-5">Field</TableHead>
              <TableHead>AI original</TableHead>
              <TableHead>Verified value</TableHead>
              <TableHead>Decision</TableHead>
              <TableHead>Confidence</TableHead>
              <TableHead className="pr-5">Source</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orderedItems.map((item) => (
              <TableRow key={String(item.id)}>
                <TableCell className="px-5 text-xs font-medium text-foreground">
                  {labelByField[String(item.field_name)] ??
                    titleCase(item.field_name)}
                </TableCell>
                <TableCell className="max-w-[190px] text-xs text-slate-500">
                  {storedReviewValue(item.original_value_json)}
                </TableCell>
                <TableCell className="max-w-[190px] text-xs font-medium text-foreground">
                  {storedReviewValue(item.verified_value_json)}
                </TableCell>
                <TableCell>
                  <StatusBadge
                    tone={
                      item.review_status === 'corrected' ? 'amber' : 'green'
                    }
                  >
                    {titleCase(item.review_status)}
                  </StatusBadge>
                </TableCell>
                <TableCell className="text-xs">
                  {Math.round(Number(item.confidence ?? 0) * 100)}%
                </TableCell>
                <TableCell className="max-w-[280px] pr-5 text-[11px] leading-4 text-slate-500">
                  {item.source_page ? `Page ${item.source_page}` : 'No page'}
                  {item.source_quote ? ` · “${item.source_quote}”` : ''}
                  {item.override_reason
                    ? ` · Override: ${valueText(item.override_reason)}`
                    : ''}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
