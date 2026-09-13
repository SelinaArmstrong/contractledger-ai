'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  AlertCircle,
  Check,
  Columns2,
  Database,
  FileSearch,
  FileText,
  LoaderCircle,
  RotateCcw,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { AnalysisReview } from '@/components/workspace/analysis-review';
import { DocumentViewer } from '@/components/workspace/document-viewer';
import { StatusBadge } from '@/components/workspace/primitives';
import type { IntakeWorkflow } from '@/components/workspace/use-intake-workflow';

type PanelLayout = 'split' | 'document' | 'fields';

const layoutOptions: Array<{ value: PanelLayout; label: string }> = [
  { value: 'split', label: 'Split view' },
  { value: 'document', label: 'Document' },
  { value: 'fields', label: 'Extraction' },
];

const steps = [
  {
    number: '01',
    title: 'Source document',
    description: 'Upload the complete draft agreement',
  },
  {
    number: '02',
    title: 'AI extraction',
    description: 'Trace values and terms back to pages',
  },
  {
    number: '03',
    title: 'Human verification',
    description: 'Confirm every field before it is stored',
  },
];

/**
 * Inline replacement for the draft upload dialog. It lives above the review
 * work queue so the source document and the extraction fields both get the full
 * page width and can grow downwards instead of scrolling inside a modal.
 */
