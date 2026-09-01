import type { Workspace } from '@/lib/contract-ledger-types';

export const assistantEntities = [
  'contracts',
  'suppliers',
  'obligations',
  'intakes',
] as const;

export const assistantOperators = [
  'equals',
  'not_equals',
  'contains',
  'greater_than',
  'at_least',
  'less_than',
  'at_most',
  'before',
  'on_or_before',
  'after',
  'on_or_after',
  'within_next_days',
  'is_missing',
  'is_not_missing',
] as const;

export type AssistantEntity = (typeof assistantEntities)[number];
export type AssistantOperator = (typeof assistantOperators)[number];

export type AssistantFilter = {
  field: string;
  operator: AssistantOperator;
  value: string | number | null;
  label: string;
};

export type AssistantQueryPlan = {
  entity: AssistantEntity;
  intent: 'list' | 'count' | 'summarize';
  filters: AssistantFilter[];
  filterLogic: 'all' | 'any';
  sort: {
    field: string;
    direction: 'ascending' | 'descending';
  } | null;
  limit: number;
  interpretation: string;
};

export type AssistantResultRecord = {
  id: string;
  entityType: AssistantEntity;
  title: string;
  subtitle: string;
  status: string;
  amountCents: number | null;
  date: string | null;
  openTarget: {
    type: 'contract' | 'supplier' | 'intake';
    id: string;
  } | null;
  details: Array<{ label: string; value: string }>;
};

export type AssistantQueryExecution = {
  entity: AssistantEntity;
  matchedCount: number;
  returnedCount: number;
  totalValueCents: number | null;
  records: AssistantResultRecord[];
};

export type AssistantResponse = {
  answer: string;
  resultContext: string[];
  suggestedFollowUps: string[];
  plan: AssistantQueryPlan;
  execution: AssistantQueryExecution;
  model: string;
  generatedAt: string;
};

const allowedFields: Record<AssistantEntity, ReadonlySet<string>> = {
  contracts: new Set([
    'contract_number',
    'title',
    'supplier_name',
    'contract_type',
    'department',
    'owner',
    'status',
    'current_value_cents',
    'effective_date',
    'expiration_date',
    'renewal_type',
    'notice_deadline',
    'payment_terms',
    'governing_law',
  ]),
  suppliers: new Set([
    'vendor_number',
    'legal_name',
    'category',
    'status',
    'state',
    'risk_tier',
    'qualification_status',
    'w9_status',
    'insurance_status',
    'insurance_expiration',
    'relationship_stage',
    'total_contract_value_cents',
    'linked_contracts',
    'linked_intakes',
  ]),
  obligations: new Set([
    'type',
    'item_type',
    'title',
    'due_date',
    'status',
    'review_status',
    'owner',
    'supplier_name',
    'contract_number',
  ]),
  intakes: new Set([
    'intake_number',
    'title',
    'proposed_supplier_name',
    'contract_type',
    'proposed_value_cents',
    'status',
    'review_status',
    'owner',
    'target_review_date',
    'risk_level',
    'approval_status',
    'required_approval',
  ]),
};

export function getAssistantAllowedFields(entity: AssistantEntity) {
  return [...allowedFields[entity]];
}

function stringValue(value: unknown) {
  if (value === null || value === undefined) return '';
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  )
    return String(value);
  return '';
}

function numberValue(value: unknown) {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function compareDate(value: unknown, expected: unknown) {
  const actualDate = stringValue(value);
  const expectedDate = stringValue(expected);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(actualDate)) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expectedDate)) return null;
  return actualDate.localeCompare(expectedDate);
}

