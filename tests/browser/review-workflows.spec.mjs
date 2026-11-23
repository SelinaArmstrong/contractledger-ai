import { expect, test } from '@playwright/test';

test('mobile supplier details show the contact and restore keyboard focus', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?view=suppliers');
  const opener = page
    .getByRole('list', { name: 'Supplier records' })
    .getByRole('button', { name: /Apex Equipment LLC/ });
  await opener.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Apex Equipment LLC' });
  const contact = dialog.getByRole('region', {
    name: 'Supplier contact details',
  });
  for (const value of [
    'Rachel Kim',
    'rachel.kim@example.com',
    '510-555-0142',
    '2900 Industrial Way, Fremont, CA 94538, United States',
  ]) {
    await expect(contact.getByText(value, { exact: true })).toBeVisible();
  }
  await expect(
    contact.getByRole('link', { name: 'rachel.kim@example.com' }),
  ).toHaveAttribute('href', 'mailto:rachel.kim@example.com');
  await expect(
    contact.getByRole('link', { name: '510-555-0142' }),
  ).toHaveAttribute('href', 'tel:510-555-0142');
  expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
    true,
  );
  await dialog.getByRole('button', { name: 'Close details' }).focus();
  for (const key of ['Shift+Tab', 'Tab', 'Tab']) {
    await page.keyboard.press(key);
    await expect
      .poll(() => dialog.evaluate((el) => el.contains(document.activeElement)))
      .toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
});

test('Escape closes the amendment before the contract and returns focus at each level', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?view=contracts');
  await page
    .getByRole('textbox', { name: 'Search contracts' })
    .fill('CT-2025-018');
  const opener = page.getByRole('button', {
    name: /Technology Support Services Agreement CT-2025-018/,
  });
  await opener.click();
  const dialog = page.getByRole('dialog', {
    name: 'Technology Support Services Agreement',
  });
  const add = dialog
    .getByRole('button', { name: 'Add amendment', exact: true })
    .first();
  await add.click();
  const child = page.getByRole('dialog', {
    name: 'Add amendment to CT-2025-018',
  });
  await expect(child).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(child).toHaveCount(0);
  await expect(add).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
});

test('supplier alert count opens its focused queue and works with history', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const button = page.getByRole('button', { name: /^Supplier documents: \d+/ });
  const label = await button.getAttribute('aria-label');
  const [, count] = label.match(/^Supplier documents: (\d+)/);
  await button.click();
  await expect(page).toHaveURL(/view=obligations#supplier-evidence-alerts$/);
  const alerts = page.getByRole('region', { name: 'Supplier evidence alerts' });
  await expect(alerts).toBeFocused();
  await expect(
    alerts.getByText(count + ' of ' + count, { exact: true }),
  ).toBeInViewport();
  await page.goBack();
  await expect(button).toBeVisible();
  await page.goForward();
  await expect(alerts).toBeFocused();
  await page.reload();
  await expect(alerts).toBeFocused();
});

test('the dashboard queue presents pending reviews and opens the selected intake', async ({
  page,
  request,
}) => {
  const response = await request.get('/api/workspace');
  const workspace = await response.json();
  expect(workspace.pendingReviews.length).toBeGreaterThan(0);
  await page.goto('/');
  const queue = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'AI review queue' }) })
    .last();
  for (const item of workspace.pendingReviews) {
    await expect(
      queue.getByRole('button', { name: item.title, exact: true }),
    ).toBeVisible();
  }
  for (const item of workspace.intakes.filter(
    (row) => row.review_status === 'complete',
  )) {
    await expect(
      queue.getByRole('button', { name: item.title, exact: true }),
    ).toHaveCount(0);
  }
  await queue
    .getByRole('button', {
      name: workspace.pendingReviews[0].title,
      exact: true,
    })
    .click();
  await expect(
    page.getByRole('dialog').getByRole('heading', {
      name: workspace.pendingReviews[0].title,
      exact: true,
    }),
  ).toBeVisible();
});

