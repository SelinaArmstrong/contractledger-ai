import { normalizeSupplierName } from '@/lib/supplier-qualification';

export const IMPORT_MAPPING_VERSION = '2026.1';
export const IMPORT_TARGETS = ['suppliers', 'contracts'] as const;
export type ImportTarget = (typeof IMPORT_TARGETS)[number];
export type ImportRowStatus = 'ready' | 'warning' | 'duplicate' | 'invalid';
export type ImportDecision = 'pending' | 'accept' | 'skip';

export type ImportFieldDefinition = {
  key: string;
  label: string;
  required: boolean;
  aliases: readonly string[];
};

export type ImportIssue = {
  code: string;
  severity: 'warning' | 'error';
  message: string;
};

export type ExistingImportData = {
  suppliers: Array<{
    id: string;
    legalName: string;
    normalizedName: string;
    vendorNumber?: string | null;
  }>;
  contracts: Array<{
    id: string;
    contractNumber: string;
    supplierId: string;
    title: string;
  }>;
};

export type ImportPreviewRow = {
  rowNumber: number;
  raw: Record<string, string>;
  normalized: Record<string, string | number | null>;
  status: ImportRowStatus;
  decision: ImportDecision;
  issues: ImportIssue[];
  duplicateRecordId: string | null;
  duplicateType: 'exact' | 'possible' | null;
};

export type ImportBatchMetricInput = {
  status: 'preview' | 'committed' | 'rolled_back';
  totalRows: number;
  acceptedRows: number;
  rejectedRows: number;
  normalizationIssueCount: number;
  createdAt: string;
  committedAt: string | null;
};

export type ImportPortfolioMetrics = {
  batchCount: number;
  completedBatchCount: number;
  assessedRowCount: number;
  finalizedRowCount: number;
  acceptedRowCount: number;
  rejectedRowCount: number;
  acceptanceRate: number | null;
  rejectionRate: number | null;
  duplicateCandidateCount: number;
  normalizationIssueCount: number;
  medianMigrationMinutes: number | null;
  migrationDurationSampleSize: number;
};

const supplierFields: readonly ImportFieldDefinition[] = [
  {
    key: 'legal_name',
    label: 'Supplier Legal Name',
    required: true,
    aliases: [
      'supplier name',
      'vendor name',
      'legal name',
      'vendor legal name',
    ],
  },
  {
    key: 'vendor_number',
    label: 'Vendor Number',
    required: false,
    aliases: ['vendor id', 'supplier id', 'vendor no', 'vendor #'],
  },
  {
    key: 'dba_name',
    label: 'DBA Name',
    required: false,
    aliases: ['dba', 'trade name'],
  },
  {
    key: 'category',
    label: 'Category',
    required: true,
    aliases: ['supplier category', 'vendor category', 'commodity'],
  },
  {
    key: 'status',
    label: 'Status',
    required: false,
    aliases: ['supplier status', 'vendor status'],
  },
  {
    key: 'primary_contact',
    label: 'Primary Contact',
    required: false,
    aliases: ['contact', 'contact name'],
  },
  {
    key: 'email',
    label: 'Email',
    required: false,
    aliases: ['contact email', 'email address'],
  },
  {
    key: 'phone',
    label: 'Phone',
    required: false,
    aliases: ['telephone', 'contact phone'],
  },
  {
    key: 'address_line_1',
    label: 'Address Line 1',
    required: false,
    aliases: ['address', 'street address', 'address 1'],
  },
  { key: 'city', label: 'City', required: false, aliases: ['supplier city'] },
  {
    key: 'state',
    label: 'State',
    required: false,
    aliases: ['province', 'state/province'],
  },
  {
    key: 'postal_code',
    label: 'Postal Code',
    required: false,
    aliases: ['zip', 'zip code', 'postcode'],
  },
  {
    key: 'country',
    label: 'Country',
    required: false,
    aliases: ['country code'],
  },
  {
    key: 'risk_tier',
    label: 'Risk Tier',
    required: false,
    aliases: ['risk', 'supplier risk', 'risk level'],
  },
  {
    key: 'w9_status',
    label: 'W-9 Status',
    required: false,
    aliases: ['w9', 'w-9', 'tax form status'],
  },
  {
    key: 'insurance_status',
    label: 'Insurance Status',
    required: false,
    aliases: ['insurance', 'coi status'],
  },
  {
    key: 'insurance_expiration',
    label: 'Insurance Expiration',
    required: false,
    aliases: [
      'insurance expiry',
      'coi expiration',
      'insurance expiration date',
    ],
  },
] as const;

