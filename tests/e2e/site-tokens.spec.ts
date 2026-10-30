/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, type Page, test } from '@playwright/test';
import { COMPONENT_TOKEN_FAMILIES, COMPONENT_TOKENS } from '@texuli/tokens/components';
import { SYSTEM_TOKEN_FAMILIES, SYSTEM_TOKENS } from '@texuli/tokens/system';
import { DESIGN_DEFAULTS_VOCABULARY } from 'texuli/defaults';
import {
  axeViolations,
  DIST,
  expectMode,
  polishProblems,
  serveDist,
  settle,
} from './support/site.ts';

/*
 * texuli.com /tokens/ and /tokens/components/ (PLAN_011 T-site-090) on the
 * built site (`pnpm build` first): the token contract v2 reference renders
 * the registries (system token rows per family, component token rows per
 * component and the defaults vocabulary equal `@texuli/tokens/system`,
 * `@texuli/tokens/components` and `texuli/defaults`), every anchor and link
 * resolves, both pages are axe-clean in light and dark, ship no island, and
 * their Markdown twins carry the tokens. The page model is unit-tested in
 * apps/website/tests/site-mcp-tokens.test.ts.
 */

const origin = serveDist();

async function expectLinksResolve(page: Page, minimum: number): Promise<void> {
  const hrefs = await page
    .locator('main a[href]')
    .evaluateAll((links) => [...new Set(links.map((link) => link.getAttribute('href') ?? ''))]);
  expect(hrefs.length).toBeGreaterThanOrEqual(minimum);
  for (const href of hrefs) {
    if (href.startsWith('#')) {
      await expect(page.locator(`[id="${href.slice(1)}"]`), href).toHaveCount(1);
      continue;
    }
    if (/^https?:/.test(href)) {
      expect(href, href).toMatch(/^https:\/\/github\.com\/DailybotHQ\/texuli\//);
      continue;
    }
    expect(href, href).toMatch(/^\/(?!\/)/);
    const response = await page.request.get(`${origin()}${href.replace(/#.*$/, '')}`);
    expect(response.status(), href).toBe(200);
  }
}

async function expectClean(page: Page, route: string): Promise<void> {
  for (const mode of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: mode, reducedMotion: 'reduce' });
    await page.goto(`${origin()}${route}`);
    await settle(page);
    await expectMode(page, mode);
    expect(await axeViolations(page), `${route} ${mode}`).toEqual([]);
    expect(await polishProblems(page), `${route} ${mode}`).toEqual([]);
  }
}

test('/tokens/: every system family and token, the defaults vocabulary', async ({ page }) => {
  await page.goto(`${origin()}/tokens/`);
  await settle(page);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Design tokens');
  // Released with 0.9.0: the in-development status line is gone.
  await expect(page.locator('[data-tokens-status]')).toHaveCount(0);
  await expect(page.locator('[data-tokens-count-system]')).toHaveText(String(SYSTEM_TOKENS.length));
  await expect(page.locator('[data-tokens-family]')).toHaveCount(SYSTEM_TOKEN_FAMILIES.length);
  await expect(page.locator('[data-tokens-family] tbody tr')).toHaveCount(SYSTEM_TOKENS.length);
  for (const family of SYSTEM_TOKEN_FAMILIES) {
    const rows = page.locator(`[data-tokens-family="${family.id}"] tbody tr`);
    await expect(rows, family.id).toHaveCount(family.tokens.length);
    const first = family.tokens[0];
    if (first) await expect(rows.first().locator('td').nth(1), family.id).toHaveText(first.value);
  }
  await expect(page.locator('[data-tokens-defaults] tbody tr')).toHaveCount(
    Object.keys(DESIGN_DEFAULTS_VOCABULARY).length
  );
  for (const id of ['scope', 'drivers', 'hooks', 'defaults', 'system'])
    await expect(page.locator(`[id="${id}"]`), id).toHaveCount(1);
  await expect(page.locator('main')).toContainText('data-tx-scope');
  await expect(page.locator('main')).toContainText('setDesignDefaults');
  await expect(page.locator('main astro-island')).toHaveCount(0);

  const twin = readFileSync(join(DIST, 'tokens.md'), 'utf8');
  for (const token of SYSTEM_TOKENS) expect(twin, token.name).toContain(token.name);
});

test('/tokens/components/: every component token with its fallback', async ({ page }) => {
  await page.goto(`${origin()}/tokens/components/`);
  await settle(page);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Component tokens');
  await expect(page.locator('[data-tokens-count-component]')).toHaveText(
    String(COMPONENT_TOKENS.length)
  );
  await expect(page.locator('[data-tokens-count-components]')).toHaveText(
    String(COMPONENT_TOKEN_FAMILIES.length)
  );
  await expect(page.locator('[data-tokens-component]')).toHaveCount(
    COMPONENT_TOKEN_FAMILIES.length
  );
  await expect(page.locator('[data-tokens-component] tbody tr')).toHaveCount(
    COMPONENT_TOKENS.length
  );
  for (const family of COMPONENT_TOKEN_FAMILIES) {
    const rows = page.locator(`[data-tokens-component="${family.component}"] tbody tr`);
    await expect(rows, family.component).toHaveCount(family.tokens.length);
    // Each row is key, fallback, meaning, in registry order.
    const cells = await rows.evaluateAll((trs) =>
      trs.map((tr) => [...tr.querySelectorAll('td')].slice(0, 2).map((td) => td.textContent))
    );
    expect(cells, family.component).toEqual(
      family.tokens.map((token) => [token.key, token.default])
    );
  }
  await expect(page.locator('main astro-island')).toHaveCount(0);

  const twin = readFileSync(join(DIST, 'tokens', 'components.md'), 'utf8');
  for (const family of COMPONENT_TOKEN_FAMILIES)
    expect(twin, family.component).toContain(`--tx-${family.component}-*`);
});

test('axe-clean in light and dark; every anchor and link resolves', async ({ page }) => {
  test.setTimeout(120_000);
  for (const route of ['/tokens/', '/tokens/components/']) {
    await expectClean(page, route);
    await expectLinksResolve(page, route === '/tokens/' ? 10 : 60);
  }
});
