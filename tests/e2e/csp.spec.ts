/**
 * Strict CSP and Trusted Types (Task 230 of PLAN_001_texuli_master): every
 * registered example renders under an enforced strict Content-Security-Policy
 * with `require-trusted-types-for 'script'`, with zero violations.
 *
 * The Vite dev server injects `<style>` elements from JavaScript, which a strict
 * `style-src` blocks, so this spec checks the production build: it builds the
 * fixture app once per run (shared by the workers, keyed by the runner's pid)
 * and serves it through Playwright routing with the policy as a response
 * header, on the same origin as the configured port. No other server runs.
 *
 * Fix findings at their source; never loosen the policy. See docs/quality/csp.md.
 */
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { extname, join, normalize, relative, resolve, sep } from 'node:path';
import { type BrowserContext, expect, type Page, test } from '@playwright/test';
import {
  pagePolicy,
  pageRoute,
  reportOnlyPolicy,
} from '../../apps/website/src/components/security/csp.ts';
import { listExampleIds } from '../fixtures/app/src/examples.ts';

/** The only Trusted Types policy allowed: Svelte's own, for its template HTML. */
export const TRUSTED_TYPES_POLICIES = ['svelte-trusted-html'] as const;

/**
 * Fictional hosts the examples point at to demonstrate the URL policy and
 * image fallbacks (`.example` / `.test` names never resolve). A real app lists
 * its own media hosts here; none of this reaches scripts or styles.
 */
export const EXAMPLE_MEDIA_HOSTS = [
  'https://example.com',
  'https://images.example.com',
  'https://media.example.test',
] as const;

export const CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  // data: placeholders and blob: previews are images, never script.
  `img-src 'self' data: blob: ${EXAMPLE_MEDIA_HOSTS.join(' ')}`,
  "font-src 'self'",
  // The video and audio players play local files from blob: URLs.
  `media-src 'self' blob: ${EXAMPLE_MEDIA_HOSTS.join(' ')}`,
  "connect-src 'self'",
  "worker-src 'self'",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "require-trusted-types-for 'script'",
  `trusted-types ${TRUSTED_TYPES_POLICIES.join(' ')}`,
].join('; ');

const ROOT = resolve(import.meta.dirname, '../..');
const PORT = Number(process.env.TEXULI_E2E_PORT ?? 4870);
const BUILDS = join(ROOT, 'test-results', `port-${PORT}`, 'csp-builds');
// Every worker of one run shares the runner as its parent process.
const DIST = join(BUILDS, `run-${process.ppid}`);
const SITE_DIST = join(ROOT, 'apps/website/dist');
const DONE = join(DIST, '.done');
const LOCK = `${DIST}.lock`;

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.vtt': 'text/vtt',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
};

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** Builds that belong to finished runs are removed, so the folder never grows. */
function pruneStaleBuilds(): void {
  if (!existsSync(BUILDS)) return;
  for (const name of readdirSync(BUILDS)) {
    const pid = Number(/^run-(\d+)/.exec(name)?.[1]);
    if (pid && pid !== process.ppid && !alive(pid)) {
      rmSync(join(BUILDS, name), { recursive: true, force: true });
    }
  }
}

async function ensureBuild(): Promise<void> {
  if (existsSync(DONE)) return;
  mkdirSync(BUILDS, { recursive: true });
  let owner = false;
  try {
    mkdirSync(LOCK);
    owner = true;
  } catch {
    // Another worker of this run is building.
  }
  if (owner) {
    pruneStaleBuilds();
    const { build } = await import('vite');
    const app = join(ROOT, 'tests/fixtures/app');
    await build({
      root: app,
      configFile: join(app, 'vite.config.ts'),
      logLevel: 'error',
      build: { outDir: DIST, emptyOutDir: true, target: 'esnext', reportCompressedSize: false },
    });
    writeFileSync(DONE, '');
    return;
  }
  const deadline = Date.now() + 15 * 60_000;
  while (!existsSync(DONE)) {
    if (Date.now() > deadline) throw new Error('csp: timed out waiting for the fixture build');
    await new Promise((done) => setTimeout(done, 500));
  }
}

