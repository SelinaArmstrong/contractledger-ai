import { describe, expect, it } from 'vitest';

import {
  buildIntakeWorkflowUpdate,
  intakeWorkflowAuditDetails,
  reviewStatusFor,
} from '@/lib/intake-workflow';

const updatedAt = '2026-09-06T10:00:00.000Z';

describe('reviewStatusFor', () => {
  it('closes the review for terminal statuses', () => {
    expect(reviewStatusFor('approved_for_signature')).toBe('complete');
    expect(reviewStatusFor('not_awarded')).toBe('complete');
    expect(reviewStatusFor('executed')).toBe('complete');
  });

  it('keeps an unstarted intake pending and everything else in progress', () => {
    expect(reviewStatusFor('draft')).toBe('pending');
    expect(reviewStatusFor('under_review')).toBe('in_progress');
    expect(reviewStatusFor('waiting_on_legal')).toBe('in_progress');
  });
});

describe('buildIntakeWorkflowUpdate', () => {
  it('touches only the field that was sent', () => {
    const update = buildIntakeWorkflowUpdate(
      { owner: 'Jordan Avery' },
      updatedAt,
    );
    expect(update?.sql).toBe(
      'UPDATE contract_intakes SET owner = ?, updated_at = ? WHERE id = ?',
    );
    expect(update?.bindings).toEqual(['Jordan Avery', updatedAt]);
  });

  it('never blanks internal notes that were not sent', () => {
    const update = buildIntakeWorkflowUpdate(
      { status: 'waiting_on_legal' },
      updatedAt,
    );
    expect(update?.sql).not.toContain('internal_notes');
  });

  it('derives review_status alongside a status change', () => {
    const update = buildIntakeWorkflowUpdate(
      { status: 'approved_for_signature' },
      updatedAt,
    );
    expect(update?.sql).toBe(
      'UPDATE contract_intakes SET status = ?, review_status = ?, updated_at = ? WHERE id = ?',
    );
    expect(update?.bindings).toEqual([
      'approved_for_signature',
      'complete',
      updatedAt,
    ]);
  });

  it('stores a cleared target date and cleared notes as NULL', () => {
    const update = buildIntakeWorkflowUpdate(
      { targetReviewDate: '', internalNotes: '   ' },
      updatedAt,
    );
    expect(update?.bindings).toEqual([null, null, updatedAt]);
  });

  it('keeps every column assignment bound rather than interpolated', () => {
    const update = buildIntakeWorkflowUpdate(
      { owner: "Robert'); DROP TABLE contracts;--" },
      updatedAt,
    );
    expect(update?.sql).not.toContain('DROP TABLE');
    expect(update?.bindings[0]).toBe("Robert'); DROP TABLE contracts;--");
  });

  it('returns null when there is nothing to change', () => {
    expect(buildIntakeWorkflowUpdate({}, updatedAt)).toBeNull();
  });
});

describe('intakeWorkflowAuditDetails', () => {
  it('records only the fields that changed', () => {
    expect(intakeWorkflowAuditDetails({ owner: 'Dana Ruiz' })).toEqual({
      owner: 'Dana Ruiz',
    });
  });

  it('distinguishes a cleared value from an untouched one', () => {
    expect(intakeWorkflowAuditDetails({ targetReviewDate: '' })).toEqual({
      targetReviewDate: null,
    });
    expect(intakeWorkflowAuditDetails({})).toEqual({});
  });
});
