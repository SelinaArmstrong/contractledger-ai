import { z } from 'zod';
import {
  buildSupplierRiskProfiles,
  contractRegisterQuery,
  normalizeSupplierRow,
  orderedRows,
  supplierRegisterQuery,
  supplierRiskProfile,
} from '@/lib/server/register-data';
import type {
  RegisterDetail,
  RegisterOptions,
  RegisterPage,
  RegisterRow,
  RegisterScope,
} from '@/lib/registers';
import { isIsoDate } from '@/lib/validation';

const filters = {
  contracts: {
    contract_type: 'contract_type',
    supplier_name: 'supplier_name',
    department: 'department',
    status: 'status',
  },
  suppliers: {
    relationship_stage: 'relationship_stage',
    status: 'status',
    qualification_status:
      "CASE WHEN has_expired_compliance = 1 THEN 'expired' ELSE qualification_status END",
    category: 'category',
    state: 'state',
    w9_status: 'w9_status',
    insurance_status:
      "CASE WHEN insurance_expiration < date('now') THEN 'expired' ELSE COALESCE(NULLIF(insurance_status, ''), 'missing') END",
  },
};

const searchFields = {
  contracts: [
    'contract_number',
    'title',
    'supplier_name',
    'contract_type',
    'department',
    'owner',
    'status',
    'effective_date',
    'expiration_date',
    'payment_terms',
    'governing_law',
  ],
  suppliers: [
    'vendor_number',
    'legal_name',
    'dba_name',
    'category',
    'status',
    'primary_contact',
    'email',
    'phone',
    'city',
    'state',
    'tax_classification',
    'risk_tier',
    'qualification_status',
    'relationship_stage',
    'linked_contracts',
    'linked_intakes',
  ],
};
const searchAmount = {
  contracts: 'current_value_cents',
  suppliers: 'total_contract_value_cents',
};
const queries = {
  contracts: contractRegisterQuery,
  suppliers: supplierRegisterQuery,
};
const pageOrder = {
  contracts: 'last_updated DESC, id',
  suppliers: 'legal_name, id',
};

const pageSchema = z.coerce.number().int().min(1).max(1_000_000).default(1);
const pageSizeSchema = z.coerce
  .number()
  .refine((size) => [20, 50, 100].includes(size))
  .default(20);

async function portfolioValue(db: D1Database) {
  const row = await db
    .prepare(`SELECT COALESCE(SUM(current_value_cents), 0) AS cents
    FROM contracts WHERE status IN ('executed', 'active')`)
    .first<{ cents: number }>();
  return row?.cents ?? 0;
}

export async function getRegisterOptions(db: D1Database, scope: RegisterScope) {
  const fields = Object.entries(filters[scope]);
  const columns = fields
    .map(
      ([key, expression]) =>
        `json_group_array(DISTINCT ${expression}) AS ${key}`,
    )
    .join(', ');
  const row = await db
    .prepare(`SELECT ${columns} FROM (${queries[scope].select})`)
    .first<Record<string, string>>();

  return Object.fromEntries(
    fields.map(([key]) => [
      key,
      (JSON.parse(row?.[key] ?? '[]') as Array<string | null>)
        .filter((value): value is string =>
          Boolean(value && value !== 'Not found'),
        )
        .sort((left, right) => left.localeCompare(right)),
    ]),
  ) satisfies RegisterOptions;
}

export async function getRegisterRecord(
  db: D1Database,
  scope: RegisterScope,
  id: string,
): Promise<RegisterDetail> {
  const contract =
    scope === 'contracts'
      ? await db
          .prepare(`${contractRegisterQuery.select} WHERE c.id = ?`)
          .bind(id)
          .first<RegisterRow>()
      : null;
  const supplierId = scope === 'suppliers' ? id : contract?.supplier_id;
  const supplier = supplierId
    ? await db
        .prepare(`${supplierRegisterQuery.select} WHERE s.id = ?`)
        .bind(supplierId)
        .first<RegisterRow>()
    : null;
  let risk = null;
  if (supplier) {
    const asOfDate = new Date().toISOString().slice(0, 10);
    normalizeSupplierRow(supplier, asOfDate);
    risk = supplierRiskProfile(supplier, await portfolioValue(db), asOfDate);
  }

  return { contract, supplier, supplierRiskProfile: risk };
}