/**
 * A page module served from 'self': its code runs under the page's policy,
 * unlike `page.evaluate`, which the browser exempts from CSP. Each probe tries
 * something the policy must block and records how it ended.
 */
const PROBE_PATH = '/__csp-probe.js';
const PROBE_MODULE = `
const outcome = (run) => {
  try { run(); return 'allowed'; } catch (error) { return error && error.name ? error.name : 'blocked'; }
};
const style = document.createElement('style');
style.textContent = 'body { outline: 3px solid red; }';
document.head.append(style);
const attr = document.createElement('div');
document.body.append(attr);
attr.setAttribute('style', 'outline: 3px solid red');
export const results = {
  trustedTypes: 'trustedTypes' in window,
  innerHTML: outcome(() => { document.createElement('div').innerHTML = '<b>raw</b>'; }),
  insertAdjacentHTML: outcome(() => { document.body.insertAdjacentHTML('beforeend', '<i></i>'); }),
  extraPolicy: outcome(() => window.trustedTypes && window.trustedTypes.createPolicy('rogue', {})),
  eval: outcome(() => (0, eval)('1 + 1')),
  newFunction: outcome(() => new Function('return 1')),
  injectedStyle: getComputedStyle(document.body).outlineStyle === 'solid' ? 'allowed' : 'blocked',
  styleAttribute: getComputedStyle(attr).outlineStyle === 'solid' ? 'allowed' : 'blocked',
};
style.remove();
attr.remove();
`;

/** A bare native select, appended by page code under the policy (the WebKit canary). */
const SELECT_MODULE = `
const select = document.createElement('select');
select.setAttribute('aria-label', 'Canary');
for (const value of ['1', '2']) select.append(new Option(value, value));
document.body.append(select);
`;

/** Serves the build for the fixture origin; every response carries the policy. */
async function serveBuild(context: BrowserContext, baseURL: string): Promise<void> {
  const origin = new URL(baseURL).origin;
  await context.route(
    (url) => url.origin === origin,
    async (route) => {
      const url = new URL(route.request().url());
      const headers = { 'content-security-policy': CSP };
      if (url.pathname === PROBE_PATH) {
        await route.fulfill({
          status: 200,
          body: url.search === '?select' ? SELECT_MODULE : PROBE_MODULE,
          headers: { ...headers, 'content-type': TYPES['.js'] as string },
        });
        return;
      }
      const path = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname);
      const file = normalize(join(DIST, path));
      if (!file.startsWith(DIST + sep) || !existsSync(file)) {
        await route.fulfill({ status: 404, body: 'not found' });
        return;
      }
      await route.fulfill({
        status: 200,
        body: readFileSync(file),
        headers: { ...headers, 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' },
      });
    }
  );
}

