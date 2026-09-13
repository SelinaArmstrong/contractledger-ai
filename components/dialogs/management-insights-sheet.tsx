'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import type {
  ManagementInsightResponse,
  ManagementInsightScope,
} from '@/lib/management-insights';
import {
  AlertCircle,
  BellRing,
  CircleCheck,
  LoaderCircle,
  Sparkles,
} from 'lucide-react';
import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  managementMetricValue,
  priorityClasses,
  titleCase,
} from '@/components/workspace/formatters';
import { useDraggableDialog } from '@/components/workspace/use-draggable-dialog';

export const ManagementChartCard = lazy(() =>
  import('@/components/management-chart-card').then((module) => ({
    default: module.ManagementChartCard,
  })),
);

export function ManagementInsightsSheet({
  open,
  onOpenChange,
  scope,
  currentRecordIds,
  allRecordIds,
  onSelectRecord,
  onOpenAlerts,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scope: ManagementInsightScope;
  currentRecordIds: string[];
  allRecordIds: string[];
  onSelectRecord: (id: string) => void;
  onOpenAlerts: () => void;
}) {
  const [selection, setSelection] = useState<'current' | 'all'>('current');
  const [result, setResult] = useState<ManagementInsightResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const requestSequence = useRef(0);
  const previousOpen = useRef(false);
  const currentIdsKey = currentRecordIds.join('\u001f');
  const allIdsKey = allRecordIds.join('\u001f');
  const label = scope === 'contracts' ? 'Contract' : 'Supplier';
  const sheetRef = useRef<HTMLDivElement>(null);
  const draggable = useDraggableDialog({ surfaceRef: sheetRef });

  const runAnalysis = useCallback(
    async (nextSelection: 'current' | 'all') => {
      const ids = (nextSelection === 'current' ? currentIdsKey : allIdsKey)
        .split('\u001f')
        .filter(Boolean);
      if (!ids.length) {
        setError('No records are available in this analysis scope.');
        return;
      }
      const requestId = ++requestSequence.current;
      setSelection(nextSelection);
      setLoading(true);
      setError('');
      try {
        const now = new Date();
        const asOfDate = [
          now.getFullYear(),
          String(now.getMonth() + 1).padStart(2, '0'),
          String(now.getDate()).padStart(2, '0'),
        ].join('-');
        const response = await fetch('/api/management-insights', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scope, recordIds: ids, asOfDate }),
        });
        const body = (await response.json()) as ManagementInsightResponse & {
          error?: string;
        };
        if (!response.ok)
          throw new Error(
            body.error || 'Unable to generate management insights.',
          );
        if (requestId === requestSequence.current) setResult(body);
      } catch (analysisError) {
        if (requestId === requestSequence.current)
          setError(
            analysisError instanceof Error
              ? analysisError.message
              : 'Unable to generate management insights.',
          );
      } finally {
        if (requestId === requestSequence.current) setLoading(false);
      }
    },
    [allIdsKey, currentIdsKey, scope],
  );

  useEffect(() => {
    const justOpened = open && !previousOpen.current;
    previousOpen.current = open;
    if (!open) {
      requestSequence.current += 1;
      return;
    }
    if (!justOpened) return;
    const timer = window.setTimeout(() => void runAnalysis('current'), 0);
    return () => window.clearTimeout(timer);
  }, [open, runAnalysis]);

  const openRecord = (id: string) => {
    onOpenChange(false);
    onSelectRecord(id);
  };
  const openActionCenter = () => {
    onOpenChange(false);
    onOpenAlerts();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        ref={sheetRef}
        style={draggable.surfaceStyle}
        onPointerDown={draggable.onPointerDown}
        onPointerMove={draggable.onPointerMove}
        onPointerUp={draggable.onPointerUp}
        onPointerCancel={draggable.onPointerCancel}
        className="w-[96vw] max-w-[1180px] gap-0 overflow-hidden p-0 sm:max-w-[1180px]"
      >
        <SheetHeader
          data-dialog-drag-handle
          title="Drag to move dialog"
          className="cursor-move touch-none select-none border-b border-border bg-card px-6 py-5 pr-14"
        >
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-foreground">
            <Sparkles className="size-3.5" />
            AI-assisted management analysis
          </div>
          <SheetTitle className="mt-1 text-xl text-foreground">
            {label} management insights
          </SheetTitle>
          <SheetDescription className="max-w-3xl text-xs leading-5">
            Program-calculated facts and shared alert rules are interpreted by
            AI. The complete operational queue remains in Alerts &amp; Exports.
          </SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-muted">
          <div className="flex flex-col justify-between gap-3 border-b border-border bg-card px-6 py-3 md:flex-row md:items-center">
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant={selection === 'current' ? 'default' : 'outline'}
                onClick={() => void runAnalysis('current')}
                disabled={loading || !currentRecordIds.length}
                className={
                  selection === 'current'
                    ? 'bg-primary hover:bg-primary/90'
                    : 'bg-card'
                }
              >
                Current view · {currentRecordIds.length}
              </Button>
              <Button
                size="sm"
                variant={selection === 'all' ? 'default' : 'outline'}
                onClick={() => void runAnalysis('all')}
                disabled={loading || !allRecordIds.length}
                className={
                  selection === 'all'
                    ? 'bg-primary hover:bg-primary/90'
                    : 'bg-card'
                }
              >
                Entire register · {allRecordIds.length}
              </Button>
            </div>
            {result ? (
              <div className="text-[11px] text-slate-500">
                Generated {new Date(result.generatedAt).toLocaleString('en-US')}{' '}
                · {result.model}
              </div>
            ) : null}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            {loading ? (
              <div className="flex min-h-[420px] flex-col items-center justify-center text-center">
                <LoaderCircle className="size-8 animate-spin text-[#2b819f]" />
                <p className="mt-4 text-sm font-medium text-foreground">
                  Calculating facts and generating management insights…
                </p>
                <p className="mt-1 max-w-md text-xs leading-5 text-slate-500">
                  Counts, dates, values, and exceptions are calculated by
                  program rules before the structured results are sent to AI.
                </p>
              </div>
            ) : error ? (
              <Alert variant="destructive">
                <AlertCircle />
                <AlertTitle>Analysis unavailable</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : result ? (
              <div className="space-y-5">
                <section>
                  <div className="mb-3 flex items-end justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-semibold text-foreground">
                        Portfolio overview
                      </h2>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        Deterministic database calculations as of{' '}
                        {result.report.asOfDate}
                      </p>
                    </div>
                    <Badge variant="outline" className="bg-card text-slate-600">
                      {result.report.recordCount} verified records
                    </Badge>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {result.report.metrics.map((metric) => (
                      <div
                        key={metric.key}
                        className="rounded-xl border border-border bg-card px-4 py-3"
                      >
                        <p className="text-[11px] font-medium text-slate-500">
                          {metric.label}
                        </p>
                        <p className="mt-1 text-xl font-semibold tracking-[-0.03em] text-foreground">
                          {managementMetricValue(metric)}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="grid gap-4 xl:grid-cols-2">
                  <Suspense
                    fallback={result.report.charts.map((chart) => (
                      <div
                        key={chart.key}
                        className="h-[286px] animate-pulse rounded-xl border border-border bg-card"
                      />
                    ))}
                  >
                    {result.report.charts.map((chart) => (
                      <ManagementChartCard key={chart.key} chart={chart} />
                    ))}
                  </Suspense>
                </section>

                <section className="rounded-xl border border-border bg-card">
                  <div className="flex flex-col justify-between gap-3 border-b border-border px-5 py-4 sm:flex-row sm:items-center">
                    <div>
                      <h2 className="text-sm font-semibold text-foreground">
                        Priority attention preview
                      </h2>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        Top 3 of {result.report.attentionCount} rule-generated
                        items
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={openActionCenter}
                    >
                      <BellRing />
                      View all in Alerts &amp; Exports
                    </Button>
                  </div>
                  <div className="divide-y divide-border">
                    {result.report.attentionItems.slice(0, 3).map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => openRecord(item.entityId)}
                        className="flex w-full flex-col gap-2 px-5 py-4 text-left hover:bg-muted sm:flex-row sm:items-start sm:justify-between"
                      >
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-semibold text-accent-foreground">
                              {item.reference || item.label}
                            </span>
                            <Badge
                              variant="outline"
                              className={priorityClasses(item.priority)}
                            >
                              {titleCase(item.priority)}
                            </Badge>
                          </div>
                          <p className="mt-1 text-xs font-medium text-foreground">
                            {item.issue}
                          </p>
                          <p className="mt-1 text-[11px] leading-4 text-slate-500">
                            {item.label} · {item.reason}
                          </p>
                        </div>
                        <span className="shrink-0 text-[11px] text-slate-500">
                          {item.dueDate ?? 'No due date'}
                        </span>
                      </button>
                    ))}
                    {!result.report.attentionItems.length ? (
                      <div className="px-5 py-8 text-center text-xs text-slate-500">
                        No current rule-based attention items in this scope.
                      </div>
                    ) : null}
                  </div>
                </section>

                <section className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(300px,0.75fr)]">
                  <article className="rounded-xl border border-[#b9d9e5] bg-accent p-5">
                    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-accent-foreground">
                      <Sparkles className="size-3.5" />
                      AI management insights
                    </div>
                    <p className="mt-3 text-sm leading-6 text-[#244757]">
                      {result.ai.executiveSummary}
                    </p>
                    <div className="mt-4 space-y-3">
                      {result.ai.insights.map((insight) => (
                        <div
                          key={`${insight.title}-${insight.explanation}`}
                          className="rounded-lg border border-[#c9e1e9] bg-card/80 p-4"
                        >
                          <h3 className="text-xs font-semibold text-foreground">
                            {insight.title}
                          </h3>
                          <p className="mt-1 text-[11px] leading-5 text-slate-600">
                            {insight.explanation}
                          </p>
                          {insight.supportingRecordIds.length ? (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {insight.supportingRecordIds.map((id) => (
                                <button
                                  key={id}
                                  type="button"
                                  onClick={() => openRecord(id)}
                                  className="rounded-md border border-[#b9d9e5] bg-card px-2 py-1 text-[11px] font-medium text-accent-foreground hover:bg-accent"
                                >
                                  Open supporting record
                                </button>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </article>

                  <article className="rounded-xl border border-border bg-card p-5">
                    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                      <CircleCheck className="size-3.5" />
                      Recommended actions
                    </div>
                    <div className="mt-3 space-y-3">
                      {result.ai.recommendedActions.map((action) => (
                        <div
                          key={`${action.action}-${action.reason}`}
                          className="rounded-lg border border-border p-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <h3 className="text-xs font-semibold text-foreground">
                              {action.action}
                            </h3>
                            <Badge
                              variant="outline"
                              className={priorityClasses(action.priority)}
                            >
                              {titleCase(action.priority)}
                            </Badge>
                          </div>
                          <p className="mt-1 text-[11px] leading-4 text-slate-500">
                            {action.reason}
                          </p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 rounded-lg bg-slate-50 px-3 py-3 text-[11px] leading-4 text-slate-500">
                      Decision support only. AI does not change register data,
                      approve suppliers, make legal determinations, or decide
                      renewal and termination actions.
                    </div>
                    {result.ai.dataLimitations.length ? (
                      <div className="mt-3 text-[11px] leading-4 text-slate-500">
                        <span className="font-semibold text-slate-600">
                          Data limitations:{' '}
                        </span>
                        {result.ai.dataLimitations.join(' ')}
                      </div>
                    ) : null}
                  </article>
                </section>
              </div>
            ) : null}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
