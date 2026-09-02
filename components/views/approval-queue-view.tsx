'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { Workspace } from '@/lib/contract-ledger-types';
import { useState } from 'react';
import { ApprovalDecisionDialog } from '@/components/dialogs/approval-decision-dialog';
import {
  titleCase,
  toneForStatus,
  usDateText,
} from '@/components/workspace/formatters';
import {
  EmptyState,
  PageHeading,
  StatusBadge,
} from '@/components/workspace/primitives';

export function ApprovalQueueView({
  workspace,
  onUpdated,
  onOpenIntake,
}: {
  workspace: Workspace | null;
  onUpdated: (workspace: Workspace) => void;
  onOpenIntake: (id: string) => void;
}) {
  const [statusFilter, setStatusFilter] = useState('open');
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(
    null,
  );
  const filtered = (workspace?.approvalQueue ?? []).filter((item) =>
    statusFilter === 'all'
      ? true
      : statusFilter === 'open'
        ? ['pending', 'in_review', 'revision_requested'].includes(
            item.request_status,
          )
        : item.request_status === statusFilter,
  );
  const metrics = workspace?.approvalMetrics;

  return (
    <>
      <PageHeading
        eyebrow="Controlled decisions"
        title="Approvals & Exceptions"
        description="Route deterministic policy triggers to accountable reviewers, preserve every decision, and prevent execution while mandatory controls remain incomplete."
        action={
          <label className="text-[10px] font-medium text-slate-500">
            Status
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="ml-2 h-9 rounded-md border border-input bg-white px-3 text-xs text-slate-700"
            >
              <option value="open">Open decisions</option>
              <option value="all">All decisions</option>
              <option value="pending">Pending</option>
              <option value="in_review">In review</option>
              <option value="revision_requested">Revision requested</option>
              <option value="approved">Approved</option>
              <option value="declined">Declined</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          ['Open requests', metrics?.open_requests ?? 0, 'Awaiting a decision'],
          ['Overdue', metrics?.overdue_requests ?? 0, 'Past the deadline'],
          ['Blocked intakes', metrics?.blocked_intakes ?? 0, 'Gate is active'],
          [
            'Avg. turnaround',
            `${metrics?.average_turnaround_hours ?? 0}h`,
            'Completed requests',
          ],
          [
            'Exception rate',
            `${metrics?.exception_approval_rate ?? 0}%`,
            'Exception approvals ÷ decisions',
          ],
        ].map(([label, value, note]) => (
          <article
            key={String(label)}
            className="rounded-xl border border-[#dce3e8] bg-white p-4 shadow-sm"
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
              {label}
            </p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-[#183040]">
              {value}
            </p>
            <p className="mt-1 text-[9px] text-slate-500">{note}</p>
          </article>
        ))}
      </div>

      <section className="overflow-hidden rounded-xl border border-[#dce3e8] bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-[#e2e8eb] px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-[#203845]">
              Approval aging queue
            </h2>
            <p className="mt-1 text-[10px] text-slate-500">
              Owner, source, rule version, age, and deadline travel with every
              decision.
            </p>
          </div>
          <Badge variant="outline">{filtered.length} shown</Badge>
        </div>
        {filtered.length ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-5">Control / reason</TableHead>
                  <TableHead>Intake</TableHead>
                  <TableHead>Decision owner</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Age / deadline</TableHead>
                  <TableHead className="pr-5 text-right">Source</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((item) => (
                  <TableRow key={item.step_id} className="align-top">
                    <TableCell className="max-w-[360px] pl-5">
                      <p className="text-xs font-semibold text-[#1d718f]">
                        {item.rule_name}
                      </p>
                      <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-slate-500">
                        {item.reason}
                      </p>
                      <p className="mt-1 text-[9px] text-slate-400">
                        {item.rule_key} · v{item.rule_version}
                      </p>
                    </TableCell>
                    <TableCell>
                      <p className="text-[11px] font-medium text-slate-700">
                        {item.intake_number}
                      </p>
                      <p className="mt-1 max-w-52 truncate text-[9px] text-slate-500">
                        {item.intake_title}
                      </p>
                    </TableCell>
                    <TableCell>
                      <p className="text-[11px] font-medium text-slate-700">
                        {item.owner_role}
                      </p>
                      <p className="mt-1 text-[9px] text-slate-500">
                        {item.assigned_reviewer || 'Unassigned'}
                      </p>
                    </TableCell>
                    <TableCell>
                      <StatusBadge tone={toneForStatus(item.request_status)}>
                        {titleCase(item.request_status)}
                      </StatusBadge>
                      {item.escalation_level ? (
                        <p className="mt-1 text-[9px] text-amber-700">
                          Escalation level {item.escalation_level}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <p
                        className={`text-[11px] font-medium ${item.overdue ? 'text-rose-700' : 'text-slate-700'}`}
                      >
                        {item.age_days} day{item.age_days === 1 ? '' : 's'} open
                      </p>
                      <p className="mt-1 text-[9px] text-slate-500">
                        Due {usDateText(item.due_at)}
                      </p>
                    </TableCell>
                    <TableCell className="pr-5 text-right">
                      <p className="max-w-52 truncate text-[10px] text-slate-600">
                        {item.source_file_name || 'Verified register data'}
                      </p>
                      {item.source_page ? (
                        <p className="mt-1 text-[9px] text-slate-400">
                          Page {item.source_page}
                        </p>
                      ) : null}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedRequestId(item.request_id)}
                        className="mt-2 h-7 px-2 text-[9px]"
                      >
                        Review decision
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <EmptyState
            title="No approvals in this view"
            description="Change the filter or save a draft whose verified values trigger a versioned approval rule."
          />
        )}
      </section>

      {selectedRequestId ? (
        <ApprovalDecisionDialog
          requestId={selectedRequestId}
          onClose={() => setSelectedRequestId(null)}
          onUpdated={onUpdated}
          onOpenIntake={(id) => {
            setSelectedRequestId(null);
            onOpenIntake(id);
          }}
        />
      ) : null}
    </>
  );
}
