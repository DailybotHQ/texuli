// @vitest-environment node
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  type BudgetsFile,
  budgetFor,
  compare,
  discoverEntries,
  discoverFunctionEntries,
  exportFile,
  formatTable,
  isExternal,
  measureEntry,
  parseArgs,
  parseBudgets,
  roundUp,
  runSize,
  type SizeMeasure,
  type SizeRow,
  unmatchedBudgets,
  updateBudgets,
} from '../size.ts';

const FIXTURE = resolve(import.meta.dirname, 'fixtures/size-workspace');
const BUILD = 60_000;

const measure = (gzip: number, extra: Partial<SizeMeasure> = {}): SizeMeasure => ({
  raw: gzip * 3,
  gzip,
  brotli: Math.round(gzip * 0.8),
  cssGzip: 0,
  lazyGzip: 0,
  ...extra,
});

/** A scratch copy of the fixture workspace, so --update never writes into the repository. */
let workspace: string;
beforeAll(async () => {
  workspace = await mkdtemp(join(tmpdir(), 'texuli-size-test-'));
  await cp(FIXTURE, workspace, { recursive: true });
});
afterAll(async () => {
  await rm(workspace, { recursive: true, force: true });
});

async function writeBudgets(budgets: BudgetsFile): Promise<string> {
  const path = join(workspace, `budgets-${Math.random().toString(36).slice(2)}.json`);
  await writeFile(path, JSON.stringify(budgets));
  return path;
}

describe('discoverEntries', () => {
  it('finds every measurable export subpath and skips what is not code; measures ignored packages only when they are not ignored; picks the svelte, browser, import or default condition, in that order', async () => {
    // finds every measurable export subpath and skips what is not code
    {
      const entries = await discoverEntries(workspace, ['@fixture/tool']);
      expect(entries.map((entry) => entry.id)).toEqual([
        '@fixture/alpha',
        '@fixture/alpha/extra',
        '@fixture/alpha/styles.css',
        '@fixture/widgets',
        '@fixture/widgets/button',
      ]);
      const css = entries.find((entry) => entry.id === '@fixture/alpha/styles.css');
      expect(css?.css).toBe(true);
      expect(css?.file).toBe(join(workspace, 'packages/alpha/src/styles.css'));
      // ./package.json, the ./internal/* wildcard and the types-only ./types are skipped.
      expect(entries.some((entry) => entry.id.includes('package.json'))).toBe(false);
    }
    // measures ignored packages only when they are not ignored
    {
      const entries = await discoverEntries(workspace);
      expect(entries.map((entry) => entry.id)).toContain('@fixture/tool');
    }
    expect(exportFile('./src/index.ts')).toBe('./src/index.ts');
    expect(exportFile({ types: './a.d.ts', default: './a.js', svelte: './a.ts' })).toBe('./a.ts');
    expect(exportFile({ node: './n.js', import: { default: './i.js' } })).toBe('./i.js');
    expect(exportFile({ types: './only.d.ts' })).toBeNull();
    expect(exportFile(null)).toBeNull();
  });
});

