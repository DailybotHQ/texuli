/**
 * /sheets-page/ (PLAN_010 T-site-080): honest status copy (in development,
 * on npm from 0.8.0, its first release), fictional data, no HTML sinks, lazy
 * islands, sections that match the page, one example per function of the
 * package's own list (each evaluated without an unexpected error), the
 * safety cases the engine really produces, a valid two-tab workbook, CSV
 * export that neutralizes injection, and the agent blueprint accepted
 * while the INDIRECT formula is refused.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { validateDraft } from '@texuli/catalog/validate';
import { createPlayerCatalog } from '@texuli/player';
import { csvToSheet, sheetToCsv } from '@texuli/sheets/csv';
import { SHEET_FUNCTION_NAMES } from '@texuli/sheets/formula';
import { checkSheetDraft, createWorkbook, displayValue, validateSheet } from '@texuli/sheets/model';
import { describe, expect, it } from 'vitest';
import {
  AGENT_SHEET_BLUEPRINT,
  HOSTILE_SHEET_BLUEPRINT,
  SHEETS_SPEC,
} from '../src/components/sheets-site/blueprint.ts';
import { HOSTILE_CSV } from '../src/components/sheets-site/csv.ts';
import {
  SHEETS_DOCS,
  SHEETS_RELEASE,
  SHEETS_SECTIONS,
  SHEETS_STATUS,
} from '../src/components/sheets-site/page.ts';
import {
  dependencyRows,
  evaluateInLab,
  FUNCTION_EXAMPLES,
  functionRows,
  ORDERS_WORKBOOK,
  safetyCases,
} from '../src/components/sheets-site/workbook.ts';

const read = (path: string) => readFileSync(resolve('apps/website/src', path), 'utf8');
const PAGE = read('pages/sheets-page/index.astro');
const ISLANDS = ['AgentSheetDemo', 'CsvLab', 'FunctionLab', 'SheetWorkbench'];
const SOURCES = [
  ...ISLANDS.map((name) => `components/sheets-site/${name}.svelte`),
  'components/sheets-site/blueprint.ts',
  'components/sheets-site/csv.ts',
  'components/sheets-site/page.ts',
  'components/sheets-site/workbook.ts',
  'pages/sheets-page/index.astro',
].map((path) => [path, read(path)] as const);

const errorsOf = (blueprint: unknown) =>
  validateDraft(blueprint, {
    catalog: createPlayerCatalog(),
    tier: 'untrusted',
    checkSheet: checkSheetDraft,
  }).diagnostics.filter((entry) => entry.severity === 'error');

describe('sheets page: copy and safety', () => {
  it('says @texuli/sheets is in development and on npm from 0.8.0, its first release', () => {
    const pkg = JSON.parse(readFileSync(resolve('packages/sheets/package.json'), 'utf8')) as {
      version: string;
      private?: boolean;
    };
    // First published in 0.8.0; the copy names that release.
    expect(pkg.version).toBe(SHEETS_RELEASE);
    expect(pkg.private).toBe(true);
    expect(SHEETS_RELEASE).toBe('0.8.0');
    expect(SHEETS_STATUS).toBe('In development, on npm from 0.8.0, a pre-1.0 release.');
    const copy = PAGE.replace(/\s+/g, ' ');
    expect(copy).toMatch(
      /eyebrow=\{`@texuli\/sheets · in development · on npm from \$\{SHEETS_RELEASE\}`\}/
    );
    expect(copy).toContain('on npm from <code>{SHEETS_RELEASE}</code>, a pre-1.0 release');
    for (const [path, source] of SOURCES) {
      expect(source, path).not.toMatch(
        /not (?:yet )?published to npm|coming in 0\.8|unreleased|production[- ]ready/i
      );
      expect(source, path).not.toMatch(/\{@html|set:html|innerHTML|srcdoc/);
      for (const [url] of source.matchAll(/https?:\/\/[^\s'"`)]+/g)) {
        expect(new URL(url).hostname, `${path}: ${url}`).toMatch(/(^|\.)example\.com$/);
      }
    }
  });

  it('mounts every island with client:visible and loads the player and the host lazily', () => {
    const islands = [...PAGE.matchAll(/<([A-Z]\w+) client:(\w+)/g)];
    expect(islands.map(([, name]) => name).sort()).toEqual(ISLANDS);
    for (const [, name, directive] of islands) expect(`${name} ${directive}`).toMatch(/ visible$/);
    const heavy = /^import\s+(?!type\b)[^;]*from\s+'@texuli\/(sheets\/host|player)'/m;
    for (const name of ISLANDS) {
      expect(read(`components/sheets-site/${name}.svelte`), name).not.toMatch(heavy);
    }
  });

  it('gives every section an anchor and a unique id, and points at docs that exist', () => {
    const ids = SHEETS_SECTIONS.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(PAGE).toContain(`id="${id}"`);
    expect(PAGE).not.toMatch(/<h1[\s>]/);
    for (const doc of SHEETS_DOCS) expect(existsSync(resolve(doc.path)), doc.path).toBe(true);
  });
});

describe('sheets page: data', () => {
  it('has one example per function of the package, each evaluated without a surprise error', () => {
    expect(Object.keys(FUNCTION_EXAMPLES).sort()).toEqual([...SHEET_FUNCTION_NAMES].sort());
    const rows = functionRows();
    expect(rows).toHaveLength(SHEET_FUNCTION_NAMES.length);
    for (const row of rows) {
      if (row.name === 'NA') expect(row.result).toBe('#N/A');
      else expect(row.result, `${row.name}: ${row.example}`).not.toMatch(/^#/);
    }
    const by = Object.fromEntries(rows.map((row) => [row.name, row.result]));
    expect(by.SUM).toBe('1110.75');
    expect(by.SUMIF).toBe('820');
    expect(by.VLOOKUP).toBe('open');
    expect(by.TODAY).toBe('2026-10-29');
    expect(evaluateInLab('=SUM(B2:B9').error).toBeTruthy();
  });

  it('builds a two-tab workbook that validates, with cross-sheet formulas and a full graph', () => {
    const checked = validateSheet(ORDERS_WORKBOOK);
    expect(checked.ok).toBe(true);
    if (!checked.ok) return;
    const book = createWorkbook(checked.sheet);
    expect(displayValue(book.value('summary', 1, 1))).toBe('820');
    // Editing the tax rate evaluates exactly the one formula that reads it.
    const pass = book.setInput('summary', 5, 1, 0.1);
    expect(pass.evaluated).toBe(1);
    expect(displayValue(book.value('summary', 6, 1))).toBe('902');
    // Inserting rows rewrites the total's range.
    book.insertRows('orders', 4, 2);
    expect(book.input('orders', 12, 1)).toBe('=SUM(B2:B11)');
    expect(dependencyRows().length).toBe(10);
  });

  it('reports the safety outcomes the engine really produces', () => {
    const cases = Object.fromEntries(safetyCases().map((entry) => [entry.id, entry.outcome]));
    expect(cases.cycle).toContain('#CYCLE!');
    expect(cases['self-range']).toContain('#CYCLE!');
    expect(cases.limit).toContain('#LIMIT!');
    expect(cases.div).toContain('#DIV/0!');
    expect(cases['dynamic-0']).toContain('INDIRECT is not a sheet function');
    expect(cases['agent-indirect']).toMatch(/^refused/);
    expect(cases.bidi).toContain('unsafe-text');
    expect(cases['too-big']).toMatch(/^refused/);
  });

  it('keeps imported formulas as text and neutralizes them on export', () => {
    const imported = csvToSheet(HOSTILE_CSV, { name: 'Imported' });
    expect(imported.ok).toBe(true);
    if (!imported.ok) return;
    const book = createWorkbook(imported.sheet);
    const csv = sheetToCsv(book, book.sheets[0]?.id ?? '');
    expect(csv).toContain(`'+1+1`);
    expect(csv).toContain(`'@SUM(A1)`);
    expect(csv).toContain(`"'=HYPERLINK(`);
    expect(csv).toContain(',-5,');
    // With formulas on, HYPERLINK is outside the language and the file is refused.
    expect(csvToSheet(HOSTILE_CSV, { formulas: true }).ok).toBe(false);
  });

  it('writes an agent spreadsheet blueprint (spec 0.8.0) the player accepts, and refuses INDIRECT', () => {
    expect(SHEETS_SPEC).toBe('0.8.0');
    expect(errorsOf(AGENT_SHEET_BLUEPRINT)).toEqual([]);
    const hostile = errorsOf(HOSTILE_SHEET_BLUEPRINT);
    expect(hostile.length).toBeGreaterThan(0);
  });
});
