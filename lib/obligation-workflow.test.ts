import { describe, expect, it } from 'vitest';

import {
  assertCompletionEvidence,
  buildObligationCalendar,
  calculateObligationMetrics,
  effectiveObligationStatus,
  nextObligationStatus,
} from '@/lib/obligation-workflow';

describe('obligation execution state machine', () => {
  it('enforces the controlled status sequence', () => {
    expect(nextObligationStatus('upcoming', 'in_progress')).toBe('in_progress');
    expect(nextObligationStatus('in_progress', 'evidence_required')).toBe(
      'evidence_required',
    );
    expect(nextObligationStatus('evidence_required', 'completed')).toBe(
      'completed',
    );
  });

  it('rejects skipped and terminal transitions', () => {
    expect(() => nextObligationStatus('upcoming', 'completed')).toThrow(
      'must follow',
    );
    expect(() => nextObligationStatus('completed', 'in_progress')).toThrow(
      'must follow',
    );
  });

  it('calculates overdue without storing it as a mutable workflow status', () => {
    expect(
      effectiveObligationStatus('in_progress', '2026-08-31', '2026-09-01'),
    ).toBe('overdue');
    expect(
      effectiveObligationStatus('completed', '2026-08-31', '2026-09-01'),
    ).toBe('completed');
  });

  it('requires both a completion note and evidence', () => {
    expect(() =>
      assertCompletionEvidence({
        completionNote: 'Confirmed delivery.',
        evidenceReference: null,
      }),
    ).toThrow('evidence');
    expect(() =>
      assertCompletionEvidence({
        completionNote: '',
        evidenceReference: 'Closeout-42',
      }),
    ).toThrow('completion note');
    expect(() =>
      assertCompletionEvidence({
        completionNote: 'Confirmed delivery.',
        evidenceReference: 'Closeout-42',
      }),
    ).not.toThrow();
  });
});

describe('obligation evidence metrics and calendar export', () => {
  const records = [
    {
      status: 'completed',
      due_date: '2026-08-20',
      material: 1,
      created_at: '2026-08-01T00:00:00.000Z',
      assigned_at: '2026-08-01T12:00:00.000Z',
      completed_at: '2026-08-19T00:00:00.000Z',
      evidence_reference: 'Closeout-42',
    },
    {
      status: 'completed',
      due_date: '2026-08-20',
      material: 1,
      created_at: '2026-08-01T00:00:00.000Z',
      assigned_at: '2026-08-02T12:00:00.000Z',
      completed_at: '2026-08-22T00:00:00.000Z',
    },
    {
      status: 'in_progress',
      due_date: '2026-08-30',
      material: 1,
      created_at: '2026-08-20T00:00:00.000Z',
      assigned_at: '2026-08-21T00:00:00.000Z',
    },
  ];

  it('derives reproducible completion, evidence, and aging metrics', () => {
    expect(calculateObligationMetrics(records, '2026-09-01')).toEqual({
      open_obligations: 1,
      overdue_obligations: 1,
      average_overdue_age_days: 2,
      on_time_completion_rate: 50,
      completed_with_evidence_rate: 50,
      median_assignment_hours: 24,
      median_completion_hours: 468,
    });
  });

  it('exports selected obligations as escaped all-day calendar events', () => {
    const calendar = buildObligationCalendar([
      {
        id: 'date-1',
        title: 'Renewal, review',
        due_date: '2026-11-01',
        owner: 'Selina Armstrong',
        contract_number: 'CT-001',
        supplier_name: 'Harbor; Technology',
      },
    ]);
    expect(calendar).toContain('DTSTART;VALUE=DATE:20261101');
    expect(calendar).toContain('DTEND;VALUE=DATE:20261102');
    expect(calendar).toContain('SUMMARY:Renewal\\, review');
    expect(calendar).toContain('Harbor\\; Technology');
  });
});
