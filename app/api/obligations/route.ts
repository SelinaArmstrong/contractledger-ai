import { env } from 'cloudflare:workers';
import { z } from 'zod';

import { getWorkspace } from '@/app/api/workspace/route';
import { ensureWorkspaceDatabase } from '@/db/bootstrap';
import {
  OBLIGATION_PRIORITIES,
  OBLIGATION_STATUSES,
  assertCompletionEvidence,
  buildObligationCalendar,
  nextObligationStatus,
  type ObligationCalendarRecord,
  type ObligationStatus,
} from '@/lib/obligation-workflow';
import { buildOutboxEvent } from '@/lib/integration-outbox';
import { assertSupplierFileSignature } from '@/lib/server/file-validation';
import { authorizeApiRequest } from '@/lib/server/request-security';
import {
  ALLOWED_SUPPLIER_DOCUMENT_MIME_TYPES,
  MAX_SUPPLIER_DOCUMENT_BYTES,
  safeSupplierFileName,
} from '@/lib/supplier-qualification';

const obligationSchema = z.object({
  id: z.string().min(1),
  action: z.enum(['update', 'escalate']).default('update'),
  status: z.enum(OBLIGATION_STATUSES),
  owner: z.string().trim().max(100).nullable().optional(),
  backupOwner: z.string().trim().max(100).nullable().optional(),
  priority: z.enum(OBLIGATION_PRIORITIES),
  decision: z
    .enum(['under_review', 'renew', 'do_not_renew', 'not_applicable'])
    .nullable()
    .optional(),
  notes: z.string().trim().max(2_000).nullable().optional(),
  completionNote: z.string().trim().max(2_000).nullable().optional(),
  evidenceDocumentId: z.string().trim().max(120).nullable().optional(),
  evidenceReference: z.string().trim().max(500).nullable().optional(),
  transitionNote: z.string().trim().max(1_000).nullable().optional(),
});

type CurrentObligation = {
  id: string;
  contract_id: string | null;
  supplier_id: string | null;
  title: string;
  due_date: string;
  status: string;
  owner: string | null;
  backup_owner: string | null;
  priority: string;
  assigned_at: string | null;
  completed_at: string | null;
  completed_by: string | null;
  completion_note: string | null;
  evidence_document_id: string | null;
  evidence_reference: string | null;
  escalation_level: number;
  decision: string | null;
  notes: string | null;
};

function blankToNull(value: FormDataEntryValue | null) {
  return typeof value === 'string' && value.trim() ? value : null;
}

async function parseObligationRequest(request: Request) {
  if (!request.headers.get('content-type')?.includes('multipart/form-data')) {
    return {
      input: obligationSchema.parse(await request.json()),
      evidenceFile: null as File | null,
    };
  }
  const form = await request.formData();
  const evidence = form.get('evidenceFile');
  return {
    input: obligationSchema.parse({
      id: form.get('id'),
      action: form.get('action') || 'update',
      status: form.get('status'),
      owner: blankToNull(form.get('owner')),
      backupOwner: blankToNull(form.get('backupOwner')),
      priority: form.get('priority'),
      decision: blankToNull(form.get('decision')),
      notes: blankToNull(form.get('notes')),
      completionNote: blankToNull(form.get('completionNote')),
      evidenceDocumentId: blankToNull(form.get('evidenceDocumentId')),
      evidenceReference: blankToNull(form.get('evidenceReference')),
      transitionNote: blankToNull(form.get('transitionNote')),
    }),
    evidenceFile: evidence instanceof File && evidence.size ? evidence : null,
  };
}

async function loadCurrentObligation(id: string) {
  return env.DB.prepare(`SELECT id, contract_id, supplier_id, title, due_date,
    status, owner, backup_owner, priority, assigned_at, completed_at,
    completed_by, completion_note, evidence_document_id, evidence_reference,
    escalation_level, decision, notes
    FROM key_dates WHERE id = ? LIMIT 1`)
    .bind(id)
    .first<CurrentObligation>();
}