const contractFields: readonly ImportFieldDefinition[] = [
  {
    key: 'contract_number',
    label: 'Contract Number',
    required: true,
    aliases: [
      'contract id',
      'agreement number',
      'agreement id',
      'contract no',
      'contract #',
    ],
  },
  {
    key: 'supplier_legal_name',
    label: 'Supplier Legal Name',
    required: true,
    aliases: ['supplier name', 'vendor name', 'counterparty'],
  },
  {
    key: 'title',
    label: 'Contract Title',
    required: true,
    aliases: ['agreement title', 'title', 'contract name'],
  },
  {
    key: 'contract_type',
    label: 'Contract Type',
    required: true,
    aliases: ['agreement type', 'type'],
  },
  {
    key: 'department',
    label: 'Department',
    required: true,
    aliases: ['business unit', 'cost center'],
  },
  {
    key: 'owner',
    label: 'Owner',
    required: true,
    aliases: ['contract owner', 'business owner'],
  },
  {
    key: 'current_value',
    label: 'Current Value (USD)',
    required: true,
    aliases: [
      'contract value',
      'value',
      'amount',
      'total value',
      'current value',
    ],
  },
  {
    key: 'effective_date',
    label: 'Effective Date',
    required: true,
    aliases: ['start date', 'commencement date'],
  },
  {
    key: 'expiration_date',
    label: 'Expiration Date',
    required: false,
    aliases: ['end date', 'expiry date', 'termination date'],
  },
  {
    key: 'renewal_type',
    label: 'Renewal Type',
    required: false,
    aliases: ['renewal', 'auto renewal'],
  },
  {
    key: 'notice_days',
    label: 'Notice Days',
    required: false,
    aliases: ['notice period', 'notice period days'],
  },
  {
    key: 'payment_terms',
    label: 'Payment Terms',
    required: false,
    aliases: ['terms', 'invoice terms'],
  },
  {
    key: 'governing_law',
    label: 'Governing Law',
    required: false,
    aliases: ['jurisdiction', 'governing state'],
  },
  {
    key: 'status',
    label: 'Status',
    required: false,
    aliases: ['contract status', 'agreement status'],
  },
] as const;

export const IMPORT_FIELDS: Record<
  ImportTarget,
  readonly ImportFieldDefinition[]
> = {
  suppliers: supplierFields,
  contracts: contractFields,
};

export const IMPORT_TEMPLATE_ROWS: Record<
  ImportTarget,
  Record<string, string>[]
> = {
  suppliers: [
    {
      legal_name: 'Redwood Office Supply LLC',
      vendor_number: 'VND-1042',
      dba_name: 'Redwood Office Supply',
      category: 'Office Supplies',
      status: 'Active',
      primary_contact: 'Jamie Chen',
      email: 'jamie@example.com',
      phone: '415-555-0142',
      address_line_1: '100 Market Street',
      city: 'San Francisco',
      state: 'California',
      postal_code: '94105',
      country: 'United States',
      risk_tier: 'Low',
      w9_status: 'Received',
      insurance_status: 'Current',
      insurance_expiration: '12/31/2027',
    },
  ],
  contracts: [
    {
      contract_number: 'CT-2026-1042',
      supplier_legal_name: 'Redwood Office Supply LLC',
      title: 'Office Supply Agreement',
      contract_type: 'Supply Agreement',
      department: 'Operations',
      owner: 'Jamie Chen',
      current_value: '$125,000.00',
      effective_date: '01/01/2026',
      expiration_date: '12/31/2027',
      renewal_type: 'Automatic',
      notice_days: '60',
      payment_terms: 'Net 30',
      governing_law: 'California',
      status: 'Active',
    },
  ],
};

function headerKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function autoMapImportHeaders(
  target: ImportTarget,
  headers: readonly string[],
) {
  const lookup = new Map(headers.map((header) => [headerKey(header), header]));
  return Object.fromEntries(
    IMPORT_FIELDS[target].map((field) => {
      const candidates = [field.key, field.label, ...field.aliases];
      const match = candidates
        .map(headerKey)
        .map((key) => lookup.get(key))
        .find(Boolean);
      return [field.key, match ?? ''];
    }),
  ) as Record<string, string>;
}

function cleanText(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

function normalizeEnum(
  value: string,
  aliases: Record<string, string>,
  fallback: string,
) {
  const normalized = headerKey(value);
  return aliases[normalized] ?? fallback;
}

const stateCodes: Record<string, string> = Object.fromEntries(
  [
    ['alabama', 'AL'],
    ['alaska', 'AK'],
    ['arizona', 'AZ'],
    ['arkansas', 'AR'],
    ['california', 'CA'],
    ['colorado', 'CO'],
    ['connecticut', 'CT'],
    ['delaware', 'DE'],
    ['florida', 'FL'],
    ['georgia', 'GA'],
    ['hawaii', 'HI'],
    ['idaho', 'ID'],
    ['illinois', 'IL'],
    ['indiana', 'IN'],
    ['iowa', 'IA'],
    ['kansas', 'KS'],
    ['kentucky', 'KY'],
    ['louisiana', 'LA'],
    ['maine', 'ME'],
    ['maryland', 'MD'],
    ['massachusetts', 'MA'],
    ['michigan', 'MI'],
    ['minnesota', 'MN'],
    ['mississippi', 'MS'],
    ['missouri', 'MO'],
    ['montana', 'MT'],
    ['nebraska', 'NE'],
    ['nevada', 'NV'],
    ['new hampshire', 'NH'],
    ['new jersey', 'NJ'],
    ['new mexico', 'NM'],
    ['new york', 'NY'],
    ['north carolina', 'NC'],
    ['north dakota', 'ND'],
    ['ohio', 'OH'],
    ['oklahoma', 'OK'],
    ['oregon', 'OR'],
    ['pennsylvania', 'PA'],
    ['rhode island', 'RI'],
    ['south carolina', 'SC'],
    ['south dakota', 'SD'],
    ['tennessee', 'TN'],
    ['texas', 'TX'],
    ['utah', 'UT'],
    ['vermont', 'VT'],
    ['virginia', 'VA'],
    ['washington', 'WA'],
    ['west virginia', 'WV'],
    ['wisconsin', 'WI'],
    ['wyoming', 'WY'],
    ['district of columbia', 'DC'],
    ['washington dc', 'DC'],
  ].flatMap(([name, code]) => [
    [name, code],
    [code.toLowerCase(), code],
  ]),
);

export function normalizeImportDate(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const parsed = new Date(`${trimmed}T00:00:00Z`);
    return Number.isNaN(parsed.valueOf()) ||
      parsed.toISOString().slice(0, 10) !== trimmed
      ? null
      : trimmed;
  }
  const match = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (!match) return null;
  const iso = `${match[3]}-${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}`;
  const parsed = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(parsed.valueOf()) ||
    parsed.toISOString().slice(0, 10) !== iso
    ? null
    : iso;
}

export function normalizeCurrencyToCents(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const negative = /^\(.*\)$/.test(trimmed);
  const numberText = trimmed.replace(/[,$()\sUSD]/gi, '');
  if (!/^-?\d+(?:\.\d{1,2})?$/.test(numberText)) return null;
  const amount = Number(numberText);
  if (!Number.isFinite(amount)) return null;
  return Math.round((negative ? -Math.abs(amount) : amount) * 100);
}

function similarity(left: string, right: string) {
  const a = new Set(left.split(' ').filter(Boolean));
  const b = new Set(right.split(' ').filter(Boolean));
  const intersection = [...a].filter((token) => b.has(token)).length;
  const union = new Set([...a, ...b]).size;
  return union ? intersection / union : 0;
}

function formulaIssue(raw: Record<string, string>): ImportIssue | null {
  const risky = Object.entries(raw).find(([, value]) =>
    /^[=+@-]/.test(value.trim()),
  );
  return risky
    ? {
        code: 'formula_injection',
        severity: 'error',
        message: `${risky[0]} begins with a spreadsheet formula character.`,
      }
    : null;
}

