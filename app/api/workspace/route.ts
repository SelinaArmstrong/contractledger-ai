import { env } from 'cloudflare:workers';
import { z } from 'zod';

import { ensureWorkspaceDatabase } from '@/db/bootstrap';

const fieldSchema = z.object({
  value: z.union([z.string(), z.number(), z.null()]),
  confidence: z.number(),
  sourcePage: z.number().nullable(),
  sourceQuote: z.string().nullable(),
});

const saveSchema = z.object({
  stage: z.enum(['draft', 'executed']),
  document: z.object({
    fileName: z.string(),
    totalPages: z.number(),
    storageKey: z.string(),
    mimeType: z.string(),
  }),
  analysis: z.object({
    documentTitle: fieldSchema,
    supplierLegalName: fieldSchema,
    contractType: fieldSchema,
    contractNumber: fieldSchema,
    contractValue: fieldSchema,
    effectiveDate: fieldSchema,
    expirationDate: fieldSchema,
    renewalType: fieldSchema,
    noticeDays: fieldSchema,
    governingLaw: fieldSchema,
    paymentTerms: fieldSchema,
    findings: z.array(
      z.object({
        rule: z.string(),
        observed: z.string(),
        standard: z.string(),
        severity: z.enum(['info', 'low', 'medium', 'high']),
        sourcePage: z.number().nullable(),
      }),
    ),
    keyDates: z.array(
      z.object({
        type: z.string(),
        title: z.string(),
        dueDate: z.string().nullable(),
        sourcePage: z.number().nullable(),
        sourceQuote: z.string().nullable(),
      }),
    ),
    warnings: z.array(z.string()),
  }),
});

