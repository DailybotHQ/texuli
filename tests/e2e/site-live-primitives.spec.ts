/// <reference types="node" />
import { createReadStream, existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, join, normalize, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import AxeBuilder from '@axe-core/playwright';
import { expect, type Locator, type Page, test } from '@playwright/test';
import { budgetFor, DEFAULT_BUDGET } from '../../apps/website/src/components/perf/budgets.ts';
import { polishProblems } from './support/site.ts';

/*
 * Live primitive demos (T-site-live-primitives). Every /primitives-page/<id>/
 * mounts the real primitive, lazily, in a framed preview with light/dark and
 * RTL toggles, uncontrolled and controlled panels, a props panel that drives
 * the code sample, keyboard hints that light up, and an anatomy bridge.
 *
 * Each demo declares its own key and control checks (mirrored on the frame
 * as data attributes), so this spec runs exactly what the page promises.
 * Every primitive page must ship its lazy demo island (a build check). The
 * demo interactions (a fresh load each) and axe plus the polish check in
 * light, dark and forced colors, with the demo mounted and its floating
 * content open, run on the representative set (overlay, form, composite and
 * range primitives): the pages share one template, and every primitive's
 * keyboard, pointer and axe contract runs in its behavior scenario
 * (tests/behavior). a11y-site.spec.ts skips these pages.
 * Chromium covers every primitive; WebKit and Pixel 7 cover a representative
 * set (overlay, form, composite and range primitives).
 */

const DIST = resolve('apps/website/dist');
const AXE_TAGS = [
  'wcag2a',
  'wcag2aa',
  'wcag21a',
  'wcag21aa',
  'wcag22a',
  'wcag22aa',
  'best-practice',
];
const REPRESENTATIVE = new Set(['accordion', 'dialog', 'select', 'slider', 'tabs', 'menu']);
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
};

interface Expectation {
  selector?: string;
  attribute?: string;
  value?: string;
  count?: number;
}
interface KeyCheck {
  open?: string;
  openWith?: 'click' | 'contextmenu';
  focus: string;
  press: string;
  expect: Expectation & { fileChooser?: boolean };
}
interface ControlCheck {
  act: string;
  expect: Expectation;
}

function primitiveIds(): string[] {
  const dir = join(DIST, 'primitives-page');
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(dir, entry.name, 'index.html')))
    .map((entry) => entry.name)
    .sort();
}

const IDS = primitiveIds();

let server: Server;
let origin = '';

