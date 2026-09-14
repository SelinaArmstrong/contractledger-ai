'use client';

import type { WorkspaceRole } from '@/lib/workspace-roles';

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
import {
  FloatingTableScrollbar,
  TablePagination,
  useFloatingTableScrollbar,
} from '@/components/workspace/table';

export function ApprovalQueueView({
  workspace,
  currentRole,
  onUpdated,
  onOpenIntake,
  onOpenRule,
}: {
  workspace: Workspace | null;
  currentRole: WorkspaceRole;
  onUpdated: (workspace: Workspace) => void;
  onOpenIntake: (id: string) => void;
  /** Opens the read-only rules reference at the control that fired. */
  onOpenRule: (ruleKey: string) => void;
}) {
  const [statusFilter, setStatusFilter] = useState('open');
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(
    null,
  );
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(1);
  const queueTableScroll = useFloatingTableScrollbar();
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
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageStart = (safePage - 1) * pageSize;
  const pageItems = filtered.slice(pageStart, pageStart + pageSize);

  return (
    <>
      <PageHeading
        eyebrow="Controlled decisions"
        title="Approvals & Exceptions"
        description="Route deterministic policy triggers to accountable reviewers, preserve every decision, and prevent execution while mandatory controls remain incomplete."
        action={
          <label className="text-[11px] font-medium text-slate-500">
            Status
            <select
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value);
                setPage(1);
              }}
              className="ml-2 h-9 rounded-md border border-input bg-card px-3 text-xs text-slate-700"
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
            className="rounded-xl border border-border bg-card p-4 shadow-sm"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
              {label}
            </p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
              {value}
            </p>
            <p className="mt-1 text-[11px] text-slate-500">{note}</p>
          </article>
        ))}
      </div>

      <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              Approval aging queue
            </h2>
            <p className="mt-1 text-[11px] text-slate-500">
              Owner, source, rule version, age, and deadline travel with every
              decision.
            </p>
          </div>
          <Badge variant="outline">{filtered.length} shown</Badge>
        </div>
        {filtered.length ? (
          <div>
            <Table
              className="min-w-[1180px]"
              containerRef={queueTableScroll.tableScrollerRef}
              onContainerScroll={queueTableScroll.syncTableToFloating}
            >
              <TableHeader>
                <TableRow>
                  <TableHead className="w-14 pl-5 text-center">No.</TableHead>
                  <TableHead>Control / reason</TableHead>
                  <TableHead>Intake</TableHead>
                  <TableHead>Decision owner</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Age / deadline</TableHead>
                  <TableHead className="pr-5 text-right">Source</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageItems.map((item, index) => (
                  <TableRow key={item.step_id} className="align-top">
                    <TableCell className="pl-5 text-center text-xs font-medium text-slate-500">
                      {pageStart + index + 1}
                    </TableCell>
                    <TableCell className="max-w-[360px]">
                      <p className="text-xs font-semibold text-accent-foreground">
                        {item.rule_name}
                      </p>
                      <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-slate-500">
                        {item.reason}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-400">
                        {item.rule_key} · v{item.rule_version}
                      </p>
                    </TableCell>
                    <TableCell>
                      <p className="text-[11px] font-medium text-slate-700">
                        {item.intake_number}
                      </p>
                      <p className="mt-1 max-w-52 truncate text-[11px] text-slate-500">
                        {item.intake_title}
                      </p>
                    </TableCell>
                    <TableCell>
                      <p className="text-[11px] font-medium text-slate-700">
                        {item.owner_role}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-500">
                        {item.assigned_reviewer || 'Unassigned'}
                      </p>
                    </TableCell>
                    <TableCell>
                      <StatusBadge tone={toneForStatus(item.request_status)}>
                        {titleCase(item.request_status)}
                      </StatusBadge>
                      {item.escalation_level ? (
                        <p className="mt-1 text-[11px] text-amber-700">
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
                      <p className="mt-1 text-[11px] text-slate-500">
                        Due {usDateText(item.due_at)}
                      </p>
                    </TableCell>
                    <TableCell className="pr-5 text-right">
                      <p className="max-w-52 truncate text-[11px] text-slate-600">
                        {item.source_file_name || 'Verified register data'}
                      </p>
                      {item.source_page ? (
                        <p className="mt-1 text-[11px] text-slate-400">
                          Page {item.source_page}
                        </p>
                      ) : null}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedRequestId(item.request_id)}
                        className="mt-2 h-7 px-2 text-[11px]"
                      >
                        Review decision
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <TablePagination
              label="Approval queue pagination"
              page={safePage}
              pageSize={pageSize}
              total={filtered.length}
              onPageChange={setPage}
              onPageSizeChange={(nextPageSize) => {
                setPageSize(nextPageSize);
                setPage(1);
              }}
              floating={queueTableScroll.floating}
            />
            <FloatingTableScrollbar
              label="Approval queue horizontal scrollbar"
              floating={queueTableScroll.floating}
              floatingScrollerRef={queueTableScroll.floatingScrollerRef}
              onScroll={queueTableScroll.syncFloatingToTable}
            />
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
          currentRole={currentRole}
          requestId={selectedRequestId}
          onClose={() => setSelectedRequestId(null)}
          onUpdated={onUpdated}
          onOpenIntake={(id) => {
            setSelectedRequestId(null);
            onOpenIntake(id);
          }}
          onOpenRule={(ruleKey) => {
            setSelectedRequestId(null);
            onOpenRule(ruleKey);
          }}
        />
      ) : null}
    </>
  );
}