test('guests can browse a review without uploading or editing', async ({
  page,
}) => {
  await page.goto('http://guest.localhost:8791/');
  await page.getByRole('button', { name: 'View contract reviews' }).click();
  await expect(page).toHaveURL(/view=new-contract-review/);
  await expect(page.getByRole('button', { name: 'Upload draft' })).toHaveCount(
    0,
  );
  await expect(page.locator('input[type=file]')).toHaveCount(0);
  await page
    .getByRole('table')
    .getByRole('button')
    .filter({ hasText: /Open review workspace/i })
    .first()
    .click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Review owner')).toHaveAttribute(
    'readonly',
    '',
  );
  await expect(
    dialog.getByRole('button', { name: 'Save review workflow' }),
  ).toHaveCount(0);
});

test('requesters can analyze and inspect source values without seeing verification or save actions', async ({
  page,
}) => {
  const origin = 'http://guest.localhost:8791';
  const response = await page.request.post(origin + '/api/auth/login', {
    headers: { Origin: origin },
    form: {
      username: 'browser-requester',
      password: process.env.CONTRACTLEDGER_TEST_PASSWORD,
    },
    maxRedirects: 0,
  });
  expect(response.headers()['set-cookie']).toContain(
    'contractledger_demo_session=',
  );
  await page.goto(origin);
  await page.getByRole('button', { name: 'Analyze a draft' }).click();
  await expect(
    page.getByText(/reviewer with verification permission/),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Use demo PDF' }).click();
  const fields = Object.fromEntries(
    [
      'documentTitle',
      'supplierLegalName',
      'contractType',
      'contractNumber',
      'contractValue',
      'effectiveDate',
      'expirationDate',
      'renewalType',
      'noticeDays',
      'governingLaw',
      'paymentTerms',
      'liabilityCap',
    ].map((key) => [
      key,
      {
        value: key === 'documentTitle' ? 'Fictional supply agreement' : null,
        sourceQuote:
          key === 'documentTitle' ? 'Source title from page one' : null,
        sourcePage: 1,
        confidence: 0.95,
      },
    ]),
  );
  await page.route('**/api/analyze', (route) =>
    route.fulfill({
      json: {
        model: 'test',
        analysis: { ...fields, warnings: [], findings: [] },
        qualityReport: {
          status: 'ready',
          inspectedPages: 1,
          totalPages: 1,
          textCharacters: 500,
          issues: [],
        },
      },
    }),
  );
  await page
    .getByRole('button', { name: 'Analyze with DeepSeek' })
    .first()
    .click();
  await expect(
    page.getByText('Analysis complete', { exact: true }),
  ).toBeVisible();
  await expect(page.getByText('Fictional supply agreement')).toBeVisible();
  await expect(page.getByText(/Source title from page one/)).toBeVisible();
  await expect(
    page.getByRole('textbox', { name: 'Document title' }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', {
      name: /Confirm field|Confirm all unchanged|Save reviewed intake/,
    }),
  ).toHaveCount(0);
});

test('the review workspace searches and opens drafts omitted from its initial snapshot', async ({
  page,
  request,
}) => {
  const response = await request.get('/api/workspace');
  const workspace = await response.json();
  const target = workspace.intakes
    .slice(1)
    .find((row) => row.status !== 'executed');
  expect(target).toBeDefined();
  await page.route('**/api/workspace', (route) =>
    route.fulfill({
      json: { ...workspace, intakes: workspace.intakes.slice(0, 1) },
    }),
  );
  // Exercise recovery without losing the search, then use the real history endpoint.
  await page.route(
    '**/api/intakes?beforeDate=*',
    (route) => route.fulfill({ status: 503, json: { error: 'Unavailable' } }),
    { times: 1 },
  );
  await page.goto('/?view=new-contract-review');
  await page
    .getByRole('textbox', { name: 'Search reviews' })
    .fill(target.intake_number);
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await page
    .getByRole('table')
    .getByRole('button', {
      name:
        target.title + ' ' + target.intake_number + ' · Open review workspace',
      exact: true,
    })
    .click();
  await expect(page.getByRole('dialog', { name: target.title })).toBeVisible();
});
