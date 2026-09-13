'use client';

import { Button } from '@/components/ui/button';
import type { Workspace } from '@/lib/contract-ledger-types';
import { Building2, ExternalLink } from 'lucide-react';
import {
  alertTiming,
  supplierDocumentLabel,
  titleCase,
  usDateText,
  valueText,
} from '@/components/workspace/formatters';
import { EmptyState, StatusBadge } from '@/components/workspace/primitives';

export function SupplierComplianceAlert({
  item,
  onOpenSupplier,
}: {
  item: Workspace['supplierAlerts'][number];
  onOpenSupplier: () => void;
}) {
  const missing = item.source_type === 'missing_record';
  const timing = alertTiming(item.due_date);
  const tone = missing ? 'rose' : (timing?.tone ?? 'blue');

  return (
    <article
      className={`rounded-xl border p-4 ${tone === 'rose' ? 'border-rose-200 bg-rose-50/40' : tone === 'amber' ? 'border-amber-200 bg-amber-50/30' : 'border-border bg-card'}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-foreground">
              {valueText(item.supplier_name)}
            </p>
            <StatusBadge tone={tone}>
              {missing ? 'Missing record' : (timing?.label ?? 'Date pending')}
            </StatusBadge>
          </div>
          <p className="mt-1 text-xs font-medium text-[#335565]">
            {supplierDocumentLabel(item.item_type)} · {valueText(item.title)}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            Vendor {valueText(item.vendor_number)}
            {item.due_date ? ` · Expires ${valueText(item.due_date)}` : ''}
            {item.document_number
              ? ` · Document ${valueText(item.document_number)}`
              : ''}
            {item.issuer ? ` · Issuer ${valueText(item.issuer)}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {item.document_id ? (
            <a
              href={`/api/document?id=${encodeURIComponent(String(item.document_id))}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-[11px] font-medium text-accent-foreground"
            >
              <ExternalLink className="size-3.5" /> Open file
            </a>
          ) : null}
          <Button variant="outline" size="sm" onClick={onOpenSupplier}>
            <Building2 /> Open supplier
          </Button>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-current/10 pt-3 text-[11px] text-slate-500">
        <span>Review status: {titleCase(item.review_status)}</span>
        <span>
          {missing
            ? 'Qualification file required'
            : item.document_id
              ? 'Qualification document'
              : 'Supplier register record'}
        </span>
      </div>
    </article>
  );
}

export function KeyDateList({ items }: { items: Workspace['keyDates'] }) {
  if (!items.length)
    return (
      <EmptyState
        title="No current alerts"
        description="Verified contract renewal, notice, and performance dates will appear here."
      />
    );
  return (
    <div className="divide-y divide-border px-5">
      {items.map((item) => (
        <div key={String(item.id)} className="flex items-start gap-3 py-4">
          <span
            className={`mt-1 size-2 shrink-0 rounded-full ${item.type === 'non_renewal_notice' ? 'bg-rose-500' : item.type === 'insurance_expiration' ? 'bg-amber-500' : 'bg-sky-500'}`}
          />
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-medium text-[#263c49]">
              {valueText(item.title)}
            </p>
            <p className="mt-1 truncate text-[11px] text-slate-500">
              {valueText(item.contract_number ?? item.supplier_name)}
            </p>
          </div>
          <div className="text-right">
            <span className="text-[11px] font-medium text-slate-600">
              {usDateText(item.due_date)}
            </span>
            {item.source_page ? (
              <p className="mt-1 text-[11px] text-slate-400">
                Source p. {item.source_page}
              </p>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
