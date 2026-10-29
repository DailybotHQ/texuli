/**
 * The workbooks of /sheets-page/ (fictional data only): an order log and a
 * summary sheet that reads it across tabs, the lab copy every function
 * example runs against, one example per function of the package's own
 * `SHEET_FUNCTION_NAMES` (a unit test keeps the two lists equal), and the
 * safety cases (cycles, limits, refused functions, hostile documents) the
 * page evaluates with the real engine at build time.
 */
import { formatReference, parseFormula, SHEET_FUNCTION_INFO } from '@texuli/sheets/formula';
import {
  createWorkbook,
  displayValue,
  type SheetDocument,
  type SheetInput,
  validateSheet,
} from '@texuli/sheets/model';

/** The clock the build-time tables use for TODAY and NOW (stated on the page). */
export const BUILD_CLOCK = Date.UTC(2026, 9, 29, 9, 30);

/** The order log: eight orders across columns A to I, totals below. */
export const ORDER_CELLS: Readonly<Record<string, SheetInput>> = Object.freeze({
  A1: 'City',
  B1: 'Amount',
  C1: 'Status',
  D1: 'Region',
  E1: 'Ordered',
  F1: 'Shipped',
  G1: 'Code',
  H1: 'Rush',
  I1: 'Discount',
  A2: 'Lima',
  B2: 120,
  C2: 'paid',
  D2: 'east',
  E2: '2026-01-15',
  F2: '2026-01-19',
  G2: '  ord-1042  ',
  H2: true,
  I2: '40%',
  A3: 'Quito',
  B3: 85.5,
  C3: 'open',
  D3: 'west',
  E3: '2026-02-03',
  F3: '2026-02-10',
  G3: 'ord-1043',
  H3: false,
  I3: '12.5',
  A4: 'Bogota',
  B4: 240,
  C4: 'paid',
  D4: 'east',
  E4: '2026-02-20',
  F4: '2026-02-22',
  G4: 'ord-1044',
  H4: false,
  A5: 'Santiago',
  B5: 64.25,
  C5: 'refunded',
  D5: 'south',
  E5: '2026-03-08',
  G5: 'ord-1045',
  H5: true,
  A6: 'Montevideo',
  B6: 310,
  C6: 'paid',
  D6: 'west',
  E6: '2026-03-30',
  F6: '2026-04-02',
  G6: 'ord-1046',
  H6: false,
  A7: 'Asuncion',
  B7: 99,
  C7: 'open',
  D7: 'east',
  E7: '2026-04-12',
  G7: 'ord-1047',
  H7: false,
  A8: 'La Paz',
  B8: 150,
  C8: 'paid',
  D8: 'south',
  E8: '2026-05-01',
  F8: '2026-05-04',
  G8: 'ord-1048',
  H8: true,
  A9: 'Caracas',
  B9: 42,
  C9: 'open',
  D9: 'west',
  E9: '2026-05-19',
  G9: 'ord-1049',
  H9: false,
  A11: 'Total',
  B11: '=SUM(B2:B9)',
  A12: 'Paid',
  B12: '=SUMIF(C2:C9, "paid", B2:B9)',
  A13: 'Share paid',
  B13: '=TEXT(B12/B11, "0.0%")',
});

/** The summary tab: every figure reads the order log through a cross-sheet reference. */
export const SUMMARY_CELLS: Readonly<Record<string, SheetInput>> = Object.freeze({
  A1: 'Metric',
  B1: 'Value',
  A2: 'Revenue (paid)',
  B2: '=SUMIF(Orders!C2:C9, "paid", Orders!B2:B9)',
  A3: 'Open orders',
  B3: '=COUNTIF(Orders!C2:C9, "open")',
  A4: 'Average order',
  B4: '=ROUND(AVERAGE(Orders!B2:B9), 2)',
  A5: 'Largest order',
  B5: '=MAX(Orders!B2:B9)',
  A6: 'Tax rate',
  B6: 0.08,
  A7: 'Revenue with tax',
  B7: '=ROUND(B2 * (1 + B6), 2)',
  A8: 'Tier',
  B8: '=IFS(B2 > 800, "gold", B2 > 400, "silver", TRUE, "bronze")',
  A9: 'Days to ship, Lima',
  B9: '=DAYS(XLOOKUP("Lima", Orders!A2:A9, Orders!F2:F9), XLOOKUP("Lima", Orders!A2:A9, Orders!E2:E9))',
});

