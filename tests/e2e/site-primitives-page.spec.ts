/// <reference types="node" />

import { createReadStream, existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';
import {
  behaviorEvidence,
  parseBehaviorChecks,
  parseBehaviorRows,
  parseOpenToFocusLimits,
} from '../../apps/website/src/components/primitives-page/behavior.ts';
import {
  anatomyParts,
  importLine,
  PRIMITIVES,
  partLabel,
  primitivePath,
} from '../../apps/website/src/components/primitives-page/primitives.ts';
import { DEFAULT_OPEN_TO_FOCUS_P75_MS, OPEN_TO_FOCUS_P75_MS } from '../behavior/harness/limits.ts';
import { primaryNav } from './support/site-nav.ts';

/*
 * texuli.com primitives reference (apps/website/src/pages/primitives-page).
 * Built static site only — run `pnpm build` first. Every primitive page shows
 * an anatomy whose parts are real exports, and the behavior checks parsed from
 * the committed behavior suite. No foreign network; axe in light and dark.
 */

const DIST = resolve('apps/website/dist');
const PRIMITIVES_SRC = resolve('packages/primitives/src');
const SCENARIOS = resolve('tests/behavior/scenarios');
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};
const PATHS = ['/primitives-page/', ...PRIMITIVES.map((doc) => primitivePath(doc.id))];
const BUDGETS = (
  JSON.parse(readFileSync('texuli.budgets.json', 'utf8')) as {
    budgets: Record<string, { gzip?: number }>;
  }
).budgets;
const scenarioSource = (id: string) => {
  const file = join(SCENARIOS, `${id}.spec.ts`);
  return existsSync(file) ? readFileSync(file, 'utf8') : undefined;
};

// ── the package's real exports ───────────────────────────────────────────

/** Name → its keys (a compound object or `export * as`), or null for a plain export. */
type Exports = Map<string, Set<string> | null>;

