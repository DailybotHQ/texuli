/** The built Astro consumer must hydrate its Svelte island under a strict page hash policy. */
import { execFileSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { expect, test } from '@playwright/test';
import { pagePolicy } from '../../apps/website/src/components/security/csp.ts';

const ROOT = resolve(import.meta.dirname, '../..');
const FIXTURE = join(ROOT, 'tests/consumers/fixtures/astro-plain');
const HOISTED = join(ROOT, 'node_modules/.pnpm/node_modules');
const PORT = Number(process.env.TEXULI_E2E_PORT ?? 4870);
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
};

let dist: string;
let html: string;
let work: string;

/** Build a disposable copy with the already installed workspace dependencies. No install runs. */
function buildFixture(): void {
  work = mkdtempSync(join(ROOT, 'tmp/astro-islands-'));
  cpSync(FIXTURE, work, { recursive: true });
  cpSync(join(ROOT, 'tests/consumers/fixtures/Smoke.svelte'), join(work, 'Smoke.svelte'));
  const page = join(work, 'src/pages/index.astro');
  writeFileSync(
    page,
    readFileSync(page, 'utf8').replace('../../../Smoke.svelte', '../../Smoke.svelte')
  );

  const modules = join(work, 'node_modules');
  mkdirSync(modules);
  for (const name of readdirSync(HOISTED)) {
    if (name !== '@texuli') symlinkSync(realpathSync(join(HOISTED, name)), join(modules, name));
  }
  const scope = join(modules, '@texuli');
  mkdirSync(scope);
  for (const name of readdirSync(join(ROOT, 'packages'))) {
    const pkg = join(ROOT, 'packages', name);
    if (existsSync(join(pkg, 'package.json'))) symlinkSync(pkg, join(scope, name));
  }

  execFileSync(process.execPath, [join(modules, 'astro/bin/astro.mjs'), 'build'], {
    cwd: work,
    stdio: 'pipe',
    timeout: 120_000,
  });
  dist = join(work, 'dist');
  html = readFileSync(join(dist, 'index.html'), 'utf8');
}

test.describe.configure({ timeout: 180_000 });

test.beforeAll(() => {
  buildFixture();
});

test.afterAll(() => {
  if (work) rmSync(work, { recursive: true, force: true });
});

test('static sections and SSR fallback survive strict CSP while the island hydrates', async ({
  context,
  page,
  baseURL,
}) => {
  const policy = pagePolicy(html);
  expect(policy).toContain("script-src 'self' 'sha256-");
  expect(policy).toContain("require-trusted-types-for 'script'");
  expect(policy).not.toMatch(/'unsafe-(?:inline|eval)'/);

  // The generated document contains real SSR content and no client-only controls.
  expect(html).toContain('Content without a client bundle');
  expect(html).toContain('data-tx-theme="sky"');
  expect(html).toContain('data-astro-content');
  expect(html).toContain('data-tx-consumer-smoke');
  expect(html).toContain('data-select-ssr="pending"');
  expect(html).toContain('data-grid-ssr="pending"');
  expect(html).not.toContain('aria-label="Smoke select"');
  expect(html).not.toContain('caption="Smoke grid"');

  const origin = new URL(baseURL ?? `http://127.0.0.1:${PORT}`).origin;
  await context.route(
    (url) => url.origin === origin,
    async (route) => {
      const pathname = decodeURIComponent(new URL(route.request().url()).pathname);
      const file = normalize(join(dist, pathname === '/' ? 'index.html' : pathname));
      if (!file.startsWith(`${dist}${sep}`) || !existsSync(file)) {
        await route.fulfill({ status: 404, body: 'not found' });
        return;
      }
      const isHtml = extname(file) === '.html';
      await route.fulfill({
        status: 200,
        body: readFileSync(file),
        headers: {
          'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
          ...(isHtml ? { 'content-security-policy': policy } : {}),
        },
      });
    }
  );

  const findings: string[] = [];
  await page.addInitScript(() => {
    (window as typeof window & { __astroCspViolations: string[] }).__astroCspViolations = [];
    document.addEventListener('securitypolicyviolation', (event) => {
      (window as typeof window & { __astroCspViolations: string[] }).__astroCspViolations.push(
        `${event.effectiveDirective}: ${event.blockedURI || '(inline)'}`
      );
    });
  });
  page.on('pageerror', (error) => findings.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (/Content[- ]Security[- ]Policy|Trusted ?Type|Refused to/i.test(message.text())) {
      findings.push(`console: ${message.text()}`);
    }
  });

  const response = await page.goto('/');
  expect(response?.headers()['content-security-policy']).toBe(policy);
  await expect(page.locator('html')).toHaveAttribute('data-tx-mode', 'dark');
  await expect(page.locator('html')).toHaveClass(/dark/);
  await expect(
    page.getByRole('heading', { name: 'Content without a client bundle' })
  ).toBeVisible();
  await expect(page.locator('[data-astro-content]')).toHaveText(
    'Rendered by the Texuli Astro section.'
  );

  const island = page
    .locator('astro-island[data-astro-source-file], astro-island[component-url]')
    .first();
  await expect(island).not.toHaveAttribute('ssr', '', { timeout: 30_000 });
  await expect(page.locator('[data-select-ssr], [data-grid-ssr]')).toHaveCount(0);
  await expect(page.getByRole('grid', { name: 'Smoke grid' })).toBeVisible();
  await page.getByRole('checkbox', { name: 'Smoke checkbox' }).click();
  await expect(page.locator('[data-checked]')).toHaveAttribute('data-checked', 'true');
  await page.waitForLoadState('networkidle');

  const violations = await page.evaluate(
    () => (window as typeof window & { __astroCspViolations: string[] }).__astroCspViolations
  );
  expect([...findings, ...violations]).toEqual([]);
});