export async function getRegisterPage(
  db: D1Database,
  scope: RegisterScope,
  params: URLSearchParams,
  analysisLimit?: number,
): Promise<RegisterPage> {
  const requestedPage = analysisLimit
    ? 1
    : pageSchema.parse(params.get('page') ?? undefined);
  const pageSize =
    analysisLimit ?? pageSizeSchema.parse(params.get('pageSize') ?? undefined);
  const search = params.get('search')?.trim().toLowerCase() ?? '';
  // SQLite lower() folds ASCII. Keep the existing JavaScript case folding for
  // international queries while still narrowing by the structured SQL filters.
  const unicodeSearch = Array.from(search).some(
    (character) => character.charCodeAt(0) > 127,
  );
  const risk = scope === 'suppliers' ? params.get('risk') : null;
  const riskFilter = risk === 'all' ? null : risk;
  const predicates: string[] = [];
  const bindings: Array<string | number> = [];
  const compare = (
    column: string,
    operator: string,
    value: string | number,
  ) => {
    predicates.push(`${column} ${operator} ?`);
    bindings.push(value);
  };

  for (const [key, expression] of Object.entries(filters[scope])) {
    const value = params.get(key);
    if (value && value !== 'all') compare(expression, '=', value);
  }
  if (scope === 'contracts') {
    const amount = Number(params.get('amountValue') ?? '');
    const comparison = params.get('amountComparison');
    if (
      Number.isFinite(amount) &&
      (comparison === 'greater' || comparison === 'less')
    ) {
      compare(
        'COALESCE(current_value_cents, 0)',
        comparison === 'greater' ? '>' : '<',
        amount * 100,
      );
    }
    for (const [key, column] of [
      ['effective', 'effective_date'],
      ['expiration', 'expiration_date'],
    ]) {
      const date = params.get(`${key}Date`);
      const condition = params.get(`${key}Condition`);
      if (
        date &&
        isIsoDate(date) &&
        (condition === 'on_or_before' || condition === 'on_or_after')
      ) {
        predicates.push(`${column} != ''`);
        compare(column, condition === 'on_or_before' ? '<=' : '>=', date);
      }
    }
  } else {
    const expiry = params.get('documentExpiry');
    if (expiry === 'expiring_90_days')
      predicates.push(
        "next_compliance_expiration BETWEEN date('now') AND date('now', '+90 days')",
      );
    if (expiry === 'expired') predicates.push('has_expired_compliance = 1');
    if (expiry === 'no_expiration')
      predicates.push(
        'next_compliance_expiration IS NULL AND has_expired_compliance = 0',
      );
  }

  if (search && !unicodeSearch) {
    const fields = searchFields[scope].map((column) => {
      const expression =
        'qualification_status' === column && scope === 'suppliers'
          ? filters.suppliers.qualification_status
          : column;
      return `COALESCE(${expression}, '')`;
    });
    const cents = searchAmount[scope];
    fields.push(`CASE WHEN ${cents} IS NULL THEN ''
      ELSE RTRIM(RTRIM(PRINTF('%.2f', ${cents} / 100.0), '0'), '.') END`);
    predicates.push(`INSTR(LOWER(${fields.join(" || ' ' || ")}), ?) > 0`);
    bindings.push(search);
  }

  const source = `FROM (${queries[scope].select})${predicates.length ? ` WHERE ${predicates.join(' AND ')}` : ''}`;
  const today = new Date().toISOString().slice(0, 10);
  const totals = db
    .prepare(`SELECT COUNT(*) AS count FROM ${scope}`)
    .first<{ count: number }>();
  const portfolio =
    scope === 'suppliers' && (!analysisLimit || riskFilter)
      ? portfolioValue(db)
      : Promise.resolve(0);
  const fetchRows = (size: number, offset: number) =>
    db
      .prepare(
        `SELECT * ${source} ORDER BY ${pageOrder[scope]} LIMIT ? OFFSET ?`,
      )
      .bind(...bindings, size, offset)
      .all<RegisterRow>();
  const pageFor = (count: number) =>
    Math.min(requestedPage, Math.max(1, Math.ceil(count / pageSize)));
  const totalCount = (await totals)?.count ?? 0;

  if (unicodeSearch || riskFilter) {
    const portfolioCents = await portfolio;
    const rows: RegisterRow[] = [];
    const riskProfiles: RegisterPage['riskProfiles'] = {};
    let matchCount = 0;
    const start = (requestedPage - 1) * pageSize;
    const scanSize = 200;
    // Scored risk is calculated from the same factors as the supplier detail
    // panel. Scan candidates in bounded batches so the score has one source.
    for (let offset = 0; ; offset += scanSize) {
      const { results } = await fetchRows(scanSize, offset);
      for (const row of results) {
        if (scope === 'suppliers') normalizeSupplierRow(row, today);
        if (
          unicodeSearch &&
          ![
            ...searchFields[scope].map((column) => row[column]),
            typeof row[searchAmount[scope]] === 'number'
              ? Number(row[searchAmount[scope]]) / 100
              : '',
          ]
            .join(' ')
            .toLowerCase()
            .includes(search)
        )
          continue;
        const profile =
          scope === 'suppliers' && (!analysisLimit || riskFilter)
            ? supplierRiskProfile(row, portfolioCents, today)
            : null;
        if (riskFilter && profile?.level !== riskFilter) continue;
        if (matchCount >= start && matchCount < start + pageSize) {
          rows.push(row);
          if (profile && !analysisLimit) riskProfiles[String(row.id)] = profile;
        }
        matchCount += 1;
      }
      if (results.length < scanSize) break;
    }
    const page = pageFor(matchCount);
    if (page !== requestedPage) {
      const corrected = new URLSearchParams(params);
      corrected.set('page', String(page));
      return getRegisterPage(db, scope, corrected, analysisLimit);
    }
    return { rows, matchCount, totalCount, page, riskProfiles };
  }

  const matchCount = predicates.length
    ? ((
        await db
          .prepare(`SELECT COUNT(*) AS count ${source}`)
          .bind(...bindings)
          .first<{ count: number }>()
      )?.count ?? 0)
    : totalCount;
  const page = pageFor(matchCount);
  const { results: rows } = await fetchRows(pageSize, (page - 1) * pageSize);
  let riskProfiles = {};
  if (scope === 'suppliers') {
    if (analysisLimit) rows.forEach((row) => normalizeSupplierRow(row, today));
    else riskProfiles = buildSupplierRiskProfiles(rows, await portfolio, today);
  }
  return { rows, matchCount, totalCount, page, riskProfiles };
}

export async function getRegisterRowsByIds(
  db: D1Database,
  scope: RegisterScope,
  ids: string[],
  bySupplier = false,
) {
  const { select, order } = queries[scope];
  const key =
    scope === 'suppliers' ? 's.id' : bySupplier ? 'c.supplier_id' : 'c.id';
  const { results } = await db
    .prepare(
      orderedRows({
        select: `${select} WHERE ${key} IN (SELECT value FROM json_each(?))`,
        order,
      }),
    )
    .bind(JSON.stringify(ids))
    .all<RegisterRow>();
  if (scope === 'suppliers') {
    const today = new Date().toISOString().slice(0, 10);
    results.forEach((row) => normalizeSupplierRow(row, today));
  }
  return results;
}
