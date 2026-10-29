// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { csvToSheet, parseCsv } from '../src/csv/index.ts';
import { evaluateFormula, FORMULA_LIMITS, parseFormula } from '../src/formula/index.ts';
import {
  checkSheetDraft,
  createWorkbook,
  displayValue,
  loadUntrustedSheet,
  SHEET_LIMITS,
  type SheetInput,
  validateSheet,
} from '../src/model/index.ts';

/*
 * Hostile input (ADR-015): agent and user formulas, documents and CSV are
 * untrusted. Each case must end in a value or a refusal (`#LIMIT!`,
 * `#CYCLE!`, a diagnostic) within a time bound, never a hang, a stack
 * overflow or an exception. Bounds are generous for a loaded host; rerun a
 * failing one alone before concluding.
 */

function timed<T>(run: () => T): { value: T; ms: number } {
  const start = performance.now();
  const value = run();
  return { value, ms: performance.now() - start };
}

function sheet(rows: number, columns: number, cells: Record<string, SheetInput>) {
  return {
    format: 'texuli-sheet' as const,
    formatVersion: 1 as const,
    sheets: [{ id: 's1', name: 'Sheet1', rows, columns, cells }],
  };
}

describe('hostile formulas', () => {
  it('refuses deep nesting, long text and huge node counts quickly', () => {
    const cases: [string, string][] = [
      [`=${'('.repeat(100_000)}1${')'.repeat(100_000)}`, 'too-long'],
      [`=${'('.repeat(4000)}1${')'.repeat(4000)}`, 'too-deep'],
      [`=${'-'.repeat(4000)}1`, 'too-deep'],
      [`=${'SUM('.repeat(1500)}1${')'.repeat(1500)}`, 'too-deep'],
      [`=1${'+1'.repeat(1200)}`, 'too-many-nodes'],
      [`="${'x'.repeat(FORMULA_LIMITS.length)}"`, 'too-long'],
      [`=${'"a"&'.repeat(1500)}"a"`, 'too-many-nodes'],
    ];
    for (const [source, code] of cases) {
      const { value, ms } = timed(() => parseFormula(source));
      expect(value.ok, code).toBe(false);
      if (!value.ok)
        expect(
          value.diagnostics.map((d) => d.code),
          code
        ).toContain(code);
      expect(ms, code).toBeLessThan(200);
    }
  });

  it('refuses long chains of operators that are not rebalanced, at every entry point', () => {
    // `%`, `^`, comparisons, `*` and `/` nest to the left without rebalancing:
    // each chain must end in a too-deep refusal, never a stack overflow.
    const chains = [
      `=1${'%'.repeat(4095)}`,
      `=${Array(4090).fill('2').join('^')}`,
      `=${Array(4090).fill('1').join('=')}`,
      `=${Array(4090).fill('1').join('<')}`,
      `=${Array(4090).fill('2').join('*')}`,
      `=${Array(4090).fill('2').join('/')}`,
      `=(${Array(2000).fill('2').join('*')})+1`,
    ];
    for (const source of chains) {
      const label = source.slice(0, 12);
      const parsed = timed(() => parseFormula(source));
      expect(parsed.value.ok, label).toBe(false);
      if (!parsed.value.ok)
        expect(
          parsed.value.diagnostics.map((d) => d.code),
          label
        ).toContain('too-deep');
      expect(parsed.ms, label).toBeLessThan(500);

      const doc = sheet(2, 2, { A1: source });
      const entry = timed(() => {
        const validated = validateSheet(doc);
        const loaded = loadUntrustedSheet(JSON.stringify(doc));
        const draft = checkSheetDraft(doc);
        const csv = csvToSheet(`"${source.replaceAll('"', '""')}"`, { formulas: true });
        const workbook = createWorkbook(sheet(2, 2, { A1: 1 }));
        workbook.setInput('s1', 0, 1, source);
        return { validated, loaded, draft, csv, shown: displayValue(workbook.value('s1', 0, 1)) };
      });
      for (const result of [entry.value.validated, entry.value.loaded, entry.value.draft]) {
        expect(result.ok, label).toBe(false);
        expect(result.issues.length, label).toBeGreaterThan(0);
      }
      expect(entry.value.csv.ok, label).toBe(false);
      expect(entry.value.shown, label).toBe('#VALUE!');
      expect(entry.ms, label).toBeLessThan(2000);
    }
  });

  it('keeps short operator chains and long rebalanced sums legal', () => {
    for (const source of [
      `=${Array(20).fill('2').join('*')}`,
      `=1${'%'.repeat(20)}`,
      `=${Array(400).fill('1').join('+')}`,
      `=${Array(400).fill('"a"').join('&')}`,
    ]) {
      expect(parseFormula(source).ok, source.slice(0, 12)).toBe(true);
    }
  });

  it('parses the longest legal formula in linear time', () => {
    const source = `=SUM(${Array.from({ length: 60 }, (_, i) => `A${i + 1}`).join(',')})+"${'y'.repeat(FORMULA_LIMITS.length - 400)}"`;
    const { value, ms } = timed(() => parseFormula(source));
    expect(value.ok).toBe(true);
    expect(ms).toBeLessThan(100);
  });

  it('bounds evaluation work: huge ranges, long strings and wildcard criteria end in #LIMIT!', () => {
    const long = 'a'.repeat(32_000);
    const list = Array.from({ length: 10_000 }, () => long);
    const env = { ref: () => long, range: () => list };
    const cases: [string, string][] = [
      ['=COUNTIF(A1:A10000, "*a*a*a*a*a*a*a*a*a*b")', '#LIMIT!'],
      ['=SUBSTITUTE(A1, "a", A1)', '#LIMIT!'],
      ['=CONCAT(A1, A1)', '#LIMIT!'],
      ['=LEN(CONCAT(A1:A10000))', '#LIMIT!'],
      ['=MATCH("b", A1:A10000, 0)', '#N/A'],
    ];
    for (const [source, expected] of cases) {
      const parsed = parseFormula(source);
      if (!parsed.ok) throw new Error(source);
      const { value, ms } = timed(() => evaluateFormula(parsed.formula, env));
      expect(value, source).toEqual({ error: expected });
      expect(ms, source).toBeLessThan(1500);
    }
  });
});

