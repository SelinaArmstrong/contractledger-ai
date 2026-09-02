'use client';

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
import {
  ArrowRight,
  CircleCheck,
  FlaskConical,
  ShieldCheck,
} from 'lucide-react';
import {
  portfolioDemoChapters,
  portfolioReleaseEvidence,
} from '@/components/workspace/constants';
import { valueText } from '@/components/workspace/formatters';
import {
  PageHeading,
  Panel,
  PanelHeader,
  StatusBadge,
} from '@/components/workspace/primitives';
import type { ViewName } from '@/components/workspace/types';
import { WorkflowTimingPanel } from '@/components/workspace/workflow-timing-panel';

export function PortfolioCaseStudyView({
  workspace,
  onNavigate,
  canRecordTimings,
}: {
  workspace: Workspace | null;
  onNavigate: (view: ViewName) => void;
  canRecordTimings: boolean;
}) {
  const liveEvidence = [
    {
      label: 'Active contracts',
      value: valueText(workspace?.metrics.active_contracts),
      note: 'Executed records only',
    },
    {
      label: 'Active suppliers',
      value: valueText(workspace?.metrics.active_suppliers),
      note: `${valueText(workspace?.metrics.pending_suppliers)} pending onboarding`,
    },
    {
      label: 'Open obligations',
      value: valueText(workspace?.obligationMetrics.open_obligations),
      note: `${valueText(workspace?.obligationMetrics.overdue_obligations)} calculated overdue`,
    },
    {
      label: 'Open approvals',
      value: valueText(workspace?.approvalMetrics.open_requests),
      note: `${valueText(workspace?.approvalMetrics.blocked_intakes)} blocked intakes`,
    },
  ];

  return (
    <>
      <PageHeading
        eyebrow="Portfolio-ready evidence"
        title="Contract Operations Case Study"
        description="A concise interview narrative, ten-minute demonstration path, and claim-safe evidence ledger for the complete ContractLedger AI lifecycle."
        action={
          <Button
            variant="outline"
            onClick={() => onNavigate('AI Accuracy & Validation')}
          >
            <FlaskConical className="size-4" /> Open validation evidence
          </Button>
        }
      />

      <Panel className="mb-5 overflow-hidden border-[#bfd4dd]">
        <div className="grid gap-0 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="bg-[#0f3044] px-6 py-7 text-white md:px-8 md:py-9">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#79c6dd]">
              Portfolio thesis
            </p>
            <h2 className="mt-3 max-w-3xl text-2xl font-semibold tracking-[-0.025em] md:text-3xl">
              Turn unstructured agreements into verified operational records
              without hiding the human decisions.
            </h2>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300">
              ContractLedger AI stages legacy data, separates drafts from
              official records, routes exceptions, reproduces effective terms,
              and converts dates into accountable work. Every material result
              remains tied to its source, reviewer, rule, and history.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-px bg-[#dce6ea]">
            {[
              ['7', 'Lifecycle releases', 'v0.2–v0.8'],
              ['15', 'Evaluation cases', 'Fictional ground truth'],
              ['7 / 13', 'Roles / permissions', 'Server enforced'],
              ['101', 'Passing tests', '2026-09-02 v1.0 baseline'],
            ].map(([value, label, note]) => (
              <div key={label} className="bg-[#f8fbfc] p-5 md:p-6">
                <p className="text-2xl font-semibold text-[#14384d]">{value}</p>
                <p className="mt-2 text-[11px] font-semibold text-slate-700">
                  {label}
                </p>
                <p className="mt-1 text-[9px] text-slate-500">{note}</p>
              </div>
            ))}
          </div>
        </div>
      </Panel>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {liveEvidence.map((item) => (
          <article
            key={item.label}
            className="rounded-xl border border-[#dce3e8] bg-white p-4 shadow-sm"
          >
            <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-500">
              Current demo state
            </p>
            <div className="mt-2 flex items-end justify-between gap-3">
              <div>
                <p className="text-xl font-semibold text-[#183040]">
                  {item.value}
                </p>
                <p className="mt-1 text-[10px] font-medium text-slate-700">
                  {item.label}
                </p>
              </div>
              <CircleCheck className="mb-1 size-4 text-[#2d8a72]" />
            </div>
            <p className="mt-2 text-[9px] text-slate-500">{item.note}</p>
          </article>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
        <div className="space-y-5">
          <Panel>
            <PanelHeader
              title="Case-study decisions"
              description="The product choices that make the workflow defensible rather than merely automated."
            />
            <div className="grid gap-3 p-5 md:grid-cols-2">
              {[
                [
                  'Draft ≠ official record',
                  'Reviewed proposals remain intakes. Only authorized executed agreements enter official totals and registers.',
                ],
                [
                  'Source before confidence',
                  'Critical fields require a supporting page and quote or an explicit reviewer override reason.',
                ],
                [
                  'Rules own operational decisions',
                  'Deterministic code controls approvals, arithmetic, overdue state, risk factors, and permissions.',
                ],
                [
                  'History stays reproducible',
                  'Original terms, amendments, decisions, obligation events, and exported evidence remain linked.',
                ],
              ].map(([title, description], index) => (
                <article
                  key={title}
                  className="rounded-xl border border-[#dce3e8] bg-[#f8fafb] p-4"
                >
                  <div className="flex items-start gap-3">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[#dff0f5] text-[10px] font-semibold text-[#1d718f]">
                      {index + 1}
                    </span>
                    <div>
                      <h3 className="text-xs font-semibold text-[#203845]">
                        {title}
                      </h3>
                      <p className="mt-1 text-[10px] leading-5 text-slate-600">
                        {description}
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </Panel>

          <Panel className="overflow-hidden">
            <PanelHeader
              title="Release evidence ledger"
              description="Each claim is paired with reproducible evidence and an explicit boundary."
            />
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-5">Release</TableHead>
                    <TableHead>Capability</TableHead>
                    <TableHead>Verified evidence</TableHead>
                    <TableHead className="pr-5">Claim boundary</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {portfolioReleaseEvidence.map((item) => (
                    <TableRow key={item.release} className="align-top">
                      <TableCell className="pl-5">
                        <StatusBadge tone="green">{item.release}</StatusBadge>
                      </TableCell>
                      <TableCell className="text-[10px] font-semibold text-[#203845]">
                        {item.capability}
                      </TableCell>
                      <TableCell className="min-w-72 text-[10px] leading-5 text-slate-600">
                        {item.evidence}
                      </TableCell>
                      <TableCell className="min-w-56 pr-5 text-[9px] leading-4 text-slate-500">
                        {item.boundary}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Panel>
        </div>

        <div className="space-y-5">
          <Panel>
            <PanelHeader
              title="10-minute demo route"
              description="A paced path from business problem to measured evidence."
            />
            <ol className="divide-y divide-[#e7ecef]">
              {portfolioDemoChapters.map((chapter, index) => (
                <li key={`${chapter.time}-${chapter.title}`} className="p-4">
                  <button
                    type="button"
                    onClick={() => onNavigate(chapter.view)}
                    className="group flex w-full items-start gap-3 text-left"
                  >
                    <span className="flex h-7 min-w-12 items-center justify-center rounded-lg bg-[#edf5f7] px-2 text-[9px] font-semibold text-[#276e87]">
                      {chapter.time}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[11px] font-semibold text-[#203845]">
                        {index + 1}. {chapter.title}
                      </span>
                      <span className="mt-1 block text-[9px] leading-4 text-slate-500">
                        {chapter.proof}
                      </span>
                      <span className="mt-2 inline-flex items-center gap-1 text-[9px] font-medium text-[#1d718f]">
                        {chapter.view}
                        <ArrowRight className="size-3 transition group-hover:translate-x-0.5" />
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </Panel>

          <Panel>
            <PanelHeader
              title="Evidence boundaries"
              description="What this portfolio deliberately does not claim."
            />
            <ul className="space-y-3 p-5">
              {[
                'No real-company time-savings percentage until repeated paired timing runs are saved.',
                'No extraction-accuracy claim without a named completed run, dataset version, and sample size.',
                'No legal-advice, negotiation-outcome, or contract-enforceability claim.',
                'No production duplicate-precision claim without labeled false-positive and false-negative evidence.',
                'No external-notification claim while outbox delivery remains intentionally unconfigured.',
              ].map((boundary) => (
                <li
                  key={boundary}
                  className="flex items-start gap-2 text-[10px] leading-5 text-slate-600"
                >
                  <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-[#2d8a72]" />
                  {boundary}
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
      <WorkflowTimingPanel canRecord={canRecordTimings} />
    </>
  );
}
