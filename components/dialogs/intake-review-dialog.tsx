'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type {
  ExtractedField,
  IntakeDetails,
  Workspace,
} from '@/lib/contract-ledger-types';
import {
  AlertCircle,
  Building2,
  Check,
  ExternalLink,
  FileSearch,
  FileText,
  LoaderCircle,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { extractionFields } from '@/components/workspace/constants';
import {
  moneyFromCents,
  titleCase,
  toneForStatus,
  valueText,
} from '@/components/workspace/formatters';
import {
  FieldConfidence,
  StatusBadge,
} from '@/components/workspace/primitives';
import { useDraggableDialog } from '@/components/workspace/use-draggable-dialog';

export function IntakeReviewDialog({
  intakeId,
  onClose,
  onUpdated,
  onOpenSupplier,
}: {
  intakeId: string;
  onClose: () => void;
  onUpdated: (workspace: Workspace) => void;
  onOpenSupplier: (supplierId: string) => void;
}) {
  const [details, setDetails] = useState<IntakeDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('under_review');
  const [owner, setOwner] = useState('');
  const [targetReviewDate, setTargetReviewDate] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [findingStatuses, setFindingStatuses] = useState<
    Record<string, string>
  >({});
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(
    null,
  );
  const dialogRef = useRef<HTMLDialogElement>(null);
  const draggable = useDraggableDialog({ surfaceRef: dialogRef });

  const applyDetails = useCallback((nextDetails: IntakeDetails) => {
    setDetails(nextDetails);
    setStatus(String(nextDetails.intake.status ?? 'under_review'));
    setOwner(String(nextDetails.intake.owner ?? 'Selina Armstrong'));
    setTargetReviewDate(String(nextDetails.intake.target_review_date ?? ''));
    setInternalNotes(String(nextDetails.intake.internal_notes ?? ''));
    setFindingStatuses(
      Object.fromEntries(
        nextDetails.findings.map((finding) => [
          String(finding.id),
          String(finding.status ?? 'open'),
        ]),
      ),
    );
    setSelectedDocumentId((current) =>
      nextDetails.documents.some((item) => String(item.id) === current)
        ? current
        : nextDetails.documents[0]
          ? String(nextDetails.documents[0].id)
          : null,
    );
  }, []);

  const loadDetails = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(
        `/api/intakes?id=${encodeURIComponent(intakeId)}`,
      );
      const body = (await response.json()) as IntakeDetails & {
        error?: string;
      };
      if (!response.ok)
        throw new Error(body.error || 'Unable to load this review intake.');
      applyDetails(body);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to load this review intake.',
      );
    } finally {
      setLoading(false);
    }
  }, [applyDetails, intakeId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadDetails(), 0);
    return () => window.clearTimeout(timer);
  }, [loadDetails]);

  const saveWorkflow = async () => {
    if (!details) return;
    setSaving(true);
    setError('');
    try {
      const response = await fetch('/api/intakes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: intakeId,
          status,
          owner,
          targetReviewDate,
          internalNotes,
          findings: details.findings.map((finding) => ({
            id: String(finding.id),
            status: findingStatuses[String(finding.id)] ?? 'open',
          })),
        }),
      });
      const body = (await response.json()) as {
        saved?: boolean;
        details?: IntakeDetails;
        workspace?: Workspace;
        error?: string;
      };
      if (!response.ok || !body.details || !body.workspace)
        throw new Error(body.error || 'Unable to save the review workflow.');
      applyDetails(body.details);
      onUpdated(body.workspace);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Unable to save the review workflow.',
      );
    } finally {
      setSaving(false);
    }
  };

  const selectedDocument =
    details?.documents.find((item) => String(item.id) === selectedDocumentId) ??
    details?.documents[0];
  const analysis = details?.analysis;
  const supplier = details?.supplier;
  const openApprovalCount = Number(details?.intake.open_approval_count ?? 0);
  const analysisSummary = analysis
    ? extractionFields.map(([fieldName, label]) => ({
        fieldName,
        label,
        field: analysis[fieldName] as ExtractedField,
      }))
    : [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/25 p-4 backdrop-blur-[2px]"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
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
        aria-labelledby="intake-review-dialog-title"
        className="m-0 grid h-[88vh] min-h-[660px] w-[96vw] max-w-[1440px] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-xl bg-white p-0 text-sm shadow-2xl ring-1 ring-slate-900/10"
      >
        <header
          data-dialog-drag-handle
          title="Drag to move dialog"
          className="relative cursor-move touch-none select-none border-b border-[#e1e7ea] px-6 py-4"
        >
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close contract review workspace"
            className="absolute right-4 top-4 flex size-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
          >
            ×
          </button>
          <div className="flex flex-wrap items-center gap-2 pr-10 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#347d96]">
            <FileSearch className="size-3.5" /> AI contract review workspace
            {details ? (
              <StatusBadge tone={toneForStatus(details.intake.status)}>
                {titleCase(details.intake.status)}
              </StatusBadge>
            ) : null}
          </div>
          <h2
            id="intake-review-dialog-title"
            className="mt-1 pr-10 text-xl font-semibold text-[#183040]"
          >
            {details ? valueText(details.intake.title) : 'Loading review…'}
          </h2>
          {details ? (
            <p className="mt-1 text-xs text-slate-500">
              {valueText(details.intake.intake_number)} ·{' '}
              {valueText(details.intake.proposed_supplier_name)} ·{' '}
              {moneyFromCents(details.intake.proposed_value_cents)} proposed
            </p>
          ) : null}
        </header>

        {loading ? (
          <div className="flex min-h-0 items-center justify-center">
            <LoaderCircle className="mr-2 size-5 animate-spin text-[#287d9b]" />
            <span className="text-xs text-slate-500">
              Loading source document and review history…
            </span>
          </div>
        ) : details ? (
          <div className="grid min-h-0 overflow-hidden xl:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
            <section className="min-h-0 border-b border-[#dce3e8] bg-[#eef2f4] xl:border-b-0 xl:border-r">
              <div className="flex items-center justify-between gap-3 border-b border-[#d7e1e6] bg-white px-4 py-3">
                <div>
                  <h3 className="text-xs font-semibold text-[#203845]">
                    Draft source document
                  </h3>
                  <p className="mt-0.5 text-[10px] text-slate-500">
                    Read the original language beside the AI findings.
                  </p>
                </div>
                {selectedDocument ? (
                  <a
                    href={`/api/document?id=${encodeURIComponent(String(selectedDocument.id))}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#d4dfe4] bg-white px-3 text-[10px] font-medium text-[#27657c]"
                  >
                    <ExternalLink className="size-3.5" /> Open separately
                  </a>
                ) : null}
              </div>
              {details.documents.length > 1 ? (
                <div className="flex gap-2 overflow-x-auto border-b border-[#d7e1e6] bg-white px-4 py-2">
                  {details.documents.map((document) => (
                    <button
                      key={String(document.id)}
                      type="button"
                      onClick={() => setSelectedDocumentId(String(document.id))}
                      className={`shrink-0 rounded-md px-3 py-1.5 text-[10px] ${String(document.id) === String(selectedDocument?.id) ? 'bg-[#dff0f5] font-semibold text-[#1d647d]' : 'bg-slate-50 text-slate-500'}`}
                    >
                      {valueText(document.file_name)}
                    </button>
                  ))}
                </div>
              ) : null}
              {selectedDocument ? (
                <iframe
                  title={valueText(selectedDocument.file_name)}
                  src={`/api/document?id=${encodeURIComponent(String(selectedDocument.id))}`}
                  className="h-[calc(88vh-164px)] min-h-[520px] w-full bg-white"
                />
              ) : (
                <div className="flex h-full min-h-[420px] flex-col items-center justify-center px-6 text-center text-xs text-slate-500">
                  <FileText className="mb-3 size-7 text-slate-300" />
                  No draft source document is linked to this seeded intake.
                </div>
              )}
            </section>

            <section className="min-h-0 overflow-y-auto px-5 py-4">
              <div className="space-y-4">
                <article className="rounded-xl border border-[#c9dbe2] bg-[#f6fbfc] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-[#203845]">
                        AI review summary
                      </h3>
                      <p className="mt-1 text-[10px] text-slate-500">
                        {valueText(details.analysisMeta?.model)} · reviewed by{' '}
                        {valueText(details.analysisMeta?.reviewed_by)} ·{' '}
                        {valueText(details.analysisMeta?.correction_count)}{' '}
                        human correction(s)
                      </p>
                    </div>
                    <StatusBadge
                      tone={
                        details.intake.risk_level === 'high'
                          ? 'rose'
                          : details.intake.risk_level === 'medium'
                            ? 'amber'
                            : 'green'
                      }
                    >
                      {titleCase(details.intake.risk_level)} risk
                    </StatusBadge>
                  </div>
                  {analysisSummary.length ? (
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {analysisSummary.map(({ fieldName, label, field }) => (
                        <div
                          key={fieldName}
                          className="rounded-lg border border-[#dce7eb] bg-white px-3 py-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[9px] font-semibold uppercase tracking-[0.06em] text-slate-500">
                              {label}
                            </span>
                            <FieldConfidence field={field} />
                          </div>
                          <p className="mt-1 truncate text-[11px] font-medium text-[#294354]">
                            {fieldName === 'contractValue'
                              ? moneyFromCents(Number(field.value ?? 0) * 100)
                              : valueText(field.value)}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-[10px] text-slate-500">
                      This seeded intake predates the stored AI summary.
                    </p>
                  )}
                </article>

                <article className="rounded-xl border border-[#dce3e8] bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-[#203845]">
                        Supplier handling
                      </h3>
                      <p className="mt-1 text-[10px] text-slate-500">
                        Draft review records the proposed supplier name only. It
                        does not create or update the Supplier Register.
                      </p>
                    </div>
                    {supplier ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onOpenSupplier(String(supplier.id))}
                      >
                        <Building2 /> Open supplier record
                      </Button>
                    ) : null}
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {[
                      [
                        'Proposed supplier',
                        details.intake.proposed_supplier_name,
                      ],
                      [
                        'Supplier register link',
                        supplier?.legal_name ?? 'Not created from draft',
                      ],
                      [
                        'Link timing',
                        supplier
                          ? 'Linked after executed contract registration'
                          : 'Available after executed contract registration',
                      ],
                    ].map(([label, value]) => (
                      <div
                        key={String(label)}
                        className="rounded-lg bg-slate-50 px-3 py-2"
                      >
                        <div className="text-[9px] font-semibold uppercase tracking-[0.06em] text-slate-500">
                          {label}
                        </div>
                        <div className="mt-1 text-[11px] font-medium text-[#294354]">
                          {label === 'Proposed supplier' ||
                          label === 'Supplier register link' ||
                          label === 'Link timing'
                            ? valueText(value)
                            : titleCase(value)}
                        </div>
                      </div>
                    ))}
                  </div>
                </article>

                <article>
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-[#203845]">
                        Playbook differences and negotiation support
                      </h3>
                      <p className="mt-1 text-[10px] text-slate-500">
                        Suggested language is an AI drafting aid—not legal
                        advice or an automatic redline.
                      </p>
                    </div>
                    <Badge variant="outline">
                      {details.findings.length} finding(s)
                    </Badge>
                  </div>
                  <div className="mt-3 space-y-3">
                    {details.findings.length ? (
                      details.findings.map((finding) => {
                        const suggested = valueText(
                          finding.suggested_revision ?? finding.standard_text,
                        );
                        return (
                          <div
                            key={String(finding.id)}
                            className="rounded-xl border border-[#dce3e8] bg-white p-4"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <h4 className="text-xs font-semibold text-[#203845]">
                                  {valueText(finding.rule_name)}
                                </h4>
                                <p className="mt-1 text-[10px] text-slate-500">
                                  Page {valueText(finding.source_page)}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <StatusBadge
                                  tone={
                                    finding.severity === 'high'
                                      ? 'rose'
                                      : 'amber'
                                  }
                                >
                                  {titleCase(finding.severity)}
                                </StatusBadge>
                                <select
                                  aria-label={`${valueText(finding.rule_name)} finding status`}
                                  value={
                                    findingStatuses[String(finding.id)] ??
                                    'open'
                                  }
                                  onChange={(event) =>
                                    setFindingStatuses((current) => ({
                                      ...current,
                                      [String(finding.id)]: event.target.value,
                                    }))
                                  }
                                  className="h-8 rounded-md border border-input bg-white px-2 text-[10px]"
                                >
                                  <option value="open">Open</option>
                                  <option value="accepted">
                                    Risk accepted
                                  </option>
                                  <option value="resolved">Resolved</option>
                                  <option value="dismissed">Dismissed</option>
                                </select>
                              </div>
                            </div>
                            <div className="mt-3 grid gap-2">
                              <div className="rounded-lg bg-rose-50 px-3 py-2">
                                <span className="text-[9px] font-semibold uppercase text-rose-700">
                                  Contract language
                                </span>
                                <p className="mt-1 text-[10px] leading-4 text-rose-900">
                                  {valueText(finding.observed_text)}
                                </p>
                              </div>
                              <div className="rounded-lg bg-slate-50 px-3 py-2">
                                <span className="text-[9px] font-semibold uppercase text-slate-600">
                                  Playbook position
                                </span>
                                <p className="mt-1 text-[10px] leading-4 text-slate-700">
                                  {valueText(finding.standard_text)}
                                </p>
                              </div>
                              <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-[9px] font-semibold uppercase text-sky-700">
                                    Suggested revision
                                  </span>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      void navigator.clipboard.writeText(
                                        suggested,
                                      )
                                    }
                                    className="h-6 px-2 text-[9px] text-sky-700"
                                  >
                                    Copy language
                                  </Button>
                                </div>
                                <p className="mt-1 text-[10px] leading-4 text-sky-900">
                                  {suggested}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800">
                        No open playbook differences are stored for this intake.
                      </div>
                    )}
                  </div>
                </article>

                <article className="rounded-xl border border-[#cbd9df] bg-[#f8fafb] p-4">
                  <h3 className="text-sm font-semibold text-[#203845]">
                    Review workflow
                  </h3>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <label
                      htmlFor="review-workflow-owner"
                      className="text-[10px] font-medium text-slate-600"
                    >
                      Review owner
                      <Input
                        id="review-workflow-owner"
                        value={owner}
                        onChange={(event) => setOwner(event.target.value)}
                        className="mt-1 bg-white text-xs"
                      />
                    </label>
                    <label
                      htmlFor="review-workflow-target-date"
                      className="text-[10px] font-medium text-slate-600"
                    >
                      Target review date
                      <Input
                        id="review-workflow-target-date"
                        type="date"
                        value={targetReviewDate}
                        onChange={(event) =>
                          setTargetReviewDate(event.target.value)
                        }
                        className="mt-1 bg-white text-xs"
                      />
                    </label>
                    <label className="text-[10px] font-medium text-slate-600">
                      Workflow status
                      <select
                        value={status}
                        onChange={(event) => setStatus(event.target.value)}
                        className="mt-1 h-9 w-full rounded-md border border-input bg-white px-3 text-xs"
                      >
                        <option value="draft">New</option>
                        <option value="under_review">Under review</option>
                        <option value="waiting_on_business">
                          Waiting on business
                        </option>
                        <option value="waiting_on_legal">
                          Waiting on legal
                        </option>
                        <option value="revision_requested">
                          Revision requested
                        </option>
                        <option value="approved_for_signature">
                          Approved for signature
                        </option>
                        <option value="not_awarded">
                          Rejected / not awarded
                        </option>
                      </select>
                    </label>
                    <div className="rounded-lg border border-[#dce3e8] bg-white px-3 py-2">
                      <p className="text-[9px] font-semibold uppercase text-slate-500">
                        Mandatory approval gate
                      </p>
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <StatusBadge
                          tone={toneForStatus(details.intake.approval_status)}
                        >
                          {titleCase(details.intake.approval_status)}
                        </StatusBadge>
                        <span className="text-[10px] text-slate-500">
                          {openApprovalCount} open
                        </span>
                      </div>
                    </div>
                  </div>
                  <label className="mt-3 block text-[10px] font-medium text-slate-600">
                    Internal review notes
                    <textarea
                      value={internalNotes}
                      onChange={(event) => setInternalNotes(event.target.value)}
                      rows={3}
                      className="mt-1 w-full rounded-md border border-input bg-white px-3 py-2 text-xs"
                      placeholder="Record negotiation position, business input, approval rationale, or next step…"
                    />
                  </label>
                  {details.approvalRequests.length ? (
                    <p className="mt-2 text-[10px] text-amber-700">
                      Versioned approval requests are controlled in Approvals &
                      Exceptions. This intake cannot advance to Approved for
                      signature while {openApprovalCount} mandatory request
                      {openApprovalCount === 1 ? '' : 's'} remain open.
                    </p>
                  ) : null}
                </article>
              </div>
            </section>
          </div>
        ) : (
          <div className="flex min-h-0 items-center justify-center px-6 text-center">
            <Alert variant="destructive" className="max-w-lg">
              <AlertCircle />
              <AlertTitle>Review intake unavailable</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </div>
        )}

        <footer className="flex items-center justify-between gap-3 border-t border-[#e1e7ea] bg-white px-6 py-4">
          <span className="text-[10px] text-rose-600">
            {details ? error : ''}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>
              Close
            </Button>
            <Button
              onClick={() => void saveWorkflow()}
              disabled={!details || saving || !owner.trim()}
              className="bg-[#1d718f] hover:bg-[#185f78]"
            >
              {saving ? <LoaderCircle className="animate-spin" /> : <Check />}
              Save review workflow
            </Button>
          </div>
        </footer>
      </dialog>
    </div>
  );
}
