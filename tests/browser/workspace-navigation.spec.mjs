import { expect, test } from '@playwright/test';

test('mobile navigation opens register records and preserves browser history', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Contract operations' }),
  ).toBeVisible();

  const menu = page.getByRole('button', { name: 'Open workspace navigation' });
  await menu.click();
  const navigation = page.getByRole('dialog').getByRole('navigation');
  await expect(
    navigation.getByRole('link', { name: 'Dashboard' }),
  ).toHaveAttribute('aria-current', 'page');
  await navigation.getByRole('link', { name: 'Contract Register' }).click();
  await expect(navigation).toBeHidden();
  await expect(page).toHaveURL(/\?view=contracts$/);

  const records = page.getByRole('list', { name: 'Contract records' });
  await expect(
    records.getByRole('button', {
      name: /Technology Support Services Agreement/,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('table', { name: 'Contract records' }),
  ).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );

  await page.goBack();
  await expect(
    page.getByRole('heading', { name: 'Contract operations' }),
  ).toBeVisible();
});

test('register filters combine with search and can be cleared independently', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?view=contracts');

  const search = page.getByRole('textbox', { name: 'Search contracts' });
  const status = page.getByRole('combobox', { name: 'Status', exact: true });
  const filters = page.getByRole('button', { name: /^Filters/ });
  const record = page.getByRole('button', {
    name: /Technology Support Services Agreement CT-2025-018/,
  });
  await expect(record).toBeVisible();
  await expect(status).toBeHidden();

  await search.fill('CT-2025-018');
  await expect(page.getByText(/^1 of \d+ records$/)).toBeVisible();
  await filters.click();
  await status.selectOption('active');
  await expect(filters).toHaveText('Filters1');
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(status).toHaveValue('all');
  await expect(search).toHaveValue('CT-2025-018');

  await page
    .getByRole('navigation', { name: 'Primary navigation' })
    .getByRole('link', { name: 'Supplier Register' })
    .click();
  await expect(
    page.getByRole('textbox', { name: 'Search suppliers' }),
  ).toBeEmpty();
  await page.goBack();
  await expect(search).toHaveValue('CT-2025-018');
  await page.getByRole('button', { name: 'Clear search contracts' }).click();
  await expect(search).toBeEmpty();
  await expect(search).toBeFocused();
});
