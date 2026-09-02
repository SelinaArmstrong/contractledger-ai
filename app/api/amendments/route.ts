import { env } from 'cloudflare:workers';
import { z } from 'zod';

import { getWorkspace } from '@/app/api/workspace/route';
import {
  calculateResultingContractValue,
  formatAmendmentNumber,
  subtractCalendarDays,
} from '@/lib/amendment-lifecycle';
import { isIsoDate } from '@/lib/validation';
import { validatedOverrideReason } from '@/lib/ai-governance';
import { withApiRoute } from '@/lib/server/route-handler';

const fieldSchema = z.object({
  value: z.union([z.string(), z.number(), z.null()]),
  confidence: z.number().min(0).max(1),
  sourcePage: z.number().int().positive().nullable(),
  sourceQuote: z.string().max(500).nullable(),
});

const amendmentFieldNames = [
  'amendmentTitle',
  'amendmentNumber',
  'amendmentType',
  'referencedContractNumber',
  'signedDate',
  'effectiveDate',
  'valueChange',
  'resultingContractValue',
  'newExpirationDate',
  'paymentTerms',
  'renewalType',
  'noticeDays',
  'scopeSummary',
] as const;

const analysisSchema = z.object({
  amendmentTitle: fieldSchema,
  amendmentNumber: fieldSchema,
  amendmentType: fieldSchema,
  referencedContractNumber: fieldSchema,
  signedDate: fieldSchema,
  effectiveDate: fieldSchema,
  valueChange: fieldSchema,
  resultingContractValue: fieldSchema,
  newExpirationDate: fieldSchema,
  paymentTerms: fieldSchema,
  renewalType: fieldSchema,
  noticeDays: fieldSchema,
  scopeSummary: fieldSchema,
  keyDates: z.array(
    z.object({
      type: z.string().min(1).max(100),
      title: z.string().min(1).max(200),
      dueDate: z.string().refine(isIsoDate).nullable(),
      sourcePage: z.number().int().positive().nullable(),
      sourceQuote: z.string().max(500).nullable(),
    }),
  ),
  warnings: z.array(z.string().max(500)).max(50),
});

const saveSchema = z.object({
  contractId: z.string().min(1).max(200),
  analysisRunId: z.string().min(1).max(200),
  document: z.object({
    fileName: z.string().min(1).max(255),
    totalPages: z.number().int().positive().max(40),
    storageKey: z.string().min(1).max(500),
    mimeType: z.string().min(1).max(120),
  }),
  analysis: analysisSchema,
  review: z.object({
    confirmed: z.literal(true),
    overrideReasons: z.record(z.string(), z.string().max(500)).optional(),
  }),
});

const amendmentTypes = new Set([
  'amendment',
  'change_order',
  'extension',
  'renewal',
  'termination',
  'price_adjustment',
  'sow_replacement',
]);

function stringValue(field: z.infer<typeof fieldSchema>) {
  return typeof field.value === 'string' ? field.value.trim() : '';
}

