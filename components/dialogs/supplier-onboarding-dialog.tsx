'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { needsSourceOverride } from '@/lib/ai-governance';
import type {
  ExtractedField,
  SupplierDocumentAnalysisResponse,
  Workspace,
} from '@/lib/contract-ledger-types';
import {
  SUPPLIER_DOCUMENT_LABELS,
  SUPPLIER_DOCUMENT_TYPES,
} from '@/lib/supplier-qualification';
import type { SupplierDocumentType } from '@/lib/supplier-qualification';
import {
  AlertCircle,
  AlertTriangle,
  Building2,
  Check,
  Database,
  FileText,
  LoaderCircle,
  Plus,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { supplierProfileExtractionFields } from '@/components/workspace/constants';
import {
  newSupplierDocument,
  titleCase,
  valueText,
} from '@/components/workspace/formatters';
import { StatusBadge } from '@/components/workspace/primitives';
import { SupplierDocumentAIReview } from '@/components/workspace/supplier-document-upload';
import type {
  SupplierOnboardingDocument,
  SupplierProfileEvidence,
  SupplierProfileFieldKey,
} from '@/components/workspace/types';
import { useDraggableDialog } from '@/components/workspace/use-draggable-dialog';

export function SupplierOnboardingDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (workspace: Workspace, supplierName: string) => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const draggable = useDraggableDialog({
    surfaceRef: dialogRef,
    centered: true,
  });
  const initialSupplier = {
    legalName: '',
    dbaName: '',
    category: '',
    primaryContact: '',
    email: '',
    phone: '',
    website: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    postalCode: '',
    country: '',
    taxClassification: 'Pending verification',
    riskTier: 'medium',
  };
  const [supplier, setSupplier] = useState(initialSupplier);
  const [documents, setDocuments] = useState<SupplierOnboardingDocument[]>(
    () => [newSupplierDocument()],
  );

  const sourceOverrideFields = (document: SupplierOnboardingDocument) => {
    if (!document.aiResult) return [];
    const candidates: Array<[string, ExtractedField]> = [
      [
        'supplierLegalName',
        {
          ...document.aiResult.analysis.supplierLegalName,
          value: supplier.legalName,
        },
      ],
      [
        'documentType',
        {
          ...document.aiResult.analysis.documentType,
          value: document.documentType,
        },
      ],
      [
        'effectiveDate',
        {
          ...document.aiResult.analysis.effectiveDate,
          value: document.effectiveDate || null,
        },
      ],
      [
        'expirationDate',
        {
          ...document.aiResult.analysis.expirationDate,
          value: document.expirationDate || null,
        },
      ],
    ];
    return candidates
      .filter(([fieldName, field]) => needsSourceOverride(fieldName, field))
      .map(([fieldName]) => fieldName);
  };
  const [saving, setSaving] = useState(false);
  const [packageAnalyzing, setPackageAnalyzing] = useState(false);
  const [profileGenerated, setProfileGenerated] = useState(false);
  const [profileEvidence, setProfileEvidence] = useState<
    Partial<Record<SupplierProfileFieldKey, SupplierProfileEvidence>>
  >({});
  const [profileWarnings, setProfileWarnings] = useState<string[]>([]);
  const [error, setError] = useState('');
  const packageUploadInputRef = useRef<HTMLInputElement>(null);

  const updateSupplier = (field: keyof typeof initialSupplier, value: string) =>
    setSupplier((current) => ({ ...current, [field]: value }));
  const updateDocument = (
    id: string,
    changes: Partial<SupplierOnboardingDocument>,
  ) =>
    setDocuments((current) =>
      current.map((item) => (item.id === id ? { ...item, ...changes } : item)),
    );
  const reset = () => {
    setSupplier(initialSupplier);
    setDocuments([newSupplierDocument()]);
    setPackageAnalyzing(false);
    setProfileGenerated(false);
    setProfileEvidence({});
    setProfileWarnings([]);
    setError('');
  };

  const selectQualificationPackage = (fileList: FileList | null) => {
    if (!fileList?.length) return;
    const selectedFiles = Array.from(fileList);
    const retained = documents.filter((item) => item.file);
    const availableSlots = Math.max(0, 10 - retained.length);
    const accepted = selectedFiles.slice(0, availableSlots);
    setError(
      accepted.length < selectedFiles.length
        ? 'A supplier qualification package can contain up to 10 files.'
        : '',
    );
    setDocuments([
      ...retained,
      ...accepted.map((file) => ({
        ...newSupplierDocument(),
        file,
      })),
    ]);
    setSupplier(initialSupplier);
    setProfileGenerated(false);
    setProfileEvidence({});
    setProfileWarnings([]);
  };

  const extractedText = (field: ExtractedField) => {
    if (field.value === null || field.value === undefined) return '';
    return String(field.value).trim();
  };

  const analysisDocumentChanges = (
    document: SupplierOnboardingDocument,
    result: SupplierDocumentAnalysisResponse,
  ): Partial<SupplierOnboardingDocument> => {
    const extractedType = result.analysis.documentType.value;
    return {
      aiResult: result,
      analyzing: false,
      aiError: '',
      documentType:
        typeof extractedType === 'string' &&
        SUPPLIER_DOCUMENT_TYPES.includes(extractedType as SupplierDocumentType)
          ? (extractedType as SupplierDocumentType)
          : document.documentType,
      issuer: extractedText(result.analysis.issuer),
      documentNumber: extractedText(result.analysis.documentNumber),
      effectiveDate: extractedText(result.analysis.effectiveDate),
      expirationDate: extractedText(result.analysis.expirationDate),
      coverageSummary: extractedText(result.analysis.coverageSummary),
    };
  };

  const generateSupplierProfile = (
    results: SupplierDocumentAnalysisResponse[],
  ) => {
    const evidence: Partial<
      Record<SupplierProfileFieldKey, SupplierProfileEvidence>
    > = {};
    const nextSupplier = { ...initialSupplier };
    const warnings: string[] = [];

    for (const [profileKey, analysisKey] of supplierProfileExtractionFields) {
      const candidates = results
        .map((result) => ({
          result,
          field: result.analysis[analysisKey] as ExtractedField,
        }))
        .filter(({ field }) => extractedText(field))
        .sort((left, right) => right.field.confidence - left.field.confidence);
      const selected = candidates[0];
      if (!selected) continue;
      nextSupplier[profileKey] = extractedText(selected.field);
      evidence[profileKey] = {
        fileName: selected.result.document.fileName,
        confidence: selected.field.confidence,
        sourcePage: selected.field.sourcePage,
      };
      const distinctValues = new Set(
        candidates.map(({ field }) => extractedText(field).toLowerCase()),
      );
      if (distinctValues.size > 1)
        warnings.push(
          `${profileKey.replace(/([A-Z])/g, ' $1').toLowerCase()} differs across uploaded files; the highest-confidence value was selected for review.`,
        );
    }

    if (!nextSupplier.category) nextSupplier.category = 'Unclassified';
    if (!nextSupplier.taxClassification)
      nextSupplier.taxClassification = 'Pending verification';
    setSupplier(nextSupplier);
    setProfileEvidence(evidence);
    setProfileWarnings([...new Set(warnings)]);
    setProfileGenerated(true);
  };

  const requestDocumentAnalysis = async (
    document: SupplierOnboardingDocument,
  ) => {
    if (!document.file)
      throw new Error('Choose a PDF, PNG, or JPEG file first.');
    const form = new FormData();
    form.append('file', document.file);
    form.append('expectedDocumentType', document.documentType);
    const response = await fetch('/api/analyze-supplier-document', {
      method: 'POST',
      body: form,
    });
    const body = (await response.json()) as SupplierDocumentAnalysisResponse & {
      error?: string;
    };
    if (!response.ok)
      throw new Error(body.error || 'Unable to analyze this supplier file.');
    return body;
  };

  const analyzeDocument = async (document: SupplierOnboardingDocument) => {
    if (!document.file) {
      updateDocument(document.id, {
        aiError: 'Choose a PDF, PNG, or JPEG file first.',
      });
      return;
    }
    updateDocument(document.id, { analyzing: true, aiError: '' });
    try {
      const body = await requestDocumentAnalysis(document);
      updateDocument(document.id, analysisDocumentChanges(document, body));
      generateSupplierProfile([
        ...documents
          .filter((item) => item.id !== document.id)
          .flatMap((item) => (item.aiResult ? [item.aiResult] : [])),
        body,
      ]);
    } catch (analysisError) {
      updateDocument(document.id, {
        analyzing: false,
        aiError:
          analysisError instanceof Error
            ? analysisError.message
            : 'Unable to analyze this supplier file.',
      });
    }
  };

  const analyzePackage = async () => {
    if (!documents.length || documents.some((item) => !item.file)) {
      setError(
        'Upload a qualification file in every file card before generating the supplier register.',
      );
      return;
    }
    setPackageAnalyzing(true);
    setError('');
    const results = new Map<string, SupplierDocumentAnalysisResponse>();
    const failures: string[] = [];
    for (const document of documents) {
      if (document.aiResult) {
        results.set(document.id, document.aiResult);
        continue;
      }
      updateDocument(document.id, { analyzing: true, aiError: '' });
      try {
        const result = await requestDocumentAnalysis(document);
        results.set(document.id, result);
        updateDocument(document.id, analysisDocumentChanges(document, result));
      } catch (analysisError) {
        const message =
          analysisError instanceof Error
            ? analysisError.message
            : 'Unable to analyze this supplier file.';
        failures.push(
          document.file?.name ?? `Qualification file ${document.id}`,
        );
        updateDocument(document.id, { analyzing: false, aiError: message });
      }
    }
    if (results.size) generateSupplierProfile([...results.values()]);
    if (failures.length)
      setError(
        `AI could not analyze ${failures.join(', ')}. Successful files were merged; review the remaining file errors.`,
      );
    setPackageAnalyzing(false);
  };

  const loadDemoSupplierPackage = async () => {
    setPackageAnalyzing(true);
    setError('');
    try {
      const demoFiles = [
        ['11_Canyon_Ridge_Demo_W9.pdf', 'w9'],
        [
          '12_Canyon_Ridge_Demo_Insurance_Certificate.pdf',
          'insurance_certificate',
        ],
        ['13_Canyon_Ridge_Demo_Business_License.pdf', 'business_license'],
      ] as const;
      const loaded = await Promise.all(
        demoFiles.map(async ([fileName, documentType]) => {
          const response = await fetch(`/demo-documents/${fileName}`);
          if (!response.ok) throw new Error(`Unable to load ${fileName}.`);
          const blob = await response.blob();
          return {
            ...newSupplierDocument(),
            documentType,
            file: new File([blob], fileName, { type: 'application/pdf' }),
          };
        }),
      );
      setDocuments(loaded);
      setSupplier(initialSupplier);
      setProfileGenerated(false);
      setProfileEvidence({});
      setProfileWarnings([]);
    } catch (demoError) {
      setError(
        demoError instanceof Error
          ? demoError.message
          : 'Unable to load the demo qualification package.',
      );
    } finally {
      setPackageAnalyzing(false);
    }
  };

  const submit = async () => {
    if (!profileGenerated || documents.some((item) => !item.aiResult)) {
      setError(
        'Analyze the complete qualification package before creating the supplier register record.',
      );
      return;
    }
    const requiredFields = [
      supplier.legalName,
      supplier.category,
      supplier.addressLine1,
      supplier.city,
      supplier.state,
      supplier.postalCode,
      supplier.country,
    ];
    if (requiredFields.some((value) => !value.trim())) {
      setError(
        'AI could not confirm every required register field. Review or complete the legal name, category, business address, city, state, postal code, and country.',
      );
      return;
    }
    if (documents.some((item) => !item.file)) {
      setError('Choose a file for every qualification record.');
      return;
    }
    const missingOverrides = documents.filter(
      (item) =>
        sourceOverrideFields(item).length > 0 &&
        item.overrideReason.trim().length < 12,
    );
    if (missingOverrides.length) {
      setError(
        'Add a reviewer override reason of at least 12 characters for every document with unsupported critical fields.',
      );
      return;
    }
    if (
      documents.some(
        (item) =>
          item.documentType === 'insurance_certificate' && !item.expirationDate,
      )
    ) {
      setError('Enter an expiration date for every insurance certificate.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const form = new FormData();
      form.append('supplier', JSON.stringify(supplier));
      form.append(
        'documents',
        JSON.stringify(
          documents.map((item, index) => ({
            fileField: `document-${index}`,
            analysisRunId: item.aiResult?.analysisRunId ?? '',
            documentType: item.documentType,
            issuer: item.issuer,
            documentNumber: item.documentNumber,
            effectiveDate: item.effectiveDate,
            expirationDate: item.expirationDate,
            coverageSummary: item.coverageSummary,
            overrideReason: item.overrideReason,
          })),
        ),
      );
      documents.forEach((item, index) => {
        if (item.file) form.append(`document-${index}`, item.file);
      });
      const response = await fetch('/api/suppliers', {
        method: 'POST',
        body: form,
      });
      const body = (await response.json()) as {
        workspace?: Workspace;
        error?: string;
      };
      if (!response.ok || !body.workspace)
        throw new Error(body.error || 'Unable to create the supplier record.');
      onCreated(body.workspace, supplier.legalName);
      onOpenChange(false);
      reset();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Unable to create the supplier record.',
      );
    } finally {
      setSaving(false);
    }
  };

  const profileLocked = !profileGenerated || packageAnalyzing || saving;
  const extractedProfileCount = Object.keys(profileEvidence).length;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!saving) {
          onOpenChange(nextOpen);
          if (!nextOpen) reset();
        }
      }}
    >
      <DialogContent
        ref={dialogRef}
        style={draggable.surfaceStyle}
        onPointerDown={draggable.onPointerDown}
        onPointerMove={draggable.onPointerMove}
        onPointerUp={draggable.onPointerUp}
        onPointerCancel={draggable.onPointerCancel}
        className="h-[84vh] min-h-[620px] w-[96vw] max-w-none grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-[1440px]"
      >
        <DialogHeader
          data-dialog-drag-handle
          title="Drag to move dialog"
          className="cursor-move touch-none select-none border-b border-[#e1e7ea] px-6 py-4"
        >
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#347d96]">
            <Building2 className="size-3.5" />
            Independent supplier onboarding
          </div>
          <DialogTitle className="text-xl text-[#183040]">
            Create supplier from documentation
          </DialogTitle>
          <DialogDescription className="max-w-3xl text-xs leading-5">
            Upload the supplier&apos;s W-9, business license, insurance
            certificate, or other supplier evidence. AI consolidates the files
            into a proposed supplier master for human verification before the
            database changes.
          </DialogDescription>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {[
              ['01', 'Upload files', 'Supplier evidence first'],
              ['02', 'AI builds profile', 'Merge supported supplier fields'],
              ['03', 'Verify & create', 'Human-confirmed register update'],
            ].map(([number, title, description]) => (
              <div
                key={number}
                className="rounded-lg border border-[#d9e6eb] bg-[#f8fbfc] px-3 py-2"
              >
                <span className="text-[9px] font-semibold text-[#43849a]">
                  STEP {number}
                </span>
                <span className="ml-2 text-[10px] font-semibold text-[#203845]">
                  {title}
                </span>
                <span className="ml-2 text-[9px] text-slate-500">
                  {description}
                </span>
              </div>
            ))}
          </div>
        </DialogHeader>

        <div className="grid min-h-0 overflow-hidden xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <section className="order-2 min-h-0 overflow-y-auto border-t border-[#e1e7ea] px-6 py-5 xl:border-l xl:border-t-0">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-[#203845]">
                  AI-generated supplier master
                </h3>
                <p className="mt-1 text-[11px] text-slate-500">
                  {profileGenerated
                    ? `${extractedProfileCount} fields were supported by uploaded files. Review or correct the proposed record.`
                    : 'The register preview remains locked until the supplier documentation package is analyzed.'}
                </p>
              </div>
              <StatusBadge tone={profileGenerated ? 'green' : 'amber'}>
                {profileGenerated
                  ? 'Ready for verification'
                  : 'Waiting for files'}
              </StatusBadge>
            </div>
            {profileGenerated ? (
              <div className="mt-3 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2.5 text-[10px] leading-4 text-sky-900">
                AI values remain editable because uploaded files may be
                incomplete or inconsistent. Vendor number, relationship status,
                documentation status, and the initial medium risk tier are
                applied by system rules—not invented from the documents.
              </div>
            ) : (
              <>
                <input
                  ref={packageUploadInputRef}
                  type="file"
                  multiple
                  accept="application/pdf,image/png,image/jpeg"
                  className="sr-only"
                  aria-label="Upload supplier qualification package"
                  onChange={(event) => {
                    selectQualificationPackage(event.target.files);
                    event.target.value = '';
                  }}
                />
                <button
                  type="button"
                  onClick={() => packageUploadInputRef.current?.click()}
                  disabled={packageAnalyzing || saving}
                  className="mt-3 flex min-h-28 w-full flex-col items-center justify-center rounded-xl border border-dashed border-[#8dbdcd] bg-[#f4fafc] px-5 text-center transition-colors hover:border-[#347d96] hover:bg-[#eaf6f9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#347d96] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Upload className="size-6 text-[#347d96]" />
                  <span className="mt-2 text-xs font-semibold text-[#245a70]">
                    Upload qualification files
                  </span>
                  <span className="mt-1 max-w-sm text-[10px] leading-4 text-slate-500">
                    Click to choose one or more PDF, PNG, or JPEG files. They
                    will appear in the qualification package on the left.
                  </span>
                </button>
              </>
            )}
            {profileWarnings.length ? (
              <Alert className="mt-3 border-amber-200 bg-amber-50 text-amber-900">
                <AlertTriangle />
                <AlertTitle>
                  Cross-document differences require review
                </AlertTitle>
                <AlertDescription>{profileWarnings.join(' ')}</AlertDescription>
              </Alert>
            ) : null}
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <Input
                value={supplier.legalName}
                disabled={profileLocked}
                onChange={(event) =>
                  updateSupplier('legalName', event.target.value)
                }
                placeholder="Legal name *"
                aria-label="Supplier legal name"
              />
              <Input
                value={supplier.dbaName}
                disabled={profileLocked}
                onChange={(event) =>
                  updateSupplier('dbaName', event.target.value)
                }
                placeholder="DBA name"
                aria-label="Supplier DBA name"
              />
              <Input
                value={supplier.category}
                disabled={profileLocked}
                onChange={(event) =>
                  updateSupplier('category', event.target.value)
                }
                placeholder="Category *"
                aria-label="Supplier category"
              />
              <select
                value={supplier.riskTier}
                disabled={profileLocked}
                onChange={(event) =>
                  updateSupplier('riskTier', event.target.value)
                }
                aria-label="Supplier risk tier"
                className="h-9 rounded-md border border-input bg-white px-3 text-xs"
              >
                <option value="low">Low risk</option>
                <option value="medium">Medium risk</option>
                <option value="high">High risk</option>
              </select>
              <Input
                value={supplier.primaryContact}
                disabled={profileLocked}
                onChange={(event) =>
                  updateSupplier('primaryContact', event.target.value)
                }
                placeholder="Primary contact"
                aria-label="Primary contact"
              />
              <Input
                type="email"
                value={supplier.email}
                disabled={profileLocked}
                onChange={(event) =>
                  updateSupplier('email', event.target.value)
                }
                placeholder="Email"
                aria-label="Supplier email"
              />
              <Input
                value={supplier.phone}
                disabled={profileLocked}
                onChange={(event) =>
                  updateSupplier('phone', event.target.value)
                }
                placeholder="Phone"
                aria-label="Supplier phone"
              />
              <Input
                type="url"
                value={supplier.website}
                disabled={profileLocked}
                onChange={(event) =>
                  updateSupplier('website', event.target.value)
                }
                placeholder="Website (https://…)"
                aria-label="Supplier website"
              />
              <Input
                value={supplier.addressLine1}
                disabled={profileLocked}
                onChange={(event) =>
                  updateSupplier('addressLine1', event.target.value)
                }
                placeholder="Business address *"
                aria-label="Supplier business address"
                className="md:col-span-2"
              />
              <Input
                value={supplier.addressLine2}
                disabled={profileLocked}
                onChange={(event) =>
                  updateSupplier('addressLine2', event.target.value)
                }
                placeholder="Suite / unit"
                aria-label="Supplier address line 2"
              />
              <Input
                value={supplier.city}
                disabled={profileLocked}
                onChange={(event) => updateSupplier('city', event.target.value)}
                placeholder="City *"
                aria-label="Supplier city"
              />
              <Input
                value={supplier.state}
                disabled={profileLocked}
                onChange={(event) =>
                  updateSupplier('state', event.target.value)
                }
                placeholder="State / province *"
                aria-label="Supplier state or province"
              />
              <Input
                value={supplier.postalCode}
                disabled={profileLocked}
                onChange={(event) =>
                  updateSupplier('postalCode', event.target.value)
                }
                placeholder="Postal code *"
                aria-label="Supplier postal code"
              />
              <Input
                value={supplier.country}
                disabled={profileLocked}
                onChange={(event) =>
                  updateSupplier('country', event.target.value)
                }
                placeholder="Country *"
                aria-label="Supplier country"
              />
              <Input
                value={supplier.taxClassification}
                disabled={profileLocked}
                onChange={(event) =>
                  updateSupplier('taxClassification', event.target.value)
                }
                placeholder="Federal tax classification"
                aria-label="Supplier tax classification"
              />
            </div>
            {profileGenerated && Object.keys(profileEvidence).length ? (
              <details className="mt-4 rounded-lg border border-[#dce3e8] bg-[#f8fafb]">
                <summary className="cursor-pointer px-3 py-2 text-[10px] font-semibold text-[#2c667b]">
                  View AI field sources ({Object.keys(profileEvidence).length})
                </summary>
                <div className="grid gap-2 border-t border-[#e3e9ed] p-3 sm:grid-cols-2">
                  {Object.entries(profileEvidence).map(([field, evidence]) => (
                    <div
                      key={field}
                      className="rounded-md bg-white px-2.5 py-2 text-[9px] text-slate-600"
                    >
                      <span className="font-semibold text-[#294354]">
                        {titleCase(field)}
                      </span>
                      <span className="mt-0.5 block">
                        {evidence.fileName} ·{' '}
                        {Math.round(evidence.confidence * 100)}%
                        {evidence.sourcePage
                          ? ` · page ${evidence.sourcePage}`
                          : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </details>
            ) : null}
          </section>

          <section className="order-1 min-h-0 overflow-y-auto px-6 py-5">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
              <div>
                <h3 className="text-sm font-semibold text-[#203845]">
                  Start here: qualification package
                </h3>
                <p className="mt-1 text-[11px] text-slate-500">
                  Upload one or more PDF, PNG, or JPEG files. AI will read and
                  consolidate them into the supplier master shown on the right.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void loadDemoSupplierPackage()}
                  disabled={packageAnalyzing || saving}
                >
                  <FileText />
                  Load demo package
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setDocuments((current) => [
                      ...current,
                      newSupplierDocument(),
                    ]);
                    setProfileGenerated(false);
                    setProfileEvidence({});
                  }}
                  disabled={
                    documents.length >= 10 || packageAnalyzing || saving
                  }
                >
                  <Plus />
                  Add another file
                </Button>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {documents.map((document, index) => (
                <div
                  key={document.id}
                  className="rounded-xl border border-[#d8e2e7] bg-[#f8fafb] p-4"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-xs font-semibold text-[#294354]">
                      Qualification file {index + 1}
                    </p>
                    {documents.length > 1 ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Remove qualification file ${index + 1}`}
                        onClick={() => {
                          setDocuments((current) =>
                            current.filter((item) => item.id !== document.id),
                          );
                          setProfileGenerated(false);
                          setProfileEvidence({});
                        }}
                      >
                        <Trash2 />
                      </Button>
                    ) : null}
                  </div>
                  <div className="grid gap-3 md:grid-cols-[220px_minmax(0,1fr)_auto]">
                    <select
                      value={document.documentType}
                      onChange={(event) => {
                        updateDocument(document.id, {
                          documentType: event.target
                            .value as SupplierDocumentType,
                          aiResult: null,
                        });
                        setProfileGenerated(false);
                        setProfileEvidence({});
                      }}
                      disabled={
                        document.analyzing || packageAnalyzing || saving
                      }
                      aria-label={`Qualification file ${index + 1} type`}
                      className="h-9 rounded-md border border-input bg-white px-3 text-xs"
                    >
                      {SUPPLIER_DOCUMENT_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {SUPPLIER_DOCUMENT_LABELS[type]}
                        </option>
                      ))}
                    </select>
                    <Input
                      key={document.id}
                      type="file"
                      accept="application/pdf,image/png,image/jpeg"
                      onChange={(event) => {
                        updateDocument(document.id, {
                          file: event.target.files?.[0] ?? null,
                          aiResult: null,
                          aiError: '',
                          overrideReason: '',
                        });
                        setSupplier(initialSupplier);
                        setProfileGenerated(false);
                        setProfileEvidence({});
                        setProfileWarnings([]);
                      }}
                      disabled={
                        document.analyzing || packageAnalyzing || saving
                      }
                      aria-label={`Qualification file ${index + 1}`}
                      className="bg-white text-xs file:mr-2 file:border-0 file:bg-transparent"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => analyzeDocument(document)}
                      disabled={
                        !document.file ||
                        document.analyzing ||
                        packageAnalyzing ||
                        saving ||
                        Boolean(document.aiResult)
                      }
                      className="bg-white"
                    >
                      {document.analyzing ? (
                        <LoaderCircle className="animate-spin" />
                      ) : document.aiResult ? (
                        <Check />
                      ) : (
                        <Sparkles />
                      )}
                      {document.aiResult ? 'AI analyzed' : 'Analyze this file'}
                    </Button>
                  </div>
                  {document.aiResult ? (
                    <div className="mt-3 grid gap-3 rounded-lg border border-sky-100 bg-white p-3 md:grid-cols-2 xl:grid-cols-4">
                      <Input
                        value={document.issuer}
                        onChange={(event) =>
                          updateDocument(document.id, {
                            issuer: event.target.value,
                          })
                        }
                        placeholder="Issuer / source"
                        aria-label={`Qualification file ${index + 1} issuer`}
                        className="bg-white text-xs"
                      />
                      <Input
                        value={document.documentNumber}
                        onChange={(event) =>
                          updateDocument(document.id, {
                            documentNumber: event.target.value,
                          })
                        }
                        placeholder="Document number"
                        aria-label={`Qualification file ${index + 1} number`}
                        className="bg-white text-xs"
                      />
                      <Input
                        type="date"
                        value={document.effectiveDate}
                        onChange={(event) =>
                          updateDocument(document.id, {
                            effectiveDate: event.target.value,
                          })
                        }
                        aria-label={`Qualification file ${index + 1} effective date`}
                        className="bg-white text-xs"
                      />
                      <Input
                        type="date"
                        value={document.expirationDate}
                        onChange={(event) =>
                          updateDocument(document.id, {
                            expirationDate: event.target.value,
                          })
                        }
                        aria-label={`Qualification file ${index + 1} expiration date`}
                        className="bg-white text-xs"
                      />
                      <Input
                        value={document.coverageSummary}
                        onChange={(event) =>
                          updateDocument(document.id, {
                            coverageSummary: event.target.value,
                          })
                        }
                        placeholder="Coverage / qualification summary"
                        aria-label={`Qualification file ${index + 1} coverage or qualification summary`}
                        className="bg-white text-xs md:col-span-2 xl:col-span-4"
                      />
                      {sourceOverrideFields(document).length ? (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 md:col-span-2 xl:col-span-4">
                          <label
                            htmlFor={`supplier-onboarding-override-${document.id}`}
                            className="text-[10px] font-semibold text-amber-900"
                          >
                            Required source override reason
                          </label>
                          <p className="mt-1 text-[9px] text-amber-700">
                            Missing page-and-quote support:{' '}
                            {sourceOverrideFields(document)
                              .map((fieldName) => titleCase(fieldName))
                              .join(', ')}
                          </p>
                          <Input
                            id={`supplier-onboarding-override-${document.id}`}
                            value={document.overrideReason}
                            onChange={(event) =>
                              updateDocument(document.id, {
                                overrideReason: event.target.value,
                              })
                            }
                            placeholder="Explain independent verification"
                            className="mt-2 h-8 bg-white text-[10px]"
                          />
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <p className="mt-2 text-[10px] text-slate-500">
                      The document metadata and supplier master fields will
                      appear after AI analysis.
                    </p>
                  )}
                  {document.documentType === 'insurance_certificate' ? (
                    <p className="mt-2 text-[10px] text-amber-700">
                      Insurance expiration date is required.
                    </p>
                  ) : null}
                  {document.aiResult ? (
                    <SupplierDocumentAIReview
                      result={document.aiResult}
                      supplierName={
                        supplier.legalName ||
                        valueText(
                          document.aiResult.analysis.supplierLegalName.value,
                        )
                      }
                    />
                  ) : null}
                  {document.aiError ? (
                    <p className="mt-2 text-[10px] text-rose-700">
                      {document.aiError}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
            {error ? (
              <Alert variant="destructive" className="mt-4">
                <AlertCircle />
                <AlertTitle>Supplier record needs attention</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
          </section>
        </div>

        <DialogFooter className="mx-0 mb-0 px-6 py-4">
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              reset();
            }}
            disabled={saving || packageAnalyzing}
          >
            Cancel
          </Button>
          {profileGenerated && documents.every((item) => item.aiResult) ? (
            <Button
              onClick={submit}
              disabled={saving || packageAnalyzing}
              className="bg-[#1d718f] hover:bg-[#185f78]"
            >
              {saving ? (
                <LoaderCircle className="animate-spin" />
              ) : (
                <Database />
              )}
              Create supplier from verified AI data
            </Button>
          ) : (
            <Button
              onClick={() => void analyzePackage()}
              disabled={
                saving ||
                packageAnalyzing ||
                documents.some((item) => !item.file)
              }
              className="bg-[#1d718f] hover:bg-[#185f78]"
            >
              {packageAnalyzing ? (
                <LoaderCircle className="animate-spin" />
              ) : (
                <Sparkles />
              )}
              Generate supplier register from files
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
