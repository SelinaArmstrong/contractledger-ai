import { expect, test } from '@playwright/test';
import ExcelJS from 'exceljs';
import { readFile } from 'node:fs/promises';

async function importRows(request, origin, target, headers, rows) {
  // Resolving a batch uses one D1 parameter per row, plus the batch ID.
  const batchSize = 90;
  for (let start = 0; start < rows.length; start += batchSize) {
    const csv = [headers, ...rows.slice(start, start + batchSize)]
      .map((row) => row.join(','))
      .join('\n');
    const preview = await request.post('/api/imports', {
      headers: { Origin: origin },
      multipart: {
        target,
        file: {
          name: 'register-depth.csv',
          mimeType: 'text/csv',
          buffer: Buffer.from(csv),
        },
      },
    });
    expect(preview.status(), await preview.text()).toBe(201);
    const { batch, rows: staged } = await preview.json();
    const resolved = await request.patch('/api/imports', {
      headers: { Origin: origin },
      data: {
        action: 'resolve',
        batchId: batch.id,
        rowIds: staged.map((row) => row.id),
        decision: 'accept',
      },
    });
    expect(resolved.status(), await resolved.text()).toBe(200);
    const committed = await request.patch('/api/imports', {
      headers: { Origin: origin },
      data: { action: 'commit', batchId: batch.id },
    });
    expect(committed.status(), await committed.text()).toBe(200);
  }
}

// Restore the disposable release-preview fixture after importing the large register.
test.afterAll(async ({ request, baseURL }) => {
  const origin = new URL(baseURL).origin;
  if (origin !== 'http://127.0.0.1:8791')
    throw new Error('Expected the local release preview.');
  const response = await request.post('/api/workspace/reset', {
    headers: { Origin: origin },
  });
  expect(response.ok()).toBe(true);
});

test('finds and opens records beyond the snapshot and downloads every supplier', async ({
  page,
  request,
  baseURL,
}) => {
  test.setTimeout(120_000);
  const origin = new URL(baseURL).origin;
  const supplierName = 'ZZ Register Depth Target Supplier';
  const contractNumber = 'REGISTER-DEPTH-TARGET';
  const fixtureNumbers = Array.from({ length: 500 }, (_, index) =>
    String(index + 1).padStart(3, '0'),
  );
  const supplierHeaders = [
    'Legal Name',
    'Vendor Number',
    'Category',
    'W-9 Status',
    'Insurance Status',
  ];
  const contractHeaders = [
    'Contract Number',
    'Supplier Legal Name',
    'Contract Title',
    'Contract Type',
    'Department',
    'Owner',
    'Current Value (USD)',
    'Effective Date',
  ];
  const contractRow = (number, title) => [
    number,
    supplierName,
    title,
    'Services',
    'Operations',
    'Fixture owner',
    '12345',
    '2026-09-01',
  ];
  await importRows(request, origin, 'suppliers', supplierHeaders, [
    [supplierName, 'REGISTER-DEPTH-501', 'Depth target', 'Received', 'Current'],
    ...fixtureNumbers.map((number) => [
      `Z Register Depth Fixture ${number}`,
      `DEPTH-${number}`,
      'Depth fixtures',
      'Received',
      'Current',
    ]),
  ]);
  await importRows(request, origin, 'contracts', contractHeaders, [
    contractRow(contractNumber, 'Register Depth Target Agreement'),
  ]);
  await importRows(
    request,
    origin,
    'contracts',
    contractHeaders,
    fixtureNumbers.map((number) =>
      contractRow(
        `REGISTER-DEPTH-${number}`,
        `Register Depth Agreement ${number}`,
      ),
    ),
  );

  const response = await request.get('/api/workspace');
  expect(response.ok()).toBe(true);
  const snapshot = await response.json();
  expect(
    snapshot.contracts.some((row) => row.contract_number === contractNumber),
  ).toBe(false);
  expect(
    snapshot.suppliers.some((row) => row.legal_name === supplierName),
  ).toBe(false);

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?view=contracts');
  await page
    .getByRole('textbox', { name: 'Search contracts' })
    .fill(contractNumber);
  await expect(
    page.getByText(`1 of ${snapshot.metrics.total_contracts} records`),
  ).toBeVisible();
  await page
    .getByRole('button', { name: /Register Depth Target Agreement/ })
    .click();
  await expect(
    page.getByRole('dialog', { name: 'Register Depth Target Agreement' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Close details' }).click();

  await page
    .getByRole('navigation', { name: 'Primary navigation' })
    .getByRole('link', { name: 'Supplier Register' })
    .click();
  await page
    .getByRole('textbox', { name: 'Search suppliers' })
    .fill(supplierName);
  await expect(
    page.getByText(`1 of ${snapshot.metrics.total_suppliers} records`),
  ).toBeVisible();
  await page.getByRole('button', { name: new RegExp(supplierName) }).click();
  await expect(page.getByRole('dialog', { name: supplierName })).toBeVisible();
  await page.getByRole('button', { name: 'Close details' }).click();

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export all suppliers' }).click();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await readFile(await (await download).path()));
  expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
    'Supplier Register',
    'Supplier Documents',
  ]);
  const suppliers = workbook.getWorksheet('Supplier Register');
  expect(suppliers.rowCount).toBe(snapshot.metrics.total_suppliers + 1);
  expect(suppliers.getRow(suppliers.rowCount).getCell('C').value).toBe(
    supplierName,
  );
});