function mappedValue(
  raw: Record<string, string>,
  mapping: Record<string, string>,
  field: string,
) {
  const header = mapping[field];
  return header ? cleanText(raw[header] ?? '') : '';
}

function normalizeSupplierRow(
  raw: Record<string, string>,
  mapping: Record<string, string>,
  existing: ExistingImportData,
) {
  const issues: ImportIssue[] = [];
  const legalName = mappedValue(raw, mapping, 'legal_name');
  const normalizedName = normalizeSupplierName(legalName);
  const vendorNumber = mappedValue(raw, mapping, 'vendor_number').toUpperCase();
  const stateRaw = mappedValue(raw, mapping, 'state');
  const state = stateRaw
    ? (stateCodes[headerKey(stateRaw)] ?? stateRaw.toUpperCase())
    : null;
  const insuranceDateRaw = mappedValue(raw, mapping, 'insurance_expiration');
  const insuranceExpiration = normalizeImportDate(insuranceDateRaw);
  if (insuranceDateRaw && !insuranceExpiration)
    issues.push({
      code: 'invalid_date',
      severity: 'error',
      message: 'Insurance expiration must be a real ISO or MM/DD/YYYY date.',
    });
  const statusRaw = mappedValue(raw, mapping, 'status');
  const status = normalizeEnum(
    statusRaw,
    {
      active: 'active',
      pending: 'pending',
      inactive: 'inactive',
      suspended: 'suspended',
      archived: 'archived',
    },
    statusRaw ? '' : 'pending',
  );
  if (!status)
    issues.push({
      code: 'invalid_status',
      severity: 'error',
      message: `Unsupported supplier status: ${statusRaw}.`,
    });
  const riskRaw = mappedValue(raw, mapping, 'risk_tier');
  const riskTier = normalizeEnum(
    riskRaw,
    { low: 'low', medium: 'medium', high: 'high' },
    riskRaw ? '' : 'medium',
  );
  if (!riskTier)
    issues.push({
      code: 'invalid_risk',
      severity: 'error',
      message: `Unsupported risk tier: ${riskRaw}.`,
    });
  const w9Raw = mappedValue(raw, mapping, 'w9_status');
  const w9Status = normalizeEnum(
    w9Raw,
    {
      received: 'received',
      missing: 'missing',
      expired: 'expired',
      'not required': 'not_required',
      not_required: 'not_required',
    },
    w9Raw ? '' : 'missing',
  );
  if (!w9Status)
    issues.push({
      code: 'invalid_w9',
      severity: 'error',
      message: `Unsupported W-9 status: ${w9Raw}.`,
    });
  const insuranceRaw = mappedValue(raw, mapping, 'insurance_status');
  const insuranceStatus = normalizeEnum(
    insuranceRaw,
    {
      current: 'current',
      missing: 'missing',
      expired: 'expired',
      'not required': 'not_required',
      not_required: 'not_required',
    },
    insuranceRaw ? '' : 'missing',
  );
  if (!insuranceStatus)
    issues.push({
      code: 'invalid_insurance',
      severity: 'error',
      message: `Unsupported insurance status: ${insuranceRaw}.`,
    });
  if (!legalName || !normalizedName)
    issues.push({
      code: 'required',
      severity: 'error',
      message: 'Supplier Legal Name is required.',
    });
  const category = mappedValue(raw, mapping, 'category');
  if (!category)
    issues.push({
      code: 'required',
      severity: 'error',
      message: 'Category is required.',
    });
  const email = mappedValue(raw, mapping, 'email');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    issues.push({
      code: 'invalid_email',
      severity: 'error',
      message: 'Email address is invalid.',
    });
  const exact = existing.suppliers.find(
    (item) =>
      item.normalizedName === normalizedName ||
      (vendorNumber && item.vendorNumber?.toUpperCase() === vendorNumber),
  );
  const possible =
    !exact && normalizedName
      ? existing.suppliers.find(
          (item) => similarity(item.normalizedName, normalizedName) >= 0.6,
        )
      : undefined;
  if (exact)
    issues.push({
      code: 'exact_duplicate',
      severity: 'warning',
      message: `Exact supplier duplicate: ${exact.legalName}.`,
    });
  else if (possible)
    issues.push({
      code: 'possible_match',
      severity: 'warning',
      message: `Possible supplier match: ${possible.legalName}. Review before accepting.`,
    });
  const formula = formulaIssue(raw);
  if (formula) issues.push(formula);
  return {
    normalized: {
      legal_name: legalName,
      normalized_name: normalizedName,
      vendor_number: vendorNumber || null,
      dba_name: mappedValue(raw, mapping, 'dba_name') || null,
      category,
      status: status || null,
      primary_contact: mappedValue(raw, mapping, 'primary_contact') || null,
      email: email || null,
      phone: mappedValue(raw, mapping, 'phone') || null,
      address_line_1: mappedValue(raw, mapping, 'address_line_1') || null,
      city: mappedValue(raw, mapping, 'city') || null,
      state,
      postal_code: mappedValue(raw, mapping, 'postal_code') || null,
      country: mappedValue(raw, mapping, 'country') || 'United States',
      risk_tier: riskTier || null,
      w9_status: w9Status || null,
      insurance_status: insuranceStatus || null,
      insurance_expiration: insuranceExpiration,
    },
    issues,
    duplicateRecordId: exact?.id ?? possible?.id ?? null,
    duplicateType: exact
      ? ('exact' as const)
      : possible
        ? ('possible' as const)
        : null,
  };
}

