export type ManagementInsightScope = 'contracts' | 'suppliers';

export type ManagementPriority = 'high' | 'medium' | 'low';

export type ManagementMetric = {
  key: string;
  label: string;
  value: number;
  format: 'number' | 'currency' | 'percent';
  note?: string;
};

export type ManagementAttentionItem = {
  id: string;
  entityId: string;
  entityType: 'contract' | 'supplier';
  reference: string;
  label: string;
  issue: string;
  reason: string;
  priority: ManagementPriority;
  dueDate: string | null;
  valueCents: number | null;
};

export type ManagementChart = {
  key: string;
  title: string;
  description: string;
  valueFormat: 'number' | 'currency';
  data: Array<{ label: string; value: number }>;
};

export type ManagementReport = {
  scope: ManagementInsightScope;
  asOfDate: string;
  recordCount: number;
  metrics: ManagementMetric[];
  charts: ManagementChart[];
  attentionItems: ManagementAttentionItem[];
  attentionCount: number;
  deterministicFindings: string[];
  evidenceRecords: Array<{
    id: string;
    reference: string;
    label: string;
    context: string;
  }>;
};

export type ManagementAIInsight = {
  title: string;
  explanation: string;
  supportingRecordIds: string[];
};

export type ManagementRecommendedAction = {
  action: string;
  reason: string;
  priority: ManagementPriority;
};

export type ManagementAIOutput = {
  executiveSummary: string;
  insights: ManagementAIInsight[];
  recommendedActions: ManagementRecommendedAction[];
  dataLimitations: string[];
};

export type ManagementInsightResponse = {
  runId: string;
  model: string;
  generatedAt: string;
  report: ManagementReport;
  ai: ManagementAIOutput;
};

type Row = Record<string, unknown>;

type BuildReportInput = {
  scope: ManagementInsightScope;
  contracts: Row[];
  suppliers: Row[];
  keyDates: Row[];
  supplierAlerts: Row[];
  today?: string;
};

const activeContractStatuses = new Set(['active', 'executed']);
const priorityOrder: Record<ManagementPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

