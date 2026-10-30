// @vitest-environment node
import { isExpressionError } from '@texuli/core/expression';
import { describe, expect, it } from 'vitest';
import {
  columnIndex,
  columnName,
  compileCriteria,
  evaluateFormula,
  formatReference,
  formatText,
  parseFormula,
  parseReference,
  quoteSheetName,
  rewriteFormula,
  SHEET_FUNCTION_INFO,
  SHEET_FUNCTION_NAMES,
  SHEET_TEXT_FORMATS,
} from '../src/formula/index.ts';

/** A tiny fixed grid: A1:C4 on the formula's sheet, plus `'Q1 plan'!A1`. */
const GRID: Record<string, unknown> = {
  A1: 'Lima',
  B1: 10,
  C1: 'paid',
  A2: 'Quito',
  B2: 20,
  C2: 'open',
  A3: 'Bogotá',
  B3: 30,
  C3: 'paid',
  A4: null,
  B4: true,
  C4: '2026-10-29',
  "'Q1 plan'!A1": 7,
};

function rangeValues(from: string, to: string): unknown {
  const a = parseReference(from, true);
  const b = parseReference(to, true);
  if (!a || !b) return { error: '#REF!' };
  const out: unknown[] = [];
  for (let r = a.row ?? 0; r <= (b.row ?? 3); r += 1) {
    for (let c = a.col; c <= b.col; c += 1) {
      out.push(GRID[`${columnName(c)}${r + 1}`] ?? null);
    }
  }
  return out;
}

const env = {
  ref: (ref: string) => GRID[ref] ?? null,
  range: rangeValues,
  now: () => Date.UTC(2026, 9, 29, 15, 4, 5),
};

function run(source: string): unknown {
  const parsed = parseFormula(source);
  if (!parsed.ok) return parsed.error;
  const value = evaluateFormula(parsed.formula, env);
  return isExpressionError(value) ? value.error : value;
}