describe('measureEntry', () => {
  it(
    'measures an entry’s initial JavaScript with gzip and brotli, and its lazy chunks apart',
    async () => {
      const [alpha] = await discoverEntries(workspace);
      const result = await measureEntry(alpha as NonNullable<typeof alpha>);
      expect(result.raw).toBeGreaterThan(0);
      expect(result.gzip).toBeGreaterThan(0);
      expect(result.brotli).toBeGreaterThan(0);
      expect(result.gzip).toBeLessThan(result.raw + 64);
      // later.ts is reached only through import(): measured, but not as the entry.
      expect(result.lazyGzip).toBeGreaterThan(0);
      expect(result.cssGzip).toBe(0);
    },
    BUILD
  );

  it(
    'compiles Svelte components, keeps the svelte runtime external and measures their CSS',
    async () => {
      const entries = await discoverEntries(workspace);
      const button = entries.find((entry) => entry.id === '@fixture/widgets/button');
      const result = await measureEntry(button as NonNullable<typeof button>);
      expect(result.gzip).toBeGreaterThan(0);
      expect(result.cssGzip).toBeGreaterThan(0);
      // The runtime is the consumer's: only the component's own code is counted.
      expect(result.gzip).toBeLessThan(2048);
    },
    BUILD
  );

  it(
    'measures a stylesheet export as CSS only',
    async () => {
      const entries = await discoverEntries(workspace);
      const css = entries.find((entry) => entry.id === '@fixture/alpha/styles.css');
      const result = await measureEntry(css as NonNullable<typeof css>);
      expect(result.cssGzip).toBeGreaterThan(0);
      expect(result.gzip).toBe(0);
    },
    BUILD
  );

  it(
    'discovers Pages Functions as functions/<route> entries and measures them, lazy chunks apart',
    async () => {
      await mkdir(join(workspace, 'functions'), { recursive: true });
      await writeFile(
        join(workspace, 'functions', 'probe.ts'),
        "export const onRequest = async () => (await import('./lazy.ts')).answer();\n"
      );
      await writeFile(
        join(workspace, 'functions', 'lazy.ts'),
        `export const answer = () => new Response(${JSON.stringify('lazy '.repeat(400))});\n`
      );
      const entries = await discoverFunctionEntries(workspace, ['probe', 'missing']);
      expect(entries.map((entry) => entry.id)).toEqual(['functions/probe']);
      expect(entries[0]?.packageName).toBe('functions');
      const result = await measureEntry(entries[0] as NonNullable<(typeof entries)[0]>);
      expect(result.gzip).toBeGreaterThan(0);
      expect(result.lazyGzip).toBeGreaterThan(0);
    },
    BUILD
  );

  it('treats svelte and its subpaths as external, and nothing else', () => {
    expect(isExternal('svelte')).toBe(true);
    expect(isExternal('svelte/internal/client')).toBe(true);
    expect(isExternal('svelte-check')).toBe(false);
    expect(isExternal('@texuli/core')).toBe(false);
  });
});

describe('budgets', () => {
  const budgets: BudgetsFile = parseBudgets({
    budgets: {
      '@fixture/widgets/*': { gzip: 4096, cssGzip: 1024 },
      '@fixture/widgets/dialog': { gzip: 8192 },
      '@fixture/alpha': {
        gzip: 512,
        brotli: 400,
        protoyard: { specifier: '@protoyard/ui', gzip: 300 },
      },
    },
  });

  it('applies the exact id before the package pattern; rejects a malformed file with every problem listed; flags over budget, no budget and larger than Protoyard, each with its reason; prints one row per entry, with the pattern that applied', () => {
    expect(budgetFor('@fixture/widgets/dialog', budgets)?.key).toBe('@fixture/widgets/dialog');
    expect(budgetFor('@fixture/widgets/button', budgets)?.key).toBe('@fixture/widgets/*');
    // The pattern covers subpaths, not the package root.
    expect(budgetFor('@fixture/widgets', budgets)).toBeNull();
    // rejects a malformed file with every problem listed
    {
      expect(() => parseBudgets(null)).toThrow(/expected an object/);
      expect(() => parseBudgets({})).toThrow(/"budgets" object/);
      let message = '';
      try {
        parseBudgets({
          ignore: 'tools',
          budgets: {
            a: { gzip: -1 },
            'b*': { gzip: 10 },
            c: { gzip: 10, cssGzip: 1.5 },
            d: { gzip: 10, protoyard: { specifier: 'other-ui' } },
          },
        });
      } catch (error) {
        message = String(error);
      }
      expect(message).toContain('"ignore" must be an array');
      expect(message).toContain('a: "gzip" must be a whole number');
      expect(message).toContain('b*: a pattern ends in "/*"');
      expect(message).toContain('c: "cssGzip" must be a whole number');
      expect(message).toContain('d: "protoyard.specifier" must name a @protoyard/* import');
    }
    // flags over budget, no budget and larger than Protoyard, each with its reason
    {
      const rows = compare(
        [
          { id: '@fixture/widgets/button', measure: measure(1000, { cssGzip: 2000 }) },
          { id: '@fixture/widgets/dialog', measure: measure(8000) },
          { id: '@fixture/alpha', measure: measure(310) },
          { id: '@fixture/unknown', measure: measure(10) },
        ],
        budgets
      );
      const byId = Object.fromEntries(rows.map((row) => [row.id, row]));
      expect(byId['@fixture/widgets/button']?.status).toBe('over');
      expect(byId['@fixture/widgets/button']?.problems).toEqual(['css gzip 2000 B > 1024 B']);
      expect(byId['@fixture/widgets/dialog']?.status).toBe('ok');
      expect(byId['@fixture/alpha']?.status).toBe('larger-than-protoyard');
      expect(byId['@fixture/alpha']?.problems[0]).toMatch(/@protoyard\/ui 300 B/);
      expect(byId['@fixture/unknown']?.status).toBe('unbudgeted');
      expect(unmatchedBudgets(rows, budgets)).toEqual([]);
      expect(unmatchedBudgets(rows.slice(0, 1), budgets)).toEqual([
        '@fixture/widgets/dialog',
        '@fixture/alpha',
      ]);
    }
    // prints one row per entry, with the pattern that applied
    {
      const rows = compare(
        [
          { id: '@fixture/widgets/button', measure: measure(900, { cssGzip: 120 }) },
          { id: '@fixture/alpha', measure: measure(2000) },
        ],
        budgets
      );
      const table = formatTable(rows).split('\n');
      expect(table[0]).toMatch(
        /^entry\s+gzip\s+budget\s+brotli\s+css gzip\s+lazy gzip\s+lazy css\s+protoyard\s+status$/
      );
      expect(table[2]).toMatch(
        /^@fixture\/alpha .*1\.95 KiB .*512 B .*300 B @protoyard\/ui .*OVER$/
      );
      expect(table[3]).toMatch(/900 B\s+4\.00 KiB \(@fixture\/widgets\/\*\).*120 B .*ok$/);
    }
  });
});

