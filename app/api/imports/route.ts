import { env } from 'cloudflare:workers';
import { z } from 'zod';

import { getWorkspace } from '@/app/api/workspace/route';
import { ensureWorkspaceDatabase } from '@/db/bootstrap';
import {
  IMPORT_FIELDS,
  IMPORT_MAPPING_VERSION,
  IMPORT_TARGETS,
  IMPORT_TEMPLATE_ROWS,
  autoMapImportHeaders,
  calculateImportPortfolioMetrics,
  csvCell,
  importPreviewSummary,
  previewImportRows,
  subtractImportNoticeDays,
  type ExistingImportData,
  type ImportDecision,
  type ImportIssue,
  type ImportTarget,
} from '@/lib/bulk-import';
import { assertImportFileSignature } from '@/lib/server/file-validation';
import { importFileHash, parseImportFile } from '@/lib/server/import-file';
import { authorizeApiRequest } from '@/lib/server/request-security';
import { supplierDocumentationStatus } from '@/lib/supplier-qualification';

const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
const MAX_IMPORT_ROWS = 150;

const getSchema = z.object({
  id: z.string().min(1).max(200).optional(),
  template: z.enum(IMPORT_TARGETS).optional(),
  format: z.enum(['csv', 'xlsx', 'corrections']).optional(),
});

const actionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('remap'),
    batchId: z.string().min(1).max(200),
    mapping: z.record(z.string(), z.string().max(200)),
  }),
  z.object({
    action: z.literal('resolve'),
    batchId: z.string().min(1).max(200),
    rowIds: z.array(z.string().min(1).max(200)).min(1).max(MAX_IMPORT_ROWS),
    decision: z.enum(['accept', 'skip']),
  }),
  z.object({
    action: z.literal('commit'),
    batchId: z.string().min(1).max(200),
  }),
  z.object({
    action: z.literal('rollback'),
    batchId: z.string().min(1).max(200),
    reason: z.string().trim().min(5).max(1000),
  }),
]);

type BatchRow = Record<string, string | number | null>;
type StagedRow = {
  id: string;
  batch_id: string;
  row_number: number;
  raw_data_json: string;
  normalized_data_json: string;
  status: 'ready' | 'warning' | 'duplicate' | 'invalid';
  decision: ImportDecision;
  issues_json: string;
  duplicate_record_id: string | null;
  duplicate_type: 'exact' | 'possible' | null;
  created_record_id: string | null;
  created_record_type: string | null;
  committed_at: string | null;
  rolled_back_at: string | null;
};

