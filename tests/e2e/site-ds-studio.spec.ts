/// <reference types="node" />
/**
 * Design System Studio on texuli.com (/theme-studio/, PLAN_011 T-ds-studio),
 * on the built site served with its own per-route `_headers` CSP:
 *
 * - starts from a preset seed, a library theme, a DTCG file, a Tokens Studio
 *   file, a logo and mood words (no request leaves the origin);
 * - an edited color repaints the scoped preview and changes the diff and the
 *   contrast report; a pinned pair below AA is refused with `aa-text`;
 * - a refused document (pasted JSON, an imported file) shows its codes;
 * - every export downloads and parses;
 * - a share link round-trips the document; hostile hashes are refused with
 *   their codes; a legacy `#theme=` link still opens;
 * - axe in light and dark, and zero CSP or Trusted Types violations while
 *   the studio is used.
 *
 * Pure helpers (codec caps, field table, engine) are unit-tested in
 * apps/website/tests/ds-studio.test.ts.
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, join, normalize, resolve } from 'node:path';
import { deflateRawSync } from 'node:zlib';
import { expect, type Locator, type Page, test } from '@playwright/test';
import { dtcgFixture, tokensStudioFixture } from '@texuli/tokens/design-system/fixtures';
import { axeViolations } from './support/site.ts';

const DIST = resolve('apps/website/dist');
const FIXTURE_IMAGE = resolve('tests/fixtures/theme-studio-seed.png');
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
};

/** The enforcing CSP of each route, from the build's `_headers`. */
function policies(): Map<string, string> {
  const out = new Map<string, string>();
  let route = '';
  for (const line of readFileSync(join(DIST, '_headers'), 'utf8').split('\n')) {
    if (line.startsWith('/')) route = line.trim();
    else if (line.startsWith('  Content-Security-Policy: ') && route) {
      out.set(route, line.slice('  Content-Security-Policy: '.length));
    }
  }
  return out;
}

let server: Server | undefined;
let origin = '';

