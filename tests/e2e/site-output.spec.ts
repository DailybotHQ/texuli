import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';
import {
  AXE_TAGS,
  expectMode,
  polishProblems,
  serveDist,
  settle,
  settleAnimations,
} from './support/site.ts';

/*
 * texuli.com /output-page/ (PLAN_010 T-site-080), in the browser:
 *
 * 1. the email preview is a sandboxed frame onto a static file (no
 *    scripts, its own CSP); the email lab renders the digest live, shows
 *    the source and the plain text as text, downloads the .html, and
 *    refuses the javascript: link with nothing written; axe in light and
 *    dark with every island hydrated;
 * 2. print and PDF: the player paints the digest in print mode, and the
 *    PDF is a real download written in the tab;
 * 3. i18n: the Spanish catalog loads lazily and relabels the components,
 *    the pseudo-locale brackets them, plurals follow the locale; at 360 px
 *    nothing overflows.
 *
 * Data and copy are unit-tested in apps/website/tests/site-output.test.ts.
 */

const origin = serveDist();

/**
 * axe on the page with no disabled rules, skipping only the scriptless
 * sandboxed email frame (axe cannot run inside a frame without scripts and
 * waits for it); the email document gets its own axe run as a top-level page.
 */
async function axeOutsideSandbox(page: Page): Promise<string[]> {
  await settleAnimations(page);
  const result = await new AxeBuilder({ page })
    .withTags(AXE_TAGS)
    .exclude('iframe[sandbox=""]')
    .analyze();
  return result.violations.map(
    (violation) =>
      `${violation.id} (${violation.impact}): ${violation.nodes.map((node) => node.target.join(' ')).join(' | ')}`
  );
}

function watchForeign(page: Page): string[] {
  const foreign: string[] = [];
  page.on('request', (request) => {
    const url = request.url();
    if (!url.startsWith(origin()) && !url.startsWith('data:') && !url.startsWith('blob:'))
      foreign.push(url);
  });
  return foreign;
}

async function hydrated(page: Page, selector: string): Promise<void> {
  await page.locator(selector).first().scrollIntoViewIfNeeded();
  await expect(page.locator(`astro-island:not([ssr]) ${selector}`).first()).toBeVisible({
    timeout: 20_000,
  });
}

async function open(page: Page): Promise<string[]> {
  const foreign = watchForeign(page);
  await page.goto(`${origin()}/output-page/`);
  await settle(page);
  return foreign;
}

test('email: a sandboxed static preview, a live render, refusals; axe light and dark', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const foreign = await open(page);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'One blueprint: a page, an email, a PDF, in any language'
  );
  await expect(page.locator('[data-output-outcome="script-link"]')).toContainText('Refused');

  // The preview frame, on request: sandboxed, a same-origin static file, the email inside.
  await hydrated(page, '[data-output-email-preview]');
  await expect(page.locator('[data-output-email-frame]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Show the rendered email' }).first().click();
  const frame = page.locator('[data-output-email-frame]');
  await frame.scrollIntoViewIfNeeded();
  await expect(frame).toHaveAttribute('sandbox', '');
  await expect(frame).not.toHaveAttribute('srcdoc', /.*/);
  const preview = page.frameLocator('[data-output-email-frame]');
  await expect(preview.getByRole('heading', { name: 'Harbor weekly digest' })).toBeVisible({
    timeout: 20_000,
  });
  await expect(preview.getByRole('link', { name: 'Open the dashboard' })).toHaveAttribute(
    'href',
    'https://example.com/dashboard'
  );
  const response = await page.request.get(`${origin()}/output-page/preview/`);
  const html = await response.text();
  expect(html).not.toMatch(/<script|\son[a-z]+=/i);
  expect(html).toContain('<meta name="robots" content="noindex">');

  await hydrated(page, '[data-output-email]');
  await page.getByRole('button', { name: 'Render the email' }).click();
  await expect(page.locator('[data-output-email-ok]')).toContainText('Rendered:', {
    timeout: 20_000,
  });
  const source = page.locator('[data-output-email-source]');
  await expect(source).toContainText('<!doctype html>');
  await expect(page.locator('[data-output-email-diagnostics]')).toContainText('email-unsupported');
  await page.getByRole('button', { name: 'Plain-text part' }).click();
  await expect(source).toContainText('Open the dashboard: https://example.com/dashboard');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download the .html' }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('weekly-digest.html');
  await page.getByLabel('Direction').selectOption('rtl');
  await page.getByRole('button', { name: 'HTML source' }).click();
  await expect(source).toContainText('dir="rtl"');
  await page.getByRole('button', { name: 'With a javascript: link' }).click();
  await expect(page.locator('[data-output-email-refused]')).toContainText('no HTML and no text');
  await expect(source).toHaveCount(0);

  for (const selector of ['[data-output-print]', '[data-output-i18n]']) {
    await hydrated(page, selector);
  }
  await expect(page.locator('[data-output-print-stage] [data-tx-player-print]')).toBeVisible({
    timeout: 20_000,
  });
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await expectMode(page, scheme);
    expect(await axeOutsideSandbox(page), scheme).toEqual([]);
  }
  expect(errors).toEqual([]);
  expect(foreign).toEqual([]);

  // The email document itself, as a top-level page: clean under the WCAG rules. The
  // landmark best practices (one main, content in regions) do not apply to an email.
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto(`${origin()}/output-page/preview/`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Harbor weekly digest');
  const wcag = await new AxeBuilder({ page })
    .withTags(AXE_TAGS.filter((tag) => tag.startsWith('wcag')))
    .analyze();
  expect(wcag.violations.map((violation) => violation.id)).toEqual([]);
});

