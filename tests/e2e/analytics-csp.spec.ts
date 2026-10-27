/// <reference types="node" />
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize, relative, resolve, sep } from 'node:path';
import { type BrowserContext, expect, type Page, test } from '@playwright/test';

/*
 * Analytics under the enforced CSP (PLAN_006 T-100, S-1). The site enforces
 * `require-trusted-types-for 'script'`, so the Umami loader must set its
 * script URL through the named `texuli-analytics` Trusted Types policy, and
 * the page policy must allow that name only where the loader is mounted.
 *
 * Every route is served from the BUILT output with its generated
 * `_headers` policies applied (read the same way tests/e2e/csp.spec.ts
 * reads them). Two builds give two halves:
 *
 * - Default build (no analytics env): every route's `trusted-types` stays
 *   exactly `svelte-trusted-html` — the analytics allowance never leaks
 *   into an analytics-off site.
 * - Analytics fixture build (`PUBLIC_UMAMI_WEBSITE_ID` set): the loader
 *   injects `/api/umami/script.js` under the enforced policy with zero
 *   CSP or Trusted Types violations, and the tracker runs.
 *
 *   PUBLIC_UMAMI_WEBSITE_ID=fixture-analytics-id pnpm --filter @texuli/website exec \
 *     astro build --outDir "$PWD/tmp/t100a-analytics-dist"
 *   TEXULI_ANALYTICS_DIST=tmp/t100a-analytics-dist TEXULI_E2E_PORT=4993 \
 *     pnpm exec playwright test tests/e2e/analytics-csp.spec.ts --project=chromium
 *
 * The fixture half skips against a default build. The static harness has
 * no functions, so `/api/umami/script.js` is answered here by a stand-in
 * tracker that defines `window.umami`; the real proxy is unit-proven in
 * apps/website/tests/umami-proxy.test.ts.
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

/** A stand-in tracker: proves the injected script really executed. */
const TRACKER_STUB = 'window.umami = { track() {} };';

type SitePolicyHeaders = { enforced: string; reportOnly: string };

/** Per-route policies from the build's `_headers` (the csp.spec.ts reader). */
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

type Finding = { kind: string; detail: string };

/** CSP and Trusted Types violations, in every way they surface. */
async function watchViolations(page: Page): Promise<Finding[]> {
  const findings: Finding[] = [];
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
      findings.push({ kind: `console.${message.type()}`, detail: text });
    }
  });
  page.on('pageerror', (error) => {
    findings.push({ kind: 'pageerror', detail: error.message });
  });
  return findings;
}

test.beforeAll(() => {
  if (!existsSync(join(DIST, '_headers'))) {
    throw new Error(`Run a website build first (no _headers in ${DIST}).`);
  }
});

test.describe('analytics · the Trusted Types allowance follows the mount', () => {
  test('a route allows texuli-analytics exactly when it mounts the loader', () => {
    const headers = siteHeaders();
    const pages = builtHtmlFiles(DIST);
    expect(pages.length).toBeGreaterThan(0);
    let mounted = 0;
    for (const file of pages) {
      const path = relative(DIST, file).split(sep).join('/');
      const route =
        path === 'index.html'
          ? '/'
          : path.endsWith('/index.html')
            ? `/${path.slice(0, -'index.html'.length)}`
            : `/${path}`;
      const html = readFileSync(file, 'utf8');
      const policy = headers.get(route)?.enforced ?? '';
      expect(policy, `${route} has an enforcing policy`).not.toBe('');
      const hasLoader = LOADER_TAG.test(html);
      if (hasLoader) mounted += 1;
      expect(directive(policy, 'require-trusted-types-for'), route).toBe("'script'");
      expect(directive(policy, 'trusted-types'), route).toBe(
        hasLoader ? 'svelte-trusted-html texuli-analytics' : 'svelte-trusted-html'
      );
    }
    // A default build mounts nothing; a fixture build mounts the shell-wide tag.
    expect(mounted > 0).toBe(fixtureBuild);
  });
});

test.describe('analytics · the loader injects under the enforced policy', () => {
  test.skip(
    !fixtureBuild,
    'fixture build only: PUBLIC_UMAMI_WEBSITE_ID=... (see the header comment)'
  );

  for (const route of ['/', '/guides/theming/']) {
    test(`zero CSP or Trusted Types violations on ${route}`, async ({ context, baseURL }) => {
      await serveSite(context, baseURL as string);
      const page = await context.newPage();
      const findings = await watchViolations(page);
      const scriptRequests: string[] = [];
      page.on('request', (request) => {
        if (request.url().includes('/api/umami/script.js')) scriptRequests.push(request.url());
      });
      const response = await page.goto(route);
      const enforced = response?.headers()['content-security-policy'] ?? '';
      expect(directive(enforced, 'require-trusted-types-for')).toBe("'script'");
      expect(directive(enforced, 'trusted-types')).toBe('svelte-trusted-html texuli-analytics');
      await page.waitForLoadState('load');
      // The tracker ran: the injected script was allowed to load and execute.
      await page.waitForFunction(() => 'umami' in window, null, { timeout: 10_000 });
      const injected = page.locator('script[data-website-id][src$="/api/umami/script.js"]');
      await expect(injected).toHaveCount(1);
      await expect(injected).toHaveAttribute('data-exclude-search', 'true');
      await expect(injected).toHaveAttribute('data-exclude-hash', 'true');
      expect(scriptRequests).toHaveLength(1);
      await page.waitForLoadState('networkidle');
      expect(findings).toEqual([]);
    });
  }
});