test.beforeAll(async () => {
  if (!existsSync(join(DIST, 'theme-studio', 'default-design-system.json'))) {
    throw new Error('Run `pnpm build` before this spec.');
  }
  const csp = policies();
  server = createServer((request, response) => {
    const path = decodeURIComponent(new URL(request.url ?? '/', 'http://site').pathname);
    let file = normalize(join(DIST, path));
    if (!file.startsWith(DIST)) file = join(DIST, '__outside__');
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
    if (!existsSync(file)) {
      response.writeHead(404, { 'content-type': 'text/plain' }).end('Not found');
      return;
    }
    const headers: Record<string, string> = {
      'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
    };
    const policy = extname(file) === '.html' ? csp.get(path) : undefined;
    if (policy) headers['content-security-policy'] = policy;
    response.writeHead(200, headers).end(readFileSync(file));
  });
  await new Promise<void>((done) => server?.listen(0, '127.0.0.1', done));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

test.afterAll(
  () =>
    new Promise<void>((done) => {
      if (!server) return done();
      server.close(() => done());
    })
);

test.beforeEach(({ browserName }) => {
  test.skip(browserName !== 'chromium', 'downloads and file pickers are checked once, in chromium');
});

/** Record CSP and Trusted Types violations and foreign requests from the first script on. */
async function watch(page: Page): Promise<{ foreign: string[] }> {
  const foreign: string[] = [];
  page.on('request', (request) => {
    const url = request.url();
    if (!url.startsWith(origin) && !/^(blob|data):/.test(url)) foreign.push(url);
  });
  await page.addInitScript(() => {
    const list: string[] = [];
    (window as unknown as { __csp: string[] }).__csp = list;
    document.addEventListener('securitypolicyviolation', (event) => {
      list.push(`${event.violatedDirective} ${event.blockedURI} ${event.sample}`.trim());
    });
  });
  return { foreign };
}

const violations = (page: Page) =>
  page.evaluate(() => (window as unknown as { __csp: string[] }).__csp ?? []);

async function open(page: Page, hash = ''): Promise<void> {
  // A fresh document every time: a hash-only change would not reload the page.
  await page.goto('about:blank');
  await page.goto(`${origin}/theme-studio/${hash}`);
  await page.waitForFunction(() => document.documentElement.dataset.txPageReady === 'true');
  await expect(page.locator('[data-tx-ds-scope]')).toBeVisible({ timeout: 15_000 });
}

const status = (page: Page) => page.locator('[data-tx-ds-status]');

/** A `--tx-*` value as the preview scope computes it. */
const previewVar = (page: Page, name: string) =>
  page
    .locator('[data-tx-ds-scope]')
    .evaluate((el, variable) => getComputedStyle(el).getPropertyValue(variable).trim(), name);

async function tap(locator: Locator): Promise<void> {
  await locator.evaluate((node) => node.scrollIntoView({ block: 'center' }));
  await locator.click();
}

/** Open a section of the editor (a `<details>`). */
async function section(page: Page, id: string): Promise<Locator> {
  const details = page.locator(`[data-tx-ds-section="${id}"]`);
  if ((await details.getAttribute('open')) === null) await tap(details.locator('summary'));
  await expect(details).toHaveAttribute('open', '');
  return details;
}

/** A hash body for any JSON value, written the way the studio writes links. */
function hashOf(value: unknown): string {
  return hashOfText(JSON.stringify(value));
}

function hashOfText(text: string): string {
  const body = deflateRawSync(Buffer.from(text))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `#ds=1.${body}`;
}

const SEED_DOCUMENT = {
  format: 'texuli/design-system',
  formatVersion: 1,
  id: 'acme',
  version: '2.1.0',
  name: 'Acme',
  color: { brand: { seed: '#0f766e' } },
  shape: { radius: 20 },
};

test('starts from a seed, a library theme, DTCG and Tokens Studio files, a logo and words', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const { foreign } = await watch(page);
  await open(page);
  const initial = await previewVar(page, '--tx-primary');
  expect(initial).not.toBe('');

  await tap(page.locator('[data-tx-ds-seed-preset="signal"]'));
  await expect(status(page)).toContainText('Started from Signal red', { timeout: 20_000 });
  await expect.poll(() => previewVar(page, '--tx-primary')).not.toBe(initial);

  const signal = await previewVar(page, '--tx-primary');
  await tap(page.locator('[data-tx-ds-library="devtools-night"]'));
  await expect(status(page)).toContainText('devtools-night library theme', { timeout: 20_000 });
  await expect.poll(() => previewVar(page, '--tx-primary')).not.toBe(signal);

  await page.locator('[data-tx-ds-file]').setInputFiles({
    name: 'brand.tokens.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(dtcgFixture())),
  });
  await expect(status(page)).toContainText('W3C DTCG tokens', { timeout: 20_000 });
  await expect(page.locator('[data-tx-ds-refusal]')).toHaveCount(0);

  await page.locator('[data-tx-ds-file]').setInputFiles({
    name: 'brand.tokens-studio.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(tokensStudioFixture())),
  });
  await expect(status(page)).toContainText('Tokens Studio file', { timeout: 20_000 });

  await page.locator('[data-tx-ds-logo]').setInputFiles(FIXTURE_IMAGE);
  await expect(page.locator('[data-tx-ds-logo-palette]')).toContainText('#', { timeout: 20_000 });
  await expect(status(page)).toContainText('Started from the logo', { timeout: 20_000 });

  await page.getByLabel('Mood words').fill('calm ocean');
  await tap(page.getByRole('button', { name: 'Start from words' }));
  await expect(status(page)).toContainText('mood words', { timeout: 20_000 });

  expect(foreign).toEqual([]);
  expect(await violations(page)).toEqual([]);
});

test('an edited color repaints the preview and changes the diff and the contrast report', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await watch(page);
  await open(page);
  const color = await section(page, 'color');
  const before = await previewVar(page, '--tx-primary');
  const contrastBefore = await page.locator('[data-tx-ds-contrast-summary]').innerText();

  const seed = color.locator('#ds-field-color-brand-seed');
  await seed.fill('#b91c1c');
  await seed.press('Enter');
  await expect(status(page)).toContainText('Updated brand seed', { timeout: 20_000 });
  await expect.poll(() => previewVar(page, '--tx-primary')).not.toBe(before);
  await expect(page.locator('[data-tx-ds-diff-summary]')).toContainText(/\d+ changed/);
  await expect
    .poll(() => page.locator('[data-tx-ds-contrast-summary]').innerText())
    .not.toBe(contrastBefore);
  await expect(page.locator('[data-tx-ds-contrast-live]')).toContainText('pairs pass');

  // One pin compiles (the solver moves what is not pinned); a second pin that
  // leaves the pair below AA is refused with the code at its path, and the
  // preview keeps the last design system that compiled.
  const pinRole = async (role: string, value: string) => {
    await color.locator('#ds-pin-role').selectOption(role);
    const field = color.locator(`#ds-field-color-roles-light-${role}`);
    await field.fill(value);
    await field.press('Enter');
  };
  await pinRole('foreground', '#fafafa');
  await expect(status(page)).toContainText('Updated foreground (light)', { timeout: 20_000 });
  await expect.poll(() => previewVar(page, '--tx-foreground')).toBe('#fafafa');
  const background = await previewVar(page, '--tx-background');
  await pinRole('background', '#ffffff');
  await expect(page.locator('[data-tx-ds-issues]')).toContainText(/\d+ issues?;/, {
    timeout: 20_000,
  });
  await expect(status(page)).toContainText('aa-text');
  await expect(color.locator('[data-tx-ds-field-issues]').first()).toContainText('aa-text');
  expect(await previewVar(page, '--tx-background')).toBe(background);
  expect(await violations(page)).toEqual([]);
});