/** The top-level keys of the object literal that starts at `open` (`{`). */
function objectKeys(text: string, open: number): Set<string> {
  let depth = 0;
  let end = open;
  for (let i = open; i < text.length; i += 1) {
    if (text[i] === '{') depth += 1;
    else if (text[i] === '}') {
      depth -= 1;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  const keys = new Set<string>();
  let level = 0;
  let entry = '';
  for (const char of `${text.slice(open + 1, end)},`) {
    if ('{([<'.includes(char)) level += 1;
    if ('})]>'.includes(char)) level -= 1;
    if (char === ',' && level === 0) {
      const key = entry
        .replace(/\/\/.*$/gm, '')
        .trim()
        .split(':')[0]
        ?.trim();
      if (key && /^\w+$/.test(key)) keys.add(key);
      entry = '';
    } else entry += char;
  }
  return keys;
}

/** Where the value of `export const NAME` starts: past its type, at the `=`. */
function valueStart(text: string, from: number): number {
  let depth = 0;
  for (let i = from; i < text.length; i += 1) {
    const char = text[i];
    if ('{(<['.includes(char ?? '')) depth += 1;
    else if ('})>]'.includes(char ?? '') && text[i - 1] !== '=') depth -= 1;
    else if (char === '=' && depth === 0 && text[i + 1] !== '>') return i + 1;
  }
  return text.length;
}

function moduleExports(file: string, seen = new Set<string>()): Exports {
  const exports: Exports = new Map();
  if (seen.has(file) || !existsSync(file)) return exports;
  seen.add(file);
  const text = readFileSync(file, 'utf8');
  const near = (spec: string) => resolve(dirname(file), spec);
  for (const match of text.matchAll(/export const (\w+)/g)) {
    const start = valueStart(text, (match.index ?? 0) + match[0].length);
    const brace = text.slice(start).search(/\S/);
    const rest = text.slice(start + brace);
    const object = /^(Object\.freeze\(\s*)?\{/.exec(rest);
    exports.set(
      match[1] as string,
      object ? objectKeys(text, start + brace + object[0].length - 1) : null
    );
  }
  for (const match of text.matchAll(/export (?:function|class) (\w+)/g)) {
    exports.set(match[1] as string, null);
  }
  for (const match of text.matchAll(/export (type )?\{([^}]*)\}/g)) {
    if (match[1]) continue;
    for (const item of (match[2] ?? '').split(',')) {
      const name = item.trim();
      if (!name || name.startsWith('type ')) continue;
      exports.set(
        name
          .split(/\s+as\s+/)
          .pop()
          ?.trim() as string,
        null
      );
    }
  }
  for (const match of text.matchAll(/export \* as (\w+) from '([^']+)'/g)) {
    exports.set(match[1] as string, new Set(moduleExports(near(match[2] as string), seen).keys()));
  }
  for (const match of text.matchAll(/export \* from '([^']+)'/g)) {
    for (const [name, keys] of moduleExports(near(match[1] as string), seen)) {
      exports.set(name, keys);
    }
  }
  return exports;
}

function resolvesTo(exports: Exports, part: string): boolean {
  const [head, key] = part.split('.') as [string, string | undefined];
  if (!exports.has(head)) return false;
  if (key === undefined) return true;
  return exports.get(head)?.has(key) ?? false;
}

// ── the static site ──────────────────────────────────────────────────────

let server: Server;
let origin = '';

test.beforeAll(async () => {
  if (!existsSync(join(DIST, 'primitives-page', 'index.html'))) {
    throw new Error('Primitives pages missing from dist — run `pnpm build` first.');
  }
  server = createServer((request, response) => {
    const path = decodeURIComponent(new URL(request.url ?? '/', 'http://site').pathname);
    let file = normalize(join(DIST, path));
    if (!file.startsWith(DIST)) file = join(DIST, '404');
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

async function visit(page: Page, path: string) {
  const foreign: string[] = [];
  page.on('request', (request) => {
    if (!request.url().startsWith(origin)) foreign.push(request.url());
  });
  await page.goto(`${origin}${path}`);
  await page.waitForLoadState('networkidle');
  return foreign;
}

test.describe('texuli.com primitives reference: data', () => {
  test.beforeEach(({ browserName }, info) => {
    void browserName;
    test.skip(info.project.name !== 'chromium', 'the data checks are browser-independent');
  });

  test('documents every @texuli/primitives subpath, once', () => {
    const manifest = JSON.parse(readFileSync('packages/primitives/package.json', 'utf8')) as {
      exports: Record<string, unknown>;
    };
    const subpaths = Object.keys(manifest.exports)
      .filter((key) => key !== '.')
      .map((key) => key.slice(2))
      .sort();
    expect(PRIMITIVES.map((doc) => doc.id)).toEqual(subpaths);
  });

  test('every anatomy part is a real export of its subpath', () => {
    const missing: string[] = [];
    for (const doc of PRIMITIVES) {
      const exports = moduleExports(join(PRIMITIVES_SRC, doc.id, 'index.ts'));
      expect(exports.size, doc.id).toBeGreaterThan(0);
      for (const part of anatomyParts(doc.anatomy)) {
        if (!resolvesTo(exports, part)) missing.push(`${doc.id}: ${part}`);
      }
    }
    expect(missing).toEqual([]);
  });

  test('the import line names what the anatomy uses', () => {
    const dialog = PRIMITIVES.find((doc) => doc.id === 'dialog');
    const tooltip = PRIMITIVES.find((doc) => doc.id === 'tooltip');
    if (!dialog || !tooltip) throw new Error('missing fixtures');
    expect(importLine(dialog)).toBe("import * as Dialog from '@texuli/primitives/dialog';");
    expect(partLabel(dialog, 'Content')).toBe('Dialog.Content');
    expect(importLine(tooltip)).toBe("import { Tooltip } from '@texuli/primitives/tooltip';");
  });

  test('parses every committed scenario: rows or standalone checks', () => {
    const files = readdirSync(SCENARIOS).filter((file) => file.endsWith('.spec.ts'));
    expect(files.length).toBeGreaterThan(30);
    for (const file of files) {
      const source = readFileSync(join(SCENARIOS, file), 'utf8');
      const evidence = behaviorEvidence(file.replace('.spec.ts', ''), source);
      if (evidence.kind === 'rows') {
        const rows = source.match(/^\s+id:\s*['"]/gm)?.length ?? 0;
        expect(evidence.rows, file).toHaveLength(rows);
        for (const row of evidence.rows) expect(row.title, `${file} ${row.id}`).not.toBe('');
      } else {
        expect(evidence.checks.length, file).toBeGreaterThan(0);
      }
    }
  });

  test('reads the open-to-focus limits exactly as the suite defines them', () => {
    const limits = readFileSync('tests/behavior/harness/limits.ts', 'utf8');
    expect(parseOpenToFocusLimits(limits)).toEqual({
      defaultMs: DEFAULT_OPEN_TO_FOCUS_P75_MS,
      byPrimitive: OPEN_TO_FOCUS_P75_MS,
    });
  });

  test('parses rows with concatenated titles and quotes', () => {
    const source = `defineRows([
      {
        id: 'one',
        title: "it's " + 'open',
        async run({ page }) { await page.evaluate(() => ({ title: 'not this' })); },
      },
      {
        id: 'two',
        title: 'plain \\'escaped\\' row',
        run: async () => {},
      },
    ]);`;
    expect(parseBehaviorRows(source)).toEqual([
      { id: 'one', title: "it's open" },
      { id: 'two', title: "plain 'escaped' row" },
    ]);
    expect(
      parseBehaviorChecks("test('a check', async () => {}); test.describe('x', () => {});")
    ).toEqual(['a check']);
    expect(behaviorEvidence('ghost', undefined).kind).toBe('missing');
  });
});

test.describe('texuli.com primitives reference: pages', () => {
  test('the index lists every primitive with its pattern and behavior checks', async ({ page }) => {
    expect(await visit(page, '/primitives-page/')).toEqual([]);
    await expect(page).toHaveTitle('Primitives · Texuli');
    await expect(page.getByRole('heading', { level: 1, name: 'Primitives' })).toBeVisible();
    await expect(
      (await primaryNav(page)).getByRole('link', { name: 'Primitives overview', exact: true })
    ).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('[data-primitive]')).toHaveCount(PRIMITIVES.length);
    for (const doc of PRIMITIVES) {
      const card = page.locator(`[data-primitive="${doc.id}"]`);
      await expect(card.getByRole('link', { name: doc.name, exact: true })).toHaveAttribute(
        'href',
        primitivePath(doc.id)
      );
      await expect(card).toContainText(`@texuli/primitives/${doc.id}`);
      await expect(card).toContainText(doc.pattern.name);
      const evidence = behaviorEvidence(doc.id, scenarioSource(doc.id));
      if (evidence.kind === 'rows')
        await expect(card).toContainText(`${evidence.rows.length} rows`);
      if (evidence.kind === 'checks') {
        await expect(card).toContainText(`${evidence.checks.length} checks`);
      }
    }
  });

  test('every primitive page shows its anatomy, import line and behavior checks', async ({
    page,
  }) => {
    test.setTimeout(240_000);
    for (const doc of PRIMITIVES) {
      const path = primitivePath(doc.id);
      expect(await visit(page, path), path).toEqual([]);
      await expect(page.getByRole('heading', { level: 1, name: doc.name })).toBeVisible();
      await expect(
        page.getByRole('navigation', { name: 'Breadcrumb' }).getByRole('link')
      ).toHaveAttribute('href', '/primitives-page/');
      await expect(page.locator('[data-import]')).toHaveText(importLine(doc));
      const budget = BUDGETS[`@texuli/primitives/${doc.id}`] ?? BUDGETS['@texuli/primitives/*'];
      await expect(page.locator('[data-budget]')).toHaveText(
        budget?.gzip === undefined
          ? 'No budget entry'
          : `${(budget.gzip / 1024).toFixed(1)} KiB gzip for @texuli/primitives/${doc.id}`
      );

      // The diagram: one box per part, nested as the data says, named as in code.
      const figure = page.getByRole('figure', { name: `${doc.name} anatomy` });
      await expect(figure).toBeVisible();
      const parts = anatomyParts(doc.anatomy);
      await expect(figure.locator('li')).toHaveCount(parts.length);
      for (const part of new Set(parts)) {
        await expect(
          figure.locator('code', { hasText: partLabel(doc, part) }).first()
        ).toBeVisible();
      }
      const top = doc.anatomy[0];
      if (top?.children?.[0]) {
        await expect(
          figure
            .locator(`li[data-part="${top.part}"] li[data-part="${top.children[0].part}"]`)
            .first()
        ).toBeVisible();
      }

      // The evidence matches the committed scenario.
      const evidence = behaviorEvidence(doc.id, scenarioSource(doc.id));
      const section = page.getByRole('region', { name: 'Behavior checks' });
      await expect(section).toHaveAttribute('data-behavior-kind', evidence.kind);
      if (evidence.kind === 'rows') {
        await expect(section).toContainText(`${evidence.rows.length} rows`);
        await expect(section.locator('[data-row]')).toHaveCount(evidence.rows.length);
      } else if (evidence.kind === 'checks') {
        await expect(section).toContainText(`${evidence.checks.length} checks`);
      }
      if (evidence.kind !== 'missing') {
        const limit = OPEN_TO_FOCUS_P75_MS[doc.id] ?? DEFAULT_OPEN_TO_FOCUS_P75_MS;
        await expect(section.locator('[data-limits]')).toContainText(`p75 at most ${limit} ms`);
        await expect(section.locator('[data-limits]')).toContainText(
          `@texuli/primitives/${doc.id}`
        );
      }
    }
  });

  test('the row list opens from the keyboard', async ({ page }) => {
    await visit(page, primitivePath('dialog'));
    const summary = page.locator('.behavior__rows summary');
    await summary.focus();
    await expect(summary).toBeFocused();
    const first = page.locator('[data-row]').first();
    await expect(first).toBeHidden();
    await page.keyboard.press('Enter');
    await expect(first).toBeVisible();
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`passes axe on every primitives page with the rows open (${scheme})`, async ({ page }) => {
      test.setTimeout(240_000);
      await page.emulateMedia({ colorScheme: scheme });
      for (const path of PATHS) {
        expect(await visit(page, path), path).toEqual([]);
        expect(await page.locator('html').getAttribute('data-tx-mode')).toBe(scheme);
        await page.evaluate(() => {
          for (const details of document.querySelectorAll('details')) details.open = true;
        });
        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
          .analyze();
        expect(
          results.violations.map(
            (v) => `${path} ${v.id}: ${v.help} ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`
          ),
          path
        ).toEqual([]);
      }
    });
  }
});