function addDays(date: string, days: number) {
  const parsed = new Date(`${date}T00:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

function matchesFilter(
  entity: AssistantEntity,
  record: Record<string, string | number | null>,
  filter: AssistantFilter,
  today: string,
) {
  const actual = record[filter.field];
  const normalizedActual = stringValue(actual).trim().toLowerCase();
  let normalizedExpected = stringValue(filter.value).trim().toLowerCase();
  if (
    filter.field === 'status' &&
    (entity === 'contracts' || entity === 'suppliers') &&
    ['effective', 'valid', 'current', 'in force', '有效', '生效'].includes(
      normalizedExpected,
    )
  ) {
    normalizedExpected = 'active';
  }
  switch (filter.operator) {
    case 'equals':
      return normalizedActual === normalizedExpected;
    case 'not_equals':
      return normalizedActual !== normalizedExpected;
    case 'contains':
      return normalizedActual.includes(normalizedExpected);
    case 'greater_than':
      return numberValue(actual) > numberValue(filter.value);
    case 'at_least':
      return numberValue(actual) >= numberValue(filter.value);
    case 'less_than':
      return numberValue(actual) < numberValue(filter.value);
    case 'at_most':
      return numberValue(actual) <= numberValue(filter.value);
    case 'before':
      return (compareDate(actual, filter.value) ?? 1) < 0;
    case 'on_or_before':
      return (compareDate(actual, filter.value) ?? 1) <= 0;
    case 'after':
      return (compareDate(actual, filter.value) ?? -1) > 0;
    case 'on_or_after':
      return (compareDate(actual, filter.value) ?? -1) >= 0;
    case 'within_next_days': {
      const days = Math.max(0, Math.min(3_650, numberValue(filter.value)));
      const comparisonToToday = compareDate(actual, today);
      const comparisonToEnd = compareDate(actual, addDays(today, days));
      return (
        comparisonToToday !== null &&
        comparisonToEnd !== null &&
        comparisonToToday >= 0 &&
        comparisonToEnd <= 0
      );
    }
    case 'is_missing':
      return (
        !normalizedActual ||
        normalizedActual === 'missing' ||
        normalizedActual === 'not found'
      );
    case 'is_not_missing':
      return (
        Boolean(normalizedActual) &&
        normalizedActual !== 'missing' &&
        normalizedActual !== 'not found'
      );
  }
}

function normalizeObligations(
  workspace: Workspace,
): Array<Record<string, string | number | null>> {
  const obligationCategory = (value: unknown) => {
    const normalized = stringValue(value).toLowerCase();
    return normalized.includes('insurance') ? 'insurance' : normalized;
  };
  const keyDateIdentity = new Set(
    workspace.keyDates.map((item) =>
      [
        stringValue(item.supplier_id),
        obligationCategory(item.type),
        stringValue(item.due_date),
      ].join('|'),
    ),
  );
  const keyDates = workspace.keyDates.map((item) => ({
    ...item,
    id: String(item.id),
    item_type: String(item.type ?? ''),
    review_status: String(item.status ?? ''),
    record_kind: 'contract_obligation',
  }));
  const supplierAlerts = workspace.supplierAlerts
    .filter(
      (item) =>
        !keyDateIdentity.has(
          [
            stringValue(item.supplier_id),
            obligationCategory(item.item_type),
            stringValue(item.due_date),
          ].join('|'),
        ),
    )
    .map((item) => ({
      ...item,
      id: String(item.alert_id),
      type: String(item.item_type ?? ''),
      status: String(item.review_status ?? ''),
      owner: null,
      contract_number: null,
      record_kind: 'supplier_qualification',
    }));
  return [...keyDates, ...supplierAlerts];
}

function sourceRecords(
  workspace: Workspace,
  entity: AssistantEntity,
): Array<Record<string, string | number | null>> {
  if (entity === 'contracts') return workspace.contracts;
  if (entity === 'suppliers') return workspace.suppliers;
  if (entity === 'intakes') return workspace.intakes;
  return normalizeObligations(workspace);
}

function resultRecord(
  entity: AssistantEntity,
  record: Record<string, string | number | null>,
): AssistantResultRecord {
  if (entity === 'contracts') {
    return {
      id: String(record.id),
      entityType: entity,
      title: stringValue(record.title) || 'Untitled contract',
      subtitle: [record.contract_number, record.supplier_name]
        .filter(Boolean)
        .join(' · '),
      status: stringValue(record.status),
      amountCents: numberValue(record.current_value_cents),
      date: stringValue(record.expiration_date) || null,
      openTarget: { type: 'contract', id: String(record.id) },
      details: [
        { label: 'Type', value: stringValue(record.contract_type) },
        { label: 'Renewal', value: stringValue(record.renewal_type) },
        {
          label: 'Notice deadline',
          value: stringValue(record.notice_deadline),
        },
        { label: 'Owner', value: stringValue(record.owner) },
      ],
    };
  }
  if (entity === 'suppliers') {
    return {
      id: String(record.id),
      entityType: entity,
      title: stringValue(record.legal_name) || 'Unnamed supplier',
      subtitle: [record.vendor_number, record.category]
        .filter(Boolean)
        .join(' · '),
      status: stringValue(record.status),
      amountCents: numberValue(record.total_contract_value_cents),
      date: stringValue(record.insurance_expiration) || null,
      openTarget: { type: 'supplier', id: String(record.id) },
      details: [
        {
          label: 'Qualification',
          value: stringValue(record.qualification_status),
        },
        { label: 'W-9', value: stringValue(record.w9_status) },
        { label: 'Insurance', value: stringValue(record.insurance_status) },
        {
          label: 'Contracts',
          value: stringValue(record.linked_contracts) || '0',
        },
      ],
    };
  }
  if (entity === 'intakes') {
    return {
      id: String(record.id),
      entityType: entity,
      title: stringValue(record.title) || 'Untitled intake',
      subtitle: [record.intake_number, record.proposed_supplier_name]
        .filter(Boolean)
        .join(' · '),
      status: stringValue(record.status),
      amountCents: numberValue(record.proposed_value_cents),
      date: stringValue(record.target_review_date) || null,
      openTarget: { type: 'intake', id: String(record.id) },
      details: [
        { label: 'Risk', value: stringValue(record.risk_level) },
        { label: 'Approval', value: stringValue(record.approval_status) },
        {
          label: 'Required gate',
          value: stringValue(record.required_approval),
        },
        { label: 'Owner', value: stringValue(record.owner) },
      ],
    };
  }

  const contractId = stringValue(record.contract_id);
  const supplierId = stringValue(record.supplier_id);
  return {
    id: String(record.id),
    entityType: entity,
    title: stringValue(record.title) || 'Operational obligation',
    subtitle: [record.contract_number, record.supplier_name]
      .filter(Boolean)
      .join(' · '),
    status: stringValue(record.status || record.review_status),
    amountCents:
      record.current_value_cents === null ||
      record.current_value_cents === undefined
        ? null
        : numberValue(record.current_value_cents),
    date: stringValue(record.due_date) || null,
    openTarget: contractId
      ? { type: 'contract', id: contractId }
      : supplierId
        ? { type: 'supplier', id: supplierId }
        : null,
    details: [
      { label: 'Category', value: stringValue(record.record_kind) },
      { label: 'Type', value: stringValue(record.type || record.item_type) },
      { label: 'Due date', value: stringValue(record.due_date) },
      { label: 'Owner', value: stringValue(record.owner) },
    ],
  };
}

export function executeAssistantQuery(
  workspace: Workspace,
  plan: AssistantQueryPlan,
  today = new Date().toISOString().slice(0, 10),
): AssistantQueryExecution {
  for (const filter of plan.filters) {
    if (!allowedFields[plan.entity].has(filter.field))
      throw new Error(
        `Unsupported ${plan.entity} filter field: ${filter.field}`,
      );
  }
  if (plan.sort && !allowedFields[plan.entity].has(plan.sort.field))
    throw new Error(
      `Unsupported ${plan.entity} sort field: ${plan.sort.field}`,
    );

  const matched = sourceRecords(workspace, plan.entity).filter((record) => {
    if (!plan.filters.length) return true;
    const matches = (filter: AssistantFilter) =>
      matchesFilter(plan.entity, record, filter, today);
    return plan.filterLogic === 'any'
      ? plan.filters.some(matches)
      : plan.filters.every(matches);
  });
  if (plan.sort) {
    const direction = plan.sort.direction === 'descending' ? -1 : 1;
    matched.sort((left, right) => {
      const leftValue = left[plan.sort!.field];
      const rightValue = right[plan.sort!.field];
      if (typeof leftValue === 'number' || typeof rightValue === 'number')
        return (numberValue(leftValue) - numberValue(rightValue)) * direction;
      return (
        stringValue(leftValue).localeCompare(stringValue(rightValue)) *
        direction
      );
    });
  }

  const amountField =
    plan.entity === 'contracts'
      ? 'current_value_cents'
      : plan.entity === 'suppliers'
        ? 'total_contract_value_cents'
        : plan.entity === 'intakes'
          ? 'proposed_value_cents'
          : null;
  const totalValueCents = amountField
    ? matched.reduce((sum, item) => sum + numberValue(item[amountField]), 0)
    : null;
  const limit = Math.max(1, Math.min(50, Math.round(plan.limit || 20)));
  const records = matched
    .slice(0, limit)
    .map((record) => resultRecord(plan.entity, record));

  return {
    entity: plan.entity,
    matchedCount: matched.length,
    returnedCount: records.length,
    totalValueCents,
    records,
  };
}