async function assertEligibleEvidenceDocument(
  documentId: string,
  obligation: CurrentObligation,
) {
  const document = await env.DB.prepare(`SELECT id FROM documents
    WHERE id = ? AND (
      (? IS NOT NULL AND contract_id = ?)
      OR (? IS NOT NULL AND supplier_id = ?)
    ) LIMIT 1`)
    .bind(
      documentId,
      obligation.contract_id,
      obligation.contract_id,
      obligation.supplier_id,
      obligation.supplier_id,
    )
    .first<{ id: string }>();
  if (!document) {
    throw new Error(
      'The selected evidence file is not linked to this contract or supplier.',
    );
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const access = await authorizeApiRequest(request, {
    permission:
      url.searchParams.get('format') === 'ics'
        ? 'export_data'
        : 'view_workspace',
  });
  if (!access.ok) return access.response;

  try {
    await ensureWorkspaceDatabase();
    if (url.searchParams.get('format') === 'ics') {
      const ids = [
        ...new Set(
          (url.searchParams.get('ids') ?? '')
            .split(',')
            .map((value) => value.trim())
            .filter(Boolean),
        ),
      ];
      if (!ids.length || ids.length > 100)
        return Response.json(
          { error: 'Select between 1 and 100 obligations to export.' },
          { status: 400 },
        );
      const rows = await env.DB.prepare(`SELECT k.id, k.title, k.due_date,
        k.owner, k.priority, k.source_clause, c.contract_number,
        s.legal_name AS supplier_name
        FROM key_dates k
        LEFT JOIN contracts c ON c.id = k.contract_id
        LEFT JOIN suppliers s ON s.id = k.supplier_id
        WHERE k.id IN (${ids.map(() => '?').join(',')})
        ORDER BY k.due_date, k.title`)
        .bind(...ids)
        .all<ObligationCalendarRecord>();
      return new Response(buildObligationCalendar(rows.results), {
        headers: {
          'Content-Type': 'text/calendar; charset=utf-8',
          'Content-Disposition':
            'attachment; filename="ContractLedger_Obligations.ics"',
          'Cache-Control': 'private, no-store',
        },
      });
    }

    const id = url.searchParams.get('id');
    if (!id)
      return Response.json(
        { error: 'Obligation id is required.' },
        { status: 400 },
      );
    const obligation = await env.DB.prepare(`SELECT k.*,
      CASE WHEN k.status != 'completed' AND k.due_date < date('now')
        THEN 'overdue' ELSE k.status END AS effective_status,
      c.contract_number, c.title AS contract_title,
      s.legal_name AS supplier_name,
      evidence.file_name AS evidence_file_name,
      source.file_name AS source_file_name
      FROM key_dates k
      LEFT JOIN contracts c ON c.id = k.contract_id
      LEFT JOIN suppliers s ON s.id = k.supplier_id
      LEFT JOIN documents evidence ON evidence.id = k.evidence_document_id
      LEFT JOIN documents source ON source.id = k.source_document_id
      WHERE k.id = ? LIMIT 1`)
      .bind(id)
      .first();
    if (!obligation)
      return Response.json({ error: 'Obligation not found.' }, { status: 404 });
    const current = obligation as Record<string, string | number | null>;
    const [events, eligibleDocuments] = await env.DB.batch([
      env.DB.prepare(`SELECT e.*, d.file_name AS evidence_file_name
        FROM obligation_events e
        LEFT JOIN documents d ON d.id = e.evidence_document_id
        WHERE e.key_date_id = ? ORDER BY e.created_at DESC`).bind(id),
      env.DB.prepare(`SELECT id, file_name, lifecycle_stage, uploaded_at
        FROM documents WHERE
          (? IS NOT NULL AND contract_id = ?)
          OR (? IS NOT NULL AND supplier_id = ?)
        ORDER BY uploaded_at DESC LIMIT 100`).bind(
        current.contract_id,
        current.contract_id,
        current.supplier_id,
        current.supplier_id,
      ),
    ]);
    return Response.json({
      obligation,
      events: events.results,
      eligibleDocuments: eligibleDocuments.results,
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Unable to load the obligation.',
      },
      { status: 400 },
    );
  }
}

export async function POST(request: Request) {
  const access = await authorizeApiRequest(request, {
    permission: 'complete_obligations',
  });
  if (!access.ok) return access.response;

  let newlyStoredKey: string | null = null;
  try {
    await ensureWorkspaceDatabase();
    const { input, evidenceFile } = await parseObligationRequest(request);
    const current = await loadCurrentObligation(input.id);
    if (!current)
      return Response.json({ error: 'Obligation not found.' }, { status: 404 });

    const currentStatus =
      current.status === 'due' ? 'in_progress' : current.status;
    if (!OBLIGATION_STATUSES.includes(currentStatus as ObligationStatus))
      throw new Error('The saved obligation has an unsupported status.');
    const nextStatus = nextObligationStatus(
      currentStatus as ObligationStatus,
      input.status,
    );
    const owner = input.owner || null;
    const backupOwner = input.backupOwner || null;
    if (nextStatus !== 'upcoming' && !owner)
      throw new Error('Assign an owner before advancing this obligation.');

    if (input.evidenceDocumentId)
      await assertEligibleEvidenceDocument(input.evidenceDocumentId, current);
    if (evidenceFile) {
      if (evidenceFile.size > MAX_SUPPLIER_DOCUMENT_BYTES)
        throw new Error('Evidence files must be 8 MB or smaller.');
      if (
        !ALLOWED_SUPPLIER_DOCUMENT_MIME_TYPES.includes(
          evidenceFile.type as (typeof ALLOWED_SUPPLIER_DOCUMENT_MIME_TYPES)[number],
        )
      )
        throw new Error('Use a PDF, PNG, or JPEG evidence file.');
      await assertSupplierFileSignature(evidenceFile);
    }

    const now = new Date().toISOString();
    if (input.action === 'escalate') {
      if (
        current.status === 'completed' ||
        current.due_date >= now.slice(0, 10)
      )
        throw new Error('Only overdue open obligations can be escalated.');
      if (!backupOwner)
        throw new Error('Assign a backup owner before escalating.');
      if (!input.transitionNote)
        throw new Error('Explain why this overdue obligation is escalated.');
      const outboxEvent = buildOutboxEvent({
        id: `outbox-${crypto.randomUUID()}`,
        eventType: 'obligation.escalated',
        aggregateType: 'obligation',
        aggregateId: input.id,
        occurredAt: now,
        actor: access.actor.name,
        payload: {
          contractId: current.contract_id,
          supplierId: current.supplier_id,
          backupOwner,
          escalationLevel: current.escalation_level + 1,
        },
      });
      await env.DB.batch([
        env.DB.prepare(`UPDATE key_dates SET owner = ?, backup_owner = ?,
          priority = ?, decision = ?, notes = ?, escalation_level = escalation_level + 1,
          escalated_at = ?, updated_at = ? WHERE id = ?`).bind(
          owner,
          backupOwner,
          input.priority,
          input.decision || null,
          input.notes || null,
          now,
          now,
          input.id,
        ),
        env.DB.prepare(`INSERT INTO obligation_events
          (id, key_date_id, event_type, from_status, to_status, actor, note,
           metadata_json, created_at)
          VALUES (?, ?, 'escalated', ?, ?, ?, ?, ?, ?)`).bind(
          `obligation-event-${crypto.randomUUID()}`,
          input.id,
          currentStatus,
          currentStatus,
          access.actor.name,
          input.transitionNote,
          JSON.stringify({ backupOwner, level: current.escalation_level + 1 }),
          now,
        ),
        env.DB.prepare(`INSERT INTO audit_logs
          (id, entity_type, entity_id, action, actor, details, created_at)
          VALUES (?, 'key_date', ?, 'obligation_escalated', ?, ?, ?)`).bind(
          `audit-${crypto.randomUUID()}`,
          input.id,
          access.actor.name,
          JSON.stringify({ backupOwner, reason: input.transitionNote }),
          now,
        ),
        env.DB.prepare(`INSERT INTO integration_outbox
          (id, event_type, aggregate_type, aggregate_id, payload_json, status,
           attempt_count, occurred_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).bind(
          outboxEvent.id,
          outboxEvent.eventType,
          outboxEvent.aggregateType,
          outboxEvent.aggregateId,
          outboxEvent.payloadJson,
          outboxEvent.status,
          outboxEvent.attemptCount,
          outboxEvent.occurredAt,
        ),
      ]);
      return Response.json({ saved: true, workspace: await getWorkspace() });
    }

    let uploadedDocumentId: string | null = null;
    if (evidenceFile) {
      uploadedDocumentId = `doc-${crypto.randomUUID()}`;
      newlyStoredKey = `obligation-evidence/${input.id}/${crypto.randomUUID()}-${safeSupplierFileName(evidenceFile.name)}`;
      await env.FILES.put(newlyStoredKey, await evidenceFile.arrayBuffer(), {
        httpMetadata: { contentType: evidenceFile.type },
        customMetadata: {
          obligationId: input.id,
          uploadedBy: access.actor.name,
        },
      });
    }
    const evidenceDocumentId =
      uploadedDocumentId ||
      input.evidenceDocumentId ||
      current.evidence_document_id ||
      null;
    const evidenceReference =
      input.evidenceReference || current.evidence_reference || null;
    const completionNote =
      input.completionNote || current.completion_note || null;
    if (nextStatus === 'completed')
      assertCompletionEvidence({
        completionNote,
        evidenceDocumentId,
        evidenceReference,
      });

    const statusChanged = currentStatus !== nextStatus;
    const evidenceChanged = Boolean(
      uploadedDocumentId ||
      (input.evidenceDocumentId || null) !== current.evidence_document_id ||
      (input.evidenceReference || null) !== current.evidence_reference,
    );
    const assignmentChanged = owner !== current.owner;
    const eventType = statusChanged
      ? 'status_changed'
      : evidenceChanged
        ? 'evidence_linked'
        : assignmentChanged
          ? 'assigned'
          : 'details_updated';
    const outboxEvent = buildOutboxEvent({
      id: `outbox-${crypto.randomUUID()}`,
      eventType:
        nextStatus === 'completed'
          ? 'obligation.completed'
          : statusChanged
            ? 'obligation.status_changed'
            : 'obligation.updated',
      aggregateType: 'obligation',
      aggregateId: input.id,
      occurredAt: now,
      actor: access.actor.name,
      payload: {
        contractId: current.contract_id,
        supplierId: current.supplier_id,
        fromStatus: currentStatus,
        toStatus: nextStatus,
        owner,
        evidenceDocumentId,
        evidenceReference,
      },
    });
    const statements: D1PreparedStatement[] = [];
    if (evidenceFile && uploadedDocumentId && newlyStoredKey) {
      statements.push(
        env.DB.prepare(`INSERT INTO documents
          (id, supplier_id, contract_id, file_name, file_type, lifecycle_stage,
           storage_key, mime_type, review_status, ai_status, uploaded_at)
          VALUES (?, ?, ?, ?, 'obligation_evidence', 'obligation_evidence', ?, ?,
            'approved', 'verified', ?)`).bind(
          uploadedDocumentId,
          current.supplier_id,
          current.contract_id,
          evidenceFile.name,
          newlyStoredKey,
          evidenceFile.type,
          now,
        ),
      );
    }
    statements.push(
      env.DB.prepare(`UPDATE key_dates SET status = ?, owner = ?,
        backup_owner = ?, priority = ?, assigned_at = CASE
          WHEN ? IS NOT NULL AND (assigned_at IS NULL OR owner != ?) THEN ?
          ELSE assigned_at END,
        decision = ?, notes = ?, completion_note = ?, evidence_document_id = ?,
        evidence_reference = ?, completed_at = CASE WHEN ? = 'completed'
          THEN COALESCE(completed_at, ?) ELSE NULL END,
        completed_by = CASE WHEN ? = 'completed'
          THEN COALESCE(completed_by, ?) ELSE NULL END,
        updated_at = ? WHERE id = ?`).bind(
        nextStatus,
        owner,
        backupOwner,
        input.priority,
        owner,
        owner,
        now,
        input.decision || null,
        input.notes || null,
        completionNote,
        evidenceDocumentId,
        evidenceReference,
        nextStatus,
        now,
        nextStatus,
        access.actor.name,
        now,
        input.id,
      ),
      env.DB.prepare(`INSERT INTO obligation_events
        (id, key_date_id, event_type, from_status, to_status, actor, note,
         evidence_document_id, metadata_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
        `obligation-event-${crypto.randomUUID()}`,
        input.id,
        eventType,
        currentStatus,
        nextStatus,
        access.actor.name,
        input.transitionNote || completionNote || input.notes || null,
        evidenceDocumentId,
        JSON.stringify({
          owner: { before: current.owner, after: owner },
          backupOwner: { before: current.backup_owner, after: backupOwner },
          priority: { before: current.priority, after: input.priority },
          evidenceReference,
        }),
        now,
      ),
      env.DB.prepare(`INSERT INTO audit_logs
        (id, entity_type, entity_id, action, actor, details, created_at)
        VALUES (?, 'key_date', ?, 'obligation_updated', ?, ?, ?)`).bind(
        `audit-${crypto.randomUUID()}`,
        input.id,
        access.actor.name,
        JSON.stringify({
          before: {
            status: currentStatus,
            owner: current.owner,
            priority: current.priority,
          },
          after: {
            status: nextStatus,
            owner,
            backupOwner,
            priority: input.priority,
            evidenceDocumentId,
            evidenceReference,
          },
        }),
        now,
      ),
      env.DB.prepare(`INSERT INTO integration_outbox
        (id, event_type, aggregate_type, aggregate_id, payload_json, status,
         attempt_count, occurred_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).bind(
        outboxEvent.id,
        outboxEvent.eventType,
        outboxEvent.aggregateType,
        outboxEvent.aggregateId,
        outboxEvent.payloadJson,
        outboxEvent.status,
        outboxEvent.attemptCount,
        outboxEvent.occurredAt,
      ),
      ...(current.contract_id
        ? [
            env.DB.prepare(
              'UPDATE contracts SET last_updated = ? WHERE id = ?',
            ).bind(now, current.contract_id),
          ]
        : []),
    );
    await env.DB.batch(statements);
    newlyStoredKey = null;
    return Response.json({ saved: true, workspace: await getWorkspace() });
  } catch (error) {
    if (newlyStoredKey) {
      try {
        await env.FILES.delete(newlyStoredKey);
      } catch {
        // The database write remains rejected; cleanup can be retried operationally.
      }
    }
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Unable to update the obligation.',
      },
      { status: 400 },
    );
  }
}