test.beforeAll(async () => {
  if (!existsSync(join(DIST, 'index.html'))) throw new Error('Run `pnpm build` before this spec.');
  server = createServer((request, response) => {
    const path = decodeURIComponent(new URL(request.url ?? '/', 'http://site').pathname);
    let file = normalize(join(DIST, path));
    if (!file.startsWith(DIST)) file = join(DIST, '__outside__');
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
    if (!existsSync(file)) {
      response.writeHead(404, { 'content-type': 'text/plain' }).end('Not found');
      return;
    }
    response.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
    createReadStream(file).pipe(response);
  });
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
test.afterAll(() => new Promise<void>((done) => server.close(() => done())));

/** Open a primitive page and wait until its demo has loaded and mounted. */
async function openDemo(page: Page, id: string): Promise<Locator> {
  await page.goto(`${origin}/primitives-page/${id}/`);
  const live = page.locator(`[data-live-demo="${id}"]`);
  await live.scrollIntoViewIfNeeded();
  await expect(live).toHaveAttribute('data-ready', '', { timeout: 20_000 });
  return live;
}

async function expectState(scope: Locator, expectation: Expectation, label: string): Promise<void> {
  if (!expectation.selector) return;
  const target = scope.locator(expectation.selector);
  if (expectation.count !== undefined) {
    await expect(target, label).toHaveCount(expectation.count);
    return;
  }
  if (expectation.attribute) {
    await expect(target.first(), label).toHaveAttribute(
      expectation.attribute,
      expectation.value ?? ''
    );
    return;
  }
  await expect(target.first(), label).toBeVisible();
}

async function axe(page: Page): Promise<string[]> {
  const result = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  return result.violations.map(
    (violation) =>
      `${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(' | ')}`
  );
}

test('every primitive page ships a lazy live demo island', ({ browserName }, info) => {
  test.skip(info.project.name !== 'chromium', 'build output is browser-independent');
  void browserName;
  expect(IDS.length).toBeGreaterThanOrEqual(41);
  for (const id of IDS) {
    const html = readFileSync(join(DIST, 'primitives-page', id, 'index.html'), 'utf8');
    // Hydrated only when visible (an IntersectionObserver), then the demo chunk loads.
    expect(html, id).toMatch(/<astro-island[^>]+client="visible"[^>]+LiveDemo/);
    expect(html, id).toContain(`data-live-demo="${id}"`);
  }
});

test('a demo loads only once it scrolls into view', async ({ page }, info) => {
  test.skip(info.project.name !== 'chromium', 'IntersectionObserver timing is checked once');
  await page.setViewportSize({ width: 1280, height: 240 });
  const scripts: string[] = [];
  page.on('requestfinished', (request) => {
    if (request.url().endsWith('.js')) scripts.push(new URL(request.url()).pathname);
  });
  await page.goto(`${origin}/primitives-page/dialog/`);
  await page.waitForFunction(
    () =>
      document.documentElement.dataset.txPageReady === 'true' ||
      (!document.querySelector('script[data-tx-ready-script]') &&
        document.readyState === 'complete'),
    undefined,
    { polling: 250 }
  );
  const live = page.locator('[data-live-demo="dialog"]');
  await expect(live).not.toHaveAttribute('data-ready', '');
  const before = scripts.length;
  await live.scrollIntoViewIfNeeded();
  await expect(live).toHaveAttribute('data-ready', '', { timeout: 20_000 });
  expect(scripts.length).toBeGreaterThan(before);
});

test('the preview follows the page mode before and after it hydrates', async ({ page }, info) => {
  test.skip(info.project.name !== 'chromium', 'server-rendered styling is checked once');
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.setViewportSize({ width: 1280, height: 240 });
  await page.goto(`${origin}/primitives-page/calendar/`);
  await page.waitForFunction(
    () =>
      document.documentElement.dataset.txPageReady === 'true' ||
      (!document.querySelector('script[data-tx-ready-script]') &&
        document.readyState === 'complete'),
    undefined,
    { polling: 250 }
  );
  const live = page.locator('[data-live-demo="calendar"]');
  const stage = live.locator('[data-live-stage]');
  const colors = () =>
    page.evaluate(() => {
      const node = document.querySelector('[data-live-stage]');
      const tokens = (style: CSSStyleDeclaration) =>
        ['--tx-background', '--tx-foreground'].map((name) => style.getPropertyValue(name).trim());
      const own = node ? getComputedStyle(node) : undefined;
      return {
        page: tokens(getComputedStyle(document.documentElement)),
        stage: own ? [...tokens(own), own.color, own.backgroundColor] : [],
      };
    });
  // Not hydrated yet: the server-rendered stage already uses the dark tokens.
  await expect(live).not.toHaveAttribute('data-ready', '');
  await expect(page.locator('html')).toHaveAttribute('data-tx-mode', 'dark');
  await expect(stage).not.toHaveAttribute('data-tx-mode', /.*/);
  const before = await colors();
  expect(before.page.every(Boolean)).toBe(true);
  expect(before.stage.slice(0, 2)).toEqual(before.page);
  // Hydrated: the stage scopes the same mode, so its colors do not change.
  await live.scrollIntoViewIfNeeded();
  await expect(live).toHaveAttribute('data-ready', '', { timeout: 20_000 });
  await expect(stage).toHaveAttribute('data-tx-mode', 'dark');
  expect((await colors()).stage).toEqual(before.stage);
});

/** Controlled panel: a control outside the primitive changes its state. */
async function checkControlled(live: Locator, id: string): Promise<void> {
  const uncontrolled = live.locator('[data-demo-mode="uncontrolled"]');
  const controlled = live.locator('[data-demo-mode="controlled"]');
  await expect(uncontrolled).toBeVisible();
  await expect(controlled).toBeVisible();
  // The real primitive, styled: Texuli class recipes on its parts.
  expect(
    await live.locator('[data-demo-mode] [class*="tx-"]').count(),
    'Texuli-styled parts'
  ).toBeGreaterThan(0);
  const control = JSON.parse(
    (await live.getAttribute('data-control-check')) ?? '{}'
  ) as ControlCheck;
  await expect(controlled.locator('[data-demo-readout]').first()).toBeVisible();
  await controlled.locator(control.act).first().click();
  await expectState(controlled, control.expect, `${id} controlled`);
}

/** Keyboard hints describe keys that work and light up when pressed. */
async function checkKeyHints(page: Page, live: Locator, id: string, project: string) {
  const raw = await live.getAttribute('data-key-check');
  const hints = live.locator('[data-key-hint]');
  if (!raw) {
    await expect(hints).toHaveCount(0);
    return;
  }
  const check = JSON.parse(raw) as KeyCheck;
  const panel = live.locator('[data-demo-mode="uncontrolled"]');
  if (check.open) {
    await panel
      .locator(check.open)
      .first()
      .click(check.openWith === 'contextmenu' ? { button: 'right' } : {});
  }
  await panel.locator(check.focus).first().focus();
  const key = check.press === ' ' ? 'Space' : check.press;
  if (check.expect.fileChooser) {
    // The key opens the system file chooser (Playwright intercepts it).
    const chooser = page.waitForEvent('filechooser', { timeout: 10_000 });
    await page.keyboard.press(key);
    await chooser;
  } else {
    await page.keyboard.press(key);
  }
  await expectState(panel, check.expect, `${id} after ${check.press}`);
  // The hint for that key lights up and the status names it.
  expect(await hints.count()).toBeGreaterThan(0);
  if (project !== 'webkit' || !check.open) {
    await expect(live.locator('[data-key-hint][data-pressed]')).toHaveCount(1);
    await expect(live.locator('.live__key-status')).toContainText('Pressed');
  }
}

/** Anatomy parts highlight on hover and focus, both ways. */
async function checkAnatomy(page: Page, live: Locator, id: string, isMobile: boolean) {
  const figure = page.locator(`figure[data-anatomy="${id}"]`);
  const anatomy = await figure
    .locator('li[data-part]')
    .evaluateAll((boxes) => boxes.map((box) => box.getAttribute('data-part') ?? ''));
  const used = await live
    .locator('[data-demo-part]')
    .evaluateAll((parts) => [
      ...new Set(parts.map((part) => part.getAttribute('data-demo-part') ?? '')),
    ]);
  expect(used.length, 'parts marked in the demo').toBeGreaterThan(0);
  for (const part of used) expect(anatomy, `${part} is an anatomy part`).toContain(part);

  // Parts that exist only once opened (a toast, a menu) are opened first.
  const visibleParts = live.locator('[data-demo-mode="uncontrolled"] [data-demo-part]:visible');
  if ((await visibleParts.count()) === 0) {
    const raw = await live.getAttribute('data-key-check');
    const check = raw ? (JSON.parse(raw) as KeyCheck) : undefined;
    if (check?.open)
      await live.locator('[data-demo-mode="uncontrolled"]').locator(check.open).first().click();
  }
  // Hover a part in the demo: the innermost part under the pointer and its
  // diagram box are highlighted, and the part is named.
  const first = live.locator('[data-demo-mode="uncontrolled"] [data-demo-part]:visible').first();
  let name = (await first.getAttribute('data-demo-part')) ?? '';
  if (!isMobile) {
    await first.hover();
    await expect(live.locator('[data-active-part]')).toHaveCount(1);
    name = ((await live.locator('[data-active-part] code').textContent()) ?? '').trim();
    expect(anatomy, `${name} is an anatomy part`).toContain(name);
    expect(await live.locator(`[data-demo-part="${name}"][data-demo-hot]`).count()).toBe(1);
    expect(await figure.locator(`li[data-part="${name}"][data-hot]`).count()).toBe(1);
  }

  // Focus a focusable part (keyboard users get the same bridge).
  const focusable = live
    .locator('[data-demo-mode="uncontrolled"]')
    .locator('[data-demo-part]:is(button, input, a[href], [tabindex="0"], [role="slider"]):visible')
    .first();
  if ((await focusable.count()) > 0) {
    // Move the pointer away first, so hover does not compete with focus.
    if (!isMobile) await page.mouse.move(1, 1);
    await focusable.focus();
    // Focus may land on an inner element: the part reported is the innermost one.
    await expect(live.locator('[data-active-part]')).toHaveCount(1);
    const focusedPart = (
      (await live.locator('[data-active-part] code').textContent()) ?? ''
    ).trim();
    expect(anatomy).toContain(focusedPart);
    await expect(figure.locator(`li[data-part="${focusedPart}"][data-hot]`)).toHaveCount(1);
  }

  // Hover a diagram box: every instance of that part in the demo lights up.
  if (!isMobile) {
    await figure.locator(`li[data-part="${name}"] > .anatomy__label`).first().hover();
    expect(await live.locator(`[data-demo-part="${name}"][data-demo-hot]`).count()).toBeGreaterThan(
      0
    );
  }
}

/** Every prop, through its own control, changes the code sample. */
async function checkPropsPanel(page: Page, live: Locator, id: string): Promise<void> {
  const code = live.locator('[data-live-code]');
  const before = (await code.textContent()) ?? '';
  expect(before).toContain(`@texuli/primitives/${id}`);
  const rows = live.locator('[data-props-panel] [data-prop]');
  const count = await rows.count();
  for (let index = 0; index < count; index += 1) {
    const row = rows.nth(index);
    const prop = (await row.getAttribute('data-prop')) ?? '';
    const kind = await row.getAttribute('data-kind');
    const previous = (await code.textContent()) ?? '';
    if (kind === 'enum') {
      await row.locator('[aria-pressed="false"]').first().click();
    } else if (kind === 'boolean') {
      await row.getByRole('switch').click();
    } else if (kind === 'number') {
      await row.getByRole('slider').focus();
      const atEnd =
        (await row.getByRole('slider').getAttribute('aria-valuenow')) ===
        (await row.getByRole('slider').getAttribute('aria-valuemax'));
      await page.keyboard.press(atEnd ? 'Home' : 'End');
    } else {
      await row.locator('input').fill('Example label');
    }
    await expect(code, `${id}: the ${prop} prop shows in the code`).not.toHaveText(previous);
  }
}

/** The frame's light/dark and RTL toggles scope the preview (the same frame on every page). */
async function checkToggles(live: Locator): Promise<void> {
  const stage = live.locator('[data-live-stage]');
  const background = () => stage.evaluate((node) => getComputedStyle(node).backgroundColor);
  await expect(stage).toHaveAttribute('data-tx-mode', 'light');
  const light = await background();
  await live.getByRole('button', { name: 'Dark', exact: true }).click();
  await expect(stage).toHaveAttribute('data-tx-mode', 'dark');
  expect(await background()).not.toBe(light);
  await live.getByRole('switch', { name: 'Right to left' }).click();
  await expect(stage).toHaveAttribute('dir', 'rtl');
}

for (const id of IDS.filter((name) => REPRESENTATIVE.has(name))) {
  test.describe(`live ${id}`, () => {
    test('controlled and uncontrolled panels, keyboard hints, anatomy bridge, props panel', async ({
      page,
      isMobile,
    }, info) => {
      test.setTimeout(120_000);
      // Each check may leave floating content open (a modal makes the rest of
      // the page inert), so each starts from a fresh load of the same page;
      // the page session keeps its cache, which makes the reloads cheap.
      await checkControlled(await openDemo(page, id), id);
      await checkKeyHints(page, await openDemo(page, id), id, info.project.name);
      await checkAnatomy(page, await openDemo(page, id), id, isMobile);
      const live = await openDemo(page, id);
      await checkPropsPanel(page, live, id);
      await checkToggles(live);
    });

    test('axe, zero exclusions, and polish in light, dark and forced colors', async ({ page }) => {
      test.setTimeout(90_000);
      for (const mode of ['light', 'dark', 'forced-colors'] as const) {
        await page.emulateMedia({
          colorScheme: mode === 'dark' ? 'dark' : 'light',
          forcedColors: mode === 'forced-colors' ? 'active' : 'none',
          reducedMotion: 'reduce',
        });
        const live = await openDemo(page, id);
        // The API rows (details) are checked open (site-primitives-page.spec.ts).
        await page.evaluate(() => {
          for (const details of document.querySelectorAll('details')) details.open = true;
        });
        expect(await axe(page), `axe ${mode}`).toEqual([]);
        if (mode !== 'forced-colors') {
          expect(await polishProblems(page), `polish ${mode}`).toEqual([]);
        }
        // Open floating content is checked too.
        const raw = await live.getAttribute('data-key-check');
        const check = raw ? (JSON.parse(raw) as KeyCheck) : undefined;
        if (check?.open) {
          await live
            .locator('[data-demo-mode="uncontrolled"]')
            .locator(check.open)
            .first()
            .click(check.openWith === 'contextmenu' ? { button: 'right' } : {});
          expect(await axe(page), `axe ${mode}, open`).toEqual([]);
        }
      }
    });
  });
}

async function weigh(
  page: Page,
  id: string,
  load: boolean
): Promise<{ js: number; total: number }> {
  const files = new Set<string>();
  const listener = (request: { url(): string }) => {
    if (request.url().startsWith(origin)) files.add(new URL(request.url()).pathname);
  };
  page.on('requestfinished', listener);
  if (load) {
    await openDemo(page, id);
  } else {
    await page.goto(`${origin}/primitives-page/${id}/`);
  }
  await page.waitForFunction(
    () =>
      document.documentElement.dataset.txPageReady === 'true' ||
      (!document.querySelector('script[data-tx-ready-script]') &&
        document.readyState === 'complete'),
    undefined,
    { polling: 250 }
  );
  page.off('requestfinished', listener);
  let js = 0;
  let total = 0;
  for (const pathname of files) {
    let file = normalize(join(DIST, pathname));
    if (!file.startsWith(DIST)) continue;
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
    if (!existsSync(file)) continue;
    const size = gzipSync(readFileSync(file), { level: 9 }).length;
    total += size;
    if (file.endsWith('.js')) js += size;
  }
  const kb = (bytes: number) => Math.round((bytes / 1024) * 10) / 10;
  return { js: kb(js), total: kb(total) };
}

test('primitive routes stay within budget: the default until the demo is seen, the route budget with it', async ({
  browser,
}, info) => {
  test.skip(info.project.name !== 'chromium', 'transfer sizes are checked once');
  test.setTimeout(400_000);
  const over: string[] = [];
  const report: string[] = [];
  for (const id of IDS) {
    const route = `/primitives-page/${id}/`;
    const budget = budgetFor(route);
    // Off screen (a short viewport): the demo has not loaded, so its JavaScript
    // stays within the site default.
    const shortContext = await browser.newContext({ viewport: { width: 1280, height: 240 } });
    const before = await weigh(await shortContext.newPage(), id, false);
    await shortContext.close();
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const after = await weigh(await context.newPage(), id, true);
    await context.close();
    report.push(
      `${route} before js=${before.js} page=${before.total} | loaded js=${after.js} page=${after.total}`
    );
    if (before.js > DEFAULT_BUDGET.jsGzipKb)
      over.push(`${route} before the demo: js ${before.js} KB > ${DEFAULT_BUDGET.jsGzipKb}`);
    if (before.total > budget.pageGzipKb)
      over.push(`${route} before the demo: page ${before.total} KB > ${budget.pageGzipKb}`);
    if (after.js > budget.jsGzipKb) over.push(`${route}: js ${after.js} KB > ${budget.jsGzipKb}`);
    if (after.total > budget.pageGzipKb)
      over.push(`${route}: page ${after.total} KB > ${budget.pageGzipKb}`);
  }
  await info.attach('primitive-weights', { body: report.join('\n'), contentType: 'text/plain' });
  expect(over).toEqual([]);
});

test.describe('live toasts on the toast pages (FIX-toaster-viewport)', () => {
  test.skip(({ isMobile, browserName }) => isMobile || browserName !== 'chromium', 'checked once');

  const MODES = ['light', 'dark', 'forced-colors'] as const;
  const emulate = (page: Page, mode: (typeof MODES)[number]) =>
    page.emulateMedia({
      colorScheme: mode === 'dark' ? 'dark' : 'light',
      forcedColors: mode === 'forced-colors' ? 'active' : 'none',
      reducedMotion: 'reduce',
    });

  test('the toast primitive page shows a placed toast on click, axe clean, in light, dark and forced colors', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    for (const mode of MODES) {
      await emulate(page, mode);
      const live = await openDemo(page, 'toast');
      await live.locator('[data-demo-mode="uncontrolled"] [data-demo-act="show"]').click();
      const toast = live.locator('[data-demo-mode="uncontrolled"] [data-tx-toast-root]').first();
      await expect(toast).toBeVisible();
      // Placed by the library at the viewport's bottom end, inside the screen.
      const box = await toast.boundingBox();
      const size = page.viewportSize() ?? { width: 0, height: 0 };
      if (!box) throw new Error('toast not rendered');
      expect(size.height - (box.y + box.height)).toBeLessThan(48);
      expect(size.width - (box.x + box.width)).toBeLessThan(48);
      expect(await axe(page), mode).toEqual([]);
    }
  });

  test('the Toaster component page shows live toasts on click, axe clean, in light, dark and forced colors', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    for (const mode of MODES) {
      await emulate(page, mode);
      await page.goto(`${origin}/component-pages/toaster/`);
      const stage = page.locator('[data-tx-toast-stage="toaster"]');
      await stage.scrollIntoViewIfNeeded();
      await expect(stage).toBeVisible({ timeout: 20_000 });
      for (const kind of ['success', 'info', 'warning', 'error']) {
        await stage.getByRole('button', { name: `Show ${kind}` }).click();
      }
      const toasts = stage.locator('[data-tx-toast-root]');
      await expect(toasts).toHaveCount(4);
      await expect(toasts.first()).toBeVisible();
      expect(await axe(page), mode).toEqual([]);
      await stage.getByRole('button', { name: 'Dismiss all' }).click();
      await expect(toasts).toHaveCount(0);
    }
  });
});
