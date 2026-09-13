'use client';

import { Badge } from '@/components/ui/badge';
import type {
  DocumentQualityReport,
  ExtractedField,
} from '@/lib/contract-ledger-types';
import { FileText } from 'lucide-react';
import type { ReactNode } from 'react';
import { titleCase } from '@/components/workspace/formatters';

export function StatusBadge({
  tone,
  children,
}: {
  tone: string;
  children: ReactNode;
}) {
  const colors: Record<string, string> = {
    amber: 'border-amber-200 bg-amber-50 text-amber-800',
    blue: 'border-sky-200 bg-sky-50 text-sky-800',
    rose: 'border-rose-200 bg-rose-50 text-rose-800',
    green: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    slate: 'border-slate-300 bg-slate-100 text-slate-700',
  };
  return (
    <Badge
      variant="outline"
      className={`workspace-status ${colors[tone] ?? colors.blue}`}
    >
      {children}
    </Badge>
  );
}

export function Panel({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`workspace-panel rounded-xl border border-border bg-card ${className}`}
    >
      {children}
    </section>
  );
}

export function PanelHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="workspace-panel-header flex flex-col justify-between gap-3 border-b border-border px-5 py-4 sm:flex-row sm:items-center">
      <div>
        <h2 className="app-section-title">{title}</h2>
        {description ? (
          <p className="app-body-copy mt-1">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex min-h-52 flex-col items-center justify-center px-6 text-center">
      <FileText className="mb-3 size-7 text-slate-300" />
      <p className="text-sm font-medium text-slate-700">{title}</p>
      <p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">
        {description}
      </p>
    </div>
  );
}

export function FieldConfidence({ field }: { field: ExtractedField }) {
  const percent = Math.round(field.confidence * 100);
  const tone = percent >= 90 ? 'green' : percent >= 75 ? 'amber' : 'rose';
  return <StatusBadge tone={tone}>{percent}%</StatusBadge>;
}

export function DocumentQualitySummary({
  report,
}: {
  report: DocumentQualityReport;
}) {
  const tone =
    report.status === 'ready'
      ? 'green'
      : report.status === 'needs_review'
        ? 'amber'
        : 'rose';
  return (
    <div className="rounded-xl border border-border bg-muted p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
            Document preflight
          </p>
          <p className="mt-1 text-[11px] text-slate-600">
            {report.inspectedPages}/{report.totalPages} pages inspected ·{' '}
            {report.textCharacters.toLocaleString()} text characters
          </p>
        </div>
        <StatusBadge tone={tone}>
          {titleCase(report.status.replaceAll('_', ' '))}
        </StatusBadge>
      </div>
      {report.issues.length ? (
        <p className="mt-2 text-[11px] leading-4 text-amber-800">
          {report.issues.join(' ')}
        </p>
      ) : (
        <p className="mt-2 text-[11px] text-emerald-700">
          Text layer and page orientation passed pre-analysis checks.
        </p>
      )}
    </div>
  );
}

export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <section className="workspace-page-heading mb-7 flex flex-col justify-between gap-5 xl:flex-row xl:items-end">
      <div>
        <div className="workspace-eyebrow mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-foreground">
          <span
            aria-hidden="true"
            className="h-3 w-0.5 rounded-full bg-accent-foreground"
          />
          {eyebrow}
        </div>
        <h1 className="app-page-title">{title}</h1>
        <p className="app-body-copy mt-3 max-w-2xl">{description}</p>
      </div>
      {action}
    </section>
  );
}

/**
 * Announces asynchronous workspace activity to assistive technology. The
 * workbench changes views and runs long AI/import operations without a page
 * load, so screen-reader users otherwise get no feedback that anything
 * happened.
 */
export function LiveStatus({
  message,
  assertive = false,
}: {
  message: string;
  assertive?: boolean;
}) {
  return (
    <output
      className="sr-only"
      aria-live={assertive ? 'assertive' : 'polite'}
      aria-atomic="true"
    >
      {message}
    </output>
  );
}

/**
 * Lets keyboard users jump past the primary navigation. Visible only while
 * focused, which is the expected behaviour for a skip link.
 */
export function SkipToContentLink({ targetId }: { targetId: string }) {
  return (
    <a
      href={`#${targetId}`}
      className="sr-only rounded-md bg-[#0d2638] px-4 py-2 text-sm font-medium text-white focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50"
    >
      Skip to main content
    </a>
  );
}