function jsonValue<T>(value: string | number | null, fallback: T): T {
  if (typeof value !== 'string') return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

async function loadExistingData(): Promise<ExistingImportData> {
  const [suppliers, contracts] = await env.DB.batch([
    env.DB.prepare(`SELECT id, legal_name, normalized_name, vendor_number
      FROM suppliers ORDER BY legal_name`),
    env.DB.prepare(`SELECT id, contract_number, supplier_id, title
      FROM contracts ORDER BY contract_number`),
  ]);
  return {
    suppliers: (suppliers.results as BatchRow[]).map((row) => ({
      id: String(row.id),
      legalName: String(row.legal_name),
      normalizedName: String(row.normalized_name),
      vendorNumber: row.vendor_number ? String(row.vendor_number) : null,
    })),
    contracts: (contracts.results as BatchRow[]).map((row) => ({
      id: String(row.id),
      contractNumber: String(row.contract_number),
      supplierId: String(row.supplier_id),
      title: String(row.title),
    })),
  };
}

async function getBatch(batchId: string) {
  const batch = await env.DB.prepare(
    'SELECT * FROM import_batches WHERE id = ? LIMIT 1',
  )
    .bind(batchId)
    .first<BatchRow>();
  if (!batch) return null;
  const target = z.enum(IMPORT_TARGETS).parse(String(batch.entity_type));
  const rows = await env.DB.prepare(
    'SELECT * FROM import_rows WHERE batch_id = ? ORDER BY row_number',
  )
    .bind(batchId)
    .all<StagedRow>();
  const parsedBatch = {
    ...batch,
    headers: jsonValue<string[]>(batch.headers_json, []),
    mapping: jsonValue<Record<string, string>>(batch.mapping_json, {}),
  } as BatchRow & {
    headers: string[];
    mapping: Record<string, string>;
  };
  return {
    batch: parsedBatch,
    fields: IMPORT_FIELDS[target],
    rows: rows.results.map((row) => ({
      ...row,
      raw: jsonValue<Record<string, string>>(row.raw_data_json, {}),
      normalized: jsonValue<Record<string, string | number | null>>(
        row.normalized_data_json,
        {},
      ),
      issues: jsonValue<ImportIssue[]>(row.issues_json, []),
    })),
  };
}

async function updateBatchSummary(batchId: string) {
  const rows = await env.DB.prepare(
    'SELECT status, decision, issues_json FROM import_rows WHERE batch_id = ?',
  )
    .bind(batchId)
    .all<{
      status: 'ready' | 'warning' | 'duplicate' | 'invalid';
      decision: ImportDecision;
      issues_json: string;
    }>();
  const summary = importPreviewSummary(
    rows.results.map((row) => ({
      status: row.status,
      decision: row.decision,
      issues: jsonValue<ImportIssue[]>(row.issues_json, []),
    })),
  );
  await env.DB.prepare(`UPDATE import_batches SET ready_rows = ?,
      warning_rows = ?, duplicate_rows = ?, invalid_rows = ?, accepted_rows = ?,
      rejected_rows = ?, normalization_issue_count = ? WHERE id = ?`)
    .bind(
      summary.ready,
      summary.warning,
      summary.duplicate,
      summary.invalid,
      summary.accepted,
      summary.rejected,
      summary.normalizationIssues,
      batchId,
    )
    .run();
}

function csvResponse(content: string, fileName: string) {
  return new Response(`\uFEFF${content}`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'no-store',
    },
  });
}

async function templateResponse(target: ImportTarget, format: 'csv' | 'xlsx') {
  const fields = IMPORT_FIELDS[target];
  const sample = IMPORT_TEMPLATE_ROWS[target][0];
  if (format === 'csv') {
    return csvResponse(
      [
        fields.map((field) => csvCell(field.label)).join(','),
        fields.map((field) => csvCell(sample[field.key] ?? '')).join(','),
      ].join('\r\n'),
      `${target}-import-template.csv`,
    );
  }
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(
    target === 'suppliers' ? 'Supplier Master' : 'Contract Register',
  );
  worksheet.addRow(fields.map((field) => field.label));
  worksheet.addRow(fields.map((field) => sample[field.key] ?? ''));
  worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF174A5B' },
  };
  worksheet.columns.forEach((column) => {
    column.width = 22;
  });
  worksheet.views = [{ state: 'frozen', ySplit: 1 }];
  const bytes = await workbook.xlsx.writeBuffer();
  return new Response(bytes, {
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${target}-import-template.xlsx"`,
      'Cache-Control': 'no-store',
    },
  });
}