/** Serve the actual Astro build with its generated per-route response headers. */
async function serveSite(context: BrowserContext, baseURL: string): Promise<void> {
  await context.unrouteAll({ behavior: 'wait' });
  const headers = siteHeaders();
  const origin = new URL(baseURL).origin;
  await context.route(
    (url) => url.origin === origin,
    async (route) => {
      const url = new URL(route.request().url());
      const pathname = decodeURIComponent(url.pathname);
      const path = pathname.endsWith('/') ? `${pathname}index.html` : pathname;
      const file = normalize(join(SITE_DIST, path));
      const candidate =
        existsSync(file) && statSync(file).isDirectory() ? join(file, 'index.html') : file;
      if (!candidate.startsWith(SITE_DIST + sep) || !existsSync(candidate)) {
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

type SitePolicyHeaders = { enforced: string; reportOnly: string };

function siteHeaders(): Map<string, SitePolicyHeaders> {
  const headers = new Map<string, SitePolicyHeaders>();
  const rules = readFileSync(join(SITE_DIST, '_headers'), 'utf8').split('\n');
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

function hashSource(source: string): string {
  return `'sha256-${createHash('sha256').update(source).digest('base64')}'`;
}

/** An independent assertion over the emitted header, not the policy generator. */
function expectSafePagePolicy(policy: string, html: string): void {
  expect(policy).not.toMatch(/'unsafe-(?:inline|eval)'/);
  const directives = new Map(
    policy.split('; ').map((directive) => {
      const [name, ...values] = directive.split(' ');
      return [name, values.join(' ')];
    })
  );
  expect(directives.get('require-trusted-types-for')).toBe("'script'");
  expect(directives.get('trusted-types')).toBe('svelte-trusted-html');
  expect(directives.get('script-src')).toContain("'self'");
  expect(directives.get('style-src')).toContain("'self'");
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)]
    .filter((match) => !/\ssrc\s*=/.test(match[1] ?? ''))
    .map((match) => match[2] ?? '');
  const styles = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi)].map(
    (match) => match[1] ?? ''
  );
  const styleAttributes = [...html.matchAll(/\sstyle=(['"])(.*?)\1/gi)].map(
    (match) => match[2] ?? ''
  );
  for (const source of scripts) expect(directives.get('script-src')).toContain(hashSource(source));
  for (const source of styles) expect(directives.get('style-src')).toContain(hashSource(source));
  for (const source of styleAttributes) {
    expect(directives.get('style-src-attr')).toContain(hashSource(source));
  }
}

type Finding = { kind: string; detail: string };

/** One `securitypolicyviolation` event, with what it was raised on. */
type Violation = {
  directive: string;
  disposition: string;
  blocked: string;
  source: string;
  sample: string;
  target: string;
  targetHasStyle: boolean;
};

/**
 * WebKit engine bug, not a Texuli finding: in Playwright's WebKit, every native
 * `<select>` on a page with `style-src 'self'` reports a `style-src-attr`
 * violation (and logs "Refused to apply a stylesheet") although nothing writes
 * a style, not even in static HTML. Chromium reports nothing. Only that exact
 * report is set aside: WebKit, `style-src-attr`, a SELECT target without a
 * `style` attribute. The canary test below fails once WebKit stops doing it,
 * and then this exception must be removed.
 */
const WEBKIT_SELECT_CONSOLE =
  /^Refused to apply a stylesheet because its hash, its nonce, or 'unsafe-inline'/;

function isWebkitSelectBug(browser: string | undefined, violation: Violation): boolean {
  return (
    browser === 'webkit' &&
    violation.directive === 'style-src-attr' &&
    violation.target === 'SELECT' &&
    !violation.targetHasStyle
  );
}

/** Collects CSP and Trusted Types violations from the page in every way they surface. */
async function watchViolations(page: Page): Promise<Finding[]> {
  const findings: Finding[] = [];
  await page.addInitScript(() => {
    const store: unknown[] = [];
    (window as unknown as { __cspViolations: unknown[] }).__cspViolations = store;
    document.addEventListener('securitypolicyviolation', (event) => {
      const target = event.target instanceof Element ? event.target : null;
      store.push({
        directive: event.effectiveDirective,
        disposition: event.disposition,
        blocked: event.blockedURI || '(inline)',
        source: `${event.sourceFile}:${event.lineNumber}`,
        sample: event.sample,
        target: target?.tagName ?? String(event.target),
        targetHasStyle: target?.hasAttribute('style') ?? false,
      });
    });
  });
  page.on('console', (message) => {
    const text = message.text();
    if (/Content[- ]Security[- ]Policy|Trusted ?Type|Refused to/i.test(text)) {
      findings.push({ kind: 'console', detail: text });
    }
  });
  page.on('pageerror', (error) => {
    findings.push({ kind: 'pageerror', detail: error.message });
  });
  return findings;
}

async function rawViolations(page: Page): Promise<Violation[]> {
  return page.evaluate(
    () => ((window as unknown as { __cspViolations?: unknown[] }).__cspViolations ?? []) as never
  );
}

/**
 * Every violation the page raised, plus the console and page errors, minus
 * the WebKit select reports (and as many of their console lines).
 */
async function pageViolations(page: Page, logged: Finding[] = []): Promise<Finding[]> {
  const browser = page.context().browser()?.browserType().name();
  const events = await rawViolations(page);
  let engineReports = events.filter((event) => isWebkitSelectBug(browser, event)).length;
  const logs = logged.filter((finding) => {
    if (
      engineReports > 0 &&
      finding.kind === 'console' &&
      WEBKIT_SELECT_CONSOLE.test(finding.detail)
    ) {
      engineReports -= 1;
      return false;
    }
    return true;
  });
  return [
    ...logs,
    ...events
      .filter((event) => !isWebkitSelectBug(browser, event))
      .map((event) => ({
        kind: 'securitypolicyviolation',
        detail: `${event.directive} blocked ${event.blocked} on ${event.target} at ${event.source} ${event.sample}`,
      })),
  ];
}

async function settle(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
  // One more frame for effects that run after the last chunk arrives.
  await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => done(null))));
}

test.describe.configure({ timeout: 120_000 });

test.beforeAll(async () => {
  test.setTimeout(20 * 60_000);
  await ensureBuild();
});

test.beforeEach(async ({ context, baseURL }) => {
  await serveBuild(context, baseURL ?? `http://127.0.0.1:${PORT}`);
});

test.describe('csp · the policy is really enforced', () => {
  test('the document carries the policy and blocks HTML sinks, eval and inline styles', async ({
    page,
  }) => {
    const findings = await watchViolations(page);
    const response = await page.goto('/?fixture=smoke');
    expect(response?.headers()['content-security-policy']).toBe(CSP);
    await expect(page.getByRole('heading', { name: 'Texuli fixtures' })).toBeVisible();
    await settle(page);
    expect(await pageViolations(page, findings)).toEqual([]);

    const probes = await page.evaluate(
      async (path) => (await import(path)).results as Record<string, string | boolean>,
      PROBE_PATH
    );
    const browser = page.context().browser()?.browserType().name();
    // Chromium and WebKit both implement Trusted Types; a missing API would make
    // the sink probes pass for the wrong reason.
    expect(probes.trustedTypes, `${browser}: implements Trusted Types`).toBe(true);
    expect(probes.innerHTML, `${browser}: raw innerHTML`).toBe('TypeError');
    expect(probes.insertAdjacentHTML, `${browser}: insertAdjacentHTML`).toBe('TypeError');
    expect(probes.extraPolicy, `${browser}: an unlisted policy`).toBe('TypeError');
    expect(probes.eval, `${browser}: eval`).toBe('EvalError');
    expect(probes.newFunction, `${browser}: new Function`).toBe('EvalError');
    expect(probes.injectedStyle, `${browser}: an injected <style>`).toBe('blocked');
    expect(probes.styleAttribute, `${browser}: a style attribute`).toBe('blocked');
    // The probes above are expected violations; prove they were reported.
    expect((await rawViolations(page)).length).toBeGreaterThan(0);
  });

  test('canary: WebKit still reports a bare native select (remove the exception when this fails)', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'webkit', 'the engine bug is WebKit only');
    await watchViolations(page);
    await page.goto('/?fixture=smoke');
    await settle(page);
    // A select built by the page's own policy-bound code, with no style at all.
    await page.evaluate(async (path) => {
      await import(`${path}?select`);
    }, PROBE_PATH);
    await expect
      .poll(
        async () =>
          (await rawViolations(page)).filter((event) => isWebkitSelectBug('webkit', event)).length
      )
      .toBeGreaterThan(0);
  });
});