describe('hostile workbooks', () => {
  it('reads a range larger than the list cap as #LIMIT! without building it', () => {
    const workbook = createWorkbook(
      sheet(10_000, 256, { A1: '=SUM(A2:IV10000)', B1: '=COUNT(B2:IV10000)', C1: '=COUNT(A:IV)' })
    );
    expect(displayValue(workbook.value('s1', 0, 0))).toBe('#LIMIT!');
    expect(displayValue(workbook.value('s1', 0, 1))).toBe('#LIMIT!');
    expect(displayValue(workbook.value('s1', 0, 2))).toBe('#CYCLE!'); // C1 reads its own column
  });

  it('recalculates a 10,000-cell dependency chain without recursion, then incrementally', () => {
    const cells: Record<string, SheetInput> = { A1: 1 };
    for (let r = 2; r <= 10_000; r += 1) cells[`A${r}`] = `=A${r - 1}+1`;
    const { value: workbook, ms } = timed(() => createWorkbook(sheet(10_000, 2, cells)));
    expect(workbook.value('s1', 9_999, 0)).toBe(10_000);
    expect(ms).toBeLessThan(3000);
    const edit = timed(() => workbook.setInput('s1', 0, 0, 5));
    expect(edit.value.evaluated).toBe(9_999);
    expect(workbook.value('s1', 9_999, 0)).toBe(10_004);
    expect(edit.ms).toBeLessThan(2000);
  });

  it('finds a 10,000-cell cycle without recursion', () => {
    const cells: Record<string, SheetInput> = { A1: '=A10000+1' };
    for (let r = 2; r <= 10_000; r += 1) cells[`A${r}`] = `=A${r - 1}+1`;
    const { value: workbook, ms } = timed(() => createWorkbook(sheet(10_000, 1, cells)));
    expect(workbook.lastPass.cycles).toBe(10_000);
    expect(displayValue(workbook.value('s1', 5_000, 0))).toBe('#CYCLE!');
    expect(ms).toBeLessThan(3000);
  });

  it('caps the evaluation steps of a pass: past the budget, cells show #LIMIT!', () => {
    // 2,000 formulas, each summing a 9,000-cell range: 18M steps > the 10M pass budget.
    const cells: Record<string, SheetInput> = {};
    for (let r = 1; r <= 9_000; r += 1) cells[`A${r}`] = r;
    for (let r = 1; r <= 2_000; r += 1) cells[`B${r}`] = '=SUM(A1:A9000)';
    const { value: workbook, ms } = timed(() => createWorkbook(sheet(9_000, 2, cells)));
    expect(workbook.lastPass.limited).toBe(true);
    const values = Array.from({ length: 2_000 }, (_, r) =>
      displayValue(workbook.value('s1', r, 1))
    );
    // Formulas evaluate in sheet order: the first ones fit the budget, the rest are #LIMIT!.
    expect(values[0]).toBe('40504500');
    expect(values[1_999]).toBe('#LIMIT!');
    expect(values.filter((value) => value === '40504500').length).toBeGreaterThan(400);
    expect(ms).toBeLessThan(4000);
  });

  it('caps the graph work of a pass: a dense fan-in ends in #LIMIT!', () => {
    // 3,000 formulas in one column, each reading the whole column: 9M interval checks.
    const cells: Record<string, SheetInput> = {};
    for (let r = 1; r <= 3_000; r += 1) cells[`A${r}`] = '=COUNT(A:A)';
    const { value: workbook, ms } = timed(() => createWorkbook(sheet(3_000, 1, cells)));
    expect(workbook.lastPass.limited).toBe(true);
    expect(displayValue(workbook.value('s1', 0, 0))).toBe('#LIMIT!');
    expect(ms).toBeLessThan(4000);
    expect(SHEET_LIMITS.passWork).toBeLessThan(9_000_000);
  });

  it('validates a document at the cell cap, and refuses one past it, in bounded time', () => {
    const cells: Record<string, SheetInput> = {};
    for (let r = 1; r <= 10_000; r += 1) {
      for (let c = 0; c < 10; c += 1)
        cells[`${String.fromCharCode(65 + c)}${r}`] = c === 9 ? `=A${r}*2` : r;
    }
    const full = timed(() => validateSheet(sheet(10_000, 11, cells)));
    expect(full.value.ok).toBe(true);
    expect(full.ms).toBeLessThan(3000);
    cells.K1 = 1;
    const over = timed(() => validateSheet(sheet(10_000, 11, cells)));
    expect(over.value.issues.map((issue) => issue.code)).toContain('too-many');
    expect(over.ms).toBeLessThan(3000);
  });
});

describe('hostile CSV', () => {
  it('parses adversarial CSV in linear time', () => {
    const cases: [string, boolean][] = [
      [`"${'""'.repeat(2_000_000)}`, false], // 4 MB of escaped quotes, never closed
      [`${'"x",'.repeat(200)}\n`.repeat(5_000), true],
      ['a,'.repeat(255).concat('a\n').repeat(2_000), true],
      ['x'.repeat(30_000).concat('\n').repeat(200), true],
      [`"${'\n'.repeat(1_000_000)}`, false],
    ];
    for (const [text, ok] of cases) {
      const { value, ms } = timed(() => parseCsv(text));
      expect(value.ok, text.slice(0, 20)).toBe(ok);
      expect(ms, text.slice(0, 20)).toBeLessThan(1500);
    }
  });
});
