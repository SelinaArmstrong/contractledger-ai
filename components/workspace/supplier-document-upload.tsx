'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { needsSourceOverride } from '@/lib/ai-governance';
import type {
  ExtractedField,
  SupplierDocumentAnalysisResponse,
} from '@/lib/contract-ledger-types';
import {
  SUPPLIER_DOCUMENT_LABELS,
  SUPPLIER_DOCUMENT_TYPES,
  normalizeSupplierName,
} from '@/lib/supplier-qualification';
import type { SupplierDocumentType } from '@/lib/supplier-qualification';
import {
  AlertCircle,
  AlertTriangle,
  LoaderCircle,
  Sparkles,
  Upload,
} from 'lucide-react';
import { useState } from 'react';
import { titleCase, valueText } from '@/components/workspace/formatters';
import {
  DocumentQualitySummary,
  FieldConfidence,
  StatusBadge,
} from '@/components/workspace/primitives';

export function SupplierDocumentUpload({
  supplierId,
  supplierName,
  onUploaded,
}: {
  supplierId: string;
  supplierName: string;
  onUploaded: () => Promise<void>;
}) {
  const [documentType, setDocumentType] = useState('w9');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [expirationDate, setExpirationDate] = useState('');
  const [issuer, setIssuer] = useState('');
  const [documentNumber, setDocumentNumber] = useState('');
  const [coverageSummary, setCoverageSummary] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [aiResult, setAiResult] =
    useState<SupplierDocumentAnalysisResponse | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [sourceOverrideReason, setSourceOverrideReason] = useState('');

  const supplierCriticalFields = aiResult
    ? (
        [
          ['supplierLegalName', aiResult.analysis.supplierLegalName],
          ['documentType', aiResult.analysis.documentType],
          ['effectiveDate', aiResult.analysis.effectiveDate],
          ['expirationDate', aiResult.analysis.expirationDate],
        ] satisfies Array<[string, ExtractedField]>
      ).filter(([fieldName, field]) => needsSourceOverride(fieldName, field))
    : [];
  const supplierOverrideMissing =
    supplierCriticalFields.length > 0 &&
    sourceOverrideReason.trim().length < 12;

  const analyze = async () => {
    if (!file) return setMessage('Choose a PDF, PNG, or JPEG file.');
    setAnalyzing(true);
    setMessage('');
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('expectedDocumentType', documentType);
      const response = await fetch('/api/analyze-supplier-document', {
        method: 'POST',
        body: form,
      });
      const body =
        (await response.json()) as SupplierDocumentAnalysisResponse & {
          error?: string;
        };
      if (!response.ok)
        throw new Error(body.error || 'Unable to analyze the supplier file.');
      setAiResult(body);
      const extractedType = body.analysis.documentType.value;
      if (
        typeof extractedType === 'string' &&
        SUPPLIER_DOCUMENT_TYPES.includes(extractedType as SupplierDocumentType)
      )
        setDocumentType(extractedType);
      setIssuer(valueText(body.analysis.issuer.value).replace('Not found', ''));
      setDocumentNumber(
        valueText(body.analysis.documentNumber.value).replace('Not found', ''),
      );
      setEffectiveDate(
        valueText(body.analysis.effectiveDate.value).replace('Not found', ''),
      );
      setExpirationDate(
        valueText(body.analysis.expirationDate.value).replace('Not found', ''),
      );
      setCoverageSummary(
        valueText(body.analysis.coverageSummary.value).replace('Not found', ''),
      );
      setMessage('AI suggestions loaded. Review the metadata before upload.');
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Unable to analyze the supplier file.',
      );
    } finally {
      setAnalyzing(false);
    }
  };

  const upload = async () => {
    if (!file) return setMessage('Choose a PDF, PNG, or JPEG file.');
    if (supplierOverrideMissing)
      return setMessage(
        'Add a reviewer override reason of at least 12 characters for critical values without source evidence.',
      );
    setSaving(true);
    setMessage('');
    try {
      const form = new FormData();
      form.append('supplierId', supplierId);
      form.append('analysisRunId', aiResult?.analysisRunId ?? '');
      form.append('documentType', documentType);
      form.append('effectiveDate', effectiveDate);
      form.append('expirationDate', expirationDate);
      form.append('issuer', issuer);
      form.append('documentNumber', documentNumber);
      form.append('coverageSummary', coverageSummary);
      form.append('overrideReason', sourceOverrideReason);
      form.append('file', file);
      const response = await fetch('/api/supplier-documents', {
        method: 'POST',
        body: form,
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok)
        throw new Error(body.error || 'Unable to upload the document.');
      setMessage('Document archived; supplier data and status updated.');
      setFile(null);
      setAiResult(null);
      setIssuer('');
      setDocumentNumber('');
      setEffectiveDate('');
      setExpirationDate('');
      setCoverageSummary('');
      setSourceOverrideReason('');
      await onUploaded();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Unable to upload the document.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-xl border border-[#bcd8e2] bg-[#f0f8fa] p-4">
      <div className="flex items-center gap-2">
        <Upload className="size-4 text-[#287693]" />
        <h3 className="text-sm font-semibold text-[#203845]">
          Add supplier documentation
        </h3>
      </div>
      <p className="mt-1 text-[11px] text-slate-500">
        Store tax, insurance, business registration, licensing, risk, safety,
        diversity, and other supplier evidence. AI extracts metadata, updates
        blank supplier fields, archives the file, and flags missing, expired, or
        inconsistent information for follow-up. It does not approve or reject
        the supplier.
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <select
          value={documentType}
          onChange={(event) => setDocumentType(event.target.value)}
          className="h-9 rounded-md border border-input bg-white px-3 text-xs"
        >
          {SUPPLIER_DOCUMENT_TYPES.map((type) => (
            <option key={type} value={type}>
              {SUPPLIER_DOCUMENT_LABELS[type]}
            </option>
          ))}
        </select>
        <Input
          value={issuer}
          onChange={(event) => setIssuer(event.target.value)}
          placeholder="Issuer or verification source"
          className="h-9 bg-white text-xs"
        />
        <Input
          value={documentNumber}
          onChange={(event) => setDocumentNumber(event.target.value)}
          placeholder="License / document number"
          className="h-9 bg-white text-xs"
        />
        <Input
          type="date"
          value={effectiveDate}
          onChange={(event) => setEffectiveDate(event.target.value)}
          aria-label="Qualification document effective date"
          className="h-9 bg-white text-xs"
        />
        <Input
          type="date"
          value={expirationDate}
          onChange={(event) => setExpirationDate(event.target.value)}
          aria-label="Qualification document expiration date"
          className="h-9 bg-white text-xs"
        />
        <Input
          value={coverageSummary}
          onChange={(event) => setCoverageSummary(event.target.value)}
          placeholder="Coverage / qualification summary"
          className="h-9 bg-white text-xs md:col-span-2"
        />
        <Input
          type="file"
          accept="application/pdf,image/png,image/jpeg"
          onChange={(event) => {
            setFile(event.target.files?.[0] ?? null);
            setAiResult(null);
            setSourceOverrideReason('');
            setMessage('');
          }}
          className="h-9 bg-white text-xs file:mr-3 file:border-0 file:bg-transparent"
        />
        <div className="flex gap-2 xl:col-start-4 xl:justify-end">
          <Button
            size="sm"
            variant="outline"
            onClick={analyze}
            disabled={!file || analyzing || saving}
            className="bg-white"
          >
            {analyzing ? (
              <LoaderCircle className="animate-spin" />
            ) : (
              <Sparkles />
            )}
            Analyze with AI
          </Button>
          <Button
            size="sm"
            onClick={upload}
            disabled={saving || analyzing || supplierOverrideMissing}
          >
            {saving ? <LoaderCircle className="animate-spin" /> : <Upload />}
            Upload reviewed file
          </Button>
        </div>
      </div>
      {aiResult ? (
        <SupplierDocumentAIReview
          result={aiResult}
          supplierName={supplierName}
        />
      ) : null}
      {supplierCriticalFields.length ? (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <label
            htmlFor="supplier-document-source-override"
            className="text-[10px] font-semibold text-amber-900"
          >
            Required source override reason
          </label>
          <p className="mt-1 text-[9px] text-amber-700">
            Critical fields without page-and-quote support:{' '}
            {supplierCriticalFields
              .map(([fieldName]) => titleCase(String(fieldName)))
              .join(', ')}
          </p>
          <Input
            id="supplier-document-source-override"
            value={sourceOverrideReason}
            onChange={(event) => setSourceOverrideReason(event.target.value)}
            placeholder="Explain how the values were independently verified"
            className="mt-2 h-8 bg-white text-[10px]"
          />
        </div>
      ) : null}
      {message ? (
        <p
          className={`mt-2 text-[11px] ${message.startsWith('Document archived') || message.startsWith('AI suggestions') ? 'text-emerald-700' : 'text-rose-600'}`}
        >
          {message}
        </p>
      ) : null}
    </section>
  );
}

export function SupplierDocumentAIReview({
  result,
  supplierName,
}: {
  result: SupplierDocumentAnalysisResponse;
  supplierName: string;
}) {
  const extractedName = valueText(result.analysis.supplierLegalName.value);
  const supplierMatch =
    extractedName !== 'Not found' &&
    normalizeSupplierName(extractedName) ===
      normalizeSupplierName(supplierName);
  const fields = (
    [
      ['Legal name', result.analysis.supplierLegalName],
      ['DBA / trade name', result.analysis.dbaName],
      ['Supplier category', result.analysis.supplierCategory],
      ['Primary contact', result.analysis.primaryContact],
      ['Email', result.analysis.email],
      ['Phone', result.analysis.phone],
      ['Website', result.analysis.website],
      ['Address', result.analysis.addressLine1],
      ['Address line 2', result.analysis.addressLine2],
      ['City', result.analysis.city],
      ['State', result.analysis.state],
      ['Postal code', result.analysis.postalCode],
      ['Country', result.analysis.country],
      ['Tax classification', result.analysis.taxClassification],
      ['Detected type', result.analysis.documentType],
      ['Issuer', result.analysis.issuer],
      ['Document number', result.analysis.documentNumber],
      ['Effective date', result.analysis.effectiveDate],
      ['Expiration date', result.analysis.expirationDate],
      ['Coverage / qualification', result.analysis.coverageSummary],
    ] satisfies Array<[string, ExtractedField]>
  ).filter(([, field]) => field.value !== null && field.value !== '');

  return (
    <div className="mt-4 rounded-xl border border-[#bdd7e0] bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Sparkles className="size-4 text-[#287d9b]" />
            <h4 className="text-xs font-semibold text-[#203845]">
              AI qualification-document extraction
            </h4>
            <StatusBadge tone={supplierMatch ? 'green' : 'rose'}>
              {supplierMatch ? 'Supplier name matched' : 'Name needs review'}
            </StatusBadge>
          </div>
          <p className="mt-1 text-[10px] text-slate-500">
            File identifies {extractedName}; current record is {supplierName}.
          </p>
        </div>
        <Badge
          variant="outline"
          className="border-sky-200 bg-sky-50 text-sky-800"
        >
          {result.model}
        </Badge>
      </div>
      <div className="mt-3">
        <DocumentQualitySummary report={result.qualityReport} />
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {fields.map(([label, field]) => (
          <div
            key={label}
            className="rounded-lg border border-[#e0e7ea] bg-[#f8fafb] p-3"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                {label}
              </span>
              <FieldConfidence field={field} />
            </div>
            <p className="mt-1.5 text-[11px] font-medium text-[#294354]">
              {valueText(field.value)}
            </p>
            <p className="mt-1 line-clamp-2 text-[9px] leading-4 text-slate-500">
              {field.sourcePage ? `Page ${field.sourcePage}` : 'No page'}
              {field.sourceQuote ? ` · “${field.sourceQuote}”` : ''}
            </p>
          </div>
        ))}
      </div>
      {result.analysis.findings.length || result.analysis.warnings.length ? (
        <div className="mt-3 space-y-2">
          {result.analysis.findings.map((finding, index) => (
            <div
              key={`${finding.title}-${index}`}
              className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-[10px] text-amber-900"
            >
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              <span>
                <strong>{finding.title}:</strong> {finding.detail}
              </span>
            </div>
          ))}
          {result.analysis.warnings.map((warning) => (
            <div
              key={warning}
              className="flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2 text-[10px] text-rose-800"
            >
              <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
              {warning}
            </div>
          ))}
        </div>
      ) : null}
      <p className="mt-3 text-[10px] text-slate-500">
        These source-backed values feed the proposed supplier master and
        document metadata. Review or correct them before creating the database
        record.
      </p>
    </div>
  );
}
