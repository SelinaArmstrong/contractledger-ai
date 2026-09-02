import { describe, expect, it } from 'vitest';

import {
  autoMapImportHeaders,
  csvCell,
  importPreviewSummary,
  normalizeCurrencyToCents,
  normalizeImportDate,
  previewImportRows,
  subtractImportNoticeDays,
} from '@/lib/bulk-import';

const existing = {
  suppliers: [
    {
      id: 'sup-1',
      legalName: 'Harbor Facilities LLC',
      normalizedName: 'harbor facilities',
      vendorNumber: 'VND-1',
    },
  ],
  contracts: [
    {
      id: 'con-1',
      contractNumber: 'CT-100',
      supplierId: 'sup-1',
      title: 'Facilities Services Agreement',
    },
  ],
};

describe('bulk import normalization', () => {
  it('maps common legacy aliases', () => {
    expect(
      autoMapImportHeaders('suppliers', [
        'Vendor Name',
        'Vendor ID',
        'Commodity',
      ]),
    ).toMatchObject({
      legal_name: 'Vendor Name',
      vendor_number: 'Vendor ID',
      category: 'Commodity',
    });
  });

  it('normalizes valid dates and rejects impossible dates', () => {
    expect(normalizeImportDate('9/1/2026')).toBe('2026-09-01');
    expect(normalizeImportDate('2026-02-30')).toBeNull();
  });

  it('normalizes USD values to integer cents', () => {
    expect(normalizeCurrencyToCents('$125,000.25')).toBe(12_500_025);
    expect(normalizeCurrencyToCents('USD nope')).toBeNull();
  });

  it('detects exact supplier duplicates without silently accepting them', () => {
    const rows = previewImportRows(
      'suppliers',
      [{ Vendor: 'Harbor Facilities LLC', Category: 'Facilities' }],
      { legal_name: 'Vendor', category: 'Category' },
      existing,
    );
    expect(rows[0]).toMatchObject({
      status: 'duplicate',
      decision: 'pending',
      duplicateRecordId: 'sup-1',
      duplicateType: 'exact',
    });
  });

  it('rejects unknown contract suppliers and formula-injection values', () => {
    const rows = previewImportRows(
      'contracts',
      [
        {
          Number: 'CT-200',
          Vendor: 'Unknown Co',
          Title: '=CMD()',
          Type: 'Services',
          Department: 'IT',
          Owner: 'Sam',
          Value: '1000',
          Effective: '01/01/2026',
        },
      ],
      {
        contract_number: 'Number',
        supplier_legal_name: 'Vendor',
        title: 'Title',
        contract_type: 'Type',
        department: 'Department',
        owner: 'Owner',
        current_value: 'Value',
        effective_date: 'Effective',
      },
      existing,
    );
    expect(rows[0].status).toBe('invalid');
    expect(rows[0].issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(['unknown_supplier', 'formula_injection']),
    );
  });

  it('detects possible contract duplicates for explicit review', () => {
    const rows = previewImportRows(
      'contracts',
      [
        {
          Number: 'CT-101',
          Vendor: 'Harbor Facilities LLC',
          Title: 'Facilities Services',
          Type: 'Services',
          Department: 'Ops',
          Owner: 'Sam',
          Value: '$100',
          Effective: '2026-01-01',
        },
      ],
      {
        contract_number: 'Number',
        supplier_legal_name: 'Vendor',
        title: 'Title',
        contract_type: 'Type',
        department: 'Department',
        owner: 'Owner',
        current_value: 'Value',
        effective_date: 'Effective',
      },
      existing,
    );
    expect(rows[0]).toMatchObject({
      status: 'warning',
      duplicateType: 'possible',
      decision: 'pending',
    });
  });

  it('detects exact duplicates inside the uploaded file', () => {
    const source = { Vendor: 'New Supplier LLC', Category: 'Services' };
    const rows = previewImportRows(
      'suppliers',
      [source, source],
      { legal_name: 'Vendor', category: 'Category' },
      existing,
    );
    expect(rows[0].status).toBe('ready');
    expect(rows[1]).toMatchObject({
      status: 'duplicate',
      duplicateType: 'exact',
    });
    expect(rows[1].issues.map((issue) => issue.code)).toContain(
      'file_duplicate',
    );
  });

  it('summarizes independent row outcomes', () => {
    expect(
      importPreviewSummary([
        { status: 'ready', decision: 'accept', issues: [] },
        {
          status: 'invalid',
          decision: 'skip',
          issues: [{ code: 'invalid_date', severity: 'error', message: 'bad' }],
        },
      ]),
    ).toMatchObject({
      total: 2,
      ready: 1,
      invalid: 1,
      accepted: 1,
      rejected: 1,
      normalizationIssues: 1,
    });
  });

  it('calculates imported contract notice deadlines', () => {
    expect(subtractImportNoticeDays('2026-12-31', 60)).toBe('2026-11-01');
  });

  it('neutralizes formula characters in exported correction cells', () => {
    expect(csvCell('=2+2')).toBe("'=2+2");
  });
});
