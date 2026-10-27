/// <reference types="node" />
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize, relative, resolve, sep } from 'node:path';
import { type BrowserContext, expect, type Page, test } from '@playwright/test';

/*
 * Analytics (T-39, PLAN_006 T-100 S-1) against the BUILT site, every route
 * served with its generated `_headers` policies. Two builds give two halves:
 *
 * - Default build (no PUBLIC_UMAMI_WEBSITE_ID; what `pnpm build` and CI
 *   produce): no route mounts the loader, every route's `trusted-types`
 *   stays exactly `svelte-trusted-html`, and a real browser makes zero
 *   analytics requests.
 * - Analytics fixture build (PUBLIC_UMAMI_WEBSITE_ID set): the loader tag
 *   carries the same-origin proxy attributes, the loader injects
 *   `/api/umami/script.js` through the named `texuli-analytics` Trusted Types
 *   policy under the enforced CSP with zero violations, nothing goes to
 *   another origin, and an auditing client (Lighthouse) gets no injection.
 *   It skips against a default build:
 *
 *   PUBLIC_UMAMI_WEBSITE_ID=fixture-analytics-id pnpm --filter @texuli/website exec \
 *     astro build --outDir "$PWD/tmp/t100a-analytics-dist"
 *   TEXULI_ANALYTICS_DIST=tmp/t100a-analytics-dist TEXULI_E2E_PORT=4993 \
 *     pnpm exec playwright test tests/e2e/analytics.spec.ts --project=chromium
 *
 * The static harness has no functions, so `/api/umami/script.js` is answered
 * here by a stand-in tracker that defines `window.umami`; the real proxy is
 * unit-proven in apps/website/tests/umami-proxy.test.ts and the loader's skip
 * list in apps/website/tests/analytics-client.test.ts.
 */

const DIST = resolve(process.env.TEXULI_ANALYTICS_DIST ?? 'apps/website/dist');
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

/** The tag UmamiLoader.astro renders (an escaped code sample never matches). */
const LOADER_TAG = /<script\b[^>]*\sdata-umami-loader(?=[\s=>/])/i;

/** Anything that would smell like analytics leaving the site. */
const ANALYTICS_REQUEST = /\/api\/umami\/|umami-loader\.js|cloud\.umami\.is/;

/** A stand-in tracker: proves the injected script really executed. */
const TRACKER_STUB = 'window.umami = { track() {} };';

const LIGHTHOUSE_UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Chrome-Lighthouse';

/** Routes a browser visits on the default build (the PLAN_006 routes too). */
const SILENT_ROUTES = [
  '/',
  '/guides/',
  '/guides/theming/',
  '/component-pages/button/',
  '/native/',
  '/web-and-native/',
];

type SitePolicyHeaders = { enforced: string; reportOnly: string };

/** Per-route policies from the build's `_headers`. */
function siteHeaders(): Map<string, SitePolicyHeaders> {
  const headers = new Map<string, SitePolicyHeaders>();
  const rules = readFileSync(join(DIST, '_headers'), 'utf8').split('\n');
  let routePath = '';
  for (const line of rules) {
    if (line.startsWith('/')) {
      routePath = line;
      headers.set(routePath, { enforced: '', reportOnly: '' });
    } else if (line.startsWith('  Content-Security-Policy: ')) {
      const current = headers.get(routePath);
      if (current) current.enforced = line.slice('  Content-Security-Policy: '.length);
    } else if (line.startsWith('  Content-Security-Policy-Report-Only: ')) {
      const current = headers.get(routePath);
      if (current)
        current.reportOnly = line.slice('  Content-Security-Policy-Report-Only: '.length);
    }
  }
  return headers;
}

function directive(policy: string, name: string): string | undefined {
  return policy
    .split('; ')
    .find((entry) => entry.startsWith(`${name} `))
    ?.slice(name.length + 1);
}

function builtHtmlFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory()
      ? builtHtmlFiles(path)
      : name.endsWith('.html')
        ? [path]
        : [];
  });
}

const indexHtml = existsSync(join(DIST, 'index.html'))
  ? readFileSync(join(DIST, 'index.html'), 'utf8')
  : '';
const fixtureBuild = LOADER_TAG.test(indexHtml);

/** Serve the build with its generated per-route headers on the test origin. */
async function serveSite(context: BrowserContext, baseURL: string): Promise<void> {
  const headers = siteHeaders();
  const origin = new URL(baseURL).origin;
  await context.route(
    (url) => url.origin === origin,
    async (route) => {
      const url = new URL(route.request().url());
      const pathname = decodeURIComponent(url.pathname);
      if (pathname === '/api/umami/script.js') {
        await route.fulfill({
          status: 200,
          body: TRACKER_STUB,
          headers: { 'content-type': TYPES['.js'] as string },
        });
        return;
      }
      const path = pathname.endsWith('/') ? `${pathname}index.html` : pathname;
      const file = normalize(join(DIST, path));
      const candidate =
        existsSync(file) && statSync(file).isDirectory() ? join(file, 'index.html') : file;
      if (!candidate.startsWith(DIST + sep) || !existsSync(candidate)) {
        await route.fulfill({ status: 404, body: 'not found' });
        return;
      }
      await route.fulfill({
        status: 200,
        body: readFileSync(candidate),
        headers: {
          'content-type': TYPES[extname(candidate)] ?? 'application/octet-stream',
          ...(extname(candidate) === '.html'
            ? {
                'content-security-policy': headers.get(pathname)?.enforced ?? '',
                'content-security-policy-report-only': headers.get(pathname)?.reportOnly ?? '',
              }
            : {}),
        },
      });
    }
  );
}