test('print mode and a PDF written in the tab', async ({ page }) => {
  test.setTimeout(90_000);
  await open(page);
  await hydrated(page, '[data-output-print]');
  const stage = page.locator('[data-output-print-stage]');
  await expect(stage.locator('[data-tx-player-print]')).toBeVisible({ timeout: 20_000 });
  await expect(stage.getByText('Harbor weekly digest').first()).toBeVisible();
  await page.getByLabel('Print mode on screen').uncheck();
  await expect(stage.locator('[data-tx-player-print]')).toHaveCount(0);
  await page.getByLabel('Page size').selectOption('letter');
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 30_000 }),
    page.getByRole('button', { name: 'Download the PDF' }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('weekly-digest.pdf');
  await expect(page.locator('[data-output-print-status]')).toContainText('Saved weekly-digest.pdf');
});

test('i18n: a lazy Spanish catalog, the pseudo-locale and plurals; 360 px fits', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 360, height: 800 });
  await open(page);
  await hydrated(page, '[data-output-i18n]');
  const demo = page.locator('[data-output-i18n]');
  const stage = page.locator('[data-output-i18n-stage]');
  await expect(stage.getByRole('button', { name: 'Remove launch' })).toBeVisible();
  await expect(page.locator('[data-output-i18n-plural]')).toHaveText('1 file');
  await demo.getByRole('radio', { name: /Español/ }).check();
  await expect(page.locator('[data-output-i18n-status]')).toContainText('Español');
  await expect(stage).toHaveAttribute('lang', 'es');
  await expect(stage.getByRole('button', { name: 'Quitar launch' })).toBeVisible();
  await expect(stage.getByRole('button', { name: 'Copiar' })).toBeVisible();
  await expect(page.locator('[data-output-i18n-plural]')).toHaveText('1 archivo');
  await demo.getByLabel('Files').fill('3');
  await expect(page.locator('[data-output-i18n-plural]')).toHaveText('3 archivos');
  await demo.getByRole('radio', { name: /Pseudo-locale/ }).check();
  await expect(stage).toHaveAttribute('lang', 'en-XA');
  await expect(stage.getByRole('button', { name: /^⟦.*⟧$/ }).first()).toBeVisible();
  // The instance prop stays as written: the tag group keeps its name.
  await expect(stage.getByRole('group', { name: 'Topics' })).toBeVisible();
  await hydrated(page, '[data-output-email]');
  await hydrated(page, '[data-output-print]');
  expect(await polishProblems(page)).toEqual([]);
});