function normalizeContractRow(
  raw: Record<string, string>,
  mapping: Record<string, string>,
  existing: ExistingImportData,
) {
  const issues: ImportIssue[] = [];
  const contractNumber = mappedValue(raw, mapping, 'contract_number')
    .toUpperCase()
    .replace(/\s+/g, '-');
  const supplierName = mappedValue(raw, mapping, 'supplier_legal_name');
  const normalizedSupplier = normalizeSupplierName(supplierName);
  const supplier = existing.suppliers.find(
    (item) => item.normalizedName === normalizedSupplier,
  );
  const possibleSupplier =
    !supplier && normalizedSupplier
      ? existing.suppliers.find(
          (item) => similarity(item.normalizedName, normalizedSupplier) >= 0.6,
        )
      : undefined;
  if (!supplierName)
    issues.push({
      code: 'required',
      severity: 'error',
      message: 'Supplier Legal Name is required.',
    });
  else if (!supplier)
    issues.push({
      code: 'unknown_supplier',
      severity: 'error',
      message: possibleSupplier
        ? `Supplier was not an exact match. Possible match: ${possibleSupplier.legalName}. Import or correct the supplier first.`
        : 'Supplier does not exist in the supplier master. Import the supplier first.',
    });
  const title = mappedValue(raw, mapping, 'title');
  for (const [field, label] of [
    ['contract_number', 'Contract Number'],
    ['title', 'Contract Title'],
    ['contract_type', 'Contract Type'],
    ['department', 'Department'],
    ['owner', 'Owner'],
  ] as const) {
    if (!mappedValue(raw, mapping, field))
      issues.push({
        code: 'required',
        severity: 'error',
        message: `${label} is required.`,
      });
  }
  const valueRaw = mappedValue(raw, mapping, 'current_value');
  const valueCents = normalizeCurrencyToCents(valueRaw);
  if (valueCents === null || valueCents < 0)
    issues.push({
      code: 'invalid_currency',
      severity: 'error',
      message: 'Current Value must be a non-negative USD amount.',
    });
  const effectiveRaw = mappedValue(raw, mapping, 'effective_date');
  const effectiveDate = normalizeImportDate(effectiveRaw);
  if (!effectiveDate)
    issues.push({
      code: 'invalid_date',
      severity: 'error',
      message: 'Effective Date must be a real ISO or MM/DD/YYYY date.',
    });
  const expirationRaw = mappedValue(raw, mapping, 'expiration_date');
  const expirationDate = expirationRaw
    ? normalizeImportDate(expirationRaw)
    : null;
  if (expirationRaw && !expirationDate)
    issues.push({
      code: 'invalid_date',
      severity: 'error',
      message: 'Expiration Date must be a real ISO or MM/DD/YYYY date.',
    });
  if (effectiveDate && expirationDate && expirationDate < effectiveDate)
    issues.push({
      code: 'date_order',
      severity: 'error',
      message: 'Expiration Date cannot precede Effective Date.',
    });
  const renewalRaw = mappedValue(raw, mapping, 'renewal_type');
  const renewalType = normalizeEnum(
    renewalRaw,
    {
      automatic: 'automatic',
      auto: 'automatic',
      optional: 'optional',
      manual: 'optional',
      none: 'none',
      no: 'none',
    },
    renewalRaw ? '' : 'none',
  );
  if (!renewalType)
    issues.push({
      code: 'invalid_renewal',
      severity: 'error',
      message: `Unsupported renewal type: ${renewalRaw}.`,
    });
  const statusRaw = mappedValue(raw, mapping, 'status');
  const status = normalizeEnum(
    statusRaw,
    {
      active: 'active',
      executed: 'executed',
      expired: 'expired',
      terminated: 'terminated',
      closed: 'closed',
    },
    statusRaw ? '' : 'active',
  );
  if (!status)
    issues.push({
      code: 'invalid_status',
      severity: 'error',
      message: `Unsupported contract status: ${statusRaw}.`,
    });
  const noticeRaw = mappedValue(raw, mapping, 'notice_days');
  const noticeDays = noticeRaw ? Number(noticeRaw) : null;
  if (
    noticeRaw &&
    (!Number.isInteger(noticeDays) ||
      Number(noticeDays) < 0 ||
      Number(noticeDays) > 3650)
  )
    issues.push({
      code: 'invalid_notice',
      severity: 'error',
      message: 'Notice Days must be a whole number from 0 to 3650.',
    });
  const exact = existing.contracts.find(
    (item) => item.contractNumber.toUpperCase() === contractNumber,
  );
  const possible =
    !exact && supplier
      ? existing.contracts.find(
          (item) =>
            item.supplierId === supplier.id &&
            similarity(
              normalizeSupplierName(item.title),
              normalizeSupplierName(title),
            ) >= 0.6,
        )
      : undefined;
  if (exact)
    issues.push({
      code: 'exact_duplicate',
      severity: 'warning',
      message: `Exact contract duplicate: ${exact.contractNumber}.`,
    });
  else if (possible)
    issues.push({
      code: 'possible_match',
      severity: 'warning',
      message: `Possible contract match: ${possible.contractNumber}. Review before accepting.`,
    });
  const formula = formulaIssue(raw);
  if (formula) issues.push(formula);
  return {
    normalized: {
      contract_number: contractNumber,
      supplier_legal_name: supplierName,
      supplier_id: supplier?.id ?? null,
      title,
      contract_type: mappedValue(raw, mapping, 'contract_type'),
      department: mappedValue(raw, mapping, 'department'),
      owner: mappedValue(raw, mapping, 'owner'),
      current_value_cents: valueCents,
      effective_date: effectiveDate,
      expiration_date: expirationDate,
      renewal_type: renewalType || null,
      notice_days: Number.isInteger(noticeDays) ? noticeDays : null,
      payment_terms: mappedValue(raw, mapping, 'payment_terms') || null,
      governing_law: mappedValue(raw, mapping, 'governing_law') || null,
      status: status || null,
    },
    issues,
    duplicateRecordId: exact?.id ?? possible?.id ?? null,
    duplicateType: exact
      ? ('exact' as const)
      : possible
        ? ('possible' as const)
        : null,
  };
}

