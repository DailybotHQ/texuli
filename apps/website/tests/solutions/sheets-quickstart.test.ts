import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { csvToSheet } from '@texuli/sheets/csv';
import { createWorkbook, displayValue, loadUntrustedSheet } from '@texuli/sheets/model';
import { SheetView } from '@texuli/sheets/view';
import { compile as compileSvelte } from 'svelte/compiler';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import type { SolutionCodeSample } from '../../src/components/solutions/shared/types.ts';
import {
  SHEETS_CSV,
  SHEETS_CSV_SAMPLE,
  SHEETS_FORMULA_SAMPLE,
  SHEETS_INSTALL,
  SHEETS_JSON,
  SHEETS_QUICKSTART_VERIFIED_BY,
  SHEETS_VIEW_SAMPLE,
  sheetsQuickstart,
} from '../../src/components/solutions/sheets/quickstart/samples.ts';
import { getSolution } from '../../src/data/solutions/index.ts';

const WEBSITE = resolve(import.meta.dirname, '../..');
const read = (path: string): string => readFileSync(resolve(WEBSITE, path), 'utf8');

function compileSample(sample: SolutionCodeSample): void {
  switch (sample.language) {
    case 'bash':
      execFileSync('bash', ['-n'], { input: sample.code, encoding: 'utf8' });
      return;
    case 'ts': {
      const result = ts.transpileModule(sample.code, {
        compilerOptions: {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.ESNext,
          strict: true,
        },
        reportDiagnostics: true,
      });
      expect(result.diagnostics ?? []).toEqual([]);
      expect(result.outputText.trim()).not.toBe('');
      return;
    }
    case 'svelte': {
      const result = compileSvelte(sample.code, {
        filename: 'sheets-quickstart.svelte',
        generate: 'client',
      });
      expect(result.warnings).toEqual([]);
      expect(result.js.code.trim()).not.toBe('');
      return;
    }
    default:
      throw new Error(`unexpected language ${sample.language}`);
  }
}

describe('Sheets quickstart', () => {
  it('feeds the shared Quickstart block with real sheets exports', () => {
    const entry = getSolution('sheets');
    const props = sheetsQuickstart(entry);
    expect(props.entry.slug).toBe('sheets');
    expect(props.install.code).toBe(SHEETS_INSTALL);
    expect(props.verifiedBy).toBe(SHEETS_QUICKSTART_VERIFIED_BY);
    expect(props.samples.map((sample) => sample.language)).toEqual(['ts', 'ts', 'svelte']);
    const layout = read('src/components/solutions/sheets/quickstart/SheetsQuickstart.astro');
    expect(layout).toContain('Quickstart.astro');
    expect(layout).toContain('sheetsQuickstart');
    expect(layout).not.toMatch(/PLAN_015|\/solutions\/sheets\/|\/sheets-page\//);
  });

  it('compiles every sample and runs the same calls against workspace packages', () => {
    const props = sheetsQuickstart(getSolution('sheets'));
    for (const sample of [props.install, ...props.samples]) {
      expect(() => compileSample(sample), sample.label).not.toThrow();
    }

    expect(SHEETS_FORMULA_SAMPLE).toContain("from '@texuli/sheets/model'");
    expect(SHEETS_CSV_SAMPLE).toContain("from '@texuli/sheets/csv'");
    expect(SHEETS_VIEW_SAMPLE).toContain("from '@texuli/sheets/view'");

    const loaded = loadUntrustedSheet(JSON.stringify(SHEETS_JSON));
    expect(loaded.ok).toBe(true);
    if (loaded.ok) {
      const workbook = createWorkbook(loaded.sheet, { now: () => Date.now() });
      expect(displayValue(workbook.value('costs', 2, 1))).toBe('200');
    }

    const imported = csvToSheet(SHEETS_CSV, { name: 'Orders' });
    expect(imported.ok).toBe(true);
    if (imported.ok) expect(imported.sheet.sheets[0]?.name).toBe('Orders');

    expect(typeof SheetView).toBe('function');
  });
});