test.describe('csp · built website', () => {
  test('every built HTML route has enforcing and report-only hashes without unsafe directives', () => {
    expect(existsSync(join(SITE_DIST, '_headers')), 'run pnpm build first').toBe(true);
    const headers = siteHeaders();
    const pages = builtHtmlFiles(SITE_DIST);
    expect(pages.length).toBeGreaterThan(100);
    for (const file of pages) {
      const route = pageRoute(SITE_DIST, file);
      const html = readFileSync(file, 'utf8');
      const policy = pagePolicy(html);
      const reportOnly = reportOnlyPolicy(policy);
      expect(headers.get(route), route).toEqual({ enforced: policy, reportOnly });
      expect(reportOnly).toBe(`${policy}; report-to texuli-csp`);
      expectSafePagePolicy(policy, html);
      expectSafePagePolicy(reportOnly, html);
      if (route.endsWith('/')) {
        expect(headers.get(`${route}index.html`), route).toEqual({
          enforced: policy,
          reportOnly,
        });
      }
    }
  });

  test('policy hashes each page and protects the hydrated home island', async ({
    context,
    page,
    baseURL,
  }) => {
    expect(existsSync(join(SITE_DIST, 'index.html')), 'run pnpm build first').toBe(true);
    await serveSite(context, baseURL ?? `http://127.0.0.1:${PORT}`);
    const findings = await watchViolations(page);
    const response = await page.goto('/');
    const policy = response?.headers()['content-security-policy'];
    const reportOnly = response?.headers()['content-security-policy-report-only'];
    expect(policy).toBe(pagePolicy(readFileSync(join(SITE_DIST, 'index.html'), 'utf8')));
    expect(reportOnly).toBe(`${policy}; report-to texuli-csp`);
    expect(policy).toContain("script-src 'self' 'sha256-");
    expect(policy).toContain("style-src 'self' 'sha256-");
    expect(policy).toContain("require-trusted-types-for 'script'");
    expect(policy).not.toContain('unsafe-inline');
    expect(policy).not.toContain('unsafe-eval');
    // The home's hydrated islands live in the header since T-44 retired the
    // landing playground: drive the Appearance switch under the page policy.
    const dark = page
      .locator('[data-tx-site-header]')
      .getByRole('group', { name: 'Appearance' })
      .getByText('Dark', { exact: true });
    await settle(page);
    await dark.click();
    await expect(page.locator('html')).toHaveAttribute('data-tx-mode', 'dark');
    expect(await pageViolations(page, findings)).toEqual([]);
  });

  test('the theme island hydrates and changes mode under its page policy', async ({
    context,
    page,
    baseURL,
  }) => {
    await serveSite(context, baseURL ?? `http://127.0.0.1:${PORT}`);
    const findings = await watchViolations(page);
    const response = await page.goto('/theme-switcher/');
    expect(response?.headers()['content-security-policy']).toBe(
      siteHeaders().get('/theme-switcher/')?.enforced
    );
    expect(response?.headers()['content-security-policy-report-only']).toBe(
      siteHeaders().get('/theme-switcher/')?.reportOnly
    );
    const dark = page.getByRole('group', { name: 'Mode' }).getByRole('button', { name: 'Dark' });
    await dark.click();
    await expect(page.locator('[data-tx-theme-switcher] [role="status"]')).toContainText(
      'mode dark'
    );
    await settle(page);
    expect(await pageViolations(page, findings)).toEqual([]);
  });

  test('enforcing and report-only policies both observe an unauthorized style', async ({
    context,
    page,
    baseURL,
  }) => {
    await serveSite(context, baseURL ?? `http://127.0.0.1:${PORT}`);
    await watchViolations(page);
    await page.goto('/');
    await page.evaluate(() => {
      const style = document.createElement('style');
      style.textContent = 'body { outline: 3px solid red; }';
      document.head.append(style);
    });
    await expect
      .poll(async () =>
        [
          ...new Set(
            (await rawViolations(page))
              .filter((event) => event.directive.startsWith('style-src'))
              .map((event) => event.disposition)
          ),
        ].sort()
      )
      .toEqual(['enforce', 'report']);
    expect(await page.evaluate(() => getComputedStyle(document.body).outlineStyle)).not.toBe(
      'solid'
    );
  });

  test('a changed inline script needs a different page hash', () => {
    const html =
      '<html><head><meta charset="utf-8" /><script>window.ready=1</script></head></html>';
    expect(pagePolicy(html)).not.toBe(pagePolicy(html.replace('ready=1', 'ready=2')));
    expect(pageRoute('/dist', '/dist/docs/index.html')).toBe('/docs/');
    expect(pageRoute('/dist', '/dist/index.html')).toBe('/');
  });
});

