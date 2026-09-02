'use client';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import type { ObligationDetails, Workspace } from '@/lib/contract-ledger-types';
import {
  AlertTriangle,
  Building2,
  Check,
  ChevronDown,
  ExternalLink,
  FileCheck2,
  FileText,
  LoaderCircle,
} from 'lucide-react';
import { useState } from 'react';
import {
  alertTiming,
  titleCase,
  toneForStatus,
  usDateText,
  valueText,
} from '@/components/workspace/formatters';
import { StatusBadge } from '@/components/workspace/primitives';

export function ObligationEditor({
  item,
  selected,
  onSelectedChange,
  onSaved,
  onOpenRecord,
}: {
  item: Workspace['keyDates'][number];
  selected: boolean;
  onSelectedChange: (checked: boolean) => void;
  onSaved: () => Promise<void>;
  onOpenRecord?: () => void;
}) {
  const savedStatus =
    item.status === 'due' ? 'in_progress' : valueText(item.status);
  const [status, setStatus] = useState(savedStatus);
  const [owner, setOwner] = useState(
    valueText(item.owner) === 'Not found' ? '' : valueText(item.owner),
  );
  const [backupOwner, setBackupOwner] = useState(
    valueText(item.backup_owner) === 'Not found'
      ? ''
      : valueText(item.backup_owner),
  );
  const [priority, setPriority] = useState(
    valueText(item.priority) === 'Not found'
      ? 'medium'
      : valueText(item.priority),
  );
  const [decision, setDecision] = useState(
    valueText(item.decision) === 'Not found' ? '' : valueText(item.decision),
  );
  const [notes, setNotes] = useState(
    valueText(item.notes) === 'Not found' ? '' : valueText(item.notes),
  );
  const [completionNote, setCompletionNote] = useState(
    valueText(item.completion_note) === 'Not found'
      ? ''
      : valueText(item.completion_note),
  );
  const [evidenceReference, setEvidenceReference] = useState(
    valueText(item.evidence_reference) === 'Not found'
      ? ''
      : valueText(item.evidence_reference),
  );
  const [evidenceDocumentId, setEvidenceDocumentId] = useState(
    valueText(item.evidence_document_id) === 'Not found'
      ? ''
      : valueText(item.evidence_document_id),
  );
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [transitionNote, setTransitionNote] = useState('');
  const [details, setDetails] = useState<ObligationDetails | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const renewalItem =
    item.type === 'non_renewal_notice' || item.type === 'renewal';
  const effectiveStatus = valueText(item.effective_status ?? item.status);
  const timing = alertTiming(item.due_date);
  const nextStatus: Record<string, string | null> = {
    upcoming: 'in_progress',
    in_progress: 'evidence_required',
    evidence_required: 'completed',
    completed: null,
  };
  const statusOptions = [
    savedStatus,
    ...(nextStatus[savedStatus] ? [String(nextStatus[savedStatus])] : []),
  ];

  const loadDetails = async () => {
    setLoadingDetails(true);
    setMessage('');
    try {
      const response = await fetch(
        `/api/obligations?id=${encodeURIComponent(String(item.id))}`,
      );
      const body = (await response.json()) as ObligationDetails & {
        error?: string;
      };
      if (!response.ok)
        throw new Error(body.error || 'Unable to load obligation history.');
      setDetails(body);
      if (!evidenceDocumentId && body.obligation.evidence_document_id)
        setEvidenceDocumentId(String(body.obligation.evidence_document_id));
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Unable to load obligation history.',
      );
    } finally {
      setLoadingDetails(false);
    }
  };

  const toggleDetails = async () => {
    const next = !showDetails;
    setShowDetails(next);
    if (next && !details) await loadDetails();
  };

  const save = async (action: 'update' | 'escalate' = 'update') => {
    setSaving(true);
    setMessage('');
    try {
      const form = new FormData();
      [
        ['id', String(item.id)],
        ['action', action],
        ['status', status],
        ['owner', owner],
        ['backupOwner', backupOwner],
        ['priority', priority],
        ['decision', decision],
        ['notes', notes],
        ['completionNote', completionNote],
        ['evidenceDocumentId', evidenceDocumentId],
        ['evidenceReference', evidenceReference],
        ['transitionNote', transitionNote],
      ].forEach(([key, value]) => form.append(key, value));
      if (evidenceFile) form.append('evidenceFile', evidenceFile);
      const response = await fetch('/api/obligations', {
        method: 'POST',
        body: form,
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok)
        throw new Error(body.error || 'Unable to update obligation.');
      setMessage(action === 'escalate' ? 'Escalation recorded' : 'Saved');
      setEvidenceFile(null);
      setTransitionNote('');
      setDetails(null);
      await onSaved();
      if (showDetails) await loadDetails();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Unable to update obligation.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <article
      className={`rounded-xl border p-4 ${
        status === 'completed'
          ? 'border-emerald-200 bg-emerald-50/40'
          : effectiveStatus === 'overdue'
            ? 'border-rose-200 bg-rose-50/30'
            : 'border-[#dce3e8] bg-white'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <Checkbox
            checked={selected}
            onCheckedChange={(checked) => onSelectedChange(Boolean(checked))}
            aria-label={`Select ${valueText(item.title)}`}
            className="mt-1"
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium text-[#203845]">
                {valueText(item.title)}
              </p>
              <StatusBadge tone={toneForStatus(effectiveStatus)}>
                {titleCase(effectiveStatus)}
              </StatusBadge>
              <StatusBadge
                tone={
                  priority === 'critical'
                    ? 'rose'
                    : priority === 'high'
                      ? 'amber'
                      : 'blue'
                }
              >
                {titleCase(priority)}
              </StatusBadge>
              {timing && effectiveStatus !== 'completed' ? (
                <StatusBadge tone={timing.tone}>{timing.label}</StatusBadge>
              ) : null}
            </div>
            <p className="mt-1 text-xs font-medium text-[#335565]">
              {item.contract_number
                ? `${valueText(item.contract_number)} · ${valueText(item.contract_title)}`
                : valueText(item.supplier_name)}
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              Supplier: {valueText(item.supplier_name)} · Due{' '}
              {valueText(item.due_date)}
              {item.internal_review_date
                ? ` · Internal review ${valueText(item.internal_review_date)}`
                : ''}
              {item.source_page ? ` · Source p. ${item.source_page}` : ''}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {item.source_document_id ? (
            <a
              href={`/api/document?id=${encodeURIComponent(String(item.source_document_id))}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#d4dfe4] bg-white px-3 text-[11px] font-medium text-[#27657c]"
            >
              <ExternalLink className="size-3.5" /> Source
            </a>
          ) : null}
          {onOpenRecord ? (
            <Button variant="outline" size="sm" onClick={onOpenRecord}>
              {item.contract_id ? <FileText /> : <Building2 />}
              Open {item.contract_id ? 'contract' : 'supplier'}
            </Button>
          ) : null}
        </div>
      </div>

      {item.source_clause ? (
        <p className="mt-3 rounded-lg border border-[#e1e8eb] bg-slate-50 px-3 py-2 text-[10px] leading-4 text-slate-600">
          <span className="font-semibold text-slate-700">Source clause:</span>{' '}
          {valueText(item.source_clause)}
        </p>
      ) : null}

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <label
          htmlFor={`obligation-owner-${String(item.id)}`}
          className="text-[11px] font-medium text-slate-600"
        >
          Owner
          <Input
            id={`obligation-owner-${String(item.id)}`}
            value={owner}
            onChange={(event) => setOwner(event.target.value)}
            className="mt-1 h-9 bg-white text-xs"
          />
        </label>
        <label
          htmlFor={`obligation-backup-owner-${String(item.id)}`}
          className="text-[11px] font-medium text-slate-600"
        >
          Backup owner
          <Input
            id={`obligation-backup-owner-${String(item.id)}`}
            value={backupOwner}
            onChange={(event) => setBackupOwner(event.target.value)}
            className="mt-1 h-9 bg-white text-xs"
          />
        </label>
        <label className="text-[11px] font-medium text-slate-600">
          Priority
          <select
            value={priority}
            onChange={(event) => setPriority(event.target.value)}
            className="mt-1 h-9 w-full rounded-md border border-input bg-white px-3 text-xs"
          >
            {['low', 'medium', 'high', 'critical'].map((value) => (
              <option key={value} value={value}>
                {titleCase(value)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[11px] font-medium text-slate-600">
          Workflow status
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="mt-1 h-9 w-full rounded-md border border-input bg-white px-3 text-xs"
          >
            {statusOptions.map((value) => (
              <option key={value} value={value}>
                {titleCase(value)}
              </option>
            ))}
          </select>
        </label>
        {renewalItem ? (
          <label className="text-[11px] font-medium text-slate-600 md:col-span-2">
            Renewal decision
            <select
              value={decision}
              onChange={(event) => setDecision(event.target.value)}
              className="mt-1 h-9 w-full rounded-md border border-input bg-white px-3 text-xs"
            >
              <option value="">Select decision</option>
              <option value="under_review">Under review</option>
              <option value="renew">Renew</option>
              <option value="do_not_renew">Do not renew</option>
              <option value="not_applicable">Not applicable</option>
            </select>
          </label>
        ) : null}
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <label
          htmlFor={`obligation-evidence-reference-${String(item.id)}`}
          className="text-[11px] font-medium text-slate-600"
        >
          Evidence reference
          <Input
            id={`obligation-evidence-reference-${String(item.id)}`}
            value={evidenceReference}
            onChange={(event) => setEvidenceReference(event.target.value)}
            className="mt-1 h-9 bg-white text-xs"
            placeholder="Closeout record, ticket, or repository reference"
          />
        </label>
        <label className="text-[11px] font-medium text-slate-600">
          Upload evidence
          <input
            type="file"
            accept="application/pdf,image/png,image/jpeg"
            onChange={(event) =>
              setEvidenceFile(event.target.files?.[0] ?? null)
            }
            className="mt-1 block h-9 w-full rounded-md border border-input bg-white px-2 py-1.5 text-[10px] text-slate-600 file:mr-2 file:rounded file:border-0 file:bg-[#e4f2f6] file:px-2 file:py-1 file:text-[10px] file:font-medium file:text-[#1d647d]"
          />
        </label>
      </div>
      {details?.eligibleDocuments.length ? (
        <label className="mt-3 block text-[11px] font-medium text-slate-600">
          Or link an existing contract or supplier file
          <select
            value={evidenceDocumentId}
            onChange={(event) => setEvidenceDocumentId(event.target.value)}
            className="mt-1 h-9 w-full rounded-md border border-input bg-white px-3 text-xs"
          >
            <option value="">No existing file selected</option>
            {details.eligibleDocuments.map((document) => (
              <option key={String(document.id)} value={String(document.id)}>
                {valueText(document.file_name)} ·{' '}
                {titleCase(document.lifecycle_stage)}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {evidenceFile ? (
        <p className="mt-2 text-[10px] text-[#246a83]">
          New evidence ready: {evidenceFile.name}
        </p>
      ) : item.evidence_document_id ? (
        <a
          href={`/api/document?id=${encodeURIComponent(String(item.evidence_document_id))}`}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-[10px] font-medium text-[#246a83]"
        >
          <FileCheck2 className="size-3.5" />
          Open linked evidence: {valueText(item.evidence_file_name)}
        </a>
      ) : null}

      <label className="mt-3 block text-[11px] font-medium text-slate-600">
        Completion note
        <textarea
          value={completionNote}
          onChange={(event) => setCompletionNote(event.target.value)}
          rows={2}
          className="mt-1 w-full rounded-md border border-input bg-white px-3 py-2 text-xs"
          placeholder="Required when completing: what was done and what the evidence proves…"
        />
      </label>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <label className="block text-[11px] font-medium text-slate-600">
          Working notes
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={2}
            className="mt-1 w-full rounded-md border border-input bg-white px-3 py-2 text-xs"
            placeholder="Follow-up, decision rationale, or next step…"
          />
        </label>
        <label className="block text-[11px] font-medium text-slate-600">
          Status / escalation note
          <textarea
            value={transitionNote}
            onChange={(event) => setTransitionNote(event.target.value)}
            rows={2}
            className="mt-1 w-full rounded-md border border-input bg-white px-3 py-2 text-xs"
            placeholder="Explain this transition or an overdue escalation…"
          />
        </label>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-current/10 pt-3">
        <div className="flex flex-wrap items-center gap-3 text-[10px] text-slate-500">
          <span>Escalation level {valueText(item.escalation_level ?? 0)}</span>
          {item.completed_by ? (
            <span>
              Completed by {valueText(item.completed_by)} ·{' '}
              {usDateText(item.completed_at)}
            </span>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void toggleDetails()}
            disabled={loadingDetails}
          >
            {loadingDetails ? (
              <LoaderCircle className="animate-spin" />
            ) : (
              <ChevronDown />
            )}
            {showDetails ? 'Hide' : 'History & existing files'}
          </Button>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <span
            className={`max-w-sm text-right text-[11px] ${
              message === 'Saved' || message === 'Escalation recorded'
                ? 'text-emerald-700'
                : 'text-rose-600'
            }`}
          >
            {message}
          </span>
          {effectiveStatus === 'overdue' && status !== 'completed' ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => void save('escalate')}
              disabled={saving || !backupOwner || !transitionNote}
              className="border-rose-200 text-rose-700 hover:bg-rose-50"
            >
              <AlertTriangle /> Escalate to backup
            </Button>
          ) : null}
          <Button size="sm" onClick={() => void save()} disabled={saving}>
            {saving ? <LoaderCircle className="animate-spin" /> : <Check />}
            Save obligation
          </Button>
        </div>
      </div>

      {showDetails ? (
        <div className="mt-3 rounded-lg border border-[#dce3e8] bg-white">
          <div className="border-b border-[#e8edef] px-3 py-2 text-[10px] font-semibold tracking-[0.1em] text-slate-500 uppercase">
            Immutable event history
          </div>
          <div className="divide-y divide-[#edf1f3]">
            {details?.events.map((event) => (
              <div key={String(event.id)} className="px-3 py-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] font-medium text-[#294454]">
                    {titleCase(event.event_type)}
                    {event.from_status && event.to_status
                      ? ` · ${titleCase(event.from_status)} → ${titleCase(event.to_status)}`
                      : ''}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {valueText(event.actor)} · {valueText(event.created_at)}
                  </span>
                </div>
                {event.note ? (
                  <p className="mt-1 text-[10px] leading-4 text-slate-600">
                    {valueText(event.note)}
                  </p>
                ) : null}
              </div>
            ))}
            {details && !details.events.length ? (
              <p className="px-3 py-4 text-[10px] text-slate-500">
                The next saved change will create the first event.
              </p>
            ) : null}
            {loadingDetails ? (
              <p className="px-3 py-4 text-[10px] text-slate-500">
                Loading status and evidence history…
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </article>
  );
}
