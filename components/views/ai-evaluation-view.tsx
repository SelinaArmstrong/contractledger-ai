'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
import {
  AI_EVALUATION_CASES,
  AI_EVALUATION_DATASET_VERSION,
} from '@/lib/ai-evaluation';
import type { Workspace } from '@/lib/contract-ledger-types';
import {
  AlertCircle,
  AlertTriangle,
  ChevronDown,
  CircleCheck,
  Download,
  FlaskConical,
  LoaderCircle,
  ShieldCheck,
} from 'lucide-react';
import { useState } from 'react';
import { demoPlaybookRules } from '@/components/workspace/constants';
import { titleCase, valueText } from '@/components/workspace/formatters';
import {
  PageHeading,
  Panel,
  PanelHeader,
  StatusBadge,
} from '@/components/workspace/primitives';
import type { EvaluationDetail } from '@/components/workspace/types';

export function AIEvaluationView({
  workspace,
  onCompleted,
}: {
  workspace: Workspace | null;
  onCompleted: (workspace: Workspace) => void;
}) {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const latest = workspace?.evaluationRuns[0];
  let details: EvaluationDetail[] = [];
  if (typeof latest?.details_json === 'string') {
    try {
      details = JSON.parse(latest.details_json) as EvaluationDetail[];
    } catch {
      details = [];
    }
  }
  const isSeededRun = String(latest?.model ?? '').startsWith(
    'seeded-demonstration',
  );
  const reviewedOperationalFields = Number(
    workspace?.aiGovernanceMetrics?.reviewed_fields ?? 0,
  );
  const correctionRows = workspace?.aiCorrectionByField ?? [];
  const governanceMetrics = workspace?.aiGovernanceMetrics;
  const documentTypeMetrics = [
    ...new Set(details.map((item) => item.documentType)),
  ]
    .map((documentType) => {
      const cases = details.filter(
        (item) => item.documentType === documentType,
      );
      const fields = cases.flatMap((item) => item.fields);
      const correct = fields.filter((item) => item.correct).length;
      return {
        documentType,
        caseCount: cases.length,
        fields: fields.length,
        accuracy: fields.length
          ? Number(((correct / fields.length) * 100).toFixed(1))
          : 0,
        medianDuration:
          cases.map((item) => item.durationMs).sort((a, b) => a - b)[
            Math.floor(cases.length / 2)
          ] ?? 0,
      };
    })
    .sort((a, b) => a.documentType.localeCompare(b.documentType));

  const runEvaluation = async () => {
    setRunning(true);
    setError('');
    try {
      setProgress(
        `Running ${AI_EVALUATION_CASES.length} locked documents through a server-controlled evaluation…`,
      );
      const response = await fetch('/api/evaluations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'run' }),
      });
      const body = (await response.json()) as {
        workspace?: Workspace;
        error?: string;
      };
      if (!response.ok || !body.workspace)
        throw new Error(body.error || 'Unable to save the evaluation result.');
      onCompleted(body.workspace);
      setProgress('Evaluation completed and saved.');
    } catch (runError) {
      setError(
        runError instanceof Error
          ? runError.message
          : 'Unable to complete the AI evaluation.',
      );
      setProgress('');
    } finally {
      setRunning(false);
    }
  };

  const approveBaseline = async () => {
    if (!latest?.id) return;
    setRunning(true);
    setError('');
    try {
      const response = await fetch('/api/evaluations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve_baseline',
          runId: String(latest.id),
        }),
      });
      const body = (await response.json()) as {
        workspace?: Workspace;
        error?: string;
      };
      if (!response.ok || !body.workspace)
        throw new Error(body.error || 'Unable to approve the baseline.');
      onCompleted(body.workspace);
      setProgress('Approved baseline saved for this dataset version.');
    } catch (approvalError) {
      setError(
        approvalError instanceof Error
          ? approvalError.message
          : 'Unable to approve the baseline.',
      );
    } finally {
      setRunning(false);
    }
  };

  const exportReport = () => {
    if (!latest?.id) return;
    window.location.assign(
      `/api/evaluations?runId=${encodeURIComponent(String(latest.id))}`,
    );
  };

  return (
    <>
      <PageHeading
        eyebrow="Portfolio evidence · model validation"
        title="AI accuracy & validation"
        description="Validate live AI extraction against a locked fictional ground-truth set. Accuracy, source traceability, and confidence are measured and saved as interview evidence—not used for daily contract operations."
        action={
          <div className="flex flex-wrap gap-2">
            {latest ? (
              <Button variant="outline" onClick={exportReport}>
                <Download /> Export validation CSV
              </Button>
            ) : null}
            <Button
              onClick={runEvaluation}
              disabled={running}
              className="bg-[#1d718f] hover:bg-[#185f78]"
            >
              {running ? (
                <LoaderCircle className="animate-spin" />
              ) : (
                <FlaskConical />
              )}
              Run validation set
            </Button>
          </div>
        }
      />
      <Alert className="mb-5 border-amber-200 bg-amber-50 text-amber-900">
        <AlertTriangle />
        <AlertTitle>Validation evidence—not an operational workflow</AlertTitle>
        <AlertDescription>
          This page measures a locked fictional dataset separately from live
          registers. Targets are development gates; achieved results remain
          versioned evidence. Evaluation fixtures are never inserted into
          operational contract or supplier tables.
        </AlertDescription>
      </Alert>

      {isSeededRun ? (
        <Alert className="mb-5 border-slate-300 bg-slate-100 text-slate-800">
          <FlaskConical />
          <AlertTitle>
            Seeded demonstration report — not a model measurement
          </AlertTitle>
          <AlertDescription>
            The figures below were replayed from the fixture ground truth with a
            fixed set of injected defects so this page has evidence to show
            without an API key. They describe the scoring instrumentation, not
            any model&apos;s accuracy, and this run is deliberately not an
            approved baseline. Choose <strong>Run validation set</strong> with a
            configured model to record a real measurement.
          </AlertDescription>
        </Alert>
      ) : null}

      {progress ? (
        <Alert className="mb-5 border-sky-200 bg-sky-50 text-sky-900">
          {running ? (
            <LoaderCircle className="animate-spin" />
          ) : (
            <CircleCheck />
          )}
          <AlertTitle>
            {running ? 'Evaluation in progress' : 'Evaluation saved'}
          </AlertTitle>
          <AlertDescription>{progress}</AlertDescription>
        </Alert>
      ) : null}
      {error ? (
        <Alert variant="destructive" className="mb-5">
          <AlertCircle />
          <AlertTitle>Evaluation needs attention</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {latest ? (
        <>
          <section className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[
              [
                'Field accuracy',
                `${valueText(latest.accuracy_percent)}%`,
                `${valueText(latest.correct_fields)} of ${valueText(latest.total_fields)} ground-truth fields`,
              ],
              [
                'Critical-field accuracy',
                `${valueText(latest.critical_accuracy_percent)}%`,
                `${valueText(latest.correct_critical_fields)} of ${valueText(latest.critical_fields)} party, value, date, reference and notice fields`,
              ],
              [
                'Source coverage',
                `${valueText(latest.source_coverage_percent)}%`,
                `${valueText(latest.unsupported_value_percent)}% unsupported-value rate`,
              ],
              [
                'Processing success',
                `${valueText(latest.processing_success_percent)}%`,
                `${valueText(latest.successful_cases)} succeeded · ${valueText(latest.failed_cases)} failed · median ${Math.round(Number(latest.median_duration_ms ?? 0) / 1000)}s`,
              ],
              [
                'Human correction rate',
                reviewedOperationalFields
                  ? `${valueText(governanceMetrics?.correction_rate_percent)}%`
                  : '—',
                reviewedOperationalFields
                  ? `${valueText(governanceMetrics?.corrected_fields)} corrected of ${reviewedOperationalFields} reviewed operational fields`
                  : 'Verify a contract or supplier record to start collecting correction evidence',
              ],
              [
                'Regression gate',
                valueText(latest.promotion_status).replaceAll('_', ' '),
                latest.regression_delta === null
                  ? 'Approve a complete run to establish the dataset baseline'
                  : `${Number(latest.regression_delta) >= 0 ? '+' : ''}${valueText(latest.regression_delta)} points vs ${valueText(latest.baseline_run_id)}`,
              ],
            ].map(([label, metric, note]) => (
              <article
                key={label}
                className="rounded-xl border border-[#dce3e8] bg-white p-5"
              >
                <p className="text-[11px] font-medium text-slate-500">
                  {label}
                </p>
                <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[#173246]">
                  {metric}
                </p>
                <p className="mt-2 text-[10px] leading-4 text-slate-500">
                  {note}
                </p>
              </article>
            ))}
          </section>

          <Panel className="overflow-hidden">
            <PanelHeader
              title="Latest validation evidence"
              description={`${valueText(latest.model)} · ${valueText(latest.prompt_version)} · ${valueText(latest.dataset_version)} · ${valueText(latest.case_count)} documents`}
              action={
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge
                    tone={
                      latest.promotion_status === 'blocked' ? 'rose' : 'green'
                    }
                  >
                    {valueText(latest.promotion_status).replaceAll('_', ' ')}
                  </StatusBadge>
                  {!Number(latest.is_approved_baseline) &&
                  latest.promotion_status !== 'blocked' &&
                  Number(latest.failed_cases ?? 0) === 0 ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={approveBaseline}
                      disabled={running}
                    >
                      <ShieldCheck /> Approve baseline
                    </Button>
                  ) : Number(latest.is_approved_baseline) ? (
                    <StatusBadge tone="blue">Approved baseline</StatusBadge>
                  ) : null}
                </div>
              }
            />
            <div className="divide-y divide-[#e3e9ed]">
              {details.map((detail) => (
                <details key={detail.caseId} className="group">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4">
                    <div>
                      <p className="text-xs font-semibold text-[#203845]">
                        {detail.title}
                      </p>
                      <p className="mt-1 text-[10px] text-slate-500">
                        {detail.documentType} · {detail.difficulty} ·{' '}
                        {detail.correctFields} of {detail.totalFields} fields
                        matched · {(detail.durationMs / 1000).toFixed(1)}s
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge
                        tone={
                          detail.status === 'failed'
                            ? 'rose'
                            : detail.accuracyPercent >= 90
                              ? 'green'
                              : 'amber'
                        }
                      >
                        {detail.status === 'failed'
                          ? 'Analysis failed'
                          : `${detail.accuracyPercent}% accuracy`}
                      </StatusBadge>
                      <ChevronDown className="size-4 text-slate-400 transition-transform group-open:rotate-180" />
                    </div>
                  </summary>
                  <div className="overflow-x-auto border-t border-[#e3e9ed] bg-[#f8fafb]">
                    {detail.failureReason ? (
                      <p className="border-b border-rose-200 bg-rose-50 px-5 py-3 text-[11px] text-rose-800">
                        {detail.failureReason}
                      </p>
                    ) : null}
                    <Table className="min-w-[820px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="px-5">Field</TableHead>
                          <TableHead>Expected</TableHead>
                          <TableHead>AI result</TableHead>
                          <TableHead>Accuracy</TableHead>
                          <TableHead>Confidence</TableHead>
                          <TableHead className="pr-5">
                            Source evidence
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detail.fields.map((field) => (
                          <TableRow key={field.fieldName}>
                            <TableCell className="px-5 text-xs font-medium">
                              {field.label}
                              {field.critical ? (
                                <span className="ml-1 text-[9px] text-rose-600">
                                  Critical
                                </span>
                              ) : null}
                            </TableCell>
                            <TableCell className="text-xs text-slate-500">
                              {valueText(field.expected)}
                            </TableCell>
                            <TableCell className="text-xs">
                              {valueText(field.actual)}
                            </TableCell>
                            <TableCell>
                              <StatusBadge
                                tone={field.correct ? 'green' : 'rose'}
                              >
                                {field.correct ? 'Match' : 'Mismatch'}
                              </StatusBadge>
                            </TableCell>
                            <TableCell className="text-xs">
                              {Math.round(field.confidence * 100)}%
                            </TableCell>
                            <TableCell className="pr-5">
                              <StatusBadge
                                tone={field.sourceBacked ? 'green' : 'rose'}
                              >
                                {field.sourceBacked
                                  ? 'Page + quote'
                                  : 'Missing source'}
                              </StatusBadge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </details>
              ))}
            </div>
          </Panel>

          <div className="mt-5 grid gap-5 xl:grid-cols-2">
            <Panel className="overflow-hidden">
              <PanelHeader
                title="Quality by document type"
                description="Achieved values for the latest locked dataset—not targets"
              />
              <div className="overflow-x-auto">
                <Table className="min-w-[620px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="px-5">Document type</TableHead>
                      <TableHead>Cases</TableHead>
                      <TableHead>Fields</TableHead>
                      <TableHead>Accuracy</TableHead>
                      <TableHead className="pr-5">Median time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {documentTypeMetrics.map((item) => (
                      <TableRow key={item.documentType}>
                        <TableCell className="px-5 text-xs font-medium">
                          {item.documentType}
                        </TableCell>
                        <TableCell className="text-xs">
                          {item.caseCount}
                        </TableCell>
                        <TableCell className="text-xs">{item.fields}</TableCell>
                        <TableCell>
                          <StatusBadge
                            tone={item.accuracy >= 90 ? 'green' : 'amber'}
                          >
                            {item.accuracy}%
                          </StatusBadge>
                        </TableCell>
                        <TableCell className="pr-5 text-xs">
                          {(item.medianDuration / 1000).toFixed(1)}s
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Panel>

            <Panel className="overflow-hidden">
              <PanelHeader
                title="Operational human corrections"
                description="Reviewed demo records grouped by field, workflow, model and prompt"
              />
              <div className="max-h-[430px] overflow-auto">
                <Table className="min-w-[760px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="px-5">Field</TableHead>
                      <TableHead>Workflow</TableHead>
                      <TableHead>Model / prompt</TableHead>
                      <TableHead>Reviewed</TableHead>
                      <TableHead className="pr-5">Correction rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {correctionRows.slice(0, 20).map((item, index) => (
                      <TableRow
                        key={`${valueText(item.field_name)}-${valueText(item.stage)}-${index}`}
                      >
                        <TableCell className="px-5 text-xs font-medium">
                          {titleCase(valueText(item.field_name))}
                        </TableCell>
                        <TableCell className="text-xs">
                          {titleCase(valueText(item.stage))}
                        </TableCell>
                        <TableCell className="max-w-[260px] text-[10px] text-slate-500">
                          {valueText(item.model)} ·{' '}
                          {valueText(item.prompt_version)}
                        </TableCell>
                        <TableCell className="text-xs">
                          {valueText(item.reviewed_fields)}
                        </TableCell>
                        <TableCell className="pr-5">
                          <StatusBadge
                            tone={
                              Number(item.correction_rate_percent ?? 0) <= 10
                                ? 'green'
                                : 'amber'
                            }
                          >
                            {valueText(item.correction_rate_percent)}%
                          </StatusBadge>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!correctionRows.length ? (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="px-5 py-8 text-center text-xs text-slate-500"
                        >
                          No operational AI fields have been reviewed yet.
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </div>
            </Panel>
          </div>

          <Panel className="mt-5 overflow-hidden">
            <PanelHeader
              title="Governance targets versus achieved controls"
              description={`Dataset ${valueText(latest.dataset_version)} · fixture ${valueText(latest.fixture_version)} · ${valueText(latest.case_count)} documents`}
            />
            <div className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-4">
              {[
                [
                  'Critical source control',
                  '100% target',
                  `${valueText(governanceMetrics?.critical_source_control_percent)}% achieved`,
                ],
                [
                  'Unknown case IDs',
                  '0 accepted target',
                  '0 accepted · server manifest only',
                ],
                [
                  'Regression threshold',
                  `${valueText(latest.regression_threshold)} points`,
                  valueText(latest.promotion_status).replaceAll('_', ' '),
                ],
                [
                  'Fixture isolation',
                  'No operational writes',
                  `${AI_EVALUATION_CASES.length} evaluation-only files`,
                ],
              ].map(([label, target, achieved]) => (
                <article
                  key={label}
                  className="rounded-xl border border-[#dce3e8] bg-[#f8fafb] p-4"
                >
                  <p className="text-[10px] font-semibold text-[#203845]">
                    {label}
                  </p>
                  <p className="mt-2 text-[10px] text-slate-500">
                    Target · {target}
                  </p>
                  <p className="mt-1 text-xs font-medium text-[#287693]">
                    Achieved · {achieved}
                  </p>
                </article>
              ))}
            </div>
          </Panel>
        </>
      ) : (
        <Panel>
          <PanelHeader
            title="Locked fictional validation set"
            description={`${AI_EVALUATION_DATASET_VERSION} · ${AI_EVALUATION_CASES.length} server-controlled fixtures · live AI results never enter operational registers`}
          />
          <div className="grid gap-3 p-5 md:grid-cols-3">
            {AI_EVALUATION_CASES.map((evaluationCase, index) => (
              <article
                key={evaluationCase.id}
                className="rounded-xl border border-[#dce3e8] bg-[#f8fafb] p-4"
              >
                <span className="flex size-8 items-center justify-center rounded-lg bg-[#e4f2f6] text-xs font-semibold text-[#287693]">
                  {index + 1}
                </span>
                <p className="mt-3 text-xs font-semibold text-[#203845]">
                  {evaluationCase.title}
                </p>
                <p className="mt-1 text-[10px] text-slate-500">
                  {evaluationCase.fileName}
                </p>
              </article>
            ))}
          </div>
        </Panel>
      )}

      <Panel className="mt-5 overflow-hidden">
        <PanelHeader
          title="Versioned fictional U.S. contract playbook"
          description="The AI compares documents with explicit operational rules. These are portfolio-demo standards, not legal advice or real company policy."
          action={
            <Badge
              variant="outline"
              className="border-sky-200 bg-sky-50 text-sky-800"
            >
              Version 2026.1
            </Badge>
          }
        />
        <div className="overflow-x-auto">
          <Table className="min-w-[850px]">
            <TableHeader>
              <TableRow className="bg-[#f7f9fa]">
                <TableHead className="px-5">Rule ID</TableHead>
                <TableHead>Control</TableHead>
                <TableHead>Demo standard</TableHead>
                <TableHead>Applies to</TableHead>
                <TableHead className="pr-5">Risk</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {demoPlaybookRules.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell className="px-5 font-mono text-[10px] text-[#287693]">
                    {rule.id}
                  </TableCell>
                  <TableCell className="text-xs font-medium text-[#203845]">
                    {rule.rule}
                  </TableCell>
                  <TableCell className="max-w-[320px] text-xs text-slate-600">
                    {rule.standard}
                  </TableCell>
                  <TableCell className="text-xs text-slate-500">
                    {rule.appliesTo}
                  </TableCell>
                  <TableCell className="pr-5">
                    <StatusBadge tone={rule.risk === 'High' ? 'rose' : 'amber'}>
                      {rule.risk}
                    </StatusBadge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Panel>
    </>
  );
}
