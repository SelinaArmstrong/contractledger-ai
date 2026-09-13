#!/usr/bin/env node

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractText, getDocumentProxy } from 'unpdf';

const repositoryRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const baseUrlFlag = process.argv.indexOf('--base-url');
const baseUrl = (
  baseUrlFlag >= 0 ? process.argv[baseUrlFlag + 1] : 'http://localhost:3000'
)?.replace(/\/$/, '');

if (!baseUrl) {
  console.error('Baseline verification failed: --base-url requires a URL.');
  process.exit(1);
}

const expectedFixtures = [
  '01_Draft_Professional_Services_Agreement.pdf',
  '02_Executed_Professional_Services_Agreement.pdf',
  '03_Executed_Technology_Support_Services_Agreement.pdf',
  '04_Harbor_Technology_Demo_W9.pdf',
  '05_Harbor_Technology_Demo_Insurance_Certificate.pdf',
  '06_Harbor_Technology_Demo_Business_License.pdf',
  '07_Harbor_Technology_Demo_Good_Standing_Record.pdf',
  '08_Harbor_Technology_Demo_Cybersecurity_Assessment.pdf',
  '09_Harbor_Technology_Demo_SAM_Exclusion_Screening.pdf',
  '10_Westline_Engineering_Demo_Professional_License.pdf',
  '11_Canyon_Ridge_Demo_W9.pdf',
  '12_Canyon_Ridge_Demo_Insurance_Certificate.pdf',
  '13_Canyon_Ridge_Demo_Business_License.pdf',
  '14_Apex_Equipment_Amendment_No_2.pdf',
  '15_Ambiguous_Incomplete_Supplier_Note.txt',
];