describe('updateBudgets: budgets only shrink by default', () => {
  const base = (): BudgetsFile => ({
    budgets: {
      shrinks: { gzip: 4096, brotli: 4096 },
      grows: { gzip: 128 },
      'pattern/*': { gzip: 4096 },
    },
  });
  const rows = (): SizeRow[] =>
    compare(
      [
        { id: 'shrinks', measure: measure(1000) },
        { id: 'grows', measure: measure(500) },
        { id: 'pattern/item', measure: measure(100) },
        { id: 'new-entry', measure: measure(70, { cssGzip: 10 }) },
      ],
      base()
    );

  it('tightens a budget to the rounded-up measure and refuses to raise one; raises and adds budgets only with allowGrow; rounds up to the budget step and never below one step', () => {
    // tightens a budget to the rounded-up measure and refuses to raise one
    {
      const result = updateBudgets(base(), rows());
      expect(result.budgets.budgets.shrinks).toEqual({ gzip: 1024, brotli: 832 });
      expect(result.budgets.budgets.grows).toEqual({ gzip: 128 });
      expect(result.budgets.budgets['new-entry']).toBeUndefined();
      // Pattern budgets are design targets: never rewritten.
      expect(result.budgets.budgets['pattern/*']).toEqual({ gzip: 4096 });
      expect(result.refused).toEqual([
        'grows: gzip would grow 128 → 512 B',
        'new-entry: no budget (add one with --allow-grow)',
      ]);
      expect(result.changes).toEqual([
        'shrinks: gzip 4096 → 1024 B',
        'shrinks: brotli 4096 → 832 B',
      ]);
    }
    // raises and adds budgets only with allowGrow
    {
      const result = updateBudgets(base(), rows(), { allowGrow: true });
      expect(result.budgets.budgets.grows).toEqual({ gzip: 512 });
      expect(result.budgets.budgets['new-entry']).toEqual({ gzip: 128, cssGzip: 64 });
      expect(result.refused).toEqual([]);
    }
    expect(roundUp(0)).toBe(64);
    expect(roundUp(64)).toBe(64);
    expect(roundUp(65)).toBe(128);
  });
});

