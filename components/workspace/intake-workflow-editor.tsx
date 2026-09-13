'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import type { Workspace } from '@/lib/contract-ledger-types';
import type { IntakeStatus } from '@/lib/intake-workflow';
import { Check, LoaderCircle, SlidersHorizontal, X } from 'lucide-react';
import { useId, useState } from 'react';

export const workflowStatusLabels: Array<[IntakeStatus, string]> = [
  ['draft', 'New'],
  ['under_review', 'Under review'],
  ['waiting_on_business', 'Waiting on business'],
  ['waiting_on_legal', 'Waiting on legal'],
  ['revision_requested', 'Revision requested'],
  ['approved_for_signature', 'Approved for signature'],
  ['not_awarded', 'Rejected / not awarded'],
];

type WorkflowDraft = {
  owner: string;
  targetReviewDate: string;
  status: string;
};

/**
 * Sends only the fields the reviewer actually touched. `PATCH /api/intakes`
 * leaves everything else alone, so a queue edit cannot clobber the internal
 * notes or finding decisions recorded in the review dialog.
 */
async function saveWorkflow(body: Record<string, unknown>): Promise<Workspace> {
  const response = await fetch('/api/intakes', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = (await response.json()) as {
    workspace?: Workspace;
    error?: string;
  };
  if (!response.ok || !payload.workspace)
    throw new Error(payload.error || 'Unable to update the review workflow.');
  return payload.workspace;
}

function changedFields(draft: WorkflowDraft, baseline: WorkflowDraft) {
  const fields: Record<string, string> = {};
  if (draft.owner.trim() && draft.owner.trim() !== baseline.owner)
    fields.owner = draft.owner.trim();
  if (draft.targetReviewDate !== baseline.targetReviewDate)
    fields.targetReviewDate = draft.targetReviewDate;
  if (draft.status && draft.status !== baseline.status)
    fields.status = draft.status;
  return fields;
}

function WorkflowFields({
  draft,
  onChange,
  ownerOptions,
  ownerListId,
  statusPlaceholder,
  ownerPlaceholder,
  idPrefix,
}: {
  draft: WorkflowDraft;
  onChange: (next: WorkflowDraft) => void;
  ownerOptions: string[];
  ownerListId: string;
  statusPlaceholder?: string;
  ownerPlaceholder?: string;
  idPrefix: string;
}) {
  return (
    <>
      <label
        htmlFor={`${idPrefix}-owner`}
        className="text-[11px] font-medium text-slate-600"
      >
        Review owner
        <Input
          id={`${idPrefix}-owner`}
          list={ownerListId}
          value={draft.owner}
          placeholder={ownerPlaceholder}
          onChange={(event) =>
            onChange({ ...draft, owner: event.target.value })
          }
          className="mt-1 h-9 bg-card text-xs"
        />
        <datalist id={ownerListId}>
          {ownerOptions.map((owner) => (
            <option key={owner} value={owner}>
              {owner}
            </option>
          ))}
        </datalist>
      </label>
      <label
        htmlFor={`${idPrefix}-target`}
        className="text-[11px] font-medium text-slate-600"
      >
        Target review date
        <Input
          id={`${idPrefix}-target`}
          type="date"
          value={draft.targetReviewDate}
          onChange={(event) =>
            onChange({ ...draft, targetReviewDate: event.target.value })
          }
          className="mt-1 h-9 bg-card text-xs"
        />
      </label>
      <label
        htmlFor={`${idPrefix}-status`}
        className="text-[11px] font-medium text-slate-600"
      >
        Workflow status
        <select
          id={`${idPrefix}-status`}
          value={draft.status}
          onChange={(event) =>
            onChange({ ...draft, status: event.target.value })
          }
          className="mt-1 h-9 w-full rounded-md border border-input bg-card px-2 text-xs"
        >
          {statusPlaceholder ? (
            <option value="">{statusPlaceholder}</option>
          ) : null}
          {workflowStatusLabels.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}

/** Per-row editor, so assigning a review never needs the full dialog. */
export function IntakeRowActions({
  intakeId,
  intakeLabel,
  owner,
  targetReviewDate,
  status,
  ownerOptions,
  onUpdated,
}: {
  intakeId: string;
  intakeLabel: string;
  owner: string;
  targetReviewDate: string;
  status: string;
  ownerOptions: string[];
  onUpdated: (workspace: Workspace) => void;
}) {
  const baseline: WorkflowDraft = { owner, targetReviewDate, status };
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<WorkflowDraft>(baseline);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const ownerListId = useId();
  const idPrefix = useId();
  const pending = changedFields(draft, baseline);
  const pendingCount = Object.keys(pending).length;

  const submit = async () => {
    if (!pendingCount) {
      setOpen(false);
      return;
    }
    setSaving(true);
    setError('');
    try {
      onUpdated(await saveWorkflow({ id: intakeId, ...pending }));
      setOpen(false);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Unable to update the review workflow.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) {
          setDraft(baseline);
          setError('');
        }
      }}
    >
      <PopoverTrigger
        type="button"
        aria-label={`Edit review workflow for ${intakeLabel}`}
        className="flex size-8 items-center justify-center rounded-md border border-[#d9e2e7] bg-card text-slate-500 transition hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <SlidersHorizontal className="size-3.5" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 gap-3 p-4">
        <div>
          <p className="text-xs font-semibold text-foreground">Quick edit</p>
          <p className="mt-0.5 truncate text-[11px] text-slate-500">
            {intakeLabel}
          </p>
        </div>
        <WorkflowFields
          draft={draft}
          onChange={setDraft}
          ownerOptions={ownerOptions}
          ownerListId={ownerListId}
          idPrefix={idPrefix}
          ownerPlaceholder="Unassigned"
        />
        {error ? <p className="text-[11px] text-rose-600">{error}</p> : null}
        <div className="flex items-center justify-between gap-2 border-t border-[#e8eef1] pt-2.5">
          <span className="text-[11px] text-slate-500">
            {pendingCount
              ? `${pendingCount} change${pendingCount === 1 ? '' : 's'}`
              : 'Notes and findings unchanged'}
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setOpen(false)}
              disabled={saving}
              className="h-8 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => void submit()}
              disabled={saving || !pendingCount}
              className="h-8 bg-primary text-xs hover:bg-primary/90"
            >
              {saving ? <LoaderCircle className="animate-spin" /> : <Check />}
              Save
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

const emptyDraft: WorkflowDraft = {
  owner: '',
  targetReviewDate: '',
  status: '',
};

/** Applies one set of workflow values to every selected review at once. */
export function IntakeBulkActionBar({
  selectedIds,
  ownerOptions,
  onUpdated,
  onClearSelection,
}: {
  selectedIds: string[];
  ownerOptions: string[];
  onUpdated: (workspace: Workspace) => void;
  onClearSelection: () => void;
}) {
  const [draft, setDraft] = useState<WorkflowDraft>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const ownerListId = useId();
  const idPrefix = useId();
  const pending = changedFields(draft, emptyDraft);
  const pendingCount = Object.keys(pending).length;
  const count = selectedIds.length;

  const submit = async () => {
    if (!pendingCount) return;
    setSaving(true);
    setError('');
    try {
      onUpdated(await saveWorkflow({ ids: selectedIds, ...pending }));
      setDraft(emptyDraft);
      onClearSelection();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Unable to update the selected reviews.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border-b border-border bg-accent px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-semibold text-foreground">
          {count} review{count === 1 ? '' : 's'} selected
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClearSelection}
          className="h-8 text-[11px]"
        >
          <X /> Clear selection
        </Button>
      </div>
      <div className="mt-3 grid items-end gap-3 md:grid-cols-2 xl:grid-cols-4">
        <WorkflowFields
          draft={draft}
          onChange={setDraft}
          ownerOptions={ownerOptions}
          ownerListId={ownerListId}
          idPrefix={idPrefix}
          ownerPlaceholder="Leave unchanged"
          statusPlaceholder="Leave unchanged"
        />
        <Button
          type="button"
          onClick={() => void submit()}
          disabled={saving || !pendingCount}
          className="h-9 bg-primary hover:bg-primary/90"
        >
          {saving ? <LoaderCircle className="animate-spin" /> : <Check />}
          Apply to {count} review{count === 1 ? '' : 's'}
        </Button>
      </div>
      <p className="mt-2 text-[11px] text-slate-500">
        Only the fields you fill in are written. Internal notes and finding
        decisions are left untouched.
      </p>
      {error ? <p className="mt-2 text-[11px] text-rose-600">{error}</p> : null}
    </div>
  );
}