/** Sinks a strict CSP or Trusted Types blocks; none may appear in package sources. */
const BLOCKED_SINKS: [string, RegExp][] = [
  ['a style attribute write', /setAttribute\(\s*['"]style['"]/],
  [
    'an HTML string sink',
    /\.(?:inner|outer)HTML\s*=(?!=)|insertAdjacentHTML\(|createContextualFragment\(/,
  ],
  ['document.write', /document\.write(?:ln)?\(/],
  ['{@html}', /\{@html\s/],
  ['eval or new Function', /(?<![.\w])eval\(|new Function\(/],
  ['a string timer', /set(?:Timeout|Interval)\(\s*['"`]/],
  ['srcdoc', /\bsrcdoc\s*=/],
];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === 'node_modules' ? [] : sourceFiles(path);
    return /\.(?:ts|js|svelte)$/.test(name) ? [path] : [];
  });
}

test.describe('csp · sources', () => {
  test('no package source uses a sink the policy blocks', () => {
    const packages = join(ROOT, 'packages');
    const files = readdirSync(packages)
      .map((name) => join(packages, name, 'src'))
      .filter((dir) => existsSync(dir))
      .flatMap(sourceFiles);
    expect(files.length).toBeGreaterThan(100);
    const hits = files.flatMap((file) =>
      readFileSync(file, 'utf8')
        .split('\n')
        .flatMap((line, index) =>
          BLOCKED_SINKS.filter(([, pattern]) => pattern.test(line)).map(
            ([what]) => `${relative(ROOT, file)}:${index + 1} ${what}`
          )
        )
    );
    expect(hits).toEqual([]);
  });
});

/** Examples per test: one page session walks a batch (page setup dominates). */
const EXAMPLE_BATCH = 12;

test.describe('csp · every example renders with zero violations', () => {
  const ids = listExampleIds();
  for (let start = 0; start < ids.length; start += EXAMPLE_BATCH) {
    const batch = ids.slice(start, start + EXAMPLE_BATCH);
    test(`${batch[0]} … ${batch.at(-1)}`, async ({ page }) => {
      test.setTimeout(batch.length * 60_000);
      const findings = await watchViolations(page);
      const problems: string[] = [];
      for (const id of batch) {
        const logged = findings.length;
        await page.goto(`/?fixture=${id}`);
        const host = page.locator(`[data-example-host="${id}"]`);
        await expect(host, `${id} renders`).toBeVisible({ timeout: 60_000 });
        await expect(host.locator(':scope > p[role="status"]'), `${id} loads`).toHaveCount(0, {
          timeout: 60_000,
        });
        await expect(
          host.locator(':scope > p[role="alert"]'),
          `${id} loads without error`
        ).toHaveCount(0);
        await settle(page);
        // The store resets on every navigation; the console findings are this example's.
        for (const finding of await pageViolations(page, findings.slice(logged))) {
          problems.push(`${id}: ${finding.kind} ${finding.detail}`);
        }
      }
      expect(problems).toEqual([]);
    });
  }
});
