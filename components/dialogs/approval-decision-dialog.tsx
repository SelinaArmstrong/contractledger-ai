'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type {
  ApprovalRequestDetails,
  Workspace,
} from '@/lib/contract-ledger-types';
import {
  AlertCircle,
  Check,
  CircleCheck,
  ExternalLink,
  FileSearch,
  LoaderCircle,
  ShieldCheck,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  approvalActionLabels,
  dialogSurfaceClass,
} from '@/components/workspace/constants';
import {
  titleCase,
  toneForStatus,
  valueText,
} from '@/components/workspace/formatters';
import { StatusBadge } from '@/components/workspace/primitives';
import { useDraggableDialog } from '@/components/workspace/use-draggable-dialog';

export function ApprovalDecisionDialog({
  requestId,
  onClose,
  onUpdated,
  onOpenIntake,
  onOpenRule,
}: {
  requestId: string;
  onClose: () => void;
  onUpdated: (workspace: Workspace) => void;
  onOpenIntake: (id: string) => void;
  /** Opens the read-only rules reference at the control that fired. */
  onOpenRule: (ruleKey: string) => void;
}) {
  const [details, setDetails] = useState<ApprovalRequestDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [action, setAction] =
    useState<keyof typeof approvalActionLabels>('start_review');
  const [reason, setReason] = useState('');
  const [assignedReviewer, setAssignedReviewer] = useState('');
  const dialogRef = useRef<HTMLDialogElement>(null);
  const draggable = useDraggableDialog({ surfaceRef: dialogRef });

  const loadDetails = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(
        `/api/approvals?id=${encodeURIComponent(requestId)}`,
      );
      const body = (await response.json()) as ApprovalRequestDetails & {
        error?: string;
      };
      if (!response.ok)
        throw new Error(body.error || 'Unable to load the approval request.');
      setDetails(body);
      const loadedStep = body.steps[0];
      setAssignedReviewer(String(loadedStep?.assigned_reviewer ?? ''));
      setAction(
        loadedStep?.status === 'in_review' ? 'approve' : 'start_review',
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to load the approval request.',
      );
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadDetails(), 0);
    return () => window.clearTimeout(timer);
  }, [loadDetails]);

  const step = details?.steps[0];
  const terminal = ['approved', 'declined', 'cancelled'].includes(
    String(step?.status ?? ''),
  );
  const allowedActions: Array<keyof typeof approvalActionLabels> = terminal
    ? []
    : step?.status === 'pending'
      ? [
          'start_review',
          'approve',
          'approve_exception',
          'decline',
          'request_revision',
          'escalate',
          'cancel',
        ]
      : step?.status === 'revision_requested'
        ? ['start_review', 'cancel']
        : [
            'approve',
            'approve_exception',
            'decline',
            'request_revision',
            'escalate',
            'cancel',
          ];
  const reasonRequired = [
    'decline',
    'request_revision',
    'approve_exception',
    'escalate',
    'cancel',
  ].includes(action);

  const submitDecision = async () => {
    if (!step) return;
    if (reasonRequired && !reason.trim()) {
      setError('Record a reason for this decision or escalation.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const response = await fetch('/api/approvals', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stepId: step.id,
          action,
          reason,
          assignedReviewer,
        }),
      });
      const body = (await response.json()) as {
        details?: ApprovalRequestDetails;
        workspace?: Workspace;
        error?: string;
      };
      if (!response.ok || !body.details || !body.workspace)
        throw new Error(body.error || 'Unable to record this decision.');
      setDetails(body.details);
      onUpdated(body.workspace);
      setReason('');
      const nextStep = body.details.steps[0];
      setAction(nextStep?.status === 'in_review' ? 'approve' : 'start_review');
    } catch (decisionError) {
      setError(
        decisionError instanceof Error
          ? decisionError.message
          : 'Unable to record this decision.',
      );
    } finally {
      setSaving(false);
    }
  };

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
        aria-labelledby="approval-decision-title"
        className={`${dialogSurfaceClass} grid grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden`}
      >
        <header
          data-dialog-drag-handle
          title="Drag to move dialog"
          className="relative cursor-move touch-none select-none border-b border-border px-6 py-4 pr-14"
        >
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close approval decision"
            className="absolute right-4 top-4 flex size-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
          >
            ×
          </button>
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-accent-foreground">
            <ShieldCheck className="size-3.5" /> Versioned approval control
            {details ? (
              <StatusBadge tone={toneForStatus(details.request.status)}>
                {titleCase(details.request.status)}
              </StatusBadge>
            ) : null}
          </div>
          <h2
            id="approval-decision-title"
            className="mt-1 text-xl font-semibold text-foreground"
          >
            {details
              ? valueText(details.request.rule_name)
              : 'Loading approval request…'}
          </h2>
          {details ? (
            <p className="mt-1 text-xs text-slate-500">
              {valueText(details.request.intake_number)} · Rule{' '}
              {valueText(details.request.rule_key)} v
              {valueText(details.request.rule_version)}
              {' · '}
              <button
                type="button"
                onClick={() =>
                  onOpenRule(String(details.request.rule_key ?? ''))
                }
                className="font-medium text-accent-foreground hover:underline"
              >
                View triggering rule
              </button>
            </p>
          ) : null}
        </header>

        <div className="min-h-0 overflow-y-auto bg-muted p-5">
          {loading ? (
            <div className="flex min-h-64 items-center justify-center text-xs text-slate-500">
              <LoaderCircle className="mr-2 size-5 animate-spin text-accent-foreground" />
              Loading source and immutable decision history…
            </div>
          ) : details && step ? (
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
              <div className="space-y-4">
                <article className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">
                        Trigger and source
                      </h3>
                      <p className="mt-1 text-[11px] leading-4 text-slate-500">
                        {valueText(details.request.rule_description)}
                      </p>
                    </div>
                    <Badge variant="outline">
                      {Number(details.request.mandatory)
                        ? 'Mandatory'
                        : 'Advisory'}
                    </Badge>
                  </div>
                  <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-4 text-amber-900">
                    {valueText(details.request.reason)}
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {[
                      ['Decision owner', step.owner_role],
                      ['Assigned reviewer', step.assigned_reviewer],
                      ['Generated', details.request.generated_at],
                      ['Due date', details.request.due_at],
                      ['Source page', step.source_page],
                      ['Escalation level', step.escalation_level],
                    ].map(([label, value]) => (
                      <div
                        key={String(label)}
                        className="rounded-lg bg-slate-50 px-3 py-2"
                      >
                        <p className="text-[11px] font-semibold uppercase text-slate-500">
                          {label}
                        </p>
                        <p className="mt-1 text-[11px] font-medium text-slate-700">
                          {valueText(value)}
                        </p>
                      </div>
                    ))}
                  </div>
                  {step.source_quote ? (
                    <blockquote className="mt-3 rounded-lg border-l-2 border-[#65a9bf] bg-[#f2f8fa] px-3 py-2 text-[11px] leading-4 text-slate-700">
                      “{valueText(step.source_quote)}”
                    </blockquote>
                  ) : null}
                  {details.request.source_document_id ? (
                    <a
                      href={`/api/document?id=${encodeURIComponent(String(details.request.source_document_id))}`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-medium text-accent-foreground"
                    >
                      <ExternalLink className="size-3.5" /> Open{' '}
                      {valueText(details.request.source_file_name)}
                    </a>
                  ) : null}
                </article>

                <article className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">
                        Related intake
                      </h3>
                      <p className="mt-1 text-[11px] text-slate-500">
                        {valueText(details.request.intake_title)} ·{' '}
                        {valueText(details.request.proposed_supplier_name)}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        onOpenIntake(String(details.request.intake_id))
                      }
                    >
                      <FileSearch /> Open review
                    </Button>
                  </div>
                </article>

                {!terminal ? (
                  <article className="rounded-xl border border-[#bfd6df] bg-card p-4">
                    <h3 className="text-sm font-semibold text-foreground">
                      Record a controlled action
                    </h3>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <label className="text-[11px] font-medium text-slate-600">
                        Action
                        <select
                          value={action}
                          onChange={(event) =>
                            setAction(
                              event.target
                                .value as keyof typeof approvalActionLabels,
                            )
                          }
                          className="mt-1 h-9 w-full rounded-md border border-input bg-card px-3 text-xs"
                        >
                          {allowedActions.map((item) => (
                            <option key={item} value={item}>
                              {approvalActionLabels[item]}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label
                        htmlFor="approval-assigned-reviewer"
                        className="text-[11px] font-medium text-slate-600"
                      >
                        Assigned reviewer
                        <Input
                          id="approval-assigned-reviewer"
                          value={assignedReviewer}
                          onChange={(event) =>
                            setAssignedReviewer(event.target.value)
                          }
                          placeholder={valueText(step.owner_role)}
                          className="mt-1 text-xs"
                        />
                      </label>
                    </div>
                    <label className="mt-3 block text-[11px] font-medium text-slate-600">
                      Decision reason{' '}
                      {reasonRequired ? '(required)' : '(optional)'}
                      <textarea
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                        rows={4}
                        maxLength={2000}
                        className="mt-1 w-full rounded-md border border-input bg-card px-3 py-2 text-xs"
                        placeholder="Record the evidence, rationale, exception basis, revision needed, or escalation reason…"
                      />
                    </label>
                  </article>
                ) : (
                  <Alert>
                    <CircleCheck />
                    <AlertTitle>This decision is immutable</AlertTitle>
                    <AlertDescription>
                      The completed step remains in the audit history and cannot
                      be overwritten.
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              <article className="rounded-xl border border-border bg-card p-4">
                <h3 className="text-sm font-semibold text-foreground">
                  Immutable decision history
                </h3>
                <p className="mt-1 text-[11px] text-slate-500">
                  Actor, role, timestamp, reason, and before/after state are
                  retained for every event.
                </p>
                <div className="mt-4 space-y-3">
                  {details.history.map((item) => (
                    <div
                      key={String(item.id)}
                      className="rounded-lg border border-border bg-[#fafcfc] p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[11px] font-semibold text-foreground">
                            {titleCase(item.action)}
                          </p>
                          <p className="mt-1 text-[11px] text-slate-500">
                            {valueText(item.actor)} ·{' '}
                            {valueText(item.actor_role)}
                          </p>
                        </div>
                        <span className="text-[11px] text-slate-400">
                          {valueText(item.created_at)}
                        </span>
                      </div>
                      <p className="mt-2 text-[11px] font-medium text-slate-600">
                        {titleCase(item.from_status)} →{' '}
                        {titleCase(item.to_status)}
                      </p>
                      {item.reason ? (
                        <p className="mt-2 text-[11px] leading-4 text-slate-600">
                          {valueText(item.reason)}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </article>
            </div>
          ) : (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertTitle>Approval request unavailable</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-border bg-card px-6 py-4">
          <span className="text-[11px] text-rose-600">
            {details ? error : ''}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>
              Close
            </Button>
            {!terminal && details ? (
              <Button
                onClick={() => void submitDecision()}
                disabled={saving || (reasonRequired && !reason.trim())}
                className="bg-primary hover:bg-primary/90"
              >
                {saving ? <LoaderCircle className="animate-spin" /> : <Check />}
                {approvalActionLabels[action]}
              </Button>
            ) : null}
          </div>
        </footer>
      </dialog>
    </div>
  );
}
