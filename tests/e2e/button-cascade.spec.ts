/**
 * Host CSS layer contract for anchor Buttons: a host that layers its element
 * defaults before Texuli's keeps Button colors, and a later host layer can
 * still override them. Cascade layers need a real browser engine.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';

const BUTTON_CSS = readFileSync(
  join(process.cwd(), 'packages/texuli/src/components/button/button.css'),
  'utf8'
);
const SITE_LAYERS = readFileSync(
  join(process.cwd(), 'apps/website/src/styles/site-layers.css'),
  'utf8'
);

function pageHtml(extraHead: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<style>
:root {
  --tx-primary: #1e3a5f;
  --tx-primary-foreground: #ffffff;
  --tx-link: #47658d;
}
@layer site-base, tx.base, tx.components, site-overrides;
@layer site-base {
  a { color: var(--tx-link); }
}
${BUTTON_CSS}
${extraHead}
</style>
</head>
<body>${body}</body>
</html>`;
}

test.describe('Button cascade with host layers', () => {
  test('ships no unlayered anchor pin rules, and the site layers its element defaults first', () => {
    expect(BUTTON_CSS).not.toMatch(/^\s*a\.tx-button/m);
    expect(BUTTON_CSS).toContain('@layer tx.components');
    expect(SITE_LAYERS).toContain('@layer site-base, tx.base, tx.components, site-overrides');
    expect(SITE_LAYERS).toMatch(/@layer site-base\s*\{[\s\S]*\ba\s*\{/);
  });

  test('keeps primary-foreground under a layered host a { color }', async ({ page }) => {
    await page.setContent(
      pageHtml(
        '',
        '<a class="tx-button tx-button--default tx-button--md" href="#get-started">Start free</a>'
      )
    );
    const color = await page
      .locator('a.tx-button--default')
      .evaluate((el) => getComputedStyle(el).color);
    expect(color).toMatch(/rgb\(\s*255,\s*255,\s*255\s*\)/);
  });

  test('lets a consumer class in a later host layer win over the button color', async ({
    page,
  }) => {
    await page.setContent(
      pageHtml(
        '@layer site-overrides { .tx-button.consumer-ink { color: rgb(10, 20, 30); } }',
        '<a class="tx-button tx-button--default tx-button--md consumer-ink" href="#x">Override me</a>'
      )
    );
    const color = await page.locator('a.consumer-ink').evaluate((el) => getComputedStyle(el).color);
    expect(color).toMatch(/rgb\(\s*10,\s*20,\s*30\s*\)/);
  });
});