/** The two-tab workbook of the live editor. */
export const ORDERS_WORKBOOK: SheetDocument = Object.freeze({
  format: 'texuli-sheet',
  formatVersion: 1,
  meta: { title: 'Harbor order log' },
  sheets: [
    { id: 'orders', name: 'Orders', rows: 16, columns: 9, cells: { ...ORDER_CELLS } },
    { id: 'summary', name: 'Summary', rows: 12, columns: 2, cells: { ...SUMMARY_CELLS } },
  ],
}) as SheetDocument;

/** The lab: the order log with room for the formula under test in K1. */
export const LAB_CELL = { row: 0, col: 10, address: 'K1' } as const;
export const LAB_WORKBOOK: SheetDocument = Object.freeze({
  format: 'texuli-sheet',
  formatVersion: 1,
  meta: { title: 'Function lab' },
  sheets: [{ id: 'lab', name: 'Lab', rows: 16, columns: 11, cells: { ...ORDER_CELLS } }],
}) as SheetDocument;

/**
 * One example per function, written against the order log (A2:I9). Each
 * one shows what the function does on real cells; a unit test checks that
 * the keys equal `SHEET_FUNCTION_NAMES`.
 */
export const FUNCTION_EXAMPLES: Readonly<Record<string, string>> = Object.freeze({
  SUM: '=SUM(B2:B9)',
  AVERAGE: '=AVERAGE(B2:B9)',
  MIN: '=MIN(B2:B9)',
  MAX: '=MAX(B2:B9)',
  COUNT: '=COUNT(B2:B9)',
  COUNTA: '=COUNTA(F2:F9)',
  COUNTBLANK: '=COUNTBLANK(F2:F9)',
  PRODUCT: '=PRODUCT(B2, 1.08)',
  MEDIAN: '=MEDIAN(B2:B9)',
  ROUND: '=ROUND(B3, 0)',
  ROUNDUP: '=ROUNDUP(B5, 1)',
  ROUNDDOWN: '=ROUNDDOWN(B5, 1)',
  INT: '=INT(B3)',
  MOD: '=MOD(B2, 7)',
  ABS: '=ABS(B9 - B2)',
  POWER: '=POWER(2, 10)',
  SQRT: '=SQRT(B2 + 1)',
  SUMIF: '=SUMIF(C2:C9, "paid", B2:B9)',
  COUNTIF: '=COUNTIF(B2:B9, ">=100")',
  AVERAGEIF: '=AVERAGEIF(D2:D9, "east", B2:B9)',
  IF: '=IF(B2 > 100, "high", "low")',
  IFS: '=IFS(B4 > 200, "large", B4 > 100, "medium", TRUE, "small")',
  AND: '=AND(H2, C2 = "paid")',
  OR: '=OR(H3, B3 > 100)',
  NOT: '=NOT(H2)',
  IFERROR: '=IFERROR(B2 / 0, "no rate")',
  ISBLANK: '=ISBLANK(F5)',
  ISNUMBER: '=ISNUMBER(B2)',
  ISTEXT: '=ISTEXT(A2)',
  ISERROR: '=ISERROR(B2 / 0)',
  NA: '=NA()',
  CONCAT: '=CONCAT(A2, " / ", C2)',
  LEN: '=LEN(A6)',
  LEFT: '=LEFT(A4, 3)',
  RIGHT: '=RIGHT(G3, 4)',
  MID: '=MID(A6, 6, 5)',
  UPPER: '=UPPER(D2)',
  LOWER: '=LOWER(A8)',
  TRIM: '=TRIM(G2)',
  TEXT: '=TEXT(B6, "#,##0.00")',
  SUBSTITUTE: '=SUBSTITUTE(G3, "-", " #")',
  VALUE: '=VALUE(I2)',
  INDEX: '=INDEX(A2:C9, 3, 2)',
  MATCH: '=MATCH("Lima", A2:A9, 0)',
  VLOOKUP: '=VLOOKUP("Quito", A2:C9, 3, FALSE)',
  XLOOKUP: '=XLOOKUP("Oslo", A2:A9, C2:C9, "none")',
  DATE: '=DATE(2026, 13, 2)',
  YEAR: '=YEAR(E2)',
  MONTH: '=MONTH(E3)',
  DAY: '=DAY(E4)',
  DAYS: '=DAYS(F2, E2)',
  EDATE: '=EDATE("2026-01-31", 1)',
  TODAY: '=TODAY()',
  NOW: '=NOW()',
});