async function correctionResponse(batchId: string) {
  const details = await getBatch(batchId);
  if (!details)
    return Response.json({ error: 'Import batch not found.' }, { status: 404 });
  const headers = details.batch.headers as string[];
  const rows = details.rows.filter(
    (row) =>
      row.status === 'invalid' ||
      row.status === 'duplicate' ||
      row.decision === 'skip',
  );
  const lines = [
    [...headers, 'Import Status', 'Decision', 'Actionable Issues']
      .map(csvCell)
      .join(','),
    ...rows.map((row) =>
      [
        ...headers.map((header) => row.raw[header] ?? ''),
        row.status,
        row.decision,
        row.issues.map((issue) => issue.message).join(' | '),
      ]
        .map(csvCell)
        .join(','),
    ),
  ];
  return csvResponse(lines.join('\r\n'), `import-${batchId}-corrections.csv`);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const access = await authorizeApiRequest(request, {
    permission:
      url.searchParams.get('format') === 'corrections'
        ? 'export_data'
        : 'view_workspace',
  });
  if (!access.ok) return access.response;
  try {
    await ensureWorkspaceDatabase();
    const query = getSchema.parse({
      id: url.searchParams.get('id') || undefined,
      template: url.searchParams.get('template') || undefined,
      format: url.searchParams.get('format') || undefined,
    });
    if (query.template)
      return templateResponse(
        query.template,
        query.format === 'csv' ? 'csv' : 'xlsx',
      );
    if (query.id && query.format === 'corrections')
      return correctionResponse(query.id);
    if (query.id) {
      const details = await getBatch(query.id);
      return details
        ? Response.json(details)
        : Response.json({ error: 'Import batch not found.' }, { status: 404 });
    }
    const [batches, metricRows, duplicateCandidates] = await env.DB.batch([
      env.DB.prepare(
        'SELECT * FROM import_batches ORDER BY created_at DESC LIMIT 20',
      ),
      env.DB.prepare(`SELECT status, total_rows, accepted_rows, rejected_rows,
        normalization_issue_count, created_at, committed_at
        FROM import_batches ORDER BY created_at`),
      env.DB.prepare(`SELECT COUNT(*) AS count FROM import_rows
        WHERE duplicate_type IS NOT NULL`),
    ]);
    const metrics = calculateImportPortfolioMetrics(
      (metricRows.results as BatchRow[]).map((row) => ({
        status: z
          .enum(['preview', 'committed', 'rolled_back'])
          .parse(String(row.status)),
        totalRows: Number(row.total_rows),
        acceptedRows: Number(row.accepted_rows),
        rejectedRows: Number(row.rejected_rows),
        normalizationIssueCount: Number(row.normalization_issue_count),
        createdAt: String(row.created_at),
        committedAt: row.committed_at ? String(row.committed_at) : null,
      })),
      Number(
        (duplicateCandidates.results[0] as BatchRow | undefined)?.count ?? 0,
      ),
    );
    return Response.json({ batches: batches.results, metrics });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : 'Unable to load imports.',
      },
      { status: error instanceof z.ZodError ? 400 : 500 },
    );
  }
}

export async function POST(request: Request) {
  const access = await authorizeApiRequest(request, {
    permission: 'manage_imports',
  });
  if (!access.ok) return access.response;
  try {
    await ensureWorkspaceDatabase();
    const form = await request.formData();
    const file = form.get('file');
    const target = z.enum(IMPORT_TARGETS).parse(form.get('target'));
    if (!(file instanceof File))
      throw new Error('Choose a CSV or XLSX import file.');
    if (!file.size || file.size > MAX_IMPORT_BYTES)
      throw new Error('Import files must be between 1 byte and 5 MB.');
    const fileType = await assertImportFileSignature(file);
    const { headers, records } = await parseImportFile(file, fileType);
    if (records.length > MAX_IMPORT_ROWS)
      throw new Error(
        `Import files may contain at most ${MAX_IMPORT_ROWS} data rows per batch.`,
      );
    const mapping = autoMapImportHeaders(target, headers);
    const preview = previewImportRows(
      target,
      records,
      mapping,
      await loadExistingData(),
    );
    const summary = importPreviewSummary(preview);
    const batchId = `import-${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO import_batches
        (id, entity_type, file_name, file_type, file_size_bytes, source_hash,
         status, headers_json, mapping_json, mapping_version, total_rows,
         ready_rows, warning_rows, duplicate_rows, invalid_rows, accepted_rows,
         rejected_rows, normalization_issue_count, started_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 'preview', ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?)`).bind(
        batchId,
        target,
        file.name,
        fileType,
        file.size,
        await importFileHash(file),
        JSON.stringify(headers),
        JSON.stringify(mapping),
        IMPORT_MAPPING_VERSION,
        summary.total,
        summary.ready,
        summary.warning,
        summary.duplicate,
        summary.invalid,
        summary.normalizationIssues,
        access.actor.name,
        now,
      ),
      ...preview.map((row) =>
        env.DB.prepare(`INSERT INTO import_rows
          (id, batch_id, row_number, raw_data_json, normalized_data_json,
           status, decision, issues_json, duplicate_record_id, duplicate_type)
          VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`).bind(
          `import-row-${crypto.randomUUID()}`,
          batchId,
          row.rowNumber,
          JSON.stringify(row.raw),
          JSON.stringify(row.normalized),
          row.status,
          JSON.stringify(row.issues),
          row.duplicateRecordId,
          row.duplicateType,
        ),
      ),
      env.DB.prepare(`INSERT INTO audit_logs
        (id, entity_type, entity_id, action, actor, details, created_at)
        VALUES (?, 'import_batch', ?, 'import_preview_created', ?, ?, ?)`).bind(
        `audit-${crypto.randomUUID()}`,
        batchId,
        access.actor.name,
        JSON.stringify({ target, fileName: file.name, fileType, ...summary }),
        now,
      ),
    ]);
    return Response.json(await getBatch(batchId), { status: 201 });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Unable to preview the import.',
      },
      { status: error instanceof z.ZodError ? 400 : 400 },
    );
  }
}