describe('formula grammar', () => {
  it('parses operators with spreadsheet precedence', () => {
    const cases: [string, unknown][] = [
      ['=1+2*3', 7],
      ['=(1+2)*3', 9],
      ['=2^3^2', 64], // left-associative
      ['=-2^2', 4], // unary minus binds tighter than ^
      ['=50%', 0.5],
      ['=200*10%', 20],
      ['="a"&"b"&1', 'ab1'],
      ['=1+2&"x"', '3x'],
      ['=B1+B2>25', true],
      ['=B1<>B2', true],
      ['="LIMA"=A1', true], // text compares ignoring case
      ['=A4+1', 1], // blanks read as 0
      ['=A4&"x"', 'x'],
      ['=1/0', '#DIV/0!'],
      ['=B1/(B2-20)', '#DIV/0!'],
      ['=TRUE+1', 2],
      ['=  B1  *  2  ', 20],
      ['=1e3+.5', 1000.5],
      ["='Q1 plan'!A1*2", 14],
      ['=$B$1+B$2+$B3', 60],
      ['=#REF!+1', '#REF!'],
      ['=1-2-3-4-5-6-7-8-9-10', -53],
      [`=${Array.from({ length: 200 }, () => 'B1').join('+')}-B2`, 1980],
      [`=${Array.from({ length: 60 }, (_, i) => `"${i % 10}"`).join('&')}`, '0123456789'.repeat(6)],
    ];
    for (const [source, expected] of cases) expect(run(source), source).toEqual(expected);
  });

  it('reports syntax as #VALUE! and unknown names as #NAME?, with a diagnostic', () => {
    const cases: [string, string, string][] = [
      ['=SUM(', '#VALUE!', 'syntax'],
      ['=1+', '#VALUE!', 'syntax'],
      ['=(1', '#VALUE!', 'syntax'],
      ['="open', '#VALUE!', 'syntax'],
      ['=1 2', '#VALUE!', 'syntax'],
      ['=A', '#VALUE!', 'bad-ref'],
      ['=A1:B', '#VALUE!', 'bad-ref'],
      ['=Sheet1!A1:Sheet2!B2', '#VALUE!', 'bad-ref'],
      ['=FOO(1)', '#NAME?', 'unknown-function'],
      ['=INDIRECT("A1")', '#NAME?', 'unknown-function'],
      ['=OFFSET(A1,1,1)', '#NAME?', 'unknown-function'],
      ['=RAND()', '#NAME?', 'unknown-function'],
      ['=LAMBDA(x,x)', '#NAME?', 'unknown-function'],
      ['=total+1', '#NAME?', 'bad-name'],
      ['=ROUND()', '#VALUE!', 'arity'],
      ['=NA(1)', '#VALUE!', 'arity'],
      ['=#N/A', '#VALUE!', 'syntax'],
      ['=R1C1', '#NAME?', 'bad-name'],
      ['=1+{1,2}', '#VALUE!', 'syntax'],
      ['SUM(1)', '#VALUE!', 'syntax'],
    ];
    for (const [source, error, code] of cases) {
      const parsed = parseFormula(source);
      expect(parsed.ok, source).toBe(false);
      if (parsed.ok) continue;
      expect(parsed.error, source).toBe(error);
      expect(parsed.diagnostics[0]?.code, source).toBe(code);
      expect(parsed.diagnostics[0]?.path, source).toMatch(/^@\d+$/);
    }
  });

  it('lists static references and ranges (never expanded) for the dependency graph', () => {
    const parsed = parseFormula("=SUM(B1:C3)+A1+'Q1 plan'!$D$4+SUM(Sheet2!B:A)");
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.formula.refs.map((ref) => formatReference(ref))).toEqual([
      'A1',
      "'Q1 plan'!$D$4",
    ]);
    expect(
      parsed.formula.ranges.map(
        (range) => `${formatReference(range.from)}:${formatReference({ ...range.to, sheet: null })}`
      )
    ).toEqual(['B1:C3', 'Sheet2!A:B']);
    expect(parsed.formula.expression.refs).toEqual(["'Q1 plan'!D4", 'A1']);
  });

  it('round-trips A1 references, columns and sheet names', () => {
    for (const [col, name] of [
      [0, 'A'],
      [25, 'Z'],
      [26, 'AA'],
      [255, 'IV'],
      [16_383, 'XFD'],
    ] as const) {
      expect(columnName(col)).toBe(name);
      expect(columnIndex(name)).toBe(col);
      expect(columnIndex(name.toLowerCase())).toBe(col);
    }
    expect(columnName(16_384)).toBe('');
    expect(columnIndex('XFE')).toBe(-1);
    for (const text of [
      'A1',
      '$B$2',
      'C$3',
      "'Q1 plan'!A1",
      "'It''s'!B2",
      'Sheet2!$A1',
      "'A1'!B2",
    ]) {
      const ref = parseReference(text);
      expect(ref, text).not.toBeNull();
      expect(formatReference(ref as never), text).toBe(text);
    }
    for (const bad of [
      'A0',
      'A',
      '1A',
      'ZZZZ1',
      "'open!A1",
      "'a'b'!A1",
      'Sheet 2!A1',
      'A1048577',
    ]) {
      expect(parseReference(bad), bad).toBeNull();
    }
    expect(quoteSheetName('Budget')).toBe('Budget');
    expect(quoteSheetName('Q1 plan')).toBe("'Q1 plan'");
    expect(quoteSheetName('A1')).toBe("'A1'");
  });

  it('rewrites only the reference tokens and keeps the author text', () => {
    const shifted = rewriteFormula('=sum( A1:A3 ) + b2 * 50%  ', (target) =>
      target.kind === 'range'
        ? { ...target, to: { ...target.to, row: 9 } }
        : { ...target, ref: { ...target.ref, row: 4 } }
    );
    expect(shifted).toBe('=sum( A1:A10 ) + B5 * 50%  ');
    expect(
      rewriteFormula('=A1+B1', (t) => (t.kind === 'cell' && t.ref.col === 0 ? null : undefined))
    ).toBe('=#REF!+B1');
    expect(rewriteFormula('="A1"&A1', () => null)).toBe('="A1"&#REF!');
    expect(rewriteFormula('=(', () => null)).toBe('=(');
    expect(rewriteFormula('="', () => null)).toBeNull();
  });
});

