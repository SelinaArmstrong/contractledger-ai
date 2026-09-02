import type {
  ManagementMetric,
  ManagementPriority,
} from '@/lib/management-insights';
import { SUPPLIER_DOCUMENT_LABELS } from '@/lib/supplier-qualification';
import type { SupplierDocumentType } from '@/lib/supplier-qualification';
import type { SupplierOnboardingDocument } from '@/components/workspace/types';

export function moneyFromCents(value: unknown, compact = false) {
  const cents = typeof value === 'number' ? value : Number(value ?? 0);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: compact ? 'compact' : 'standard',
    maximumFractionDigits: compact ? 2 : 0,
  }).format(cents / 100);
}

export function valueText(value: unknown) {
  if (value === null || value === undefined || value === '') return 'Not found';
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  ) {
    return String(value);
  }
  return 'Structured value';
}

export function usDateText(value: unknown) {
  if (typeof value !== 'string') return valueText(value);
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return valueText(value);
  return `${match[2]}/${match[3]}/${match[1]}`;
}

export function titleCase(value: unknown) {
  return valueText(value)
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function toneForStatus(status: unknown) {
  const normalized = valueText(status).toLowerCase();
  if (
    normalized.includes('missing') ||
    normalized.includes('expired') ||
    normalized.includes('incomplete') ||
    normalized.includes('follow') ||
    normalized.includes('high') ||
    normalized.includes('declined') ||
    normalized.includes('revision')
  )
    return 'rose';
  if (
    normalized.includes('active') ||
    normalized.includes('current') ||
    normalized.includes('complete') ||
    normalized.includes('approved')
  )
    return 'green';
  if (
    normalized.includes('pending') ||
    normalized.includes('review') ||
    normalized.includes('upcoming')
  )
    return 'amber';
  return 'blue';
}

export function alertTiming(value: unknown) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return null;
  const dueDate = Date.parse(`${value}T00:00:00Z`);
  const today = Date.parse(
    `${new Date().toISOString().slice(0, 10)}T00:00:00Z`,
  );
  if (Number.isNaN(dueDate)) return null;
  const days = Math.round((dueDate - today) / 86_400_000);
  if (days < 0)
    return {
      days,
      label: `${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} overdue`,
      tone: 'rose',
    };
  if (days === 0) return { days, label: 'Due today', tone: 'rose' };
  if (days <= 30)
    return {
      days,
      label: `${days} day${days === 1 ? '' : 's'} remaining`,
      tone: 'rose',
    };
  if (days <= 90)
    return { days, label: `${days} days remaining`, tone: 'amber' };
  return { days, label: `${days} days remaining`, tone: 'blue' };
}

export function supplierDocumentLabel(value: unknown) {
  const key = String(value) as SupplierDocumentType;
  return SUPPLIER_DOCUMENT_LABELS[key] ?? titleCase(value);
}

export function newSupplierDocument(): SupplierOnboardingDocument {
  return {
    id: crypto.randomUUID(),
    documentType: 'w9',
    issuer: '',
    documentNumber: '',
    effectiveDate: '',
    expirationDate: '',
    coverageSummary: '',
    overrideReason: '',
    file: null,
    aiResult: null,
    analyzing: false,
    aiError: '',
  };
}

export function managementMetricValue(metric: ManagementMetric) {
  if (metric.format === 'currency') return moneyFromCents(metric.value, true);
  if (metric.format === 'percent') return `${metric.value}%`;
  return new Intl.NumberFormat('en-US').format(metric.value);
}

export function priorityClasses(priority: ManagementPriority) {
  if (priority === 'high') return 'border-rose-200 bg-rose-50 text-rose-800';
  if (priority === 'medium')
    return 'border-amber-200 bg-amber-50 text-amber-800';
  return 'border-sky-200 bg-sky-50 text-sky-800';
}

export function storedReviewValue(value: unknown) {
  if (typeof value !== 'string') return valueText(value);
  try {
    return valueText(JSON.parse(value));
  } catch {
    return valueText(value);
  }
}