test('a refused document shows its codes and paths, from pasted JSON and from a file', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await watch(page);
  await open(page);
  const json = await section(page, 'json');
  await json.locator('[data-tx-ds-json]').fill(
    JSON.stringify({
      ...SEED_DOCUMENT,
      shape: { radius: 99 },
      color: { brand: { seed: 'red' } },
      bogus: true,
    })
  );
  await tap(json.getByRole('button', { name: 'Apply JSON' }));
  await expect(page.locator('[data-tx-ds-issues]')).toContainText('3 issues', { timeout: 20_000 });
  await expect(status(page)).toContainText('invalid-value');
  await expect(page.locator('[data-tx-ds-issue-list]')).toContainText('unknown-key');
  await expect(page.locator('[data-tx-ds-issue-list]')).toContainText('$.bogus');
  const shape = await section(page, 'shape');
  await expect(shape.locator('[data-tx-ds-field-issues]')).toContainText('invalid-value');
  await expect(shape.locator('[data-tx-ds-field-issues]')).toContainText('$.shape.radius');
  await expect(shape.locator('#ds-field-shape-radius')).toHaveAttribute('aria-invalid', 'true');

  // An imported file that does not validate is refused whole, with its codes.
  await page.locator('[data-tx-ds-file]').setInputFiles({
    name: 'broken.design-system.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        ...SEED_DOCUMENT,
        assets: { logo: { light: 'https://evil.example/logo.png' } },
      })
    ),
  });
  const refusal = page.locator('[data-tx-ds-refusal]');
  await expect(refusal).toBeVisible({ timeout: 20_000 });
  await expect(refusal).toContainText('url-refused');
  await expect(refusal).toContainText('$.assets.logo.light');
  expect(await violations(page)).toEqual([]);
});

test('every export downloads valid content', async ({ page }) => {
  test.setTimeout(120_000);
  await watch(page);
  await open(page, hashOf(SEED_DOCUMENT));
  await expect(status(page)).toContainText('shared link', { timeout: 20_000 });
  const expected: Record<string, (text: string) => void> = {
    document: (text) => expect(JSON.parse(text)).toEqual(SEED_DOCUMENT),
    compiled: (text) => expect(JSON.parse(text).vars.light['--tx-primary']).toBeTruthy(),
    css: (text) => expect(text).toContain('[data-tx-ds="acme"]'),
    tailwind: (text) => expect(JSON.parse(text).theme.extend.colors).toBeTruthy(),
    dtcg: (text) => expect(JSON.parse(text).$extensions).toBeTruthy(),
    'tokens-studio': (text) => expect(JSON.parse(text).$metadata.tokenSetOrder).toBeTruthy(),
    report: (text) => expect(text.toLowerCase()).toContain('<!doctype html>'),
    email: (text) => expect(text).toContain('Harbor weekly digest'),
  };
  for (const [format, check] of Object.entries(expected)) {
    const button = page.locator(`[data-tx-ds-download="${format}"]`);
    await button.evaluate((node) => node.scrollIntoView({ block: 'center' }));
    const [download] = await Promise.all([page.waitForEvent('download'), button.click()]);
    expect(download.suggestedFilename(), format).toMatch(/^acme\./);
    const path = await download.path();
    check(readFileSync(path, 'utf8'));
  }
  await expect(page.locator('[data-tx-ds-export-note]')).toContainText(
    'Downloaded acme.email.html'
  );
  expect(await violations(page)).toEqual([]);
});