function normalizeSupplierName(name: string) {
  return name
    .toLowerCase()
    .replace(/\b(incorporated|corporation|company|limited|inc|corp|co|llc|l\.l\.c)\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function stringValue(field: z.infer<typeof fieldSchema>, fallback = '') {
  return typeof field.value === 'string' ? field.value.trim() : fallback;
}

function numberValue(field: z.infer<typeof fieldSchema>) {
  if (typeof field.value === 'number') return field.value;
  if (typeof field.value === 'string') {
    const parsed = Number(field.value.replace(/[^0-9.-]/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function subtractDays(dateValue: string, days: number | null) {
  if (!dateValue || !days) return null;
  const date = new Date(`${dateValue}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

async function getWorkspace() {
  const db = env.DB;
  const [metricRow, contractRows, supplierRows, intakeRows, keyDateRows] = await Promise.all([
    db.prepare(`SELECT
      (SELECT COUNT(*) FROM contracts WHERE status IN ('executed','active')) AS active_contracts,
      (SELECT COALESCE(SUM(current_value_cents), 0) FROM contracts WHERE status IN ('executed','active')) AS current_value_cents,
      (SELECT COUNT(*) FROM suppliers WHERE status = 'active') AS active_suppliers,
      (SELECT COUNT(*) FROM suppliers WHERE status = 'pending') AS pending_suppliers,
      (SELECT COUNT(*) FROM contract_intakes WHERE review_status != 'complete') AS records_to_verify`).first(),
    db.prepare(`SELECT c.*, s.legal_name AS supplier_name
      FROM contracts c JOIN suppliers s ON s.id = c.supplier_id
      ORDER BY c.last_updated DESC`).all(),
    db.prepare(`SELECT s.*,
      COUNT(c.id) AS active_contract_count,
      COALESCE(SUM(CASE WHEN c.status IN ('executed','active') THEN c.current_value_cents ELSE 0 END), 0) AS total_contract_value_cents
      FROM suppliers s LEFT JOIN contracts c ON c.supplier_id = s.id
      GROUP BY s.id ORDER BY s.legal_name`).all(),
    db.prepare(`SELECT i.*,
      (SELECT COUNT(*) FROM review_findings f WHERE f.intake_id = i.id AND f.status = 'open') AS finding_count
      FROM contract_intakes i ORDER BY i.received_at DESC`).all(),
    db.prepare(`SELECT k.*, c.contract_number, s.legal_name AS supplier_name
      FROM key_dates k
      LEFT JOIN contracts c ON c.id = k.contract_id
      LEFT JOIN suppliers s ON s.id = k.supplier_id
      WHERE k.status IN ('upcoming','due')
      ORDER BY k.due_date`).all(),
  ]);

  return {
    metrics: metricRow,
    contracts: contractRows.results,
    suppliers: supplierRows.results,
    intakes: intakeRows.results,
    keyDates: keyDateRows.results,
  };
}

export async function GET() {
  try {
    await ensureWorkspaceDatabase();
    return Response.json(await getWorkspace());
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Unable to load the workspace.' },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    await ensureWorkspaceDatabase();
    const input = saveSchema.parse(await request.json());
    const db = env.DB;
    const now = new Date().toISOString();
    const supplierName = stringValue(input.analysis.supplierLegalName, 'Supplier pending verification');
    const normalizedName = normalizeSupplierName(supplierName) || `pending-${crypto.randomUUID()}`;
    let supplier = await db
      .prepare('SELECT id, status FROM suppliers WHERE normalized_name = ? LIMIT 1')
      .bind(normalizedName)
      .first<{ id: string; status: string }>();

    if (!supplier) {
      const supplierId = `sup-${crypto.randomUUID()}`;
      await db
        .prepare(`INSERT INTO suppliers
          (id, legal_name, normalized_name, category, status, w9_status, insurance_status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, 'missing', 'missing', ?, ?)`) 
        .bind(
          supplierId,
          supplierName,
          normalizedName,
          'Pending classification',
          input.stage === 'executed' ? 'active' : 'pending',
          now,
          now,
        )
        .run();
      supplier = { id: supplierId, status: input.stage === 'executed' ? 'active' : 'pending' };
    } else if (input.stage === 'executed' && supplier.status !== 'active') {
      await db
        .prepare("UPDATE suppliers SET status = 'active', updated_at = ? WHERE id = ?")
        .bind(now, supplier.id)
        .run();
    }

    const title = stringValue(input.analysis.documentTitle, input.document.fileName.replace(/\.[^.]+$/, ''));
    const contractType = stringValue(input.analysis.contractType, 'Contract');
    const valueCents = Math.round(numberValue(input.analysis.contractValue) * 100);

    if (input.stage === 'draft') {
      const count = await db.prepare('SELECT COUNT(*) AS count FROM contract_intakes').first<{ count: number }>();
      const id = `int-${crypto.randomUUID()}`;
      const intakeNumber = `INT-${new Date().getUTCFullYear()}-${String((count?.count ?? 0) + 44).padStart(3, '0')}`;
      await db.batch([
        db.prepare(`INSERT INTO contract_intakes
          (id, intake_number, supplier_id, proposed_supplier_name, title, contract_type, proposed_value_cents, status, review_status, received_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'under_review', 'in_progress', ?, ?)`).bind(
          id,
          intakeNumber,
          supplier.id,
          supplierName,
          title,
          contractType,
          valueCents || null,
          now.slice(0, 10),
          now,
        ),
        db.prepare(`INSERT INTO documents
          (id, supplier_id, intake_id, file_name, file_type, lifecycle_stage, storage_key, mime_type, page_count, ai_status, uploaded_at)
          VALUES (?, ?, ?, ?, ?, 'draft', ?, ?, ?, 'needs_review', ?)`).bind(
          `doc-${crypto.randomUUID()}`,
          supplier.id,
          id,
          input.document.fileName,
          contractType,
          input.document.storageKey,
          input.document.mimeType,
          input.document.totalPages,
          now,
        ),
        db.prepare(`INSERT INTO audit_logs (id, entity_type, entity_id, action, actor, details, created_at)
          VALUES (?, 'contract_intake', ?, 'ai_extraction_saved', 'Selina Armstrong', ?, ?)`).bind(
          `audit-${crypto.randomUUID()}`,
          id,
          JSON.stringify({ source: input.document.fileName, model: 'deepseek-v4-flash' }),
          now,
        ),
      ]);

      if (input.analysis.findings.length) {
        await db.batch(
          input.analysis.findings.map((finding) =>
            db.prepare(`INSERT INTO review_findings
              (id, intake_id, field, rule_name, standard_text, observed_text, severity, source_page, status)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open')`).bind(
              `finding-${crypto.randomUUID()}`,
              id,
              finding.rule.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
              finding.rule,
              finding.standard,
              finding.observed,
              finding.severity,
              finding.sourcePage,
            ),
          ),
        );
      }
    } else {
      const count = await db.prepare('SELECT COUNT(*) AS count FROM contracts').first<{ count: number }>();
      const id = `con-${crypto.randomUUID()}`;
      const extractedNumber = stringValue(input.analysis.contractNumber);
      const contractNumber = extractedNumber || `CT-${new Date().getUTCFullYear()}-${String((count?.count ?? 0) + 20).padStart(3, '0')}`;
      const effectiveDate = stringValue(input.analysis.effectiveDate, now.slice(0, 10));
      const expirationDate = stringValue(input.analysis.expirationDate) || null;
      const noticeDays = Math.round(numberValue(input.analysis.noticeDays)) || null;
      const renewalType = stringValue(input.analysis.renewalType, 'none');
      const noticeDeadline = subtractDays(expirationDate ?? '', noticeDays);

      await db.batch([
        db.prepare(`INSERT INTO contracts
          (id, contract_number, supplier_id, title, contract_type, department, owner, original_value_cents, amendment_value_cents, current_value_cents, effective_date, expiration_date, renewal_type, notice_days, notice_deadline, status, last_updated)
          VALUES (?, ?, ?, ?, ?, 'Procurement', 'Selina Armstrong', ?, 0, ?, ?, ?, ?, ?, ?, 'active', ?)`).bind(
          id,
          contractNumber,
          supplier.id,
          title,
          contractType,
          valueCents,
          valueCents,
          effectiveDate,
          expirationDate,
          ['automatic', 'optional', 'none'].includes(renewalType) ? renewalType : 'none',
          noticeDays,
          noticeDeadline,
          now,
        ),
        db.prepare(`INSERT INTO documents
          (id, supplier_id, contract_id, file_name, file_type, lifecycle_stage, storage_key, mime_type, page_count, ai_status, uploaded_at)
          VALUES (?, ?, ?, ?, ?, 'executed', ?, ?, ?, 'verified', ?)`).bind(
          `doc-${crypto.randomUUID()}`,
          supplier.id,
          id,
          input.document.fileName,
          contractType,
          input.document.storageKey,
          input.document.mimeType,
          input.document.totalPages,
          now,
        ),
        db.prepare(`INSERT INTO audit_logs (id, entity_type, entity_id, action, actor, details, created_at)
          VALUES (?, 'contract', ?, 'executed_contract_registered', 'Selina Armstrong', ?, ?)`).bind(
          `audit-${crypto.randomUUID()}`,
          id,
          JSON.stringify({ source: input.document.fileName, model: 'deepseek-v4-flash' }),
          now,
        ),
      ]);

      const extractedDates = input.analysis.keyDates.filter((item) => item.dueDate);
      if (noticeDeadline) {
        extractedDates.unshift({
          type: 'non_renewal_notice',
          title: 'Non-renewal notice deadline',
          dueDate: noticeDeadline,
          sourcePage: input.analysis.noticeDays.sourcePage,
          sourceQuote: input.analysis.noticeDays.sourceQuote,
        });
      }
      if (extractedDates.length) {
        await db.batch(
          extractedDates.map((item) =>
            db.prepare(`INSERT INTO key_dates
              (id, contract_id, supplier_id, type, title, due_date, status, source_clause, source_page)
              VALUES (?, ?, ?, ?, ?, ?, 'upcoming', ?, ?)`).bind(
              `date-${crypto.randomUUID()}`,
              id,
              supplier.id,
              item.type,
              item.title,
              item.dueDate,
              item.sourceQuote,
              item.sourcePage,
            ),
          ),
        );
      }
    }

    await db.prepare('PRAGMA optimize').run();
    return Response.json({ saved: true, workspace: await getWorkspace() });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Unable to save the verified record.' },
      { status: 400 },
    );
  }
}
