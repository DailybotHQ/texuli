import { expect, test } from '@playwright/test';

const PORT = Number(process.env.TEXULI_E2E_PORT ?? 4876);
const ORIGIN = process.env.EMOJIPARSER_BASE_URL ?? `http://127.0.0.1:${PORT}`;
test.describe.configure({ mode: 'serial', timeout: 60_000 });

test('search uses CLDR data and opens a static detail page', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    const reports: string[] = [];
    (window as unknown as { __csp: string[] }).__csp = reports;
    document.addEventListener('securitypolicyviolation', (event) => {
      reports.push(`${event.effectiveDirective}: ${event.blockedURI || 'inline'}`);
    });
  });
  await page.goto(ORIGIN);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Find the right emoji. Get the exact text.'
  );
  await page.getByRole('searchbox', { name: 'Search emoji names and keywords' }).fill('rocket');
  await expect(page.getByRole('link', { name: /rocket.*:rocket:/i })).toHaveAttribute(
    'href',
    '/emoji/1f680/'
  );
  await page.getByRole('link', { name: /rocket.*:rocket:/i }).click();
  await expect(page.getByRole('heading', { name: 'rocket' })).toBeVisible();
  await expect(page.getByText('U+1F680')).toBeVisible();
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => (window as unknown as { __csp: string[] }).__csp)).toEqual([]);
});

test('converter separates canonical and legacy aliases and reports conflicts', async ({ page }) => {
  await page.goto(`${ORIGIN}/convert/`);
  const input = page.getByLabel('Text to convert');
  const output = page.locator('[data-converter-output]');
  await input.fill(':thumbsup: :rocket:');
  await page.getByRole('button', { name: 'Convert', exact: true }).click();
  await expect(output).toHaveText(':thumbsup: 🚀');

  await page.getByLabel('Dialect').selectOption('legacy');
  await page.getByRole('button', { name: 'Convert', exact: true }).click();
  await expect(output).toHaveText('👍 🚀');
  await expect(page.locator('[data-converter-diagnostics]')).toBeEmpty();

  await input.fill(':pa:');
  await page.getByRole('button', { name: 'Convert', exact: true }).click();
  await expect(output).toHaveText(':pa:');
  await expect(page.locator('[data-converter-diagnostics]')).toContainText(
    'conflicting legacy meanings'
  );
  await page.getByLabel('Legacy alias conflicts').selectOption('permissive');
  await page.getByRole('button', { name: 'Convert', exact: true }).click();
  await expect(output).not.toHaveText(':pa:');
  await expect(page.locator('[data-converter-diagnostics]')).toContainText(
    'documented fallback was used'
  );
});

test('docs, art licensing and picker integration seam are explicit', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme });
    await page.goto(ORIGIN);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      )
    ).toBeLessThanOrEqual(1);
  }
  await page.goto(`${ORIGIN}/docs/`);
  await expect(
    page.getByRole('link', { name: 'Read the universal-emoji-parser migration guide' })
  ).toHaveAttribute(
    'href',
    'https://github.com/DailybotHQ/texuli/blob/main/docs/emojis/MIGRATION.md'
  );
  await page.goto(`${ORIGIN}/licensing/`);
  await expect(
    page.getByText('Approved Texuli artwork: 0 of 3963 catalog sequences.')
  ).toBeVisible();
  await expect(page.getByText(/pending owner approval/)).toBeVisible();
  await page.goto(`${ORIGIN}/picker/`);
  await expect(page.locator('[data-emoji-picker-lab]')).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Component integration in progress' })
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    )
  ).toBeLessThanOrEqual(1);
});