export function previewImportRows(
  target: ImportTarget,
  rows: readonly Record<string, string>[],
  mapping: Record<string, string>,
  existing: ExistingImportData,
): ImportPreviewRow[] {
  const missingHeaders = IMPORT_FIELDS[target].filter(
    (field) => field.required && !mapping[field.key],
  );
  const seen = new Map<string, number>();
  return rows.map((raw, index) => {
    const result =
      target === 'suppliers'
        ? normalizeSupplierRow(raw, mapping, existing)
        : normalizeContractRow(raw, mapping, existing);
    const normalized = result.normalized as Record<
      string,
      string | number | null
    >;
    const withinFileKey =
      target === 'suppliers'
        ? String(normalized.normalized_name || normalized.vendor_number || '')
        : String(normalized.contract_number || '');
    const firstRow = withinFileKey ? seen.get(withinFileKey) : undefined;
    if (withinFileKey && firstRow === undefined)
      seen.set(withinFileKey, index + 2);
    const withinFileIssues: ImportIssue[] =
      firstRow === undefined
        ? []
        : [
            {
              code: 'file_duplicate',
              severity: 'warning',
              message: `Exact duplicate of source row ${firstRow} within this import file.`,
            },
          ];
    const issues = [
      ...missingHeaders.map(
        (field): ImportIssue => ({
          code: 'missing_mapping',
          severity: 'error',
          message: `${field.label} is not mapped.`,
        }),
      ),
      ...result.issues,
      ...withinFileIssues,
    ];
    const duplicateType =
      result.duplicateType ?? (firstRow === undefined ? null : 'exact');
    const status: ImportRowStatus = issues.some(
      (issue) => issue.severity === 'error',
    )
      ? 'invalid'
      : duplicateType === 'exact'
        ? 'duplicate'
        : issues.length || duplicateType === 'possible'
          ? 'warning'
          : 'ready';
    return {
      rowNumber: index + 2,
      raw,
      normalized,
      status,
      decision: 'pending',
      issues,
      duplicateRecordId: result.duplicateRecordId,
      duplicateType,
    };
  });
}

