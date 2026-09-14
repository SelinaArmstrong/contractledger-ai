import { test, expect } from '@playwright/test';
import sharp from 'sharp';

test('contract source opens in a same-origin PDF reader', async ({ page }) => {
  const errors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto('/?view=contracts');
  await page
    .getByRole('button', {
      name: /Technology Support Services Agreement CT-2025-018/,
    })
    .click();
  const reader = page.locator(
    'iframe[title="03_Executed_Technology_Support_Services_Agreement.pdf"]',
  );
  await expect(reader).toBeVisible();
  // An HTTP 200 is insufficient: CSP can replace the frame with chrome-error.
  await expect
    .poll(() =>
      page
        .frames()
        .some((frame) =>
          frame.url().includes('/api/document?id=doc-demo-contract-harbor'),
        ),
    )
    .toBe(true);
  // The built-in viewer is browser-owned and may expose an empty DOM.
  // Wait for visible paper and text instead of accepting a blank dark viewer.
  await expect
    .poll(
      async () => {
        const { data, info } = await sharp(await reader.screenshot())
          .removeAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true });
        let paper = 0,
          ink = 0;
        for (let i = 0; i < data.length; i += info.channels) {
          if (data[i] > 240 && data[i + 1] > 240 && data[i + 2] > 240) paper++;
          if (data[i] < 100 && data[i + 1] < 100 && data[i + 2] < 100) ink++;
        }
        const pixels = info.width * info.height;
        return paper / pixels > 0.15 && ink / pixels > 0.03;
      },
      { timeout: 15_000 },
    )
    .toBe(true);
  expect(
    errors.filter((message) =>
      /frame|Content Security Policy|sandbox/i.test(message),
    ),
  ).toEqual([]);
});