/** Every analytics request a page makes, recorded from now on. */
function analyticsRequests(page: Page): string[] {
  const seen: string[] = [];
  page.on('request', (request) => {
    if (ANALYTICS_REQUEST.test(request.url())) seen.push(request.url());
  });
  return seen;
}

/** CSP and Trusted Types violations, in every way they surface. */
async function watchViolations(page: Page): Promise<string[]> {
  const findings: string[] = [];
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (event) => {
      console.error(
        `securitypolicyviolation ${event.disposition} ${event.effectiveDirective} blocked ${event.blockedURI || '(inline)'} at ${event.sourceFile}:${event.lineNumber} ${event.sample}`
      );
    });
  });
  page.on('console', (message) => {
    const text = message.text();
    if (
      message.type() === 'error' ||
      /Content[- ]Security[- ]Policy|Trusted ?Type|Refused to/i.test(text)
    ) {
      findings.push(`console.${message.type()}: ${text}`);
    }
  });
  page.on('pageerror', (error) => findings.push(`pageerror: ${error.message}`));
  return findings;
}

test.beforeAll(() => {
  if (!existsSync(join(DIST, '_headers'))) {
    throw new Error(`Run a website build first (no _headers in ${DIST}).`);
  }
});

test('the Trusted Types allowance follows the loader mount; a default build is silent', async ({
  context,
  page,
  baseURL,
}) => {
  const headers = siteHeaders();
  const pages = builtHtmlFiles(DIST);
  expect(pages.length).toBeGreaterThan(100);
  let mounted = 0;
  for (const file of pages) {
    const route = `/${relative(DIST, file).split(sep).join('/')}`.replace(
      /(^|\/)index\.html$/,
      '$1'
    );
    const html = readFileSync(file, 'utf8');
    const policy = headers.get(route)?.enforced ?? '';
    expect(policy, `${route} has an enforcing policy`).not.toBe('');
    const hasLoader = LOADER_TAG.test(html);
    if (hasLoader) mounted += 1;
    expect(directive(policy, 'require-trusted-types-for'), route).toBe("'script'");
    expect(directive(policy, 'trusted-types'), route).toBe(
      hasLoader ? 'svelte-trusted-html texuli-analytics' : 'svelte-trusted-html'
    );
    if (!fixtureBuild) expect(html, route).not.toMatch(/umami-loader|cloud\.umami\.is/);
  }
  // A default build mounts nothing; a fixture build mounts the shell-wide tag.
  expect(mounted > 0).toBe(fixtureBuild);
  if (fixtureBuild) return;

  await serveSite(context, baseURL as string);
  const requests = analyticsRequests(page);
  for (const route of SILENT_ROUTES) {
    await page.goto(route);
    await page.waitForLoadState('load');
  }
  expect(requests, 'zero analytics requests').toEqual([]);
});

test('the enabled path stays first-party under the enforced policy and skips audits', async ({
  browser,
  context,
  baseURL,
}) => {
  test.skip(!fixtureBuild, 'fixture build only: PUBLIC_UMAMI_WEBSITE_ID=... (see the header)');
  expect(indexHtml).toContain('src="/umami-loader.js"');
  expect(indexHtml).toContain('data-script-src="/api/umami/script.js"');
  expect(indexHtml).toContain('data-website-id=');
  expect(indexHtml).toContain('data-host-url="/api/umami"');
  expect(indexHtml).not.toContain('cloud.umami.is');

  await serveSite(context, baseURL as string);
  const origin = new URL(baseURL as string).origin;
  for (const route of ['/', '/guides/theming/']) {
    await test.step(`zero CSP or Trusted Types violations on ${route}`, async () => {
      const page = await context.newPage();
      const findings = await watchViolations(page);
      const requests = analyticsRequests(page);
      const response = await page.goto(route);
      const enforced = response?.headers()['content-security-policy'] ?? '';
      expect(directive(enforced, 'require-trusted-types-for')).toBe("'script'");
      expect(directive(enforced, 'trusted-types')).toBe('svelte-trusted-html texuli-analytics');
      // The tracker ran: the injected script was allowed to load and execute.
      await page.waitForFunction(() => 'umami' in window, null, { timeout: 10_000 });
      const injected = page.locator('script[data-website-id][src$="/api/umami/script.js"]');
      await expect(injected).toHaveCount(1);
      await expect(injected).toHaveAttribute('data-exclude-search', 'true');
      await expect(injected).toHaveAttribute('data-exclude-hash', 'true');
      await page.waitForLoadState('networkidle');
      expect(requests.some((url) => url.includes('/umami-loader.js'))).toBe(true);
      expect(requests.filter((url) => url.includes('/api/umami/script.js'))).toHaveLength(1);
      expect(requests.filter((url) => new URL(url).origin !== origin)).toEqual([]);
      expect(findings).toEqual([]);
      await page.close();
    });
  }

  await test.step('an auditing client gets no injection', async () => {
    const audit = await browser.newContext({ userAgent: LIGHTHOUSE_UA });
    await serveSite(audit, baseURL as string);
    const page = await audit.newPage();
    const requests = analyticsRequests(page);
    await page.goto('/');
    await page.waitForLoadState('load');
    await page.waitForTimeout(250);
    // The loader file is mounted (the tag is in the HTML) but it must inject
    // nothing for the Lighthouse family.
    expect(requests.some((url) => url.includes('/umami-loader.js'))).toBe(true);
    expect(requests.filter((url) => url.includes('/api/umami/script.js'))).toEqual([]);
    await audit.close();
  });
});
