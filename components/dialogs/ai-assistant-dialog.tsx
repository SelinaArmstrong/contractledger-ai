'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type {
  AssistantResponse,
  AssistantResultRecord,
} from '@/lib/ai-assistant';
import {
  AlertCircle,
  Bot,
  Database,
  LoaderCircle,
  RotateCcw,
  Send,
  Sparkles,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { assistantExamples } from '@/components/workspace/constants';
import {
  moneyFromCents,
  titleCase,
  toneForStatus,
} from '@/components/workspace/formatters';
import { StatusBadge } from '@/components/workspace/primitives';
import type { AssistantConversationMessage } from '@/components/workspace/types';
import { useDraggableDialog } from '@/components/workspace/use-draggable-dialog';

export function AIAssistantDialog({
  open,
  onOpenChange,
  onOpenRecord,
  onOpenManagementInsights,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenRecord: (record: AssistantResultRecord) => void;
  onOpenManagementInsights: (scope: 'contracts' | 'suppliers') => void;
}) {
  const [messages, setMessages] = useState<AssistantConversationMessage[]>([
    {
      id: 'assistant-welcome',
      role: 'assistant',
      content:
        'Ask me about contracts, suppliers, qualification documents, renewal obligations, or pre-execution reviews. I will translate your question into verified, read-only database filters.',
    },
  ]);
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const conversationRef = useRef<HTMLDivElement>(null);
  const questionInputRef = useRef<HTMLTextAreaElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const draggable = useDraggableDialog({ surfaceRef: dialogRef });

  useEffect(() => {
    const scroller = conversationRef.current;
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
  }, [messages, loading]);

  useEffect(() => {
    if (!open) return;
    const focusTimer = window.setTimeout(
      () => questionInputRef.current?.focus(),
      0,
    );
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onOpenChange(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [onOpenChange, open]);

  const submitQuestion = async (submittedQuestion?: string) => {
    const prompt = (submittedQuestion ?? question).trim();
    if (!prompt || loading) return;
    const history = messages
      .filter((message) => message.id !== 'assistant-welcome')
      .slice(-10)
      .map(({ role, content }) => ({ role, content }));
    const userMessage: AssistantConversationMessage = {
      id: `assistant-message-${crypto.randomUUID()}`,
      role: 'user',
      content: prompt,
    };
    setMessages((current) => [...current, userMessage]);
    setQuestion('');
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: prompt, history }),
      });
      const body = (await response.json()) as AssistantResponse & {
        error?: string;
      };
      if (!response.ok)
        throw new Error(body.error || 'The AI assistant could not answer.');
      setMessages((current) => [
        ...current,
        {
          id: `assistant-message-${crypto.randomUUID()}`,
          role: 'assistant',
          content: body.answer,
          response: body,
        },
      ]);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'The AI assistant could not answer.',
      );
    } finally {
      setLoading(false);
    }
  };

  const resetConversation = () => {
    setMessages((current) => current.slice(0, 1));
    setQuestion('');
    setError('');
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/25 px-3 pb-3 pt-[86px] backdrop-blur-[2px] md:px-6"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onOpenChange(false);
      }}
    >
      <dialog
        ref={dialogRef}
        style={draggable.surfaceStyle}
        onPointerDown={draggable.onPointerDown}
        onPointerMove={draggable.onPointerMove}
        onPointerUp={draggable.onPointerUp}
        onPointerCancel={draggable.onPointerCancel}
        open
        aria-modal="true"
        aria-labelledby="ai-assistant-dialog-title"
        className="relative m-0 grid h-[84vh] min-h-[620px] w-[96vw] max-w-[1440px] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-xl bg-white p-0 text-sm shadow-2xl ring-1 ring-slate-900/10"
      >
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          aria-label="Close AI Contract Operations Assistant"
          className="absolute right-4 top-4 z-10 flex size-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
        >
          ×
        </button>
        <div
          data-dialog-drag-handle
          title="Drag to move dialog"
          className="cursor-move touch-none select-none border-b border-[#dce3e8] bg-[#f8fbfc] px-6 py-4 pr-14"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-lg bg-[#dceff5] text-[#1d718f]">
              <Bot className="size-[18px]" />
            </span>
            <div>
              <h2
                id="ai-assistant-dialog-title"
                className="text-base font-semibold text-[#183040]"
              >
                AI Contract Operations Assistant
              </h2>
              <p className="mt-0.5 text-[11px] text-slate-500">
                Natural-language questions · verified database results
              </p>
            </div>
            <Badge
              variant="outline"
              className="ml-auto border-emerald-200 bg-emerald-50 text-emerald-800"
            >
              Read-only
            </Badge>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-[#d8e5e9] bg-white px-3 py-2 text-[10px] text-slate-500">
            <span>
              AI interprets your request; approved program rules query SQLite
              and calculate totals.
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={resetConversation}
              className="h-7 shrink-0 px-2 text-[10px]"
            >
              <RotateCcw /> New chat
            </Button>
          </div>
        </div>

        <div
          ref={conversationRef}
          className="min-h-0 flex-1 overflow-y-auto bg-[#f4f7f8] px-4 py-5 sm:px-6"
        >
          <div className="mx-auto max-w-[1260px] space-y-5">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={
                    message.role === 'user'
                      ? 'max-w-[84%] rounded-2xl rounded-br-md bg-[#1c6f8c] px-4 py-3 text-xs leading-5 text-white shadow-sm'
                      : 'w-full max-w-[96%]'
                  }
                >
                  {message.role === 'assistant' ? (
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-white text-[#247590] shadow-sm ring-1 ring-[#dce5e8]">
                        <Sparkles className="size-3.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="max-w-[980px] whitespace-pre-line rounded-2xl rounded-tl-md border border-[#dce3e8] bg-white px-4 py-3 text-xs leading-5 text-[#2a414f] shadow-sm">
                          {message.content}
                        </div>
                        {message.response ? (
                          <AssistantStructuredResult
                            response={message.response}
                            onOpenRecord={onOpenRecord}
                            onFollowUp={(prompt) => void submitQuestion(prompt)}
                            onOpenManagementInsights={onOpenManagementInsights}
                          />
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    message.content
                  )}
                </div>
              </div>
            ))}

            {messages.length === 1 ? (
              <div className="ml-10">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                  Try asking
                </p>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  {assistantExamples.map((example) => (
                    <button
                      key={example}
                      type="button"
                      onClick={() => void submitQuestion(example)}
                      className="rounded-xl border border-[#d9e3e7] bg-white px-3 py-3 text-left text-[10px] leading-4 text-[#345160] shadow-sm transition hover:border-[#9fc5d2] hover:bg-[#f8fcfd]"
                    >
                      {example}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {loading ? (
              <div className="flex items-center gap-3 pl-10 text-xs text-slate-500">
                <span className="flex size-8 items-center justify-center rounded-lg bg-white shadow-sm ring-1 ring-[#dce5e8]">
                  <LoaderCircle className="size-4 animate-spin text-[#287d9b]" />
                </span>
                Understanding the question and querying verified records…
              </div>
            ) : null}
            {error ? (
              <Alert variant="destructive" className="ml-10">
                <AlertCircle />
                <AlertTitle>Assistant request needs attention</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
          </div>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submitQuestion();
          }}
          className="border-t border-[#dce3e8] bg-white px-4 py-4 sm:px-6"
        >
          <div className="mx-auto max-w-[1260px] rounded-xl border border-[#c9d9df] bg-white p-2 shadow-sm focus-within:border-[#7fb1c2] focus-within:ring-2 focus-within:ring-[#dceff5]">
            <textarea
              ref={questionInputRef}
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  void submitQuestion();
                }
              }}
              aria-label="Ask the AI Contract Operations Assistant"
              placeholder="Ask about contracts, suppliers, qualifications, renewals, or review status…"
              rows={2}
              className="w-full resize-none border-0 bg-transparent px-2 py-1.5 text-xs leading-5 text-[#203845] outline-none placeholder:text-slate-400"
            />
            <div className="flex items-center justify-between gap-3 px-1">
              <span className="text-[9px] text-slate-400">
                Enter to send · Shift + Enter for a new line
              </span>
              <Button
                type="submit"
                size="sm"
                disabled={!question.trim() || loading}
                className="h-8 bg-[#1d718f] px-3 hover:bg-[#185f78]"
              >
                {loading ? <LoaderCircle className="animate-spin" /> : <Send />}
                Ask AI
              </Button>
            </div>
          </div>
          <p className="mx-auto mt-2 max-w-[1260px] text-center text-[9px] leading-4 text-slate-400">
            Decision support only. The assistant cannot edit registers, approve
            suppliers, or make legal determinations.
          </p>
        </form>
      </dialog>
    </div>
  );
}

export function AssistantStructuredResult({
  response,
  onOpenRecord,
  onFollowUp,
  onOpenManagementInsights,
}: {
  response: AssistantResponse;
  onOpenRecord: (record: AssistantResultRecord) => void;
  onFollowUp: (prompt: string) => void;
  onOpenManagementInsights: (scope: 'contracts' | 'suppliers') => void;
}) {
  const entityLabels: Record<string, string> = {
    contracts: 'Executed contracts',
    suppliers: 'Suppliers',
    obligations: 'Obligations & supplier-document alerts',
    intakes: 'Pre-execution reviews',
  };
  const managementScope =
    response.execution.entity === 'contracts' ||
    response.execution.entity === 'suppliers'
      ? response.execution.entity
      : null;
  return (
    <div className="mt-3 space-y-3">
      <div className="rounded-xl border border-[#c9dbe2] bg-[#eef8fb] p-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-[#397d96]">
              Interpreted query
            </p>
            <p className="mt-1 text-[10px] leading-4 text-[#345160]">
              {response.plan.interpretation}
            </p>
          </div>
          <Badge
            variant="outline"
            className="border-[#bdd8e2] bg-white text-[#2c7088]"
          >
            {entityLabels[response.execution.entity]}
          </Badge>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {response.plan.filters.map((filter, index) => (
            <span
              key={`${filter.field}-${index}`}
              className="rounded-md border border-[#c9dbe2] bg-white px-2 py-1 text-[9px] text-[#3a6374]"
            >
              {filter.label}
            </span>
          ))}
          {!response.plan.filters.length ? (
            <span className="rounded-md border border-[#c9dbe2] bg-white px-2 py-1 text-[9px] text-[#3a6374]">
              Entire current register
            </span>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <div className="rounded-lg border border-[#dce3e8] bg-white px-3 py-2">
          <p className="text-[9px] text-slate-500">Matching records</p>
          <p className="mt-0.5 text-lg font-semibold text-[#1b3442]">
            {response.execution.matchedCount}
          </p>
        </div>
        <div className="rounded-lg border border-[#dce3e8] bg-white px-3 py-2">
          <p className="text-[9px] text-slate-500">Results displayed</p>
          <p className="mt-0.5 text-lg font-semibold text-[#1b3442]">
            {response.execution.returnedCount}
          </p>
        </div>
        {response.execution.totalValueCents !== null ? (
          <div className="col-span-2 rounded-lg border border-[#dce3e8] bg-white px-3 py-2 sm:col-span-1">
            <p className="text-[9px] text-slate-500">Matched value</p>
            <p className="mt-0.5 text-lg font-semibold text-[#1b3442]">
              {moneyFromCents(response.execution.totalValueCents, true)}
            </p>
          </div>
        ) : null}
      </div>

      {response.resultContext.length ? (
        <div className="rounded-xl border border-[#dce3e8] bg-white px-4 py-3">
          <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-500">
            Result context
          </p>
          <ul className="mt-2 space-y-1.5 text-[10px] leading-4 text-slate-600">
            {response.resultContext.map((context) => (
              <li key={context} className="flex items-start gap-2">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[#4f9bb4]" />
                {context}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {response.plan.intent === 'summarize' && managementScope ? (
        <div className="flex flex-col justify-between gap-3 rounded-xl border border-[#b8d9e5] bg-[#eaf7fa] px-4 py-3 sm:flex-row sm:items-center">
          <div>
            <p className="text-[11px] font-semibold text-[#1e5367]">
              Continue in the dedicated portfolio analysis workspace
            </p>
            <p className="mt-1 text-[9px] leading-4 text-[#52727f]">
              Management Insights provides charts, concentration analysis,
              portfolio risks, and recommended actions for this register.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={() => onOpenManagementInsights(managementScope)}
            className="shrink-0 bg-[#1d718f] hover:bg-[#185f78]"
          >
            <Sparkles />
            Open {managementScope === 'contracts'
              ? 'Contract'
              : 'Supplier'}{' '}
            Insights
          </Button>
        </div>
      ) : null}

      {response.execution.records.length ? (
        <div className="overflow-hidden rounded-xl border border-[#dce3e8] bg-white">
          <div className="flex items-center justify-between border-b border-[#e4e9ec] px-4 py-3">
            <div>
              <p className="text-[11px] font-semibold text-[#203845]">
                Verified database results
              </p>
              <p className="mt-0.5 text-[9px] text-slate-500">
                Select a record to open its full details and source files.
              </p>
            </div>
            <Database className="size-4 text-[#4b8da4]" />
          </div>
          <div className="max-h-[360px] divide-y divide-[#edf1f3] overflow-y-auto">
            {response.execution.records.map((record) => (
              <button
                key={`${record.entityType}-${record.id}`}
                type="button"
                onClick={() => onOpenRecord(record)}
                disabled={!record.openTarget}
                className="block w-full px-4 py-3 text-left transition hover:bg-[#f7fafb] disabled:cursor-default"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[11px] font-semibold text-[#1d718f]">
                      {record.title}
                    </p>
                    <p className="mt-0.5 truncate text-[9px] text-slate-500">
                      {record.subtitle || titleCase(record.entityType)}
                    </p>
                  </div>
                  <StatusBadge tone={toneForStatus(record.status)}>
                    {titleCase(record.status)}
                  </StatusBadge>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[9px] text-slate-500">
                  {record.amountCents !== null ? (
                    <span className="font-medium text-slate-700">
                      {moneyFromCents(record.amountCents)}
                    </span>
                  ) : null}
                  {record.date ? <span>Date {record.date}</span> : null}
                  {record.details
                    .filter((detail) => detail.value)
                    .slice(0, 2)
                    .map((detail) => (
                      <span key={`${detail.label}-${detail.value}`}>
                        {detail.label}: {titleCase(detail.value)}
                      </span>
                    ))}
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {response.suggestedFollowUps.length ? (
        <div>
          <p className="mb-2 text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-500">
            Continue the conversation
          </p>
          <div className="flex flex-wrap gap-2">
            {response.suggestedFollowUps.map((followUp) => (
              <button
                key={followUp}
                type="button"
                onClick={() => onFollowUp(followUp)}
                className="rounded-full border border-[#cbdde4] bg-white px-3 py-1.5 text-[9px] text-[#2b6c83] hover:bg-[#f0f8fa]"
              >
                {followUp}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <p className="text-[8px] text-slate-400">
        {response.model} · database calculations are deterministic
      </p>
    </div>
  );
}