function numberValue(field: z.infer<typeof fieldSchema>) {
  if (typeof field.value === 'number') return field.value;
  if (typeof field.value === 'string' && field.value.trim()) {
    const parsed = Number(field.value.replace(/[^0-9.-]/g, ''));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export const POST = withApiRoute(
  {
    permission: 'apply_amendments',
    invalidPayloadError: 'Review the amendment fields before saving.',
    fallbackError: 'Unable to apply the amendment.',
  },
  async ({ request, actor }) => {
    const input = saveSchema.parse(await request.json());
    const db = env.DB;
    const now = new Date().toISOString();
    const contract = await db
      .prepare(`SELECT c.*, s.legal_name AS supplier_name
        FROM contracts c JOIN suppliers s ON s.id = c.supplier_id
        WHERE c.id = ? LIMIT 1`)
      .bind(input.contractId)
      .first<Record<string, string | number | null>>();
    if (!contract) throw new Error('The base contract was not found.');

    const analysisRun = await db
      .prepare(`SELECT id, stage, contract_id, supplier_id, file_name,
        storage_key, model, prompt_version, original_result_json, status
        FROM ai_analysis_runs WHERE id = ? LIMIT 1`)
      .bind(input.analysisRunId)
      .first<Record<string, string | number | null>>();
    if (!analysisRun) throw new Error('The AI analysis record was not found.');
    if (
      analysisRun.stage !== 'amendment' ||
      analysisRun.contract_id !== input.contractId ||
      analysisRun.file_name !== input.document.fileName ||
      analysisRun.storage_key !== input.document.storageKey
    ) {
      throw new Error('The amendment does not match its analyzed source.');
    }
    if (analysisRun.status !== 'pending_review')
      throw new Error('This amendment analysis has already been applied.');

    for (const fieldName of [
      'signedDate',
      'effectiveDate',
      'newExpirationDate',
    ] as const) {
      const value = stringValue(input.analysis[fieldName]);
      if (value && !isIsoDate(value))
        throw new Error(`${fieldName} must use a valid YYYY-MM-DD date.`);
    }
    const typeValue = stringValue(input.analysis.amendmentType)
      .toLowerCase()
      .replaceAll(' ', '_');
    const amendmentType = amendmentTypes.has(typeValue)
      ? typeValue
      : 'amendment';
    const currentValueCents = Number(contract.current_value_cents ?? 0);
    const statedResult = numberValue(input.analysis.resultingContractValue);
    const statedDelta = numberValue(input.analysis.valueChange);
    const { resultingValueCents, valueChangeCents } =
      calculateResultingContractValue(
        currentValueCents,
        statedDelta,
        statedResult,
      );
    if (resultingValueCents < 0 || resultingValueCents > 100_000_000_000)
      throw new Error(
        'The resulting contract value is outside the supported range.',
      );
    const previousExpirationDate = contract.expiration_date
      ? String(contract.expiration_date)
      : null;
    const extractedExpiration = stringValue(input.analysis.newExpirationDate);
    const effectiveDate =
      stringValue(input.analysis.effectiveDate) ||
      stringValue(input.analysis.signedDate) ||
      now.slice(0, 10);
    const newExpirationDate =
      amendmentType === 'termination'
        ? extractedExpiration || effectiveDate
        : extractedExpiration || previousExpirationDate;
    const previousPaymentTerms = contract.payment_terms
      ? String(contract.payment_terms)
      : null;
    const newPaymentTerms =
      stringValue(input.analysis.paymentTerms) || previousPaymentTerms;
    const previousRenewalType = String(contract.renewal_type ?? 'none');
    const extractedRenewalType = stringValue(input.analysis.renewalType);
    const newRenewalType = ['automatic', 'optional', 'none'].includes(
      extractedRenewalType,
    )
      ? extractedRenewalType
      : previousRenewalType;
    const previousNoticeDays =
      contract.notice_days === null ? null : Number(contract.notice_days);
    const extractedNoticeDays = numberValue(input.analysis.noticeDays);
    const newNoticeDays =
      extractedNoticeDays === null
        ? previousNoticeDays
        : Math.round(extractedNoticeDays);
    if (newNoticeDays !== null && (newNoticeDays < 0 || newNoticeDays > 3650))
      throw new Error('Notice period must be between 0 and 3,650 days.');
    const noticeDeadline = subtractCalendarDays(
      newExpirationDate,
      newNoticeDays,
    );
    const originalAnalysis = analysisSchema.parse(
      JSON.parse(String(analysisRun.original_result_json)),
    );
    const overrideReasons = Object.fromEntries(
      amendmentFieldNames.map((fieldName) => [
        fieldName,
        validatedOverrideReason(
          fieldName,
          {
            ...originalAnalysis[fieldName],
            value: input.analysis[fieldName].value,
          },
          input.review.overrideReasons?.[fieldName],
        ),
      ]),
    );
    const correctionCount = amendmentFieldNames.filter(
      (fieldName) =>
        JSON.stringify(originalAnalysis[fieldName].value) !==
        JSON.stringify(input.analysis[fieldName].value),
    ).length;
    const versionRow = await db
      .prepare(`SELECT COALESCE(MAX(version_number), 1) AS version_number
        FROM amendments WHERE contract_id = ?`)
      .bind(input.contractId)
      .first<{ version_number: number }>();
    const versionNumber = Number(versionRow?.version_number ?? 1) + 1;
    const amendmentId = `amd-${crypto.randomUUID()}`;
    const documentId = `doc-${crypto.randomUUID()}`;
    const amendmentNumber = formatAmendmentNumber(
      stringValue(input.analysis.amendmentNumber),
      versionNumber - 1,
    );
    const duplicate = await db
      .prepare(`SELECT id FROM amendments
        WHERE contract_id = ? AND LOWER(amendment_number) = LOWER(?) LIMIT 1`)
      .bind(input.contractId, amendmentNumber)
      .first<{ id: string }>();
    if (duplicate)
      throw new Error(
        `${amendmentNumber} is already recorded for this contract.`,
      );
    const signedDate = stringValue(input.analysis.signedDate) || effectiveDate;
    const parentDocument = await db
      .prepare(`SELECT COALESCE(
        (SELECT document_id FROM amendments
          WHERE contract_id = ? AND version_status = 'current'
          ORDER BY version_number DESC LIMIT 1),
        (SELECT id FROM documents
          WHERE contract_id = ? AND lifecycle_stage = 'executed'
          ORDER BY uploaded_at ASC LIMIT 1)
      ) AS id`)
      .bind(input.contractId, input.contractId)
      .first<{ id: string | null }>();
    const supersededNote = `Superseded by ${amendmentNumber} (version ${versionNumber}).`;
    const contractStatus =
      amendmentType === 'termination'
        ? 'terminated'
        : String(contract.status ?? 'active');
    const openLifecycleObligations = await db
      .prepare(`SELECT id, type, due_date, status FROM key_dates
        WHERE contract_id = ? AND status != 'completed'
          AND type IN ('expiration', 'non_renewal_notice')
        ORDER BY due_date DESC`)
      .bind(input.contractId)
      .all<{ id: string; type: string; due_date: string; status: string }>();
    const expirationObligation = openLifecycleObligations.results.find(
      (item) => item.type === 'expiration',
    );
    const noticeObligation = openLifecycleObligations.results.find(
      (item) => item.type === 'non_renewal_notice',
    );

    const statements = [
      db
        .prepare(`UPDATE amendments SET version_status = 'superseded'
          WHERE contract_id = ? AND version_status = 'current'`)
        .bind(input.contractId),
      db
        .prepare(`INSERT INTO documents
          (id, supplier_id, contract_id, parent_document_id, file_name,
           file_type, lifecycle_stage, storage_key, mime_type, page_count,
           document_number, effective_date, expiration_date, review_status,
           ai_status, uploaded_at)
          VALUES (?, ?, ?, ?, ?, 'amendment', 'amendment', ?, ?, ?, ?, ?, ?,
            'approved', 'verified', ?)`)
        .bind(
          documentId,
          contract.supplier_id,
          input.contractId,
          parentDocument?.id ?? null,
          input.document.fileName,
          input.document.storageKey,
          input.document.mimeType,
          input.document.totalPages,
          amendmentNumber,
          effectiveDate,
          newExpirationDate,
          now,
        ),
      db
        .prepare(`INSERT INTO amendments
          (id, contract_id, document_id, amendment_number, amendment_type,
           version_number, version_status, signed_date, effective_date,
           previous_value_cents, value_change_cents, resulting_value_cents,
           previous_expiration_date, new_expiration_date,
           previous_payment_terms, new_payment_terms,
           previous_renewal_type, new_renewal_type,
           previous_notice_days, new_notice_days, scope_summary,
           created_by, created_at)
          VALUES (?, ?, ?, ?, ?, ?, 'current', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(
          amendmentId,
          input.contractId,
          documentId,
          amendmentNumber,
          amendmentType,
          versionNumber,
          signedDate,
          effectiveDate,
          currentValueCents,
          valueChangeCents,
          resultingValueCents,
          previousExpirationDate,
          newExpirationDate,
          previousPaymentTerms,
          newPaymentTerms,
          previousRenewalType,
          newRenewalType,
          previousNoticeDays,
          newNoticeDays,
          stringValue(input.analysis.scopeSummary) || null,
          actor.name,
          now,
        ),
      db
        .prepare(`UPDATE contracts SET amendment_value_cents =
            amendment_value_cents + ?, current_value_cents = ?,
            expiration_date = ?, renewal_type = ?, notice_days = ?,
            notice_deadline = ?, payment_terms = ?, status = ?, last_updated = ?
          WHERE id = ?`)
        .bind(
          valueChangeCents,
          resultingValueCents,
          newExpirationDate,
          newRenewalType,
          newNoticeDays,
          noticeDeadline,
          newPaymentTerms,
          contractStatus,
          now,
          input.contractId,
        ),
      db
        .prepare(`UPDATE ai_analysis_runs SET document_id = ?,
          verified_result_json = ?, correction_count = ?, status = 'verified',
          reviewed_by = ?, reviewed_at = ? WHERE id = ?`)
        .bind(
          documentId,
          JSON.stringify(input.analysis),
          correctionCount,
          actor.name,
          now,
          input.analysisRunId,
        ),
      ...amendmentFieldNames.map((fieldName) => {
        const originalField = originalAnalysis[fieldName];
        const verifiedField = input.analysis[fieldName];
        return db
          .prepare(`INSERT INTO ai_field_reviews
            (id, analysis_run_id, field_name, original_value_json,
             verified_value_json, confidence, source_page, source_quote,
             override_reason, review_status, reviewed_by, reviewed_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
          .bind(
            `aifield-${crypto.randomUUID()}`,
            input.analysisRunId,
            fieldName,
            JSON.stringify(originalField.value),
            JSON.stringify(verifiedField.value),
            originalField.confidence,
            originalField.sourcePage,
            originalField.sourceQuote,
            overrideReasons[fieldName],
            JSON.stringify(originalField.value) ===
              JSON.stringify(verifiedField.value)
              ? 'accepted'
              : 'corrected',
            actor.name,
            now,
          );
      }),
      db
        .prepare(`INSERT INTO audit_logs
          (id, entity_type, entity_id, action, actor, details, created_at)
          VALUES (?, 'contract', ?, 'amendment_applied', ?, ?, ?)`)
        .bind(
          `audit-${crypto.randomUUID()}`,
          input.contractId,
          actor.name,
          JSON.stringify({
            amendmentId,
            amendmentNumber,
            amendmentType,
            versionNumber,
            source: input.document.fileName,
            analysisRunId: input.analysisRunId,
            model: analysisRun.model,
            correctionCount,
            before: {
              currentValueCents,
              expirationDate: previousExpirationDate,
              paymentTerms: previousPaymentTerms,
              renewalType: previousRenewalType,
              noticeDays: previousNoticeDays,
            },
            after: {
              currentValueCents: resultingValueCents,
              expirationDate: newExpirationDate,
              paymentTerms: newPaymentTerms,
              renewalType: newRenewalType,
              noticeDays: newNoticeDays,
              status: contractStatus,
            },
          }),
          now,
        ),
    ];
    const duplicateLifecycleObligations =
      openLifecycleObligations.results.filter(
        (item) =>
          item.id !== expirationObligation?.id &&
          item.id !== noticeObligation?.id,
      );
    for (const duplicate of duplicateLifecycleObligations) {
      const duplicateNote = `${supersededNote} Consolidated into the current ${duplicate.type.replaceAll('_', ' ')} obligation.`;
      statements.push(
        db
          .prepare(`UPDATE key_dates SET status = 'completed', completed_at = ?,
            completed_by = ?, completion_note = ?, evidence_document_id = ?,
            decision = 'not_applicable', updated_at = ? WHERE id = ?`)
          .bind(now, actor.name, duplicateNote, documentId, now, duplicate.id),
        db
          .prepare(`INSERT INTO obligation_events
            (id, key_date_id, event_type, from_status, to_status, actor,
             note, evidence_document_id, metadata_json, created_at)
            VALUES (?, ?, 'status_changed', ?, 'completed', ?, ?, ?, ?, ?)`)
          .bind(
            `obligation-event-${crypto.randomUUID()}`,
            duplicate.id,
            duplicate.status,
            actor.name,
            duplicateNote,
            documentId,
            JSON.stringify({ amendmentId, duplicateConsolidated: true }),
            now,
          ),
      );
    }

    if (newExpirationDate) {
      if (expirationObligation) {
        statements.push(
          db
            .prepare(`UPDATE key_dates SET title = ?, due_date = ?,
              internal_review_date = ?, source_document_id = ?, source_clause = ?,
              source_page = ?, updated_at = ? WHERE id = ?`)
            .bind(
              `Contract expiration — ${amendmentNumber}`,
              newExpirationDate,
              subtractCalendarDays(newExpirationDate, 30),
              documentId,
              input.analysis.newExpirationDate.sourceQuote,
              input.analysis.newExpirationDate.sourcePage,
              now,
              expirationObligation.id,
            ),
          db
            .prepare(`INSERT INTO obligation_events
              (id, key_date_id, event_type, from_status, to_status, actor,
               note, evidence_document_id, metadata_json, created_at)
              VALUES (?, ?, 'due_date_changed', ?, ?, ?, ?, ?, ?, ?)`)
            .bind(
              `obligation-event-${crypto.randomUUID()}`,
              expirationObligation.id,
              expirationObligation.status,
              expirationObligation.status,
              actor.name,
              `Due date updated by ${amendmentNumber}.`,
              documentId,
              JSON.stringify({
                previousDueDate: expirationObligation.due_date,
                newDueDate: newExpirationDate,
                amendmentId,
              }),
              now,
            ),
        );
      } else {
        statements.push(
          db
            .prepare(`INSERT INTO key_dates
              (id, contract_id, supplier_id, type, title, due_date,
               internal_review_date, status, owner, priority, assigned_at,
               source_document_id, source_clause, source_page, created_at,
               updated_at)
              VALUES (?, ?, ?, 'expiration', ?, ?, ?, 'upcoming', ?, 'high', ?,
                ?, ?, ?, ?, ?)`)
            .bind(
              `date-${crypto.randomUUID()}`,
              input.contractId,
              contract.supplier_id,
              `Contract expiration — ${amendmentNumber}`,
              newExpirationDate,
              subtractCalendarDays(newExpirationDate, 30),
              actor.name,
              now,
              documentId,
              input.analysis.newExpirationDate.sourceQuote,
              input.analysis.newExpirationDate.sourcePage,
              now,
              now,
            ),
        );
      }
    } else if (expirationObligation) {
      statements.push(
        db
          .prepare(`UPDATE key_dates SET status = 'completed', completed_at = ?,
            completed_by = ?, completion_note = ?, evidence_document_id = ?,
            decision = 'not_applicable', updated_at = ? WHERE id = ?`)
          .bind(
            now,
            actor.name,
            supersededNote,
            documentId,
            now,
            expirationObligation.id,
          ),
        db
          .prepare(`INSERT INTO obligation_events
            (id, key_date_id, event_type, from_status, to_status, actor,
             note, evidence_document_id, metadata_json, created_at)
            VALUES (?, ?, 'status_changed', ?, 'completed', ?, ?, ?, ?, ?)`)
          .bind(
            `obligation-event-${crypto.randomUUID()}`,
            expirationObligation.id,
            expirationObligation.status,
            actor.name,
            supersededNote,
            documentId,
            JSON.stringify({ amendmentId }),
            now,
          ),
      );
    }
    if (noticeDeadline) {
      if (noticeObligation) {
        statements.push(
          db
            .prepare(`UPDATE key_dates SET title = ?, due_date = ?,
              internal_review_date = ?, source_document_id = ?, source_clause = ?,
              source_page = ?, updated_at = ? WHERE id = ?`)
            .bind(
              `Non-renewal notice — ${amendmentNumber}`,
              noticeDeadline,
              subtractCalendarDays(noticeDeadline, 30),
              documentId,
              input.analysis.noticeDays.sourceQuote,
              input.analysis.noticeDays.sourcePage,
              now,
              noticeObligation.id,
            ),
          db
            .prepare(`INSERT INTO obligation_events
              (id, key_date_id, event_type, from_status, to_status, actor,
               note, evidence_document_id, metadata_json, created_at)
              VALUES (?, ?, 'due_date_changed', ?, ?, ?, ?, ?, ?, ?)`)
            .bind(
              `obligation-event-${crypto.randomUUID()}`,
              noticeObligation.id,
              noticeObligation.status,
              noticeObligation.status,
              actor.name,
              `Due date updated by ${amendmentNumber}.`,
              documentId,
              JSON.stringify({
                previousDueDate: noticeObligation.due_date,
                newDueDate: noticeDeadline,
                amendmentId,
              }),
              now,
            ),
        );
      } else {
        statements.push(
          db
            .prepare(`INSERT INTO key_dates
              (id, contract_id, supplier_id, type, title, due_date,
               internal_review_date, status, owner, priority, assigned_at,
               decision, source_document_id, source_clause, source_page,
               created_at, updated_at)
              VALUES (?, ?, ?, 'non_renewal_notice', ?, ?, ?, 'upcoming', ?,
                'high', ?, 'under_review', ?, ?, ?, ?, ?)`)
            .bind(
              `date-${crypto.randomUUID()}`,
              input.contractId,
              contract.supplier_id,
              `Non-renewal notice — ${amendmentNumber}`,
              noticeDeadline,
              subtractCalendarDays(noticeDeadline, 30),
              actor.name,
              now,
              documentId,
              input.analysis.noticeDays.sourceQuote,
              input.analysis.noticeDays.sourcePage,
              now,
              now,
            ),
        );
      }
    } else if (noticeObligation) {
      statements.push(
        db
          .prepare(`UPDATE key_dates SET status = 'completed', completed_at = ?,
            completed_by = ?, completion_note = ?, evidence_document_id = ?,
            decision = 'not_applicable', updated_at = ? WHERE id = ?`)
          .bind(
            now,
            actor.name,
            supersededNote,
            documentId,
            now,
            noticeObligation.id,
          ),
        db
          .prepare(`INSERT INTO obligation_events
            (id, key_date_id, event_type, from_status, to_status, actor,
             note, evidence_document_id, metadata_json, created_at)
            VALUES (?, ?, 'status_changed', ?, 'completed', ?, ?, ?, ?, ?)`)
          .bind(
            `obligation-event-${crypto.randomUUID()}`,
            noticeObligation.id,
            noticeObligation.status,
            actor.name,
            supersededNote,
            documentId,
            JSON.stringify({ amendmentId }),
            now,
          ),
      );
    }
    for (const item of input.analysis.keyDates.filter((date) => date.dueDate)) {
      if (item.dueDate === newExpirationDate || item.dueDate === noticeDeadline)
        continue;
      statements.push(
        db
          .prepare(`INSERT INTO key_dates
            (id, contract_id, supplier_id, type, title, due_date, status,
             owner, priority, assigned_at, source_document_id, source_clause,
             source_page, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, 'upcoming', ?, 'medium', ?, ?, ?, ?, ?, ?)`)
          .bind(
            `date-${crypto.randomUUID()}`,
            input.contractId,
            contract.supplier_id,
            item.type,
            item.title,
            item.dueDate,
            actor.name,
            now,
            documentId,
            item.sourceQuote,
            item.sourcePage,
            now,
            now,
          ),
      );
    }

    await db.batch(statements);
    await db.prepare('PRAGMA optimize').run();
    return Response.json({
      saved: true,
      amendment: {
        id: amendmentId,
        amendmentNumber,
        versionNumber,
        valueChangeCents,
        resultingValueCents,
        newExpirationDate,
      },
      workspace: await getWorkspace(),
    });
  },
);