export const CATEGORY_NAMES: Readonly<Record<string, string>> = Object.freeze({
  math: 'Math and aggregates',
  logic: 'Logic',
  info: 'Information',
  text: 'Text',
  lookup: 'Lookup',
  date: 'Dates',
});

export interface FunctionRow {
  readonly name: string;
  readonly category: string;
  readonly signature: string;
  readonly description: string;
  readonly example: string;
  readonly result: string;
}

/** Evaluates one formula in the lab cell of a fresh lab workbook. */
export function evaluateInLab(
  formula: string,
  now: () => number | Date = () => BUILD_CLOCK
): { readonly value: string; readonly error: string | null } {
  const parsed = parseFormula(formula);
  if (!parsed.ok) {
    return { value: parsed.error, error: parsed.diagnostics[0]?.message ?? parsed.error };
  }
  const checked = validateSheet(LAB_WORKBOOK);
  if (!checked.ok) return { value: '#VALUE!', error: 'The lab sheet did not validate.' };
  const book = createWorkbook(checked.sheet, { now });
  book.setInput('lab', LAB_CELL.row, LAB_CELL.col, formula);
  return { value: displayValue(book.value('lab', LAB_CELL.row, LAB_CELL.col)), error: null };
}

/** Every function with its example evaluated by the engine (build time: a fixed clock). */
export function functionRows(now: () => number | Date = () => BUILD_CLOCK): FunctionRow[] {
  const checked = validateSheet(LAB_WORKBOOK);
  if (!checked.ok) throw new Error('The lab sheet did not validate.');
  const book = createWorkbook(checked.sheet, { now });
  return Object.entries(SHEET_FUNCTION_INFO).map(([name, info]) => {
    const example = FUNCTION_EXAMPLES[name] ?? info.example;
    book.setInput('lab', LAB_CELL.row, LAB_CELL.col, example);
    return {
      name,
      category: info.category,
      signature: info.signature,
      description: info.description,
      example,
      result: displayValue(book.value('lab', LAB_CELL.row, LAB_CELL.col)),
    };
  });
}

/** The sample's order rows, for the static table beside the lab. */
export const SAMPLE_COLUMNS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'] as const;
export function sampleRows(): readonly (readonly string[])[] {
  const rows: string[][] = [];
  for (let row = 1; row <= 9; row += 1) {
    rows.push(
      SAMPLE_COLUMNS.map((column) => {
        const input = ORDER_CELLS[`${column}${row}`];
        if (input === undefined || input === null) return '';
        if (typeof input === 'boolean') return input ? 'TRUE' : 'FALSE';
        return String(input);
      })
    );
  }
  return rows;
}

export interface SafetyCase {
  readonly id: string;
  readonly title: string;
  readonly input: string;
  readonly outcome: string;
}

const doc = (cells: Record<string, SheetInput>, rows = 10, columns = 4): unknown => ({
  format: 'texuli-sheet',
  formatVersion: 1,
  sheets: [{ id: 'probe', name: 'Probe', rows, columns, cells }],
});

function cellValueOf(input: unknown, address: { row: number; col: number }): string {
  const checked = validateSheet(input);
  if (!checked.ok) return `refused: ${checked.issues.map((issue) => issue.message).join(' ')}`;
  const book = createWorkbook(checked.sheet);
  return displayValue(book.value('probe', address.row, address.col));
}

function refusal(input: unknown): string {
  const checked = validateSheet(input);
  if (checked.ok) return 'accepted';
  return `refused (${checked.issues.map((issue) => `${issue.code} at ${issue.path}`).join('; ')})`;
}

