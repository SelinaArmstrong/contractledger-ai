'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { needsSourceOverride } from '@/lib/ai-governance';
import type {
  AmendmentAnalysisResponse,
  ExtractedField,
} from '@/lib/contract-ledger-types';
import {
  AlertCircle,
  AlertTriangle,
  Check,
  Database,
  FileText,
  LoaderCircle,
  Sparkles,
  Upload,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  amendmentExtractionFields,
  dialogSurfaceClass,
} from '@/components/workspace/constants';
import type { AmendmentFieldKey } from '@/components/workspace/constants';
import {
  moneyFromCents,
  titleCase,
  usDateText,
  valueText,
} from '@/components/workspace/formatters';
import { DocumentQualitySummary } from '@/components/workspace/primitives';
import { USDateInput } from '@/components/workspace/table';
import { useDraggableDialog } from '@/components/workspace/use-draggable-dialog';

export function AmendmentDialog({
  open,
  contract,
  onOpenChange,
  onApplied,
}: {
  open: boolean;
  contract: Record<string, string | number | null>;
  onOpenChange: (open: boolean) => void;
  onApplied: () => Promise<void>;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const previewUrlRef = useRef('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<AmendmentAnalysisResponse | null>(null);
  const [status, setStatus] = useState<
    'idle' | 'analyzing' | 'ready' | 'saving' | 'saved' | 'error'
  >('idle');
  const [error, setError] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [overrideReasons, setOverrideReasons] = useState<
    Partial<Record<AmendmentFieldKey, string>>
  >({});
  const dialogRef = useRef<HTMLDialogElement>(null);
  const draggable = useDraggableDialog({ surfaceRef: dialogRef });

  const selectFile = useCallback((nextFile: File | null) => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const nextPreview =
      nextFile?.type === 'application/pdf' ? URL.createObjectURL(nextFile) : '';
    previewUrlRef.current = nextPreview;
    setPreviewUrl(nextPreview);
    setFile(nextFile);
    setResult(null);
    setConfirmed(false);
    setOverrideReasons({});
    setStatus('idle');
    setError('');
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  const closeDialog = () => {
    selectFile(null);
    onOpenChange(false);
  };

  const loadDemoAmendment = async () => {
    try {
      const fileName = '14_Apex_Equipment_Amendment_No_2.pdf';
      const response = await fetch(`/demo-documents/${fileName}`);
      if (!response.ok) throw new Error('The demo amendment is unavailable.');
      const blob = await response.blob();
      selectFile(new File([blob], fileName, { type: 'application/pdf' }));
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'The demo amendment is unavailable.',
      );
      setStatus('error');
    }
  };

  const analyze = async () => {
    if (!file) return;
    setStatus('analyzing');
    setError('');
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('contractId', String(contract.id));
      const response = await fetch('/api/amendments/analyze', {
        method: 'POST',
        body: form,
      });
      const body = (await response.json()) as AmendmentAnalysisResponse & {
        error?: string;
      };
      if (!response.ok)
        throw new Error(body.error || 'The amendment could not be analyzed.');
      setResult(body);
      setConfirmed(false);
      setOverrideReasons({});
      setStatus('ready');
    } catch (analysisError) {
      setError(
        analysisError instanceof Error
          ? analysisError.message
          : 'The amendment could not be analyzed.',
      );
      setStatus('error');
    }
  };

  const updateField = (
    fieldName: AmendmentFieldKey,
    value: string | number | null,
  ) => {
    setResult((current) => {
      if (!current) return current;
      const field = current.analysis[fieldName] as ExtractedField;
      return {
        ...current,
        analysis: {
          ...current.analysis,
          [fieldName]: { ...field, value },
        },
      };
    });
    setConfirmed(false);
  };

  const save = async () => {
    if (!result || !confirmed) return;
    setStatus('saving');
    setError('');
    try {
      const response = await fetch('/api/amendments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contractId: contract.id,
          analysisRunId: result.analysisRunId,
          document: result.document,
          analysis: result.analysis,
          review: { confirmed: true, overrideReasons },
        }),
      });
      const body = (await response.json()) as {
        saved?: boolean;
        error?: string;
      };
      if (!response.ok || !body.saved)
        throw new Error(body.error || 'The amendment could not be applied.');
      await onApplied();
      setStatus('saved');
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'The amendment could not be applied.',
      );
      setStatus('error');
    }
  };

  if (!open) return null;
  const numberFromField = (fieldName: AmendmentFieldKey) => {
    const value = result?.analysis[fieldName]?.value;
    if (typeof value === 'number') return value;
    const parsed = Number(String(value ?? '').replace(/[^0-9.-]/g, ''));
    return Number.isFinite(parsed) ? parsed : null;
  };
  const valueChange = numberFromField('valueChange') ?? 0;
  const statedResult = numberFromField('resultingContractValue');
  const proposedValueCents =
    statedResult === null
      ? Number(contract.current_value_cents ?? 0) +
        Math.round(valueChange * 100)
      : Math.round(statedResult * 100);
  const proposedExpiration =
    result?.analysis.newExpirationDate.value || contract.expiration_date;
  const missingAmendmentOverrideCount = result
    ? amendmentExtractionFields.filter(
        ([fieldName]) =>
          needsSourceOverride(
            fieldName,
            result.analysis[fieldName] as ExtractedField,
          ) && (overrideReasons[fieldName]?.trim().length ?? 0) < 12,
      ).length
    : 0;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-[2px]"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && status !== 'saving')
          closeDialog();
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
        aria-labelledby="amendment-dialog-title"
        className={`${dialogSurfaceClass} grid grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden`}
      >
        <button
          type="button"
          onClick={closeDialog}
          disabled={status === 'saving'}
          aria-label="Close amendment workspace"
          className="absolute right-4 top-4 z-10 flex size-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
        >
          ×
        </button>
        <header
          data-dialog-drag-handle
          title="Drag to move dialog"
          className="cursor-move touch-none select-none border-b border-border px-6 py-4 pr-14"
        >
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-accent-foreground">
            <Sparkles className="size-3.5" /> AI-assisted contract versioning
          </div>
          <h2 id="amendment-dialog-title" className="mt-1">
            Add amendment to {valueText(contract.contract_number)}
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Extract only the signed changes, verify them against the source,
            then update current effective terms and monitoring dates.
          </p>
        </header>

        {status === 'saved' ? (
          <div className="flex min-h-0 flex-col items-center justify-center px-6 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <Check className="size-6" />
            </span>
            <h3 className="mt-4">Amendment applied and versioned</h3>
            <p className="mt-2 max-w-lg text-xs leading-5 text-slate-500">
              The source file and verified changes are retained. Current terms,
              Contract Register values, and renewal monitoring have been
              updated.
            </p>
          </div>
        ) : (
          <div className="grid min-h-0 overflow-hidden xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <section className="min-h-0 overflow-y-auto border-b border-border bg-muted p-5 xl:border-b-0 xl:border-r">
              <div className="rounded-xl border-2 border-dashed border-border bg-card p-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.txt,application/pdf,text/plain"
                  className="sr-only"
                  onChange={(event) =>
                    selectFile(event.target.files?.[0] ?? null)
                  }
                />
                <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:text-left">
                  <span className="flex size-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                    <Upload className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {file?.name ??
                        'Choose a signed amendment or change order'}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      Text-based PDF or TXT · maximum 8 MB
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={loadDemoAmendment}
                    >
                      Use demo PDF
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Browse files
                    </Button>
                  </div>
                </div>
              </div>
              <div className="mt-4 overflow-hidden rounded-xl border border-border bg-muted">
                <div className="border-b border-border bg-card px-4 py-3">
                  <h3>Amendment source document</h3>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Read the signed language beside the extracted changes.
                  </p>
                </div>
                {previewUrl ? (
                  <iframe
                    title={file?.name ?? 'Amendment source'}
                    src={previewUrl}
                    className="h-[56vh] min-h-[460px] w-full bg-card"
                  />
                ) : (
                  <div className="flex min-h-[380px] flex-col items-center justify-center px-6 text-center">
                    <FileText className="size-7 text-slate-300" />
                    <p className="mt-3 text-xs text-slate-500">
                      Select an amendment to preview and analyze it.
                    </p>
                  </div>
                )}
              </div>
            </section>

            <section className="min-h-0 overflow-y-auto p-5">
              {error ? (
                <Alert variant="destructive" className="mb-4">
                  <AlertCircle />
                  <AlertTitle>Amendment needs attention</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}
              {status === 'analyzing' ? (
                <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-border bg-muted text-center">
                  <LoaderCircle className="size-7 animate-spin text-accent-foreground" />
                  <p className="mt-3 text-sm font-medium">
                    Extracting amendment deltas…
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Comparing the source against verified current contract
                    terms.
                  </p>
                </div>
              ) : result ? (
                <div className="space-y-4">
                  <DocumentQualitySummary report={result.qualityReport} />
                  <div className="grid gap-3 rounded-xl border border-border bg-[#f1f8fa] p-4 sm:grid-cols-2">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.1em] text-slate-500">
                        Current value
                      </p>
                      <p className="mt-1 text-lg font-semibold text-foreground">
                        {moneyFromCents(contract.current_value_cents)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.1em] text-[#2d788f]">
                        Resulting value
                      </p>
                      <p className="mt-1 text-lg font-semibold text-accent-foreground">
                        {moneyFromCents(proposedValueCents)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-slate-500">
                        Current expiration
                      </p>
                      <p className="mt-1 text-xs font-semibold text-foreground">
                        {usDateText(contract.expiration_date)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-[#2d788f]">
                        Resulting expiration
                      </p>
                      <p className="mt-1 text-xs font-semibold text-accent-foreground">
                        {usDateText(proposedExpiration)}
                      </p>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {amendmentExtractionFields.map(([fieldName, label]) => (
                      <AmendmentFieldControl
                        key={fieldName}
                        fieldName={fieldName}
                        label={label}
                        field={result.analysis[fieldName] as ExtractedField}
                        onChange={(value) => updateField(fieldName, value)}
                        overrideReason={overrideReasons[fieldName] ?? ''}
                        onOverrideReasonChange={(reason) =>
                          setOverrideReasons((current) => ({
                            ...current,
                            [fieldName]: reason,
                          }))
                        }
                      />
                    ))}
                  </div>
                  {result.analysis.warnings.length ? (
                    <Alert>
                      <AlertTriangle />
                      <AlertTitle>AI extraction warnings</AlertTitle>
                      <AlertDescription>
                        {result.analysis.warnings.join(' ')}
                      </AlertDescription>
                    </Alert>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => {
                      if (missingAmendmentOverrideCount) {
                        setError(
                          `Add a reviewer override reason for ${missingAmendmentOverrideCount} critical field${missingAmendmentOverrideCount === 1 ? '' : 's'} without source evidence.`,
                        );
                        return;
                      }
                      setConfirmed((current) => !current);
                    }}
                    className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left ${confirmed ? 'border-emerald-300 bg-emerald-50' : 'border-border bg-card'}`}
                  >
                    <span
                      className={`mt-0.5 flex size-5 items-center justify-center rounded border ${confirmed ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-300'}`}
                    >
                      {confirmed ? <Check className="size-3.5" /> : null}
                    </span>
                    <span>
                      <span className="block text-xs font-semibold text-foreground">
                        Human verification complete
                      </span>
                      <span className="mt-1 block text-[11px] leading-4 text-slate-500">
                        I compared these changes with the source and approve
                        updating the current effective terms and monitoring
                        schedule.
                      </span>
                    </span>
                  </button>
                </div>
              ) : (
                <div className="flex min-h-[420px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted px-6 text-center">
                  <Sparkles className="size-7 text-[#72a9ba]" />
                  <p className="mt-3 text-xs font-semibold text-foreground">
                    Upload the signed amendment first
                  </p>
                  <p className="mt-1 max-w-sm text-[11px] leading-4 text-slate-500">
                    AI will extract only changed terms and preserve source-page
                    evidence.
                  </p>
                </div>
              )}
            </section>
          </div>
        )}

        <footer className="flex flex-col-reverse gap-2 border-t border-border bg-slate-50 px-6 py-4 sm:flex-row sm:justify-end">
          {status === 'saved' ? (
            <Button
              onClick={closeDialog}
              className="bg-primary hover:bg-primary/90"
            >
              Return to contract
            </Button>
          ) : result ? (
            <>
              <Button variant="outline" onClick={() => selectFile(null)}>
                Start over
              </Button>
              <Button
                onClick={save}
                disabled={
                  !confirmed ||
                  missingAmendmentOverrideCount > 0 ||
                  status === 'saving'
                }
                className="bg-primary hover:bg-primary/90"
              >
                {status === 'saving' ? (
                  <LoaderCircle className="animate-spin" />
                ) : (
                  <Database />
                )}
                {confirmed
                  ? 'Apply verified amendment'
                  : 'Confirm review to apply'}
              </Button>
            </>
          ) : (
            <Button
              onClick={analyze}
              disabled={!file || status === 'analyzing'}
              className="bg-primary hover:bg-primary/90"
            >
              <Sparkles /> Analyze amendment with DeepSeek
            </Button>
          )}
        </footer>
      </dialog>
    </div>
  );
}

export function AmendmentFieldControl({
  fieldName,
  label,
  field,
  onChange,
  overrideReason,
  onOverrideReasonChange,
}: {
  fieldName: AmendmentFieldKey;
  label: string;
  field: ExtractedField;
  onChange: (value: string | number | null) => void;
  overrideReason: string;
  onOverrideReasonChange: (reason: string) => void;
}) {
  const stringValue = field.value === null ? '' : String(field.value);
  const dateField = [
    'signedDate',
    'effectiveDate',
    'newExpirationDate',
  ].includes(fieldName);
  const numberField = [
    'valueChange',
    'resultingContractValue',
    'noticeDays',
  ].includes(fieldName);
  return (
    <div
      className={`rounded-lg border border-border bg-card p-3 ${fieldName === 'scopeSummary' ? 'sm:col-span-2' : ''}`}
    >
      <span className="flex items-center justify-between gap-2 text-[11px] font-semibold text-foreground">
        {label}
        <span className="font-normal text-slate-400">
          {Math.round(field.confidence * 100)}% · page {field.sourcePage ?? '—'}
        </span>
      </span>
      {fieldName === 'amendmentType' ? (
        <select
          aria-label={label}
          value={stringValue || 'amendment'}
          onChange={(event) => onChange(event.target.value)}
          className="mt-2 h-9 w-full rounded-md border border-input bg-card px-3 text-xs"
        >
          {[
            'amendment',
            'change_order',
            'extension',
            'renewal',
            'termination',
            'price_adjustment',
            'sow_replacement',
          ].map((option) => (
            <option key={option} value={option}>
              {titleCase(option)}
            </option>
          ))}
        </select>
      ) : fieldName === 'renewalType' ? (
        <select
          aria-label={label}
          value={stringValue}
          onChange={(event) => onChange(event.target.value || null)}
          className="mt-2 h-9 w-full rounded-md border border-input bg-card px-3 text-xs"
        >
          <option value="">Unchanged</option>
          <option value="automatic">Automatic</option>
          <option value="optional">Optional</option>
          <option value="none">None</option>
        </select>
      ) : fieldName === 'scopeSummary' ? (
        <textarea
          aria-label={label}
          value={stringValue}
          onChange={(event) => onChange(event.target.value)}
          rows={3}
          className="mt-2 w-full rounded-md border border-input bg-card px-3 py-2 text-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
        />
      ) : dateField ? (
        <USDateInput
          key={stringValue || `${fieldName}-empty`}
          value={stringValue}
          onChange={(value) => onChange(value || null)}
          ariaLabel={`${label} in month/day/year format`}
          className="mt-2 h-9 bg-card text-xs"
        />
      ) : (
        <Input
          aria-label={label}
          type={numberField ? 'number' : 'text'}
          step={fieldName === 'noticeDays' ? '1' : '0.01'}
          value={stringValue}
          onChange={(event) =>
            onChange(
              numberField
                ? event.target.value === ''
                  ? null
                  : Number(event.target.value)
                : event.target.value,
            )
          }
          className="mt-2 h-9 bg-card text-xs"
        />
      )}
      {field.sourceQuote ? (
        <span className="mt-2 block line-clamp-2 text-[11px] leading-4 text-slate-400">
          “{field.sourceQuote}”
        </span>
      ) : null}
      {needsSourceOverride(fieldName, field) ? (
        <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2">
          <label
            htmlFor={`amendment-override-${fieldName}`}
            className="text-[11px] font-semibold text-amber-800"
          >
            Required source override reason
          </label>
          <Input
            id={`amendment-override-${fieldName}`}
            value={overrideReason}
            onChange={(event) => onOverrideReasonChange(event.target.value)}
            placeholder="Explain independent verification"
            className="mt-1 h-8 bg-card text-[11px]"
          />
        </div>
      ) : null}
    </div>
  );
}