test('a share link round-trips the document; hostile and legacy links', async ({ page }) => {
  test.setTimeout(120_000);
  await watch(page);
  await open(page);
  const shape = await section(page, 'shape');
  const radius = shape.locator('#ds-field-shape-radius');
  await radius.fill('18');
  await radius.press('Enter');
  await expect(status(page)).toContainText('Updated radius', { timeout: 20_000 });
  await tap(page.locator('[data-tx-ds-share]'));
  const url = await page.locator('[data-tx-ds-share-url]').inputValue();
  expect(url).toMatch(/\/theme-studio\/#ds=1\.[A-Za-z0-9_-]+$/);
  await expect(page.locator('[data-tx-ds-share-note]')).toContainText('nothing was uploaded');

  const other = await page.context().newPage();
  await other.goto(url);
  await expect(other.locator('[data-tx-ds-status]')).toContainText('Started from the shared link', {
    timeout: 20_000,
  });
  await expect
    .poll(() =>
      other
        .locator('[data-tx-ds-scope]')
        .evaluate((el) => getComputedStyle(el).getPropertyValue('--tx-radius').trim())
    )
    .toBe('1.125rem');
  await other.close();

  const hostile: Array<[string, string]> = [
    ['#ds=1.%3Cscript%3E', 'share-format'],
    ['#ds=7.AAAA', 'share-version'],
    [`#ds=1.${'A'.repeat(17_000)}`, 'share-too-long'],
    ['#ds=1.AAAAAAAA', 'share-encoding'],
    [hashOf([1, 2, 3]), 'share-json'],
    [
      hashOf({ ...SEED_DOCUMENT, assets: { favicon: 'data:image/png;base64,AAAA' } }),
      'url-refused',
    ],
    [hashOf({ ...SEED_DOCUMENT, formatVersion: 99 }), 'format-version'],
    [
      hashOfText(
        `${JSON.stringify(SEED_DOCUMENT).slice(0, -1)},"__proto__":{"x":1},"constructor":1}`
      ),
      'unknown-key',
    ],
  ];
  for (const [hash, code] of hostile) {
    await open(page, hash);
    const refusal = page.locator('[data-tx-ds-refusal]');
    await expect(refusal, code).toBeVisible({ timeout: 20_000 });
    await expect(refusal, code).toContainText(code);
    // The studio keeps the default design system on screen.
    expect(await page.locator('[data-tx-ds-scope]').getAttribute('data-tx-ds')).toBe('studio');
  }

  // A link from the theme studio (a recipe) still opens, as a document.
  await open(page, '#theme=s=c&seed=%230f766e&c=AA&m=l');
  await expect(status(page)).toContainText('theme studio link', { timeout: 20_000 });
  await expect(page.locator('[data-tx-ds-refusal]')).toHaveCount(0);
  expect(await violations(page)).toEqual([]);
});

for (const scheme of ['light', 'dark'] as const) {
  test(`axe finds nothing with sections open and issues shown (${scheme})`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.emulateMedia({ colorScheme: scheme });
    await watch(page);
    await open(page);
    await section(page, 'identity');
    await section(page, 'typography');
    await section(page, 'components');
    const shape = await section(page, 'shape');
    const radius = shape.locator('#ds-field-shape-radius');
    await radius.fill('99');
    await radius.press('Enter');
    await expect(shape.locator('[data-tx-ds-field-issues]')).toBeVisible({ timeout: 20_000 });
    for (const tab of ['Dashboard', 'Slide', 'Document', 'Email']) {
      await tap(page.getByRole('tab', { name: tab }));
      expect(await axeViolations(page), `${scheme} ${tab}`).toEqual([]);
    }
    expect(await violations(page)).toEqual([]);
  });
}