/** The limits and refusals, each evaluated by the real validator and engine. */
export function safetyCases(): SafetyCase[] {
  const parsed = (formula: string) => {
    const result = parseFormula(formula);
    return result.ok ? 'parses' : `${result.error}: ${result.diagnostics[0]?.message ?? ''}`;
  };
  const bidi = String.fromCharCode(0x202e);
  return [
    {
      id: 'cycle',
      title: 'A cycle',
      input: 'A1 =B1+1, B1 =A1*2',
      outcome: `A1 shows ${cellValueOf(doc({ A1: '=B1+1', B1: '=A1*2' }), { row: 0, col: 0 })}; breaking the loop recovers it`,
    },
    {
      id: 'self-range',
      title: 'A range that holds its own cell',
      input: 'A3 =SUM(A1:A5)',
      outcome: `A3 shows ${cellValueOf(doc({ A1: 1, A2: 2, A3: '=SUM(A1:A5)' }), { row: 2, col: 0 })}`,
    },
    {
      id: 'limit',
      title: 'A range over 10,000 cells',
      input: 'C1 =SUM(A1:B6000) on a 6,000-row sheet',
      outcome: `C1 shows ${cellValueOf(doc({ C1: '=SUM(A1:B6000)' }, 6000, 3), { row: 0, col: 2 })} instead of stalling`,
    },
    {
      id: 'div',
      title: 'Errors are values',
      input: 'A1 =1/0, A2 =A1+1',
      outcome: `A2 shows ${cellValueOf(doc({ A1: '=1/0', A2: '=A1+1' }), { row: 1, col: 0 })}; IFERROR catches it`,
    },
    ...['=INDIRECT("A1")', '=OFFSET(A1, 1, 1)', '=RAND()', '=LAMBDA(x, x)'].map(
      (formula, index) => ({
        id: `dynamic-${index}`,
        title: 'A reference built from text, or the host reached',
        input: formula,
        outcome: parsed(formula),
      })
    ),
    {
      id: 'agent-indirect',
      title: 'The same in a document from an agent',
      input: 'cells: { "A1": "=INDIRECT(\\"A1\\")" }',
      outcome: refusal(doc({ A1: '=INDIRECT("A1")' })),
    },
    {
      id: 'bidi',
      title: 'Text that reads differently from what it is',
      input: 'cells: { "A1": "<U+202E>txt.exe" }',
      outcome: refusal(doc({ A1: `${bidi}txt.exe` })),
    },
    {
      id: 'missing-sheet',
      title: 'A formula that reads a sheet that does not exist',
      input: 'cells: { "A1": "=Secrets!A1" }',
      outcome: refusal(doc({ A1: '=Secrets!A1' })),
    },
    {
      id: 'too-big',
      title: 'A sheet past the caps',
      input: 'rows: 20000',
      outcome: refusal(doc({}, 20_000, 4)),
    },
  ];
}

export interface DependencyRow {
  readonly cell: string;
  readonly formula: string;
  /** What the formula reads: single cells and whole ranges (one interval each). */
  readonly reads: readonly string[];
}

/**
 * The dependency graph of the live workbook as the parser sees it: every
 * formula with the cells and ranges it reads (never expanded, the way the
 * graph stores them).
 */
export function dependencyRows(document: SheetDocument = ORDERS_WORKBOOK): DependencyRow[] {
  const rows: DependencyRow[] = [];
  for (const tab of document.sheets) {
    for (const [address, input] of Object.entries(tab.cells ?? {})) {
      if (typeof input !== 'string' || !input.startsWith('=')) continue;
      const parsed = parseFormula(input);
      if (!parsed.ok) continue;
      const reads = [
        ...parsed.formula.refs.map((ref) => formatReference(ref)),
        ...parsed.formula.ranges.map(
          (range) =>
            `${formatReference(range.from)}:${formatReference({ ...range.to, sheet: null })}`
        ),
      ];
      rows.push({ cell: `${tab.name}!${address}`, formula: input, reads: [...new Set(reads)] });
    }
  }
  return rows;
}
