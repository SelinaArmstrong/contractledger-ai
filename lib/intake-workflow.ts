/**
 * Review-workflow writes for `contract_intakes`.
 *
 * The queue edits one field at a time (assign an owner, move a target date)
 * while the review dialog saves the whole form, so the update is assembled from
 * whichever fields the caller actually sent. An omitted field is left alone —
 * a partial write must never blank `internal_notes` that a reviewer typed in
 * the dialog.
 */

export const intakeStatuses = [
  'draft',
  'under_review',
  'waiting_on_business',
  'waiting_on_legal',
  'revision_requested',
  'approved_for_signature',
  'not_awarded',
  'executed',
] as const;

export type IntakeStatus = (typeof intakeStatuses)[number];

export type IntakeWorkflowFields = {
  status?: IntakeStatus;
  owner?: string;
  targetReviewDate?: string;
  internalNotes?: string;
};

/** Statuses that close the review, versus the ones that keep it in flight. */
export function reviewStatusFor(status: IntakeStatus) {
  if (['approved_for_signature', 'not_awarded', 'executed'].includes(status))
    return 'complete';
  if (status === 'draft') return 'pending';
  return 'in_progress';
}

/**
 * Column assignments and their bindings for the fields present in `fields`.
 * Column names come from this fixed set only; every value is bound.
 */
export function buildIntakeWorkflowUpdate(
  fields: IntakeWorkflowFields,
  updatedAt: string,
) {
  const assignments: string[] = [];
  const bindings: Array<string | null> = [];

  if (fields.status !== undefined) {
    assignments.push('status = ?', 'review_status = ?');
    bindings.push(fields.status, reviewStatusFor(fields.status));
  }
  if (fields.owner !== undefined) {
    assignments.push('owner = ?');
    bindings.push(fields.owner);
  }
  if (fields.targetReviewDate !== undefined) {
    assignments.push('target_review_date = ?');
    bindings.push(fields.targetReviewDate || null);
  }
  if (fields.internalNotes !== undefined) {
    assignments.push('internal_notes = ?');
    bindings.push(fields.internalNotes.trim() || null);
  }

  if (!assignments.length) return null;

  assignments.push('updated_at = ?');
  bindings.push(updatedAt);
  return {
    sql: `UPDATE contract_intakes SET ${assignments.join(', ')} WHERE id = ?`,
    bindings,
  };
}

/** The changed fields, recorded in the audit trail exactly as they were sent. */
export function intakeWorkflowAuditDetails(fields: IntakeWorkflowFields) {
  const details: Record<string, string | null> = {};
  if (fields.status !== undefined) details.status = fields.status;
  if (fields.owner !== undefined) details.owner = fields.owner;
  if (fields.targetReviewDate !== undefined)
    details.targetReviewDate = fields.targetReviewDate || null;
  if (fields.internalNotes !== undefined)
    details.internalNotes = fields.internalNotes.trim() || null;
  return details;
}