function textValue(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function numberValue(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function addDays(date: string, days: number) {
  const parsed = new Date(`${date}T12:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

function daysUntil(date: string, today: string) {
  const due = new Date(`${date}T12:00:00Z`).getTime();
  const start = new Date(`${today}T12:00:00Z`).getTime();
  return Math.round((due - start) / 86_400_000);
}

function percentage(part: number, total: number) {
  return total > 0 ? Math.round((part / total) * 1000) / 10 : 0;
}

function sortAttention(items: ManagementAttentionItem[]) {
  return [...items].sort((left, right) => {
    const priorityDifference =
      priorityOrder[left.priority] - priorityOrder[right.priority];
    if (priorityDifference) return priorityDifference;
    if (left.dueDate && right.dueDate)
      return left.dueDate.localeCompare(right.dueDate);
    if (left.dueDate) return -1;
    if (right.dueDate) return 1;
    return (right.valueCents ?? 0) - (left.valueCents ?? 0);
  });
}

function groupCurrency(rows: Row[], key: string, valueKey: string, limit = 8) {
  const totals = new Map<string, number>();
  for (const row of rows) {
    const label = textValue(row[key]) || 'Not specified';
    totals.set(label, (totals.get(label) ?? 0) + numberValue(row[valueKey]));
  }
  return [...totals.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((left, right) => right.value - left.value)
    .slice(0, limit);
}

function buildContractReport(input: BuildReportInput): ManagementReport {
  const {
    contracts,
    keyDates,
    today = new Date().toISOString().slice(0, 10),
  } = input;
  const selectedIds = new Set(contracts.map((item) => String(item.id)));
  const totalValue = contracts.reduce(
    (sum, item) => sum + numberValue(item.current_value_cents),
    0,
  );
  const activeContracts = contracts.filter((item) =>
    activeContractStatuses.has(textValue(item.status)),
  );
  const expiringWithin = (days: number) => {
    const cutoff = addDays(today, days);
    return activeContracts.filter((item) => {
      const expiration = textValue(item.expiration_date);
      return expiration && expiration >= today && expiration <= cutoff;
    });
  };

  const attention: ManagementAttentionItem[] = [];
  for (const item of keyDates) {
    if (!selectedIds.has(String(item.contract_id))) continue;
    if (textValue(item.status) === 'completed') continue;
    const dueDate = textValue(item.due_date);
    const days = dueDate ? daysUntil(dueDate, today) : 999;
    const valueCents = numberValue(item.current_value_cents) || null;
    attention.push({
      id: `key-date:${String(item.id)}`,
      entityId: String(item.contract_id),
      entityType: 'contract',
      reference: textValue(item.contract_number),
      label: textValue(item.contract_title) || textValue(item.title),
      issue: textValue(item.title) || 'Contract obligation requires review',
      reason:
        days < 0
          ? `The tracked obligation is ${Math.abs(days)} days overdue.`
          : `The tracked obligation is due in ${days} days.`,
      priority: days <= 30 ? 'high' : days <= 90 ? 'medium' : 'low',
      dueDate: dueDate || null,
      valueCents,
    });
  }

  for (const contract of contracts) {
    const contractId = String(contract.id);
    const label = textValue(contract.title);
    const reference = textValue(contract.contract_number);
    const valueCents = numberValue(contract.current_value_cents);
    const expiration = textValue(contract.expiration_date);
    const status = textValue(contract.status);
    const expectedCurrent =
      numberValue(contract.original_value_cents) +
      numberValue(contract.amendment_value_cents);
    const hasTrackedExpiration = attention.some(
      (item) => item.entityId === contractId && item.dueDate === expiration,
    );

    if (
      expiration &&
      expiration < today &&
      activeContractStatuses.has(status)
    ) {
      attention.push({
        id: `status:${contractId}`,
        entityId: contractId,
        entityType: 'contract',
        reference,
        label,
        issue: 'Expired date conflicts with active status',
        reason: `The expiration date is ${expiration}, but the register status is ${status}.`,
        priority: 'high',
        dueDate: expiration,
        valueCents,
      });
    } else if (
      expiration &&
      expiration >= today &&
      expiration <= addDays(today, 90) &&
      !hasTrackedExpiration
    ) {
      attention.push({
        id: `expiration:${contractId}`,
        entityId: contractId,
        entityType: 'contract',
        reference,
        label,
        issue: 'Contract expiration requires review',
        reason: `The contract expires in ${daysUntil(expiration, today)} days.`,
        priority: valueCents >= 500_000_00 ? 'high' : 'medium',
        dueDate: expiration,
        valueCents,
      });
    }

    if (!expiration) {
      attention.push({
        id: `missing-expiration:${contractId}`,
        entityId: contractId,
        entityType: 'contract',
        reference,
        label,
        issue: 'Expiration date not recorded',
        reason:
          'Renewal and closeout monitoring cannot be confirmed from the register.',
        priority: 'medium',
        dueDate: null,
        valueCents,
      });
    }

    if (
      ['automatic', 'optional'].includes(textValue(contract.renewal_type)) &&
      !textValue(contract.notice_deadline)
    ) {
      attention.push({
        id: `missing-notice:${contractId}`,
        entityId: contractId,
        entityType: 'contract',
        reference,
        label,
        issue: 'Renewal notice deadline not recorded',
        reason:
          'The contract has renewal terms but no notice deadline is available for monitoring.',
        priority: 'high',
        dueDate: null,
        valueCents,
      });
    }

    if (expectedCurrent !== valueCents) {
      attention.push({
        id: `value-mismatch:${contractId}`,
        entityId: contractId,
        entityType: 'contract',
        reference,
        label,
        issue: 'Contract value reconciliation exception',
        reason:
          'Current value does not equal original value plus recorded amendments.',
        priority: 'medium',
        dueDate: null,
        valueCents,
      });
    }

    const missingTerms = [
      !textValue(contract.payment_terms) ? 'payment terms' : '',
      !textValue(contract.governing_law) ? 'governing law' : '',
    ].filter(Boolean);
    if (missingTerms.length) {
      attention.push({
        id: `missing-terms:${contractId}`,
        entityId: contractId,
        entityType: 'contract',
        reference,
        label,
        issue: 'Contract metadata requires verification',
        reason: `Missing ${missingTerms.join(' and ')}.`,
        priority: 'low',
        dueDate: null,
        valueCents,
      });
    }
  }

  const valueBySupplier = groupCurrency(
    contracts,
    'supplier_name',
    'current_value_cents',
    contracts.length,
  );
  const largestSupplierPercent = percentage(
    valueBySupplier[0]?.value ?? 0,
    totalValue,
  );
  const sortedAttention = sortAttention(attention);

  const expirationMonths = new Map<string, number>();
  for (const item of activeContracts) {
    const expiration = textValue(item.expiration_date);
    if (!expiration || expiration < today || expiration > addDays(today, 365))
      continue;
    const month = expiration.slice(0, 7);
    expirationMonths.set(month, (expirationMonths.get(month) ?? 0) + 1);
  }

  return {
    scope: 'contracts',
    asOfDate: today,
    recordCount: contracts.length,
    metrics: [
      {
        key: 'total',
        label: 'Contracts analyzed',
        value: contracts.length,
        format: 'number',
      },
      {
        key: 'active',
        label: 'Active contracts',
        value: activeContracts.length,
        format: 'number',
      },
      {
        key: 'value',
        label: 'Total contract value',
        value: totalValue,
        format: 'currency',
      },
      {
        key: 'expiring90',
        label: 'Expiring within 90 days',
        value: expiringWithin(90).length,
        format: 'number',
      },
      {
        key: 'attention',
        label: 'Attention items',
        value: sortedAttention.length,
        format: 'number',
      },
      {
        key: 'concentration',
        label: 'Largest supplier share',
        value: largestSupplierPercent,
        format: 'percent',
      },
    ],
    charts: [
      {
        key: 'valueByType',
        title: 'Contract value by type',
        description: 'Current verified contract value in the selected scope.',
        valueFormat: 'currency',
        data: groupCurrency(contracts, 'contract_type', 'current_value_cents'),
      },
      {
        key: 'expirationTimeline',
        title: 'Expiration timeline',
        description: 'Active contracts expiring during the next 12 months.',
        valueFormat: 'number',
        data: [...expirationMonths.entries()]
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([label, value]) => ({ label, value })),
      },
    ],
    attentionItems: sortedAttention,
    attentionCount: sortedAttention.length,
    deterministicFindings: [
      `${expiringWithin(30).length} contracts expire within 30 days, ${expiringWithin(60).length} within 60 days, and ${expiringWithin(90).length} within 90 days.`,
      `The largest supplier represents ${largestSupplierPercent}% of selected contract value.`,
      `${sortedAttention.filter((item) => item.priority === 'high').length} attention items are classified as high priority by deterministic rules.`,
    ],
    evidenceRecords: contracts.map((item) => ({
      id: String(item.id),
      reference: textValue(item.contract_number),
      label: textValue(item.title),
      context: `${textValue(item.supplier_name)} · ${(numberValue(item.current_value_cents) / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })} · expires ${textValue(item.expiration_date) || 'not recorded'} · status ${textValue(item.status)}`,
    })),
  };
}

function buildSupplierReport(input: BuildReportInput): ManagementReport {
  const {
    suppliers,
    supplierAlerts,
    today = new Date().toISOString().slice(0, 10),
  } = input;
  const selectedIds = new Set(suppliers.map((item) => String(item.id)));
  const selectedAlerts = supplierAlerts.filter((item) =>
    selectedIds.has(String(item.supplier_id)),
  );
  const attention: ManagementAttentionItem[] = selectedAlerts.map((alert) => {
    const supplier = suppliers.find(
      (item) => String(item.id) === String(alert.supplier_id),
    );
    const dueDate = textValue(alert.due_date);
    const days = dueDate ? daysUntil(dueDate, today) : null;
    const valueCents =
      numberValue(supplier?.total_contract_value_cents) || null;
    const hasActiveExposure = numberValue(supplier?.active_contract_count) > 0;
    const status = textValue(alert.review_status);
    const isExpired =
      Boolean(dueDate && dueDate < today) || status === 'expired';
    const isMissing = status === 'missing';
    const priority: ManagementPriority =
      isExpired ||
      (isMissing && hasActiveExposure) ||
      (days !== null && days <= 30)
        ? 'high'
        : days !== null && days <= 90
          ? 'medium'
          : 'low';
    return {
      id: String(alert.alert_id),
      entityId: String(alert.supplier_id),
      entityType: 'supplier',
      reference: textValue(alert.vendor_number),
      label: textValue(alert.supplier_name),
      issue: textValue(alert.title),
      reason: isMissing
        ? hasActiveExposure
          ? 'The qualification record is missing while the supplier has active contract exposure.'
          : 'A standard qualification record is not on file.'
        : isExpired
          ? `The qualification record expired on ${dueDate}.`
          : dueDate
            ? `The qualification record expires in ${days} days.`
            : 'The qualification record requires review.',
      priority,
      dueDate: dueDate || null,
      valueCents,
    };
  });

  for (const supplier of suppliers) {
    const supplierId = String(supplier.id);
    const activeExposure = numberValue(supplier.active_contract_count) > 0;
    const qualification = textValue(supplier.qualification_status);
    if (
      activeExposure &&
      ['pending', 'in_review', 'expired'].includes(qualification) &&
      !attention.some(
        (item) =>
          item.entityId === supplierId &&
          item.issue.toLowerCase().includes('qualification status'),
      )
    ) {
      attention.push({
        id: `qualification:${supplierId}`,
        entityId: supplierId,
        entityType: 'supplier',
        reference: textValue(supplier.vendor_number),
        label: textValue(supplier.legal_name),
        issue: 'Qualification status requires review',
        reason: `The supplier has active contract exposure while qualification status is ${qualification || 'not recorded'}.`,
        priority: qualification === 'expired' ? 'high' : 'medium',
        dueDate: textValue(supplier.qualification_review_date) || null,
        valueCents: numberValue(supplier.total_contract_value_cents),
      });
    }
    const missingContact = [
      !textValue(supplier.primary_contact) ? 'primary contact' : '',
      !textValue(supplier.email) ? 'email' : '',
    ].filter(Boolean);
    if (missingContact.length) {
      attention.push({
        id: `supplier-data:${supplierId}`,
        entityId: supplierId,
        entityType: 'supplier',
        reference: textValue(supplier.vendor_number),
        label: textValue(supplier.legal_name),
        issue: 'Supplier contact information is incomplete',
        reason: `Missing ${missingContact.join(' and ')}.`,
        priority: 'low',
        dueDate: null,
        valueCents: numberValue(supplier.total_contract_value_cents),
      });
    }
  }

  const expiringWithin = (days: number) => {
    const cutoff = addDays(today, days);
    return selectedAlerts.filter((item) => {
      const date = textValue(item.due_date);
      return date && date >= today && date <= cutoff;
    });
  };
  const expiredSuppliers = new Set(
    selectedAlerts
      .filter((item) => {
        const dueDate = textValue(item.due_date);
        return (
          textValue(item.review_status) === 'expired' ||
          Boolean(dueDate && dueDate < today)
        );
      })
      .map((item) => String(item.supplier_id)),
  );
  const missingSuppliers = new Set(
    selectedAlerts
      .filter((item) => textValue(item.review_status) === 'missing')
      .map((item) => String(item.supplier_id)),
  );
  const qualifiedCount = suppliers.filter(
    (item) => textValue(item.qualification_status) === 'approved',
  ).length;
  const totalExposure = suppliers.reduce(
    (sum, item) => sum + numberValue(item.total_contract_value_cents),
    0,
  );
  const exposureBySupplier = groupCurrency(
    suppliers,
    'legal_name',
    'total_contract_value_cents',
    6,
  );
  const topSupplierPercent = percentage(
    exposureBySupplier[0]?.value ?? 0,
    totalExposure,
  );
  const sortedAttention = sortAttention(attention);
  const qualificationCounts = new Map<string, number>();
  for (const supplier of suppliers) {
    const label = textValue(supplier.qualification_status) || 'Not recorded';
    qualificationCounts.set(label, (qualificationCounts.get(label) ?? 0) + 1);
  }

  return {
    scope: 'suppliers',
    asOfDate: today,
    recordCount: suppliers.length,
    metrics: [
      {
        key: 'total',
        label: 'Suppliers analyzed',
        value: suppliers.length,
        format: 'number',
      },
      {
        key: 'qualified',
        label: 'Qualified suppliers',
        value: qualifiedCount,
        format: 'number',
      },
      {
        key: 'missing',
        label: 'Missing documents',
        value: missingSuppliers.size,
        format: 'number',
      },
      {
        key: 'expired',
        label: 'Expired documents',
        value: expiredSuppliers.size,
        format: 'number',
      },
      {
        key: 'expiring90',
        label: 'Documents expiring in 90 days',
        value: expiringWithin(90).length,
        format: 'number',
      },
      {
        key: 'attention',
        label: 'Attention items',
        value: sortedAttention.length,
        format: 'number',
      },
    ],
    charts: [
      {
        key: 'qualificationStatus',
        title: 'Qualification status',
        description: 'Supplier qualification status in the selected scope.',
        valueFormat: 'number',
        data: [...qualificationCounts.entries()].map(([label, value]) => ({
          label,
          value,
        })),
      },
      {
        key: 'contractExposure',
        title: 'Contract exposure by supplier',
        description:
          'Active and executed contract value linked to each supplier.',
        valueFormat: 'currency',
        data: exposureBySupplier,
      },
    ],
    attentionItems: sortedAttention,
    attentionCount: sortedAttention.length,
    deterministicFindings: [
      `${missingSuppliers.size} suppliers have required qualification records missing and ${expiredSuppliers.size} have expired records.`,
      `${expiringWithin(30).length} supplier documents expire within 30 days, ${expiringWithin(60).length} within 60 days, and ${expiringWithin(90).length} within 90 days.`,
      `The largest supplier represents ${topSupplierPercent}% of selected active contract exposure.`,
    ],
    evidenceRecords: suppliers.map((item) => ({
      id: String(item.id),
      reference: textValue(item.vendor_number),
      label: textValue(item.legal_name),
      context: `${textValue(item.qualification_status) || 'qualification not recorded'} · ${numberValue(item.active_contract_count)} active contracts · ${(numberValue(item.total_contract_value_cents) / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })} exposure · next compliance expiry ${textValue(item.next_compliance_expiration) || 'not recorded'}`,
    })),
  };
}

export function buildManagementReport(input: BuildReportInput) {
  return input.scope === 'contracts'
    ? buildContractReport(input)
    : buildSupplierReport(input);
}