describe('runSize (AC-size-tool)', () => {
  const quiet = () => {
    const lines: string[] = [];
    return { lines, log: (line: string) => lines.push(line) };
  };

  it(
    'fails a fixture that exceeds its budget, and names it',
    async () => {
      const budgetsPath = await writeBudgets({
        ignore: ['@fixture/tool'],
        budgets: {
          '@fixture/alpha': { gzip: 16 },
          '@fixture/alpha/extra': { gzip: 4096 },
          '@fixture/alpha/styles.css': { gzip: 0, cssGzip: 1024 },
          '@fixture/widgets': { gzip: 4096, cssGzip: 1024 },
          '@fixture/widgets/*': { gzip: 4096, cssGzip: 1024 },
        },
      });
      const out = quiet();
      const run = await runSize({ root: workspace, budgetsPath, log: out.log });
      expect(run.exitCode).toBe(1);
      expect(run.rows).toHaveLength(5);
      expect(run.failed.map((row) => row.id)).toEqual(['@fixture/alpha']);
      expect(out.lines.join('\n')).toMatch(/✗ @fixture\/alpha: gzip \d+ B > 16 B/);
      expect(out.lines.at(-1)).toMatch(/^✗ 1 of 5 entries fail/);
    },
    BUILD
  );

  it(
    'passes when every entry is within budget, and reports planned budgets',
    async () => {
      const budgetsPath = await writeBudgets({
        ignore: ['@fixture/tool'],
        budgets: {
          '@fixture/alpha': { gzip: 4096 },
          '@fixture/alpha/extra': { gzip: 4096 },
          '@fixture/alpha/styles.css': { gzip: 0, cssGzip: 1024 },
          '@fixture/widgets': { gzip: 4096, cssGzip: 1024 },
          '@fixture/widgets/*': { gzip: 4096, cssGzip: 1024 },
          '@fixture/widgets/dialog': { gzip: 8192 },
        },
      });
      const out = quiet();
      const run = await runSize({ root: workspace, budgetsPath, log: out.log });
      expect(run.exitCode).toBe(0);
      expect(run.unmatched).toEqual(['@fixture/widgets/dialog']);
      expect(out.lines.at(-1)).toMatch(/^✓ 5 entries within budget/);
    },
    BUILD
  );

  it(
    'fails an entry with no budget, and --update --allow-grow adds it',
    async () => {
      const budgetsPath = await writeBudgets({
        ignore: ['@fixture/tool', '@fixture/widgets'],
        budgets: { '@fixture/alpha': { gzip: 4096 } },
      });
      const first = await runSize({
        root: workspace,
        budgetsPath,
        filter: '@fixture/alpha',
        log: quiet().log,
      });
      expect(first.exitCode).toBe(1);
      expect(first.failed.map((row) => row.status)).toEqual(['unbudgeted', 'unbudgeted']);

      const refused = await runSize({
        root: workspace,
        budgetsPath,
        update: true,
        log: quiet().log,
      });
      expect(refused.exitCode).toBe(1);
      // Without --allow-grow only the over-sized budget shrinks; nothing is added.
      const shrunk = JSON.parse(await readFile(budgetsPath, 'utf8')) as BudgetsFile;
      expect(shrunk.budgets['@fixture/alpha']?.gzip).toBeLessThan(4096);
      expect(shrunk.budgets['@fixture/alpha/extra']).toBeUndefined();

      const grown = await runSize({
        root: workspace,
        budgetsPath,
        update: true,
        allowGrow: true,
        log: quiet().log,
      });
      expect(grown.exitCode).toBe(0);
      const written = JSON.parse(await readFile(budgetsPath, 'utf8')) as BudgetsFile;
      expect(Object.keys(written.budgets).sort()).toEqual([
        '@fixture/alpha',
        '@fixture/alpha/extra',
        '@fixture/alpha/styles.css',
      ]);
    },
    BUILD
  );

  it(
    'prints JSON with --json',
    async () => {
      const budgetsPath = await writeBudgets({
        budgets: { '@fixture/alpha/extra': { gzip: 4096 } },
      });
      const out = quiet();
      const run = await runSize({
        root: workspace,
        budgetsPath,
        filter: 'alpha/extra',
        json: true,
        log: out.log,
      });
      expect(run.exitCode).toBe(0);
      const parsed = JSON.parse(out.lines.join('\n')) as { rows: SizeRow[] };
      expect(parsed.rows.map((row) => [row.id, row.status])).toEqual([
        ['@fixture/alpha/extra', 'ok'],
      ]);
    },
    BUILD
  );
});

describe('parseArgs', () => {
  it('reads every flag and refuses unknown ones', () => {
    expect(parseArgs(['--filter', 'primitives', '--json', '--update', '--allow-grow'])).toEqual({
      filter: 'primitives',
      json: true,
      update: true,
      allowGrow: true,
    });
    expect(parseArgs(['--protoyard', '../protoyard']).protoyard).toBe('../protoyard');
    expect(() => parseArgs(['--filter'])).toThrow(/needs a value/);
    expect(() => parseArgs(['--allow-grow'])).toThrow(/only works with --update/);
    expect(() => parseArgs(['--bogus'])).toThrow(/Unknown option --bogus/);
  });
});
