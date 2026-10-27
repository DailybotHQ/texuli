import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { serveDist, settle } from './support/site.ts';

/*
 * texuli.com agent playground, in the browser: the default safe card renders
 * with a clean validation state, a hostile preset becomes a placeholder or
 * diagnostics, invalid JSON surfaces a parse alert, and the rendered preview
 * passes axe in light and dark. The presets, the run pipeline and the
 * screen-reader output are unit-tested in apps/website/tests/studios.test.ts,
 * playground-sr.test.ts and scripts/tests/site-loaders.test.ts.
 */

const origin = serveDist();

test('renders the safe card, contains a hostile preset, flags bad JSON, axe clean when rendered', async ({
  page,
}) => {
  const foreign: string[] = [];
  page.on('request', (request) => {
    if (!request.url().startsWith(origin())) foreign.push(request.url());
  });
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto(`${origin()}/playground/`);
    await settle(page);
    await page.getByRole('button', { name: 'Render tree' }).click();
    await expect(page.locator('[data-tx-playground-tree] [data-id="card"]').first()).toBeVisible();
    await expect(page.locator('[data-tx-playground-ok]')).toBeVisible();
    await expect(page.locator('[data-tx-playground-meta]')).toContainText('Roots:');
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(results.violations.map((v) => `${scheme} ${v.id}: ${v.help}`)).toEqual([]);
  }

  const select = page.getByLabel('Preset', { exact: true });
  const options = await select
    .locator('option')
    .evaluateAll((els) => els.map((el) => (el as HTMLOptionElement).value));
  const hostile =
    options.find((v) => v.includes('fake-dialog') || v.includes('dialog-overlay')) ??
    options.find((v) => v.startsWith('hostile-'));
  expect(hostile).toBeTruthy();
  await select.selectOption(hostile as string);
  await page.getByRole('button', { name: 'Render tree' }).click();
  await expect(
    page
      .locator('[data-tx-playground-tree] [data-kind="placeholder"]')
      .or(page.locator('[data-tx-playground-diagnostics]'))
      .first()
  ).toBeVisible();
  await expect(page.locator('[data-tx-playground-tree] [role="dialog"]')).toHaveCount(0);

  await page.getByLabel('Catalog tree JSON').fill('{ not-json');
  await page.getByRole('button', { name: 'Render tree' }).click();
  await expect(page.locator('[data-tx-playground-parse-error]')).toContainText(
    /JSON parse failed/i
  );
  expect(foreign).toEqual([]);
});