async function remapBatch(
  batchId: string,
  mapping: Record<string, string>,
  actor: string,
) {
  const details = await getBatch(batchId);
  if (!details) throw new Error('Import batch not found.');
  if (details.batch.status !== 'preview')
    throw new Error('Only preview batches can be remapped.');
  const target = z
    .enum(IMPORT_TARGETS)
    .parse(String(details.batch.entity_type));
  const headers = details.batch.headers as string[];
  const allowedFields = new Set(
    IMPORT_FIELDS[target].map((field) => field.key),
  );
  for (const [field, header] of Object.entries(mapping)) {
    if (!allowedFields.has(field))
      throw new Error(`Unknown mapping field: ${field}.`);
    if (header && !headers.includes(header))
      throw new Error(`Mapped column does not exist: ${header}.`);
  }
  const used = Object.values(mapping).filter(Boolean);
  if (new Set(used).size !== used.length)
    throw new Error('A source column can only be mapped once.');
  const preview = previewImportRows(
    target,
    details.rows.map((row) => row.raw),
    mapping,
    await loadExistingData(),
  );
  const now = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare(
      'UPDATE import_batches SET mapping_json = ?, mapping_version = ? WHERE id = ?',
    ).bind(JSON.stringify(mapping), IMPORT_MAPPING_VERSION, batchId),
    ...details.rows.map((row, index) => {
      const next = preview[index];
      return env.DB.prepare(`UPDATE import_rows SET normalized_data_json = ?,
        status = ?, decision = 'pending', issues_json = ?, duplicate_record_id = ?,
        duplicate_type = ? WHERE id = ?`).bind(
        JSON.stringify(next.normalized),
        next.status,
        JSON.stringify(next.issues),
        next.duplicateRecordId,
        next.duplicateType,
        row.id,
      );
    }),
    env.DB.prepare(`INSERT INTO audit_logs
      (id, entity_type, entity_id, action, actor, details, created_at)
      VALUES (?, 'import_batch', ?, 'import_mapping_updated', ?, ?, ?)`).bind(
      `audit-${crypto.randomUUID()}`,
      batchId,
      actor,
      JSON.stringify({ mappingVersion: IMPORT_MAPPING_VERSION, mapping }),
      now,
    ),
  ]);
  await updateBatchSummary(batchId);
  return getBatch(batchId);
}

