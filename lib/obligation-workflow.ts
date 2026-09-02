export const OBLIGATION_STATUSES = [
  'upcoming',
  'in_progress',
  'evidence_required',
  'completed',
] as const;

export const OBLIGATION_PRIORITIES = [
  'low',
  'medium',
  'high',
  'critical',
] as const;

export type ObligationStatus = (typeof OBLIGATION_STATUSES)[number];
export type ObligationPriority = (typeof OBLIGATION_PRIORITIES)[number];
export type EffectiveObligationStatus = ObligationStatus | 'overdue';

const allowedTransitions: Record<ObligationStatus, ObligationStatus[]> = {
  upcoming: ['in_progress'],
  in_progress: ['evidence_required'],
  evidence_required: ['completed'],
  completed: [],
};

export function nextObligationStatus(
  current: ObligationStatus,
  requested: ObligationStatus,
) {
  if (current === requested) return current;
  if (!allowedTransitions[current].includes(requested)) {
    throw new Error(
      `Obligation status must follow upcoming → in progress → evidence required → completed.`,
    );
  }
  return requested;
}

export function effectiveObligationStatus(
  status: ObligationStatus,
  dueDate: string,
  today = new Date().toISOString().slice(0, 10),
): EffectiveObligationStatus {
  if (status !== 'completed' && dueDate < today) return 'overdue';
  return status;
}

export function assertCompletionEvidence({
  completionNote,
  evidenceDocumentId,
  evidenceReference,
}: {
  completionNote?: string | null;
  evidenceDocumentId?: string | null;
  evidenceReference?: string | null;
}) {
  if (!completionNote?.trim()) {
    throw new Error('A completion note is required to complete an obligation.');
  }
  if (!evidenceDocumentId?.trim() && !evidenceReference?.trim()) {
    throw new Error(
      'Link an evidence file or enter an evidence reference before completing this obligation.',
    );
  }
}

function elapsedHours(start: unknown, end: unknown) {
  if (typeof start !== 'string' || typeof end !== 'string') return null;
  const milliseconds = Date.parse(end) - Date.parse(start);
  if (!Number.isFinite(milliseconds) || milliseconds < 0) return null;
  return milliseconds / 3_600_000;
}

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function rounded(value: number) {
  return Math.round(value * 10) / 10;
}

export type ObligationMetricRecord = {
  status: unknown;
  due_date: unknown;
  material?: unknown;
  created_at?: unknown;
  assigned_at?: unknown;
  completed_at?: unknown;
  evidence_document_id?: unknown;
  evidence_reference?: unknown;
};

export function calculateObligationMetrics(
  records: ObligationMetricRecord[],
  today = new Date().toISOString().slice(0, 10),
) {
  const open = records.filter((item) => item.status !== 'completed');
  const overdue = open.filter(
    (item) => typeof item.due_date === 'string' && item.due_date < today,
  );
  const completed = records.filter((item) => item.status === 'completed');
  const materialCompleted = completed.filter((item) => item.material !== 0);
  const completedWithEvidence = materialCompleted.filter(
    (item) => item.evidence_document_id || item.evidence_reference,
  );
  const completedOnTime = completed.filter(
    (item) =>
      typeof item.due_date === 'string' &&
      typeof item.completed_at === 'string' &&
      item.completed_at.slice(0, 10) <= item.due_date,
  );
  const overdueAgeDays = overdue.map((item) => {
    const due = Date.parse(`${String(item.due_date)}T00:00:00Z`);
    const current = Date.parse(`${today}T00:00:00Z`);
    return Math.max(0, (current - due) / 86_400_000);
  });
  const assignmentHours = records
    .map((item) => elapsedHours(item.created_at, item.assigned_at))
    .filter((value): value is number => value !== null);
  const completionHours = completed
    .map((item) => elapsedHours(item.created_at, item.completed_at))
    .filter((value): value is number => value !== null);

  return {
    open_obligations: open.length,
    overdue_obligations: overdue.length,
    average_overdue_age_days: rounded(
      overdueAgeDays.length
        ? overdueAgeDays.reduce((sum, value) => sum + value, 0) /
            overdueAgeDays.length
        : 0,
    ),
    on_time_completion_rate: rounded(
      completed.length ? (completedOnTime.length / completed.length) * 100 : 0,
    ),
    completed_with_evidence_rate: rounded(
      materialCompleted.length
        ? (completedWithEvidence.length / materialCompleted.length) * 100
        : 0,
    ),
    median_assignment_hours: rounded(median(assignmentHours)),
    median_completion_hours: rounded(median(completionHours)),
  };
}

function escapeCalendarText(value: unknown) {
  const text =
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
      ? String(value)
      : '';
  return text
    .replaceAll('\\', '\\\\')
    .replaceAll('\r\n', '\\n')
    .replaceAll('\n', '\\n')
    .replaceAll(',', '\\,')
    .replaceAll(';', '\\;');
}

function nextCalendarDay(value: string) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10).replaceAll('-', '');
}

export type ObligationCalendarRecord = {
  id: string | number;
  title: string;
  due_date: string;
  owner?: string | number | null;
  priority?: string | number | null;
  contract_number?: string | number | null;
  supplier_name?: string | number | null;
  source_clause?: string | number | null;
};

export function buildObligationCalendar(records: ObligationCalendarRecord[]) {
  const created = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');
  const events = records.map((item) => {
    const dueDate = String(item.due_date);
    const dateValue = dueDate.replaceAll('-', '');
    const description = [
      item.contract_number ? `Contract: ${item.contract_number}` : null,
      item.supplier_name ? `Supplier: ${item.supplier_name}` : null,
      item.owner ? `Owner: ${item.owner}` : null,
      item.priority ? `Priority: ${item.priority}` : null,
      item.source_clause ? `Source: ${item.source_clause}` : null,
    ]
      .filter(Boolean)
      .join('\n');
    return [
      'BEGIN:VEVENT',
      `UID:${escapeCalendarText(item.id)}@contractledger.local`,
      `DTSTAMP:${created}`,
      `DTSTART;VALUE=DATE:${dateValue}`,
      `DTEND;VALUE=DATE:${nextCalendarDay(dueDate)}`,
      `SUMMARY:${escapeCalendarText(item.title)}`,
      `DESCRIPTION:${escapeCalendarText(description)}`,
      'END:VEVENT',
    ].join('\r\n');
  });
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ContractLedger AI//Obligation Calendar//EN',
    'CALSCALE:GREGORIAN',
    ...events,
    'END:VCALENDAR',
    '',
  ].join('\r\n');
}