describe('sheet functions', () => {
  it('documents about 45 functions, each with an example that parses, and no dynamic or random ones', () => {
    expect(SHEET_FUNCTION_NAMES.length).toBeGreaterThanOrEqual(45);
    expect(SHEET_FUNCTION_NAMES.length).toBeLessThanOrEqual(60);
    for (const name of [
      'INDIRECT',
      'OFFSET',
      'RAND',
      'RANDBETWEEN',
      'LAMBDA',
      'HYPERLINK',
      'WEBSERVICE',
    ]) {
      expect(SHEET_FUNCTION_NAMES).not.toContain(name);
    }
    for (const name of SHEET_FUNCTION_NAMES) {
      const info = SHEET_FUNCTION_INFO[name];
      expect(
        info?.example.startsWith(`=${name}(`) || info?.example.includes(`${name}(`),
        name
      ).toBe(true);
      expect(parseFormula(info?.example).ok, `${name}: ${info?.example}`).toBe(true);
    }
  });

  it('evaluates every function', () => {
    const cases: [string, unknown][] = [
      ['=SUM(B1:B3, 5)', 65],
      ['=SUM(A1:C3)', 60],
      ['=AVERAGE(B1:B3)', 20],
      ['=AVERAGE(A1:A3)', '#DIV/0!'],
      ['=MIN(B1:B3)', 10],
      ['=MAX(B1:B3, 99)', 99],
      ['=COUNT(A1:C4)', 3],
      ['=COUNTA(A1:A4)', 3],
      ['=COUNTBLANK(A1:A4)', 1],
      ['=PRODUCT(B1:B2)', 200],
      ['=MEDIAN(B1:B3, 100)', 25],
      ['=ROUND(2.675, 2)', 2.68],
      ['=ROUND(-2.5)', -3],
      ['=ROUND(1234, -2)', 1200],
      ['=ROUNDUP(1.21, 1)', 1.3],
      ['=ROUNDDOWN(-1.29, 1)', -1.2],
      ['=INT(-1.5)', -2],
      ['=MOD(-7, 3)', 2],
      ['=MOD(1, 0)', '#DIV/0!'],
      ['=ABS(-4)', 4],
      ['=POWER(2, 10)', 1024],
      ['=POWER(2, 65)', '#NUM!'],
      ['=SQRT(16)', 4],
      ['=SQRT(-1)', '#NUM!'],
      ['=SUMIF(C1:C3, "paid", B1:B3)', 40],
      ['=SUMIF(B1:B3, ">15")', 50],
      ['=COUNTIF(A1:A3, "?u*")', 1],
      ['=COUNTIF(C1:C3, "<>paid")', 1],
      ['=AVERAGEIF(C1:C3, "PAID", B1:B3)', 20],
      ['=IF(B1>5, "big", "small")', 'big'],
      ['=IF(B1>50, "big")', false],
      ['=IF(TRUE, 1, 1/0)', 1], // lazy: the other branch never runs
      ['=IFS(B1>50, "a", B1>5, "b")', 'b'],
      ['=IFS(B1>50, "a")', '#N/A'],
      ['=AND(B1>5, B2>5)', true],
      ['=AND(B1:B3)', true],
      ['=OR(B1>50, B4)', true],
      ['=NOT(B4)', false],
      ['=IFERROR(1/0, "none")', 'none'],
      ['=IFERROR(B1, "none")', 10],
      ['=ISBLANK(A4)', true],
      ['=ISNUMBER(B1)', true],
      ['=ISTEXT(A1)', true],
      ['=ISERROR(1/0)', true],
      ['=NA()', '#N/A'],
      ['=CONCAT(A1, "-", A2:A3)', 'Lima-QuitoBogotá'],
      ['=LEN(A3)', 6],
      ['=LEFT(A1, 2)', 'Li'],
      ['=LEFT(A1)', 'L'],
      ['=RIGHT(A2, 3)', 'ito'],
      ['=MID(A2, 2, 3)', 'uit'],
      ['=MID(A2, 0, 3)', '#VALUE!'],
      ['=UPPER(A1)', 'LIMA'],
      ['=LOWER(A1)', 'lima'],
      ['=TRIM("  a   b  ")', 'a b'],
      ['=TEXT(1234.5, "#,##0.00")', '1,234.50'],
      ['=TEXT(0.256, "0.0%")', '25.6%'],
      ['=TEXT(C4, "dd/mm/yyyy")', '29/10/2026'],
      ['=TEXT(1, "[Red]0")', '#VALUE!'],
      ['=SUBSTITUTE("a-b-c", "-", " ")', 'a b c'],
      ['=SUBSTITUTE("a-b-c", "-", "+", 2)', 'a-b+c'],
      ['=VALUE("12.5")', 12.5],
      ['=VALUE("40%")', 0.4],
      ['=VALUE("twelve")', '#VALUE!'],
      ['=INDEX(A1:C3, 2, 3)', 'open'],
      ['=INDEX(B1:B3, 3)', 30],
      ['=INDEX(A1:C1, 2)', 10],
      ['=INDEX(A1:C3, 4, 1)', '#REF!'],
      ['=MATCH("quito", A1:A3, 0)', 2],
      ['=MATCH(25, B1:B3)', 2],
      ['=MATCH(5, B1:B3)', '#N/A'],
      ['=MATCH(5, B1:B3, -1)', 3],
      ['=VLOOKUP("Quito", A1:C3, 2, FALSE)', 20],
      ['=VLOOKUP("nope", A1:C3, 2, FALSE)', '#N/A'],
      ['=VLOOKUP(25, B1:C3, 2)', 'open'],
      ['=VLOOKUP("Lima", A1:C3, 4, FALSE)', '#REF!'],
      ['=XLOOKUP("Bogotá", A1:A3, B1:B3)', 30],
      ['=XLOOKUP("x", A1:A3, B1:B3, "none")', 'none'],
      ['=XLOOKUP("x", A1:A3, B1:B2)', '#VALUE!'],
      ['=DATE(2026, 11, 2)', '2026-11-02'],
      ['=DATE(2026, 13, 1)', '2027-01-01'],
      ['=DATE(2026, 3, 0)', '2026-02-28'],
      ['=DATE(10000, 1, 1)', '#NUM!'],
      ['=YEAR(C4)', 2026],
      ['=MONTH(C4)', 10],
      ['=DAY(C4)', 29],
      ['=YEAR("someday")', '#VALUE!'],
      ['=DAYS("2026-12-25", C4)', 57],
      ['=EDATE("2026-01-31", 1)', '2026-02-28'],
      ['=TODAY()', '2026-10-29'],
      ['=NOW()', '2026-10-29T15:04:05Z'],
    ];
    const covered = new Set<string>();
    for (const [source, expected] of cases) {
      expect(run(source), source).toEqual(expected);
      for (const match of source.matchAll(/([A-Z]+)\(/g)) covered.add(match[1] as string);
    }
    expect(SHEET_FUNCTION_NAMES.filter((name) => !covered.has(name))).toEqual([]);
  });

  it('reads TODAY and NOW only from the host clock', () => {
    for (const source of ['=TODAY()', '=NOW()']) {
      const parsed = parseFormula(source);
      if (!parsed.ok) throw new Error(source);
      expect(evaluateFormula(parsed.formula, {})).toEqual({ error: '#N/A' });
    }
  });

  it('matches criteria with wildcards, escapes and comparisons, ignoring case', () => {
    const context = { charge: () => true, now: () => undefined };
    const cases: [unknown, unknown, boolean][] = [
      ['a*', 'Apple', true],
      ['a*', 'banana', false],
      ['*an*', 'banana', true],
      ['b?n*a', 'banana', true],
      ['b?n', 'banana', false],
      ['~*', '*', true],
      ['~*', 'x', false],
      ['*a*a*a', 'banana', true],
      ['*a*a*a*a', 'banana', false],
      ['>5', 6, true],
      ['>5', '6', false],
      ['<=5', 5, true],
      ['<>5', 'x', true],
      ['=', null, true],
      ['=', '', true],
      ['<>', null, false],
      ['<b', 'apple', true],
      [10, 10, true],
      [true, true, true],
      ['TRUE', true, true],
      [null, null, true],
    ];
    for (const [criterion, value, expected] of cases) {
      const match = compileCriteria(criterion as never);
      expect(typeof match, String(criterion)).toBe('function');
      if (typeof match !== 'function') continue;
      expect(match(value as never, context), `${String(criterion)} ~ ${String(value)}`).toBe(
        expected
      );
    }
    expect(compileCriteria('x'.repeat(256))).toEqual({ error: '#VALUE!' });
  });

  it('formats only the closed TEXT formats', () => {
    expect(SHEET_TEXT_FORMATS).toContain('#,##0.00');
    const cases: [unknown, string, unknown][] = [
      [1234567.891, '#,##0', '1,234,568'],
      [-1234.5, '#,##0.0', '-1,234.5'],
      [0.125, '0.00', '0.13'],
      [0.5, '0%', '50%'],
      [3, 'General', '3'],
      ['text', '@', 'text'],
      ['2026-01-05', 'mm/dd/yyyy', '01/05/2026'],
      ['2026-01-05', 'yyyy', '2026'],
      ['x', '0.00', { error: '#VALUE!' }],
      [5, 'yyyy-mm-dd', { error: '#VALUE!' }],
      [5, '0.00;(0.00)', { error: '#VALUE!' }],
    ];
    for (const [value, format, expected] of cases) {
      expect(formatText(value as never, format), `${String(value)} ${format}`).toEqual(expected);
    }
  });
});
