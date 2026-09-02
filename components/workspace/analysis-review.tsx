'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { needsSourceOverride } from '@/lib/ai-governance';
import type {
  AnalysisResponse,
  ContractAnalysis,
  ExtractedField,
} from '@/lib/contract-ledger-types';
import { AlertCircle, AlertTriangle, BookOpenCheck, Check } from 'lucide-react';
import { extractionFields } from '@/components/workspace/constants';
import type { ExtractionFieldKey } from '@/components/workspace/constants';
import { titleCase, valueText } from '@/components/workspace/formatters';
import {
  DocumentQualitySummary,
  FieldConfidence,
  StatusBadge,
} from '@/components/workspace/primitives';
import type {
  FieldReviewStatus,
  IntakeStage,
} from '@/components/workspace/types';

export function AnalysisReview({
  result,
  originalAnalysis,
  stage,
  fieldReviews,
  fieldOverrideReasons,
  onFieldChange,
  onConfirmField,
  onConfirmAll,
  onOverrideReasonChange,
}: {
  result: AnalysisResponse;
  originalAnalysis: ContractAnalysis | null;
  stage: IntakeStage;
  fieldReviews: Partial<Record<ExtractionFieldKey, FieldReviewStatus>>;
  fieldOverrideReasons: Partial<Record<ExtractionFieldKey, string>>;
  onFieldChange: (
    fieldName: ExtractionFieldKey,
    value: string | number | null,
  ) => void;
  onConfirmField: (fieldName: ExtractionFieldKey) => void;
  onConfirmAll: () => void;
  onOverrideReasonChange: (
    fieldName: ExtractionFieldKey,
    reason: string,
  ) => void;
}) {
  const confirmedCount = extractionFields.filter(
    ([fieldName]) =>
      fieldReviews[fieldName] === 'accepted' ||
      fieldReviews[fieldName] === 'corrected',
  ).length;
  const correctedCount = extractionFields.filter(
    ([fieldName]) => fieldReviews[fieldName] === 'corrected',
  ).length;

  return (
    <div className="space-y-5">
      <DocumentQualitySummary report={result.qualityReport} />
      <div className="rounded-xl border border-[#bdd7e0] bg-[#f0f8fa] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-[#1b3442]">
                Human verification required
              </h3>
              <Badge
                variant="outline"
                className="border-sky-200 bg-white text-sky-800"
              >
                {result.model}
              </Badge>
            </div>
            <p className="mt-1 text-[11px] text-slate-600">
              Confirm or correct every AI-extracted field before database values
              can change.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onConfirmAll}
            disabled={confirmedCount === extractionFields.length}
            className="bg-white"
          >
            <Check /> Confirm all unchanged
          </Button>
        </div>
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white">
          <div
            className="h-full rounded-full bg-[#287d9b] transition-all"
            style={{
              width: `${(confirmedCount / extractionFields.length) * 100}%`,
            }}
          />
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-600">
          <span>
            {confirmedCount} of {extractionFields.length} fields reviewed
          </span>
          <span>
            {correctedCount
              ? `${correctedCount} human correction${correctedCount === 1 ? '' : 's'} recorded`
              : 'No corrections recorded yet'}
          </span>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {extractionFields.map(([key, label]) => {
          const field = result.analysis[key] as ExtractedField;
          const originalField = (originalAnalysis?.[key] ??
            field) as ExtractedField;
          const reviewStatus = fieldReviews[key] ?? 'pending';
          const lowConfidence = field.confidence < 0.75;
          const sourceOverrideRequired = needsSourceOverride(key, {
            ...originalField,
            value: field.value,
          });
          const inputValue = field.value === null ? '' : String(field.value);
          const updateValue = (rawValue: string) => {
            if (key === 'contractValue' || key === 'noticeDays') {
              onFieldChange(key, rawValue === '' ? null : Number(rawValue));
              return;
            }
            onFieldChange(key, rawValue === '' ? null : rawValue);
          };
          return (
            <div
              key={key}
              className={`rounded-lg border bg-white p-3 ${reviewStatus === 'corrected' ? 'border-amber-300' : reviewStatus === 'accepted' ? 'border-emerald-200' : lowConfidence ? 'border-rose-300' : 'border-[#dce3e8]'}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                  {label}
                </span>
                <div className="flex items-center gap-1.5">
                  <FieldConfidence field={originalField} />
                  <StatusBadge
                    tone={
                      reviewStatus === 'accepted'
                        ? 'green'
                        : reviewStatus === 'corrected'
                          ? 'amber'
                          : lowConfidence
                            ? 'rose'
                            : 'blue'
                    }
                  >
                    {reviewStatus === 'pending'
                      ? lowConfidence
                        ? 'Needs review'
                        : 'Pending'
                      : titleCase(reviewStatus)}
                  </StatusBadge>
                </div>
              </div>
              {key === 'renewalType' ? (
                <select
                  aria-label={label}
                  value={inputValue}
                  onChange={(event) => updateValue(event.target.value)}
                  className="mt-2 h-9 w-full rounded-md border border-input bg-white px-3 text-xs font-medium text-[#203845]"
                >
                  <option value="">Not found</option>
                  <option value="automatic">Automatic</option>
                  <option value="optional">Optional</option>
                  <option value="none">None</option>
                </select>
              ) : (
                <Input
                  aria-label={label}
                  type={
                    key === 'effectiveDate' || key === 'expirationDate'
                      ? 'date'
                      : key === 'contractValue' || key === 'noticeDays'
                        ? 'number'
                        : 'text'
                  }
                  min={
                    key === 'contractValue' || key === 'noticeDays'
                      ? '0'
                      : undefined
                  }
                  step={key === 'contractValue' ? '0.01' : undefined}
                  value={inputValue}
                  onChange={(event) => updateValue(event.target.value)}
                  placeholder="Not found in document"
                  className="mt-2 h-9 bg-white text-xs font-medium text-[#203845]"
                />
              )}
              {reviewStatus === 'corrected' ? (
                <p className="mt-2 rounded bg-amber-50 px-2 py-1 text-[10px] text-amber-800">
                  AI original: {valueText(originalField.value)}
                </p>
              ) : null}
              <div className="mt-2 flex items-start gap-2 text-[10px] leading-4 text-slate-500">
                <BookOpenCheck className="mt-0.5 size-3 shrink-0" />
                <span>
                  {originalField.sourcePage
                    ? `Page ${originalField.sourcePage}`
                    : 'No page'}
                  {originalField.sourceQuote
                    ? ` · “${originalField.sourceQuote}”`
                    : ' · No supporting quote found'}
                </span>
              </div>
              {sourceOverrideRequired ? (
                <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2">
                  <label
                    htmlFor={`source-override-${key}`}
                    className="text-[9px] font-semibold uppercase tracking-[0.06em] text-amber-800"
                  >
                    Required source override reason
                  </label>
                  <Input
                    id={`source-override-${key}`}
                    value={fieldOverrideReasons[key] ?? ''}
                    onChange={(event) =>
                      onOverrideReasonChange(key, event.target.value)
                    }
                    placeholder="Explain how this value was independently verified"
                    className="mt-1 h-8 bg-white text-[10px]"
                  />
                  <p className="mt-1 text-[9px] text-amber-700">
                    At least 12 characters. This reason is retained in the AI
                    review audit trail.
                  </p>
                </div>
              ) : null}
              <div className="mt-3 flex justify-end">
                <Button
                  type="button"
                  size="sm"
                  variant={reviewStatus === 'pending' ? 'default' : 'outline'}
                  onClick={() => onConfirmField(key)}
                  className="h-7 px-2.5 text-[10px]"
                >
                  <Check />
                  {reviewStatus === 'pending'
                    ? 'Confirm field'
                    : reviewStatus === 'corrected'
                      ? 'Correction recorded'
                      : 'Confirmed'}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
      {result.analysis.findings.length ? (
        <div>
          <h3 className="text-sm font-semibold text-[#1b3442]">
            {stage === 'draft'
              ? 'Playbook differences'
              : 'Operational exceptions'}
          </h3>
          <div className="mt-3 space-y-2">
            {result.analysis.findings.map((finding, index) => (
              <div
                key={`${finding.rule}-${index}`}
                className="flex items-start gap-3 rounded-lg border border-[#dce3e8] p-3"
              >
                <AlertTriangle
                  className={`mt-0.5 size-4 shrink-0 ${finding.severity === 'high' ? 'text-rose-600' : 'text-amber-600'}`}
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-medium">{finding.rule}</p>
                    <StatusBadge
                      tone={finding.severity === 'high' ? 'rose' : 'amber'}
                    >
                      {titleCase(finding.severity)}
                    </StatusBadge>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-600">
                    Observed: {finding.observed}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Demo standard: {finding.standard}
                    {finding.sourcePage ? ` · Page ${finding.sourcePage}` : ''}
                  </p>
                  <div className="mt-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2">
                    <p className="text-[9px] font-semibold uppercase tracking-[0.06em] text-sky-700">
                      Suggested revision
                    </p>
                    <p className="mt-1 text-[10px] leading-4 text-sky-900">
                      {finding.suggestedRevision}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {result.analysis.warnings.length ? (
        <Alert>
          <AlertCircle />
          <AlertTitle>Fields needing manual attention</AlertTitle>
          <AlertDescription>
            {result.analysis.warnings.join(' ')}
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