async function resolveRows(
  batchId: string,
  rowIds: string[],
  decision: 'accept' | 'skip',
  actor: string,
) {
  const placeholders = rowIds.map(() => '?').join(',');
  const batch = await env.DB.prepare(
    'SELECT status FROM import_batches WHERE id = ? LIMIT 1',
  )
    .bind(batchId)
    .first<{ status: string }>();
  if (!batch) throw new Error('Import batch not found.');
  if (batch.status !== 'preview')
    throw new Error('Only preview rows can be resolved.');
  const rows =
    await env.DB.prepare(`SELECT id, status, duplicate_type FROM import_rows
    WHERE batch_id = ? AND id IN (${placeholders})`)
      .bind(batchId, ...rowIds)
      .all<{ id: string; status: string; duplicate_type: string | null }>();
  if (rows.results.length !== rowIds.length)
    throw new Error('One or more import rows were not found.');
  if (
    decision === 'accept' &&
    rows.results.some(
      (row) => row.status === 'invalid' || row.duplicate_type === 'exact',
    )
  )
    throw new Error(
      'Invalid rows and exact duplicates cannot be accepted. Correct or skip them.',
    );
  const now = new Date().toISOString();
  await env.DB.batch([
    ...rows.results.map((row) =>
      env.DB.prepare('UPDATE import_rows SET decision = ? WHERE id = ?').bind(
        decision,
        row.id,
      ),
    ),
    env.DB.prepare(`INSERT INTO audit_logs
      (id, entity_type, entity_id, action, actor, details, created_at)
      VALUES (?, 'import_batch', ?, 'import_rows_resolved', ?, ?, ?)`).bind(
      `audit-${crypto.randomUUID()}`,
      batchId,
      actor,
      JSON.stringify({ rowIds, decision }),
      now,
    ),
  ]);
  await updateBatchSummary(batchId);
  return getBatch(batchId);
}

