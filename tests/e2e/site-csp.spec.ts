/// <reference types="node" />
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize, sep } from 'node:path';
import { type BrowserContext, expect, type Page, test } from '@playwright/test';
import { DIST, settle } from './support/site.ts';

/*
 * The built site under its own enforced CSP (PLAN_011 Final Review): each
 * route is served with the exact `Content-Security-Policy` and
 * `Content-Security-Policy-Report-Only` lines the build wrote to `_headers`
 * (src/components/security/csp.ts), then opened, scrolled end to end so its
 * `client:visible` islands mount, and watched for every violation of every
 * directive, enforced or reported. A `<style>` an island injects at runtime
 * has no build-time hash, so it shows up here as `style-src-elem`.
 *
 * Run `pnpm build` first. The generation side (every inline source hashed)
 * is apps/website/tests/csp-coverage.mts (`check:csp`).
 */

/** Pages with live component demos (eager and on scroll), plus the shell. */
const ROUTES = [
  '/',
  '/component-pages/card/',
  '/component-pages/button/',
  '/component-pages/dialog/',
  '/component-pages/charts-line/',
  '/guides/theming/',
];

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

/** `_headers` → exact route → its CSP lines. */
function policies(): Map<string, { enforced: string; reportOnly: string }> {
  const rules = new Map<string, { enforced: string; reportOnly: string }>();
  let route = '';
  for (const line of readFileSync(join(DIST, '_headers'), 'utf8').split('\n')) {
    if (line.startsWith('/')) {
      route = line.trim();
      rules.set(route, { enforced: '', reportOnly: '' });
      continue;
    }
    const rule = rules.get(route);
    if (!rule) continue;
    const [name, ...value] = line.trim().split(': ');
    if (name === 'Content-Security-Policy') rule.enforced = value.join(': ');
    if (name === 'Content-Security-Policy-Report-Only') rule.reportOnly = value.join(': ');
  }
  return rules;
}

async function serveWithPolicies(context: BrowserContext, origin: string): Promise<void> {
  const rules = policies();
  await context.route(
    (url) => url.origin === origin,
    async (route) => {
      const pathname = decodeURIComponent(new URL(route.request().url()).pathname);
      const path = pathname.endsWith('/') ? `${pathname}index.html` : pathname;
      const file = normalize(join(DIST, path));
      if (!file.startsWith(DIST + sep) || !existsSync(file) || statSync(file).isDirectory()) {
        await route.fulfill({ status: 404, body: 'not found' });
        return;
      }
      const html = extname(file) === '.html';
      const rule = rules.get(pathname);
      await route.fulfill({
        status: 200,
        body: readFileSync(file),
        headers: {
          'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
          ...(html && rule
            ? {
                'content-security-policy': rule.enforced,
                'content-security-policy-report-only': rule.reportOnly,
              }
            : {}),
        },
      });
    }
  );
}

/** Every CSP violation the page raises, from before its first script runs. */
async function watchViolations(page: Page): Promise<() => Promise<string[]>> {
  await page.addInitScript(() => {
    const seen: string[] = [];
    (window as unknown as { __cspViolations: string[] }).__cspViolations = seen;
    document.addEventListener('securitypolicyviolation', (event) => {
      seen.push(
        `${event.disposition} ${event.effectiveDirective} ${event.blockedURI || 'inline'} ${event.sample}`.trim()
      );
    });
  });
  return () =>
    page.evaluate(() => (window as unknown as { __cspViolations: string[] }).__cspViolations);
}

/** Scrolls to the end in viewport steps, so every `client:visible` island mounts. */
async function scrollThrough(page: Page): Promise<void> {
  for (let step = 0; step < 60; step += 1) {
    const done = await page.evaluate(() => {
      window.scrollBy(0, window.innerHeight);
      return window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
    });
    await page.waitForTimeout(50);
    if (done) break;
  }
  await expect.poll(() => page.locator('astro-island[ssr]').count(), { timeout: 20_000 }).toBe(0);
}

test.beforeAll(() => {
  if (!existsSync(join(DIST, '_headers'))) throw new Error('Run `pnpm build` before this spec.');
});

test('live demo pages raise no CSP violation under their built policies', async ({
  context,
  baseURL,
}) => {
  test.setTimeout(180_000);
  const origin = new URL(baseURL as string).origin;
  const rules = policies();
  await serveWithPolicies(context, origin);
  for (const route of ROUTES) {
    await test.step(route, async () => {
      expect(rules.get(route)?.enforced, `${route} has an enforced policy`).toContain(
        "style-src 'self'"
      );
      const page = await context.newPage();
      const violations = await watchViolations(page);
      await page.goto(`${origin}${route}`);
      await settle(page);
      await scrollThrough(page);
      await page.waitForLoadState('networkidle');
      expect(await violations(), route).toEqual([]);
      await page.close();
    });
  }
});