export function DraftIntakePanel({ intake }: { intake: IntakeWorkflow }) {
  const [layout, setLayout] = useState<PanelLayout>('split');
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileInputId = useId();
  const {
    analysisError,
    analysisResult,
    analysisStatus,
    fieldOverrideReasons,
    fieldReviews,
    missingOverrideCount,
    originalAnalysis,
    pendingReviewCount,
    previewUrl,
    selectedFile,
  } = intake;

  const activeStep = analysisResult ? 3 : selectedFile ? 2 : 1;
  const expanded = Boolean(selectedFile) || analysisStatus === 'saved';
  const showDocument = layout !== 'fields';
  const showFields = layout !== 'document';

  const acceptDroppedFile = (fileList: FileList | null) => {
    const file = fileList?.[0];
    if (file) intake.selectFile(file);
  };

  const fileInput = (
    <input
      ref={fileInputRef}
      id={fileInputId}
      type="file"
      accept=".pdf,.txt,application/pdf,text/plain"
      className="sr-only"
      onChange={(event) => intake.selectFile(event.target.files?.[0] ?? null)}
    />
  );

  if (analysisStatus === 'saved') {
    return (
      <section className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-6 py-8 text-center">
        <span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <Check className="size-6" />
        </span>
        <h2 className="app-section-title">Reviewed draft saved</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-emerald-900">
          The draft now appears in the review work queue below. Its proposed
          amount stays outside the official contract register until an executed
          copy is registered.
        </p>
        <Button
          className="mt-5 bg-primary hover:bg-primary/90"
          onClick={() => intake.begin('draft')}
        >
          <Upload /> Review another draft
        </Button>
      </section>
    );
  }

  if (!expanded) {
    return (
      <section
        className={`mb-5 rounded-xl border-2 border-dashed bg-card px-6 py-10 text-center transition-colors ${
          dragActive
            ? 'border-[#1d718f] bg-[#f2fafc]'
            : 'border-border hover:border-[#a9c4ce]'
        }`}
        onDragOver={(event) => {
          event.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragActive(false);
          acceptDroppedFile(event.dataTransfer.files);
        }}
      >
        {fileInput}
        <span className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
          <Upload className="size-7" />
        </span>
        <h2 className="app-section-title">
          Upload a draft contract for review
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">
          Drop the file here, or browse. DeepSeek extracts the proposed fields
          and playbook differences, and every value waits for your confirmation
          before anything is stored.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <Button
            size="lg"
            onClick={() => fileInputRef.current?.click()}
            className="bg-primary hover:bg-primary/90"
          >
            <Upload /> Upload draft
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="bg-card"
            onClick={() => void intake.loadDemoDocument()}
          >
            <FileText /> Use demo PDF
          </Button>
        </div>
        <p className="mt-4 text-xs text-slate-500">
          Text-based PDF or TXT · maximum 8 MB · fictional demo files only
        </p>
        {analysisError ? (
          <p className="mt-3 text-xs text-rose-600">{analysisError}</p>
        ) : null}
      </section>
    );
  }

  return (
    <section className="mb-5 rounded-xl border border-border bg-card shadow-[0_1px_2px_rgb(15_23_42/3%)]">
      {fileInput}
      <header className="flex flex-col gap-4 border-b border-border px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-accent-foreground">
              <Sparkles className="size-3.5" /> DeepSeek document extraction
            </div>
            <h2 className="app-section-title mt-1">Draft review workspace</h2>
            <p className="mt-1 truncate text-sm text-slate-500">
              {selectedFile?.name ?? 'No file selected'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={analysisResult ? 'green' : 'amber'}>
              {analysisResult ? 'Ready to verify' : 'Waiting for analysis'}
            </StatusBadge>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => intake.begin('draft')}
              className="h-8 text-xs"
            >
              <X /> Close workspace
            </Button>
          </div>
        </div>
        <ol className="grid gap-2 sm:grid-cols-3">
          {steps.map((step, index) => {
            const state =
              index + 1 < activeStep
                ? 'done'
                : index + 1 === activeStep
                  ? 'active'
                  : 'upcoming';
            return (
              <li
                key={step.number}
                className={`rounded-lg border px-3 py-2.5 ${
                  state === 'active'
                    ? 'border-[#8fc0d0] bg-accent'
                    : state === 'done'
                      ? 'border-emerald-200 bg-emerald-50'
                      : 'border-border bg-[#fafbfc]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`flex size-5 items-center justify-center rounded-full text-[11px] font-semibold ${
                      state === 'done'
                        ? 'bg-emerald-600 text-white'
                        : state === 'active'
                          ? 'bg-primary text-white'
                          : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {state === 'done' ? (
                      <Check className="size-3" />
                    ) : (
                      step.number
                    )}
                  </span>
                  <span className="text-xs font-semibold text-foreground">
                    {step.title}
                  </span>
                </div>
                <p className="mt-1 pl-7 text-[11px] leading-4 text-slate-500">
                  {step.description}
                </p>
              </li>
            );
          })}
        </ol>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <fieldset
            className="inline-flex rounded-md border border-border bg-muted p-0.5"
            aria-label="Workspace layout"
          >
            {layoutOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setLayout(option.value)}
                aria-pressed={layout === option.value}
                className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                  layout === option.value
                    ? 'bg-card text-accent-foreground shadow-[0_1px_2px_rgb(15_23_42/8%)]'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {option.value === 'split' ? (
                  <Columns2 className="size-3.5" />
                ) : option.value === 'document' ? (
                  <FileText className="size-3.5" />
                ) : (
                  <FileSearch className="size-3.5" />
                )}
                {option.label}
              </button>
            ))}
          </fieldset>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="bg-card"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload /> Replace file
            </Button>
            {analysisResult ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="bg-card"
                onClick={intake.clearAnalysis}
              >
                <RotateCcw /> Start over
              </Button>
            ) : null}
          </div>
        </div>
      </header>

      {analysisError ? (
        <Alert variant="destructive" className="m-5 mb-0 w-auto">
          <AlertCircle />
          <AlertTitle>Analysis needs attention</AlertTitle>
          <AlertDescription>{analysisError}</AlertDescription>
        </Alert>
      ) : null}

      <div
        className={`grid items-start gap-5 p-5 ${
          layout === 'split' ? 'xl:grid-cols-2' : 'grid-cols-1'
        }`}
      >
        {showDocument ? (
          <div className="min-w-0 xl:sticky xl:top-4">
            <DocumentViewer
              title="Draft source copy"
              description="Read the original language while you verify each extracted value."
              fileName={selectedFile?.name}
              sourceUrl={previewUrl}
              isPdf={selectedFile?.type === 'application/pdf'}
              height={layout === 'document' ? '85vh' : '72vh'}
              emptyState={
                <p className="mt-3 max-w-sm text-sm text-slate-600">
                  {selectedFile
                    ? 'Text files have no page preview. The extracted values still appear beside this panel.'
                    : 'Select a contract document to preview it here.'}
                </p>
              }
            />
          </div>
        ) : null}

        {showFields ? (
          <div className="min-w-0">
            {analysisStatus === 'analyzing' ? (
              <div className="flex min-h-72 flex-col items-center justify-center rounded-xl border border-border bg-muted text-center">
                <LoaderCircle className="size-8 animate-spin text-accent-foreground" />
                <p className="mt-3 text-sm font-medium">
                  Extracting traceable contract fields…
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  DeepSeek is treating the uploaded document as untrusted source
                  data.
                </p>
              </div>
            ) : analysisResult ? (
              <AnalysisReview
                result={analysisResult}
                originalAnalysis={originalAnalysis}
                stage="draft"
                density="comfortable"
                fieldColumns={layout === 'fields' ? 3 : 2}
                fieldReviews={fieldReviews}
                fieldOverrideReasons={fieldOverrideReasons}
                onOverrideReasonChange={intake.setOverrideReason}
                onFieldChange={intake.updateField}
                onConfirmField={intake.confirmField}
                onConfirmAll={intake.confirmAllUnchangedFields}
              />
            ) : (
              <div className="flex min-h-72 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted px-6 text-center">
                <Sparkles className="size-8 text-[#72a9ba]" />
                <p className="mt-3 text-sm font-semibold text-foreground">
                  Analyze the document to continue
                </p>
                <p className="mt-1 max-w-md text-xs leading-5 text-slate-500">
                  Extraction returns register fields, source pages, key dates,
                  and the differences against the company playbook.
                </p>
                <Button
                  className="mt-5 bg-primary hover:bg-primary/90"
                  onClick={() => void intake.analyze()}
                  disabled={!selectedFile}
                >
                  <Sparkles /> Analyze with DeepSeek
                </Button>
              </div>
            )}
          </div>
        ) : null}
      </div>

      <footer className="sticky bottom-0 z-10 flex flex-col-reverse gap-3 rounded-b-xl border-t border-border bg-slate-50 px-5 py-4 shadow-[0_-1px_2px_rgb(15_23_42/4%)] sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-slate-500">
          {analysisResult
            ? pendingReviewCount
              ? `${pendingReviewCount} field${pendingReviewCount === 1 ? '' : 's'} still need confirmation.`
              : missingOverrideCount
                ? `${missingOverrideCount} critical field${missingOverrideCount === 1 ? '' : 's'} still need an override reason.`
                : 'Every field is confirmed. Saving keeps the draft outside the official register.'
            : 'Nothing is written to the database until you confirm every extracted field.'}
        </p>
        {analysisResult ? (
          <Button
            onClick={() => void intake.save()}
            disabled={
              analysisStatus === 'saving' ||
              pendingReviewCount > 0 ||
              missingOverrideCount > 0
            }
            className="bg-primary hover:bg-primary/90"
          >
            {analysisStatus === 'saving' ? (
              <LoaderCircle className="animate-spin" />
            ) : (
              <Database />
            )}
            {pendingReviewCount
              ? `Confirm ${pendingReviewCount} fields to save`
              : 'Save reviewed intake'}
          </Button>
        ) : (
          <Button
            onClick={() => void intake.analyze()}
            disabled={!selectedFile || analysisStatus === 'analyzing'}
            className="bg-primary hover:bg-primary/90"
          >
            {analysisStatus === 'analyzing' ? (
              <LoaderCircle className="animate-spin" />
            ) : (
              <Sparkles />
            )}
            Analyze with DeepSeek
          </Button>
        )}
      </footer>
    </section>
  );
}