async function commitBatch(batchId: string, actor: string) {
  const details = await getBatch(batchId);
  if (!details) throw new Error('Import batch not found.');
  if (details.batch.status === 'committed')
    return { ...(await getBatch(batchId)), workspace: await getWorkspace() };
  if (details.batch.status !== 'preview')
    throw new Error(
      'Rolled-back batches cannot be committed again. Start a new preview.',
    );
  const pending = details.rows.filter((row) => row.decision === 'pending');
  if (pending.length)
    throw new Error(
      `Resolve all rows before commit. ${pending.length} row(s) are still pending.`,
    );
  const accepted = details.rows.filter((row) => row.decision === 'accept');
  if (!accepted.length)
    throw new Error('Accept at least one valid row before commit.');
  const target = z
    .enum(IMPORT_TARGETS)
    .parse(String(details.batch.entity_type));
  const currentPreview = previewImportRows(
    target,
    accepted.map((row) => row.raw),
    details.batch.mapping as Record<string, string>,
    await loadExistingData(),
  );
  const changed = currentPreview.find(
    (row, index) =>
      row.status === 'invalid' ||
      row.duplicateType === 'exact' ||
      JSON.stringify(row.normalized) !==
        JSON.stringify(accepted[index].normalized),
  );
  if (changed)
    throw new Error(
      'Official data changed after preview. Remap or create a fresh preview before committing.',
    );
  const now = new Date().toISOString();
  const statements: D1PreparedStatement[] = [];
  const created: Array<{
    rowId: string;
    recordId: string;
    recordType: string;
  }> = [];
  for (const row of accepted) {
    const data = row.normalized;
    if (target === 'suppliers') {
      const supplierId = `sup-${crypto.randomUUID()}`;
      const w9Status = String(data.w9_status ?? 'missing');
      const insuranceStatus = String(data.insurance_status ?? 'missing');
      statements.push(
        env.DB.prepare(`INSERT INTO suppliers
        (id, legal_name, normalized_name, dba_name, vendor_number, category, status,
         primary_contact, email, phone, address_line1, city, state, postal_code,
         country, risk_tier, qualification_status, qualification_review_date,
         w9_status, insurance_status, insurance_expiration, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
          supplierId,
          String(data.legal_name),
          String(data.normalized_name),
          data.dba_name,
          data.vendor_number ??
            `VND-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
          String(data.category),
          String(data.status),
          data.primary_contact,
          data.email,
          data.phone,
          data.address_line_1,
          data.city,
          data.state,
          data.postal_code,
          data.country,
          data.risk_tier,
          supplierDocumentationStatus({
            w9Status,
            insuranceStatus,
            documentStatuses: [],
          }),
          now.slice(0, 10),
          w9Status,
          insuranceStatus,
          data.insurance_expiration,
          now,
          now,
        ),
      );
      created.push({
        rowId: row.id,
        recordId: supplierId,
        recordType: 'supplier',
      });
    } else {
      const contractId = `con-${crypto.randomUUID()}`;
      const expirationDate = data.expiration_date
        ? String(data.expiration_date)
        : null;
      const noticeDays =
        typeof data.notice_days === 'number' ? data.notice_days : null;
      const noticeDeadline = subtractImportNoticeDays(
        expirationDate,
        noticeDays,
      );
      statements.push(
        env.DB.prepare(`INSERT INTO contracts
        (id, contract_number, supplier_id, title, contract_type, department, owner,
         original_value_cents, amendment_value_cents, current_value_cents,
         effective_date, expiration_date, renewal_type, notice_days, notice_deadline,
         payment_terms, governing_law, status, last_updated)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
          contractId,
          String(data.contract_number),
          String(data.supplier_id),
          String(data.title),
          String(data.contract_type),
          String(data.department),
          String(data.owner),
          Number(data.current_value_cents),
          Number(data.current_value_cents),
          String(data.effective_date),
          expirationDate,
          String(data.renewal_type),
          noticeDays,
          noticeDeadline,
          data.payment_terms,
          data.governing_law,
          String(data.status),
          now,
        ),
      );
      if (expirationDate)
        statements.push(
          env.DB.prepare(`INSERT INTO key_dates
        (id, contract_id, supplier_id, type, title, due_date, status, owner,
         priority, assigned_at, source_clause, created_at, updated_at)
        VALUES (?, ?, ?, 'expiration', 'Contract expiration', ?, 'upcoming', ?,
          'high', ?, 'Imported contract register', ?, ?)`).bind(
            `date-${crypto.randomUUID()}`,
            contractId,
            String(data.supplier_id),
            expirationDate,
            String(data.owner),
            now,
            now,
            now,
          ),
        );
      if (noticeDeadline)
        statements.push(
          env.DB.prepare(`INSERT INTO key_dates
        (id, contract_id, supplier_id, type, title, due_date, status, owner,
         priority, assigned_at, decision, source_clause, created_at, updated_at)
        VALUES (?, ?, ?, 'non_renewal_notice', 'Non-renewal notice deadline', ?,
          'upcoming', ?, 'high', ?, 'under_review',
          'Calculated from imported expiration and notice period', ?, ?)`).bind(
            `date-${crypto.randomUUID()}`,
            contractId,
            String(data.supplier_id),
            noticeDeadline,
            String(data.owner),
            now,
            now,
            now,
          ),
        );
      created.push({
        rowId: row.id,
        recordId: contractId,
        recordType: 'contract',
      });
    }
  }
  statements.push(
    ...created.map((item) =>
      env.DB.prepare(`UPDATE import_rows SET
      created_record_id = ?, created_record_type = ?, committed_at = ? WHERE id = ?`).bind(
        item.recordId,
        item.recordType,
        now,
        item.rowId,
      ),
    ),
    env.DB.prepare(`UPDATE import_batches SET status = 'committed', committed_by = ?,
      committed_at = ? WHERE id = ? AND status = 'preview'`).bind(
      actor,
      now,
      batchId,
    ),
    env.DB.prepare(`INSERT INTO audit_logs
      (id, entity_type, entity_id, action, actor, details, created_at)
      VALUES (?, 'import_batch', ?, 'import_batch_committed', ?, ?, ?)`).bind(
      `audit-${crypto.randomUUID()}`,
      batchId,
      actor,
      JSON.stringify({
        target,
        acceptedRows: accepted.length,
        rejectedRows: details.rows.length - accepted.length,
        createdRecordIds: created.map((item) => item.recordId),
      }),
      now,
    ),
  );
  await env.DB.batch(statements);
  return { ...(await getBatch(batchId)), workspace: await getWorkspace() };
}

async function rollbackBatch(batchId: string, actor: string, reason: string) {
  const details = await getBatch(batchId);
  if (!details) throw new Error('Import batch not found.');
  if (details.batch.status === 'rolled_back')
    return { ...(await getBatch(batchId)), workspace: await getWorkspace() };
  if (details.batch.status !== 'committed')
    throw new Error('Only committed batches can be rolled back.');
  const created = details.rows.filter(
    (row) => row.created_record_id && !row.rolled_back_at,
  );
  const target = z
    .enum(IMPORT_TARGETS)
    .parse(String(details.batch.entity_type));
  if (target === 'suppliers') {
    for (const row of created) {
      const dependency = await env.DB.prepare(`SELECT
        (SELECT COUNT(*) FROM contracts WHERE supplier_id = ?) +
        (SELECT COUNT(*) FROM contract_intakes WHERE supplier_id = ?) +
        (SELECT COUNT(*) FROM documents WHERE supplier_id = ?) AS count`)
        .bind(
          row.created_record_id,
          row.created_record_id,
          row.created_record_id,
        )
        .first<{ count: number }>();
      if (Number(dependency?.count ?? 0) > 0)
        throw new Error(
          'Rollback is blocked because an imported supplier now has linked records. Remove those dependencies first.',
        );
    }
  } else {
    for (const row of created) {
      const dependency = await env.DB.prepare(`SELECT
        (SELECT COUNT(*) FROM documents WHERE contract_id = ?) +
        (SELECT COUNT(*) FROM amendments WHERE contract_id = ?) AS count`)
        .bind(row.created_record_id, row.created_record_id)
        .first<{ count: number }>();
      if (Number(dependency?.count ?? 0) > 0)
        throw new Error(
          'Rollback is blocked because an imported contract now has documents or amendments.',
        );
    }
  }
  const now = new Date().toISOString();
  const statements: D1PreparedStatement[] = [];
  for (const row of created) {
    if (target === 'contracts')
      statements.push(
        env.DB.prepare('DELETE FROM key_dates WHERE contract_id = ?').bind(
          row.created_record_id,
        ),
      );
    statements.push(
      env.DB.prepare(`DELETE FROM ${target} WHERE id = ?`).bind(
        row.created_record_id,
      ),
    );
    statements.push(
      env.DB.prepare(
        'UPDATE import_rows SET rolled_back_at = ? WHERE id = ?',
      ).bind(now, row.id),
    );
  }
  statements.push(
    env.DB.prepare(`UPDATE import_batches SET status = 'rolled_back', rolled_back_by = ?,
      rolled_back_at = ?, rollback_reason = ? WHERE id = ? AND status = 'committed'`).bind(
      actor,
      now,
      reason,
      batchId,
    ),
    env.DB.prepare(`INSERT INTO audit_logs
      (id, entity_type, entity_id, action, actor, details, created_at)
      VALUES (?, 'import_batch', ?, 'import_batch_rolled_back', ?, ?, ?)`).bind(
      `audit-${crypto.randomUUID()}`,
      batchId,
      actor,
      JSON.stringify({
        reason,
        reversedRecordIds: created.map((row) => row.created_record_id),
      }),
      now,
    ),
  );
  await env.DB.batch(statements);
  return { ...(await getBatch(batchId)), workspace: await getWorkspace() };
}

export async function PATCH(request: Request) {
  const access = await authorizeApiRequest(request, {
    permission: 'manage_imports',
  });
  if (!access.ok) return access.response;
  try {
    await ensureWorkspaceDatabase();
    const input = actionSchema.parse(await request.json());
    const result =
      input.action === 'remap'
        ? await remapBatch(input.batchId, input.mapping, access.actor.name)
        : input.action === 'resolve'
          ? await resolveRows(
              input.batchId,
              input.rowIds,
              input.decision,
              access.actor.name,
            )
          : input.action === 'commit'
            ? await commitBatch(input.batchId, access.actor.name)
            : await rollbackBatch(
                input.batchId,
                access.actor.name,
                input.reason,
              );
    return Response.json(result);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Unable to update the import batch.';
    const conflict =
      /duplicate|changed after preview|linked records|documents or amendments/i.test(
        message,
      );
    return Response.json({ error: message }, { status: conflict ? 409 : 400 });
  }
}
