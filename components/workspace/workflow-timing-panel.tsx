'use client';

import { useCallback, useEffect, useState } from 'react';
import { LoaderCircle, Play, Square, Timer, Trash2 } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Panel,
  PanelHeader,
  StatusBadge,
} from '@/components/workspace/primitives';
import {
  MINIMUM_COMPARABLE_RUNS,
  WORKFLOW_TIMING_SCENARIOS,
  WORKFLOW_TIMING_SCENARIO_LABELS,
  formatDuration,
  type WorkflowTimingComparison,
  type WorkflowTimingMode,
  type WorkflowTimingScenario,
} from '@/lib/workflow-timing';

type TimingRunRow = {
  id: string;
  scenario: string;
  mode: string;
  duration_ms: number;
  note: string | null;
  actor: string;
  created_at: string;
};

type TimingResponse = {
  comparisons: WorkflowTimingComparison[];
  runs: TimingRunRow[];
  totalRuns: number;
};

/**
 * Stopwatch and evidence table for repeated manual vs assisted runs of the same
 * fictional scenario. This is the measurement the evidence ledger requires
 * before any time-saving claim can be made, so the panel always shows the
 * sample size beside the result and refuses to state a percentage until both
 * modes have enough runs.
 */
export function WorkflowTimingPanel({ canRecord }: { canRecord: boolean }) {
  const [data, setData] = useState<TimingResponse | null>(null);
  const [scenario, setScenario] = useState<WorkflowTimingScenario>(
    'draft_contract_review',
  );
  const [mode, setMode] = useState<WorkflowTimingMode>('manual');
  const [note, setNote] = useState('');
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/workflow-timings');
      const payload = (await response.json()) as TimingResponse & {
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error ?? 'Request failed.');
      setData(payload);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to load timing evidence.',
      );
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  // Drives the running clock. The saved duration is always derived from the
  // start timestamp, never from this counter, so a throttled tab cannot
  // shorten a recorded run.
  useEffect(() => {
    if (startedAt === null) return;
    const timer = window.setInterval(
      () => setElapsedMs(Date.now() - startedAt),
      200,
    );
    return () => window.clearInterval(timer);
  }, [startedAt]);

  const stopAndSave = async () => {
    if (startedAt === null) return;
    const durationMs = Date.now() - startedAt;
    setStartedAt(null);
    setElapsedMs(0);
    setSaving(true);
    setError('');
    try {
      const response = await fetch('/api/workflow-timings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenario,
          mode,
          durationMs,
          note: note.trim() || null,
        }),
      });
      const payload = (await response.json()) as TimingResponse & {
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error ?? 'Request failed.');
      setData(payload);
      setNote('');
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Unable to record the timed run.',
      );
    } finally {
      setSaving(false);
    }
  };

  const discard = async (id: string) => {
    setError('');
    try {
      const response = await fetch('/api/workflow-timings', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const payload = (await response.json()) as TimingResponse & {
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error ?? 'Request failed.');
      setData(payload);
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : 'Unable to discard the run.',
      );
    }
  };

  const running = startedAt !== null;
  const comparisons = data?.comparisons ?? [];
  const recent = (data?.runs ?? []).slice(0, 8);

  return (
    <Panel className="mt-5 overflow-hidden">
      <PanelHeader
        title="Timed workflow evidence"
        description="Repeat the same fictional scenario manually and with AI assistance. The median and sample size below are the only basis for a time-saving claim."
        action={
          <StatusBadge
            tone={comparisons.some((c) => c.comparable) ? 'green' : 'blue'}
          >
            {data ? `${data.totalRuns} recorded runs` : 'Loading'}
          </StatusBadge>
        }
      />

      {error ? (
        <Alert variant="destructive" className="mx-5 mb-4 w-auto">
          <AlertTitle>Timing evidence needs attention</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {canRecord ? (
        <div className="flex flex-wrap items-end gap-3 border-b border-[#e1e7ea] bg-[#f8fafb] px-5 py-4">
          <div>
            <label
              htmlFor="timing-scenario"
              className="mb-1.5 block text-[11px] font-medium text-[#294454]"
            >
              Scenario
            </label>
            <NativeSelect
              id="timing-scenario"
              value={scenario}
              onChange={(event) =>
                setScenario(event.target.value as WorkflowTimingScenario)
              }
              className="h-9 bg-white"
            >
              {WORKFLOW_TIMING_SCENARIOS.map((value) => (
                <option key={value} value={value}>
                  {WORKFLOW_TIMING_SCENARIO_LABELS[value]}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div>
            <label
              htmlFor="timing-mode"
              className="mb-1.5 block text-[11px] font-medium text-[#294454]"
            >
              Mode
            </label>
            <NativeSelect
              id="timing-mode"
              value={mode}
              onChange={(event) =>
                setMode(event.target.value as WorkflowTimingMode)
              }
              className="h-9 bg-white"
            >
              <option value="manual">Manual baseline</option>
              <option value="assisted">AI assisted</option>
            </NativeSelect>
          </div>
          <div className="min-w-[200px] flex-1">
            <label
              htmlFor="timing-note"
              className="mb-1.5 block text-[11px] font-medium text-[#294454]"
            >
              Run note (optional)
            </label>
            <Input
              id="timing-note"
              value={note}
              maxLength={300}
              placeholder="e.g. reset-to-reset, demo PDF 01"
              onChange={(event) => setNote(event.target.value)}
              className="h-9 bg-white"
            />
          </div>
          <div className="flex items-center gap-3">
            <span
              className="font-mono text-lg tabular-nums text-[#173246]"
              aria-label="Elapsed time"
            >
              {running ? formatDuration(elapsedMs) : '—'}
            </span>
            {running ? (
              <Button onClick={stopAndSave} disabled={saving}>
                {saving ? (
                  <LoaderCircle className="animate-spin" />
                ) : (
                  <Square />
                )}
                Stop and save
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={() => {
                  setStartedAt(Date.now());
                  setElapsedMs(0);
                }}
                disabled={saving}
              >
                <Play />
                Start run
              </Button>
            )}
          </div>
        </div>
      ) : (
        <p className="border-b border-[#e1e7ea] bg-[#f8fafb] px-5 py-3 text-xs text-slate-600">
          Recording a timed run requires the AI governance permission. The saved
          evidence below is readable by every role.
        </p>
      )}

      <div className="overflow-x-auto">
        <Table className="min-w-[760px]">
          <TableHeader>
            <TableRow className="bg-[#f7f9fa]">
              <TableHead className="px-5">Scenario</TableHead>
              <TableHead>Manual median</TableHead>
              <TableHead>Assisted median</TableHead>
              <TableHead>Reduction</TableHead>
              <TableHead className="pr-5">Evidence</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {comparisons.map((comparison) => (
              <TableRow key={comparison.scenario}>
                <TableCell className="px-5 text-xs font-medium text-[#203845]">
                  {comparison.label}
                </TableCell>
                <TableCell className="text-xs tabular-nums text-slate-700">
                  {formatDuration(comparison.manualMedianMs)}
                  <span className="ml-1 text-[10px] text-slate-500">
                    n={comparison.manualRuns}
                  </span>
                </TableCell>
                <TableCell className="text-xs tabular-nums text-slate-700">
                  {formatDuration(comparison.assistedMedianMs)}
                  <span className="ml-1 text-[10px] text-slate-500">
                    n={comparison.assistedRuns}
                  </span>
                </TableCell>
                <TableCell className="text-xs">
                  {comparison.reductionPercent === null ? (
                    <span className="text-slate-400">Not yet claimable</span>
                  ) : (
                    <StatusBadge
                      tone={comparison.reductionPercent > 0 ? 'green' : 'amber'}
                    >
                      {comparison.reductionPercent > 0 ? '−' : '+'}
                      {Math.abs(comparison.reductionPercent)}%
                    </StatusBadge>
                  )}
                </TableCell>
                <TableCell className="pr-5 text-[10px] leading-4 text-slate-500">
                  {comparison.evidenceNote}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="border-t border-[#e1e7ea] bg-[#f8fafb] px-5 py-4">
        <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#397d96]">
          <Timer className="size-3.5" />
          Recent runs
        </div>
        {recent.length ? (
          <ul className="space-y-1.5">
            {recent.map((row) => (
              <li
                key={row.id}
                className="flex items-center justify-between gap-3 text-[11px] text-slate-600"
              >
                <span className="truncate">
                  <span className="font-medium text-[#203845]">
                    {WORKFLOW_TIMING_SCENARIO_LABELS[
                      row.scenario as WorkflowTimingScenario
                    ] ?? row.scenario}
                  </span>
                  {' · '}
                  {row.mode === 'assisted' ? 'AI assisted' : 'Manual baseline'}
                  {' · '}
                  <span className="tabular-nums">
                    {formatDuration(Number(row.duration_ms))}
                  </span>
                  {row.note ? ` · ${row.note}` : ''}
                </span>
                {canRecord ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label="Discard this timed run"
                    onClick={() => void discard(row.id)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[11px] text-slate-500">
            No timed runs recorded yet. Record at least{' '}
            {MINIMUM_COMPARABLE_RUNS} manual and {MINIMUM_COMPARABLE_RUNS}{' '}
            assisted runs of the same scenario before quoting a reduction.
          </p>
        )}
      </div>
    </Panel>
  );
}
