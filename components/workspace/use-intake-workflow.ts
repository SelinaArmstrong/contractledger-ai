'use client';

import { needsSourceOverride } from '@/lib/ai-governance';
import type {
  AnalysisResponse,
  ContractAnalysis,
  ExtractedField,
  Workspace,
} from '@/lib/contract-ledger-types';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { extractionFields } from '@/components/workspace/constants';
import type { ExtractionFieldKey } from '@/components/workspace/constants';
import type {
  FieldReviewStatus,
  IntakeStage,
} from '@/components/workspace/types';

export type IntakeAnalysisStatus =
  | 'idle'
  | 'analyzing'
  | 'ready'
  | 'saving'
  | 'saved'
  | 'error';

export type IntakeSaveResult = {
  stage: IntakeStage;
  workspace: Workspace;
  registeredContract: { id: string; contractNumber: string } | null;
};

const demoDocuments: Record<IntakeStage, string> = {
  draft: '01_Draft_Professional_Services_Agreement.pdf',
  executed: '02_Executed_Professional_Services_Agreement.pdf',
};

/**
 * Upload → AI extraction → human verification, shared by the executed-contract
 * dialog and the inline draft review workspace so both flows stay identical.
 */
export function useIntakeWorkflow({
  initialStage,
  onSaved,
}: {
  initialStage: IntakeStage;
  /** Return true when the caller navigated away instead of showing the receipt. */
  onSaved: (result: IntakeSaveResult) => boolean | void;
}) {
  const [stage, setStage] = useState<IntakeStage>(initialStage);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const previewUrlRef = useRef('');
  const [analysisResult, setAnalysisResult] = useState<AnalysisResponse | null>(
    null,
  );
  const [originalAnalysis, setOriginalAnalysis] =
    useState<ContractAnalysis | null>(null);
  const [fieldReviews, setFieldReviews] = useState<
    Partial<Record<ExtractionFieldKey, FieldReviewStatus>>
  >({});
  const [fieldOverrideReasons, setFieldOverrideReasons] = useState<
    Partial<Record<ExtractionFieldKey, string>>
  >({});
  const [analysisStatus, setAnalysisStatus] =
    useState<IntakeAnalysisStatus>('idle');
  const [analysisError, setAnalysisError] = useState('');
  const onSavedRef = useRef(onSaved);
  useEffect(() => {
    onSavedRef.current = onSaved;
  }, [onSaved]);

  const clearAnalysis = useCallback(() => {
    setAnalysisResult(null);
    setOriginalAnalysis(null);
    setFieldReviews({});
    setFieldOverrideReasons({});
    setAnalysisStatus('idle');
    setAnalysisError('');
  }, []);

  const selectFile = useCallback(
    (file: File | null) => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      const nextPreviewUrl =
        file?.type === 'application/pdf' ? URL.createObjectURL(file) : '';
      previewUrlRef.current = nextPreviewUrl;
      setPreviewUrl(nextPreviewUrl);
      setSelectedFile(file);
      clearAnalysis();
    },
    [clearAnalysis],
  );

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  /** Reset the whole flow, optionally switching which lifecycle stage it serves. */
  const begin = useCallback(
    (nextStage: IntakeStage = stage) => {
      setStage(nextStage);
      selectFile(null);
    },
    [selectFile, stage],
  );

  const loadDemoDocument = useCallback(async () => {
    const fileName = demoDocuments[stage];
    try {
      const response = await fetch(`/demo-documents/${fileName}`);
      if (!response.ok) throw new Error('The demo document is unavailable.');
      const blob = await response.blob();
      selectFile(new File([blob], fileName, { type: 'application/pdf' }));
    } catch (error) {
      setAnalysisError(
        error instanceof Error
          ? error.message
          : 'The demo document is unavailable.',
      );
      setAnalysisStatus('error');
    }
  }, [selectFile, stage]);

  const analyze = useCallback(async () => {
    if (!selectedFile) {
      setAnalysisError('Choose a text-based PDF or TXT contract first.');
      setAnalysisStatus('error');
      return;
    }
    setAnalysisStatus('analyzing');
    setAnalysisError('');
    try {
      const form = new FormData();
      form.append('file', selectedFile);
      form.append('stage', stage);
      const response = await fetch('/api/analyze', {
        method: 'POST',
        body: form,
      });
      const body = (await response.json()) as AnalysisResponse & {
        error?: string;
      };
      if (!response.ok)
        throw new Error(body.error || 'The document could not be analyzed.');
      setAnalysisResult(body);
      setOriginalAnalysis(structuredClone(body.analysis));
      setFieldReviews(
        Object.fromEntries(
          extractionFields.map(([key]) => [key, 'pending']),
        ) as Record<ExtractionFieldKey, FieldReviewStatus>,
      );
      setFieldOverrideReasons({});
      setAnalysisStatus('ready');
    } catch (error) {
      setAnalysisError(
        error instanceof Error
          ? error.message
          : 'The document could not be analyzed.',
      );
      setAnalysisStatus('error');
    }
  }, [selectedFile, stage]);

  const updateField = useCallback(
    (fieldName: ExtractionFieldKey, value: string | number | null) => {
      setAnalysisResult((current) => {
        if (!current) return current;
        const field = current.analysis[fieldName] as ExtractedField;
        return {
          ...current,
          analysis: { ...current.analysis, [fieldName]: { ...field, value } },
        };
      });
      setFieldReviews((current) => ({ ...current, [fieldName]: 'corrected' }));
    },
    [],
  );

  const confirmField = useCallback(
    (fieldName: ExtractionFieldKey) => {
      if (!analysisResult || !originalAnalysis) return;
      const originalValue = (originalAnalysis[fieldName] as ExtractedField)
        .value;
      const verifiedValue = (
        analysisResult.analysis[fieldName] as ExtractedField
      ).value;
      setFieldReviews((current) => ({
        ...current,
        [fieldName]:
          JSON.stringify(originalValue) === JSON.stringify(verifiedValue)
            ? 'accepted'
            : 'corrected',
      }));
    },
    [analysisResult, originalAnalysis],
  );

  const confirmAllUnchangedFields = useCallback(() => {
    if (!analysisResult || !originalAnalysis) return;
    setFieldReviews((current) => ({
      ...current,
      ...Object.fromEntries(
        extractionFields.map(([fieldName]) => {
          if (current[fieldName] === 'corrected')
            return [fieldName, 'corrected'];
          const originalValue = (originalAnalysis[fieldName] as ExtractedField)
            .value;
          const verifiedValue = (
            analysisResult.analysis[fieldName] as ExtractedField
          ).value;
          return [
            fieldName,
            JSON.stringify(originalValue) === JSON.stringify(verifiedValue)
              ? 'accepted'
              : 'corrected',
          ];
        }),
      ),
    }));
  }, [analysisResult, originalAnalysis]);

  const setOverrideReason = useCallback(
    (fieldName: ExtractionFieldKey, reason: string) => {
      setFieldOverrideReasons((current) => ({
        ...current,
        [fieldName]: reason,
      }));
    },
    [],
  );

  const pendingReviewCount = useMemo(
    () =>
      extractionFields.filter(
        ([fieldName]) =>
          !fieldReviews[fieldName] || fieldReviews[fieldName] === 'pending',
      ).length,
    [fieldReviews],
  );

  const missingOverrideCount = useMemo(() => {
    if (!analysisResult) return 0;
    return extractionFields.filter(([fieldName]) => {
      const originalField = (originalAnalysis?.[fieldName] ??
        analysisResult.analysis[fieldName]) as ExtractedField;
      const verifiedField = analysisResult.analysis[
        fieldName
      ] as ExtractedField;
      return (
        needsSourceOverride(fieldName, {
          ...originalField,
          value: verifiedField.value,
        }) && (fieldOverrideReasons[fieldName]?.trim().length ?? 0) < 12
      );
    }).length;
  }, [analysisResult, fieldOverrideReasons, originalAnalysis]);

  const save = useCallback(async () => {
    if (!analysisResult) return;
    if (pendingReviewCount || missingOverrideCount) {
      setAnalysisError(
        pendingReviewCount
          ? `Confirm the remaining ${pendingReviewCount} extracted field${pendingReviewCount === 1 ? '' : 's'} before saving.`
          : `Add a specific reviewer override reason for the remaining ${missingOverrideCount} critical field${missingOverrideCount === 1 ? '' : 's'} without source evidence.`,
      );
      setAnalysisStatus('error');
      return;
    }
    setAnalysisStatus('saving');
    setAnalysisError('');
    try {
      const response = await fetch('/api/workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysisRunId: analysisResult.analysisRunId,
          stage,
          analysis: analysisResult.analysis,
          document: analysisResult.document,
          review: {
            fields: extractionFields.map(([fieldName]) => ({
              fieldName,
              status: fieldReviews[fieldName],
              overrideReason: fieldOverrideReasons[fieldName],
            })),
          },
        }),
      });
      const body = (await response.json()) as {
        saved?: boolean;
        workspace?: Workspace;
        registeredContract?: { id: string; contractNumber: string } | null;
        error?: string;
      };
      if (!response.ok || !body.workspace)
        throw new Error(
          body.error || 'The verified record could not be saved.',
        );
      const handled = onSavedRef.current({
        stage,
        workspace: body.workspace,
        registeredContract: body.registeredContract ?? null,
      });
      if (handled) {
        selectFile(null);
        return;
      }
      setAnalysisStatus('saved');
    } catch (error) {
      setAnalysisError(
        error instanceof Error
          ? error.message
          : 'The verified record could not be saved.',
      );
      setAnalysisStatus('error');
    }
  }, [
    analysisResult,
    fieldOverrideReasons,
    fieldReviews,
    missingOverrideCount,
    pendingReviewCount,
    selectFile,
    stage,
  ]);

  return {
    stage,
    selectedFile,
    previewUrl,
    analysisResult,
    originalAnalysis,
    fieldReviews,
    fieldOverrideReasons,
    analysisStatus,
    analysisError,
    pendingReviewCount,
    missingOverrideCount,
    begin,
    selectFile,
    clearAnalysis,
    loadDemoDocument,
    analyze,
    updateField,
    confirmField,
    confirmAllUnchangedFields,
    setOverrideReason,
    save,
  };
}

export type IntakeWorkflow = ReturnType<typeof useIntakeWorkflow>;