export function importPreviewSummary(
  rows: readonly Pick<ImportPreviewRow, 'status' | 'decision' | 'issues'>[],
) {
  const count = (status: ImportRowStatus) =>
    rows.filter((row) => row.status === status).length;
  return {
    total: rows.length,
    ready: count('ready'),
    warning: count('warning'),
    duplicate: count('duplicate'),
    invalid: count('invalid'),
    accepted: rows.filter((row) => row.decision === 'accept').length,
    rejected: rows.filter((row) => row.decision === 'skip').length,
    normalizationIssues: rows.reduce(
      (sum, row) =>
        sum +
        row.issues.filter(
          (issue) =>
            issue.code !== 'exact_duplicate' && issue.code !== 'possible_match',
        ).length,
      0,
    ),
  };
}

export function calculateImportPortfolioMetrics(
  batches: readonly ImportBatchMetricInput[],
  duplicateCandidateCount: number,
): ImportPortfolioMetrics {
  const completed = batches.filter(
    (batch) =>
      (batch.status === 'committed' || batch.status === 'rolled_back') &&
      batch.committedAt,
  );
  const acceptedRowCount = completed.reduce(
    (sum, batch) => sum + batch.acceptedRows,
    0,
  );
  const rejectedRowCount = completed.reduce(
    (sum, batch) => sum + batch.rejectedRows,
    0,
  );
  const finalizedRowCount = acceptedRowCount + rejectedRowCount;
  const durations = completed
    .map((batch) => {
      const started = Date.parse(batch.createdAt);
      const committed = Date.parse(batch.committedAt ?? '');
      return Number.isFinite(started) &&
        Number.isFinite(committed) &&
        committed >= started
        ? (committed - started) / 60_000
        : null;
    })
    .filter((duration): duration is number => duration !== null)
    .sort((left, right) => left - right);
  const middle = Math.floor(durations.length / 2);
  const medianMigrationMinutes = durations.length
    ? durations.length % 2
      ? durations[middle]
      : (durations[middle - 1] + durations[middle]) / 2
    : null;

  return {
    batchCount: batches.length,
    completedBatchCount: completed.length,
    assessedRowCount: batches.reduce((sum, batch) => sum + batch.totalRows, 0),
    finalizedRowCount,
    acceptedRowCount,
    rejectedRowCount,
    acceptanceRate: finalizedRowCount
      ? acceptedRowCount / finalizedRowCount
      : null,
    rejectionRate: finalizedRowCount
      ? rejectedRowCount / finalizedRowCount
      : null,
    duplicateCandidateCount,
    normalizationIssueCount: batches.reduce(
      (sum, batch) => sum + batch.normalizationIssueCount,
      0,
    ),
    medianMigrationMinutes,
    migrationDurationSampleSize: durations.length,
  };
}

export function subtractImportNoticeDays(
  expirationDate: string | null,
  noticeDays: number | null,
) {
  if (!expirationDate || noticeDays === null) return null;
  const date = new Date(`${expirationDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - noticeDays);
  return date.toISOString().slice(0, 10);
}

export function csvCell(value: unknown) {
  let text =
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
      ? String(value)
      : '';
  if (/^[=+@-]/.test(text.trim())) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