const seededDocuments = [
  'doc-demo-draft-westline',
  'doc-demo-contract-harbor',
  'doc-demo-w9-harbor',
  'doc-demo-coi-harbor',
  'doc-demo-license-harbor',
  'doc-demo-standing-harbor',
  'doc-demo-cyber-harbor',
  'doc-demo-sam-harbor',
  'doc-demo-license-westline',
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function request(path, init) {
  const response = await fetch(`${baseUrl}${path}`, init);
  return response;
}

async function json(path, init, expectedStatus = 200) {
  const response = await request(path, init);
  assert(
    response.status === expectedStatus,
    `${path} returned ${response.status}; expected ${expectedStatus}.`,
  );
  return response.json();
}

async function reset() {
  return json('/api/workspace/reset', {
    method: 'POST',
    headers: {
      Origin: new URL(baseUrl).origin,
      'Content-Type': 'application/json',
    },
  });
}

function ids(items) {
  return items.map((item) => item.id).sort();
}

async function fixtureText(path, fileName) {
  const bytes = readFileSync(path);
  if (fileName.endsWith('.txt')) return bytes.toString('utf8');
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  const result = await extractText(pdf, { mergePages: true });
  return String(result.text);
}

async function main() {
  const home = await request('/');
  assert(home.ok, `Application home returned ${home.status}.`);

  const firstReset = await reset();
  const secondReset = await reset();
  assert(
    firstReset.reset === true && secondReset.reset === true,
    'Both reset responses must confirm success.',
  );
  assert(
    JSON.stringify(firstReset.workspace) ===
      JSON.stringify(secondReset.workspace),
    'Two consecutive reset workspace snapshots differ.',
  );

  const workspace = secondReset.workspace;
  const expectedCounts = {
    contracts: 7,
    suppliers: 8,
    intakes: 3,
    keyDates: 5,
    supplierDocuments: 7,
    approvalQueue: 5,
  };
  for (const [collection, count] of Object.entries(expectedCounts)) {
    assert(
      Array.isArray(workspace[collection]),
      `${collection} must be an array.`,
    );
    assert(
      workspace[collection].length === count,
      `${collection} has ${workspace[collection].length} records; expected ${count}.`,
    );
  }

  assert(
    JSON.stringify(ids(workspace.contracts)) ===
      JSON.stringify([
        'con-001',
        'con-002',
        'con-003',
        'con-004',
        'con-005',
        'con-006',
        'con-007',
      ]),
    'Contract fixture identities changed.',
  );
  assert(
    JSON.stringify(ids(workspace.keyDates)) ===
      JSON.stringify([
        'date-001',
        'date-002',
        'date-003',
        'date-004',
        'date-005',
      ]),
    'Obligation fixture identities changed.',
  );
  assert(
    Number(workspace.metrics.current_value_cents) === 405_500_000,
    'Portfolio value must remain USD 4,055,000.',
  );
  assert(
    Number(workspace.approvalMetrics.open_requests) === 4,
    'Reset must produce four open approvals.',
  );
  assert(
    Number(workspace.obligationMetrics.open_obligations) === 4,
    'Reset must produce four open obligations.',
  );
  assert(
    Number(workspace.integrationMetrics.pending_events) === 1,
    'Reset must produce one pending outbox event.',
  );

  const fixtureDirectory = resolve(repositoryRoot, 'public/demo-documents');
  const actualFixtures = readdirSync(fixtureDirectory).sort();
  assert(
    JSON.stringify(actualFixtures) === JSON.stringify(expectedFixtures),
    'Demo document inventory changed.',
  );
  for (const fixture of expectedFixtures) {
    const fixturePath = resolve(fixtureDirectory, fixture);
    assert(statSync(fixturePath).size > 0, `${fixture} is empty.`);
    const text = await fixtureText(fixturePath, fixture);
    assert(
      /fictional/i.test(text),
      `${fixture} does not visibly identify itself as fictional.`,
    );
    for (const email of text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ??
      []) {
      const normalizedEmail = email.toLowerCase();
      assert(
        normalizedEmail.endsWith('@example.com') ||
          normalizedEmail.endsWith('.example'),
        `${fixture} contains a non-example email address.`,
      );
    }
    const response = await request(
      `/demo-documents/${encodeURIComponent(fixture)}`,
    );
    assert(
      response.ok,
      `${fixture} is not served by the application (${response.status}).`,
    );
  }

  for (const documentId of seededDocuments) {
    const response = await request(
      `/api/document?id=${encodeURIComponent(documentId)}`,
    );
    assert(
      response.ok,
      `Seeded document ${documentId} cannot be opened (${response.status}).`,
    );
    assert(
      (response.headers.get('content-type') ?? '').includes('application/pdf'),
      `${documentId} is not served as a PDF.`,
    );
  }

  const contractDetails = await json(
    '/api/record-details?type=contract&id=con-002',
  );
  assert(
    contractDetails.amendments.some((item) => item.id === 'amd-demo-apex-001'),
    'Apex amendment history is missing.',
  );
  const approvalDetails = await json(
    `/api/approvals?id=${encodeURIComponent(workspace.approvalQueue[0].request_id)}`,
  );
  assert(
    approvalDetails.steps.length >= 1,
    'Approval detail has no review step.',
  );
  const obligation = await json('/api/obligations?id=date-004');
  assert(
    obligation.obligation.status === 'completed',
    'Completed obligation fixture changed state.',
  );
  assert(
    Boolean(obligation.obligation.evidence_reference),
    'Completed obligation fixture lost its evidence reference.',
  );
  const imports = await json('/api/imports');
  assert(
    imports.batches.length === 2,
    'Reset must produce the import preview batch and the reversed batch.',
  );
  assert(
    imports.batches.filter((batch) => batch.status === 'rolled_back').length ===
      1,
    'Reset must retain the rolled-back import batch that proves reversibility.',
  );
  assert(
    Number.isFinite(imports.metrics.medianMigrationMinutes),
    'Reset must produce a completed batch so migration duration is measurable.',
  );

  const exportAuthorization = await json('/api/exports/authorize', {
    method: 'POST',
    headers: {
      Origin: new URL(baseUrl).origin,
      'Content-Type': 'application/json',
    },
  });
  assert(
    exportAuthorization.authorized === true,
    'Export authorization did not succeed.',
  );
  const calendar = await request('/api/obligations?format=ics&ids=date-001');
  assert(calendar.ok, `Calendar export returned ${calendar.status}.`);
  assert(
    (calendar.headers.get('content-type') ?? '').includes('text/calendar'),
    'Calendar export has the wrong media type.',
  );
  const reviewPackage = await request('/api/review-package', {
    method: 'POST',
    headers: {
      Origin: new URL(baseUrl).origin,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ contractId: 'con-003' }),
  });
  assert(
    reviewPackage.ok,
    `Review-package export returned ${reviewPackage.status}.`,
  );
  assert(
    (reviewPackage.headers.get('content-type') ?? '').includes(
      'application/pdf',
    ),
    'Review-package export is not a PDF.',
  );

  await json('/api/document', undefined, 400);
  await json('/api/obligations', undefined, 400);

  const finalReset = await reset();
  assert(
    JSON.stringify(finalReset.workspace) ===
      JSON.stringify(secondReset.workspace),
    'Final cleanup reset did not restore the approved baseline.',
  );

  console.log('[PASS] Application home and primary read workflows respond.');
  console.log(
    '[PASS] Two consecutive reset snapshots are byte-for-byte equivalent.',
  );
  console.log(
    '[PASS] 7 contracts, 8 suppliers, 3 intakes, 5 obligations, and 5 approval records are stable.',
  );
  console.log(
    '[PASS] All 15 fixtures are visibly fictional, use only reserved example email domains, and are served; all 9 seeded document links open.',
  );
  console.log(
    '[PASS] Amendment, approval, obligation, import, review-package, calendar, authorization, and invalid-input smoke paths respond correctly.',
  );
  console.log(
    '[PASS] Final reset restores the approved baseline after export-side audit writes.',
  );
  console.log('Release baseline verification passed.');
}

main().catch((error) => {
  console.error(
    `Release baseline verification failed: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
});
