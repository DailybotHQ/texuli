/// <reference types="node" />
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { expect, test } from '@playwright/test';
import { auditAeo, collectAeo } from '../../scripts/audit-aeo.mjs';
import { auditSite, collectDist } from '../../scripts/audit-seo.mjs';
import { DIST, serveDist, settle } from './support/site.ts';

/*
 * texuli.com SEO and AEO, on the built site (`pnpm build` first). The build
 * output is audited once with the offline auditors the reports use
 * (scripts/audit-seo.mjs, scripts/audit-aeo.mjs; their rules are unit-tested
 * in scripts/tests/audit-*.test.ts): every indexed page's head, canonical,
 * Open Graph, JSON-LD and 1200x630 social image, the sitemap and robots, the
 * root llms.txt, the markdown twins and their manifest, and the .well-known
 * files. Every same-origin link in the built HTML must resolve. The helpers
 * and JSON-LD builders behind them are unit-tested in
 * apps/website/tests/site-build-guards.test.ts. In the browser: the 404 page.
 */

const origin = serveDist();

/** Every built HTML file under dist. */
function htmlFiles(dir = DIST): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return htmlFiles(full);
    return entry.name.endsWith('.html') ? [full] : [];
  });
}

test('the built site passes the SEO and AEO audits, and every internal link resolves', () => {
  const seo = auditSite(collectDist(DIST));
  expect(seo.summary.pages.indexed).toBeGreaterThan(100);
  expect(seo.findings.filter((finding) => finding.severity === 'critical')).toEqual([]);
  const aeo = auditAeo(collectAeo(DIST));
  expect(aeo.summary.surface.twins).toBeGreaterThan(50);
  expect(aeo.summary.surface.wellKnownFiles).toBe(4);
  expect(aeo.findings.filter((finding) => finding.severity === 'critical')).toEqual([]);

  // Same-origin links: a file, a directory page or an `.html` page in dist.
  const seen = new Map<string, boolean>();
  const broken: string[] = [];
  let links = 0;
  for (const file of htmlFiles()) {
    const html = readFileSync(file, 'utf8');
    for (const match of html.matchAll(/<a\b[^>]*\shref="(\/[^"/][^"]*|\/)"/g)) {
      links += 1;
      const path = decodeURIComponent((match[1] as string).replace(/[?#].*$/, ''));
      let ok = seen.get(path);
      if (ok === undefined) {
        const target = join(DIST, path);
        ok =
          (existsSync(target) && statSync(target).isFile()) ||
          existsSync(join(target, 'index.html')) ||
          existsSync(`${target.replace(/\/$/, '')}.html`);
        seen.set(path, ok);
      }
      if (!ok) broken.push(`${relative(DIST, file)} -> ${match[1]}`);
    }
  }
  expect(links).toBeGreaterThan(10_000);
  expect(broken.slice(0, 20)).toEqual([]);
});

test('an unknown path gets the 404 page: noindex, no echo, home link, skip link to main', async ({
  page,
}) => {
  const foreign: string[] = [];
  page.on('request', (request) => {
    if (!request.url().startsWith(origin())) foreign.push(request.url());
  });
  const response = await page.goto(`${origin()}/no-such-page/`);
  await settle(page);
  expect(response?.status()).toBe(404);
  expect(foreign).toEqual([]);
  await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible();
  await expect(page.locator('head meta[name="robots"]')).toHaveAttribute('content', 'noindex');
  await expect(page.locator('head link[rel="canonical"]')).toHaveCount(0);
  await expect(page.locator('head meta[property="og:image"]')).toHaveCount(0);
  // The requested path is not echoed back into the page.
  expect(await page.locator('main').textContent()).not.toContain('no-such-page');
  const home = page.getByRole('main').getByRole('link', { name: 'Home' });
  await expect(home).toHaveAttribute('href', '/');
  // Keyboard: the skip link comes first and moves focus to main.
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('main')).toBeFocused();
});
