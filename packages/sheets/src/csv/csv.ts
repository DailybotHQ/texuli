import { isExpressionError } from '@texuli/core/expression';
import { numberText } from '../formula/functions.ts';
import { cellAddress } from '../formula/reference.ts';
import { parseSheetInput } from '../model/input.ts';
import { type SheetValidation, validateSheet } from '../model/schema.ts';
import { SHEET_LIMITS, type SheetInput, type SheetValue } from '../model/types.ts';
import type { Workbook } from '../model/workbook.ts';

/*
 * CSV in and out (RFC 4180 with the usual leniencies). Import is one pass
 * over the text (quoted runs are copied in slices, never char by char into
 * a regex), stops at the first cap it crosses, and treats every field as
 * untrusted: a field that starts with `=` stays text unless the caller opts
 * into formulas. Export neutralizes formula injection: text that a
 * spreadsheet would run (`=`, `+`, `-`, `@`, tab, carriage return, and their
 * full-width forms) is written with a leading `'`, so opening the file in
 * another spreadsheet never evaluates it; numbers stay numbers.
 */

/** The caps of CSV import. */
export const CSV_LIMITS = Object.freeze({
  /** Characters of CSV text read. */
  length: SHEET_LIMITS.jsonBytes,
  rows: SHEET_LIMITS.rows,
  columns: SHEET_LIMITS.columns,
  /** Characters of one field. */
  field: SHEET_LIMITS.text,
});

/** A field delimiter. */
export type CsvDelimiter = ',' | ';' | '\t';

export interface CsvParseOptions {
  /** The field delimiter (default `,`). */
  readonly delimiter?: CsvDelimiter;
}

/** A problem that stopped a CSV import. */
export interface CsvIssue {
  readonly code:
    | 'too-large'
    | 'too-many-rows'
    | 'too-many-columns'
    | 'field-too-long'
    | 'unterminated-quote'
    | 'not-text';
  /** 1-based line where the problem was found. */
  readonly line: number;
  readonly message: string;
}

export type CsvParseResult =
  | { readonly ok: true; readonly rows: string[][] }
  | { readonly ok: false; readonly issue: CsvIssue };

function fail(code: CsvIssue['code'], line: number, message: string): CsvParseResult {
  return { ok: false, issue: Object.freeze({ code, line, message }) };
}

/** Parse CSV text into rows of fields. Linear in the text; never throws. */
export function parseCsv(text: string, options: CsvParseOptions = {}): CsvParseResult {
  if (typeof text !== 'string') return fail('not-text', 1, 'CSV is text.');
  if (text.length > CSV_LIMITS.length) {
    return fail('too-large', 1, `CSV is at most ${CSV_LIMITS.length} characters.`);
  }
  const delimiter = options.delimiter ?? ',';
  const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const n = source.length;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let line = 1;
  let i = 0;
  let fieldStarted = false;

  const endField = (): CsvParseResult | null => {
    if (field.length > CSV_LIMITS.field) {
      return fail('field-too-long', line, `A field holds at most ${CSV_LIMITS.field} characters.`);
    }
    row.push(field);
    field = '';
    fieldStarted = false;
    if (row.length > CSV_LIMITS.columns) {
      return fail('too-many-columns', line, `A row has at most ${CSV_LIMITS.columns} fields.`);
    }
    return null;
  };
  const endRow = (): CsvParseResult | null => {
    const problem = endField();
    if (problem) return problem;
    rows.push(row);
    row = [];
    if (rows.length > CSV_LIMITS.rows) {
      return fail('too-many-rows', line, `CSV has at most ${CSV_LIMITS.rows} rows.`);
    }
    return null;
  };

  while (i < n) {
    const ch = source[i] as string;
    if (ch === '"' && !fieldStarted) {
      // A quoted field: copy runs up to each quote; "" is one quote.
      fieldStarted = true;
      const startLine = line;
      i += 1;
      for (;;) {
        const next = source.indexOf('"', i);
        if (next < 0) {
          return fail('unterminated-quote', startLine, 'A quoted field is not closed.');
        }
        const run = source.slice(i, next);
        for (let k = run.indexOf('\n'); k >= 0; k = run.indexOf('\n', k + 1)) line += 1;
        field += run;
        if (field.length > CSV_LIMITS.field) {
          return fail(
            'field-too-long',
            startLine,
            `A field holds at most ${CSV_LIMITS.field} characters.`
          );
        }
        if (source[next + 1] === '"') {
          field += '"';
          i = next + 2;
          continue;
        }
        i = next + 1;
        break;
      }
      continue;
    }
    if (ch === delimiter) {
      const problem = endField();
      if (problem) return problem;
      i += 1;
      continue;
    }
    if (ch === '\r' || ch === '\n') {
      const problem = endRow();
      if (problem) return problem;
      i += ch === '\r' && source[i + 1] === '\n' ? 2 : 1;
      line += 1;
      continue;
    }
    // A plain run up to the next special character.
    let j = i + 1;
    while (j < n) {
      const c = source[j];
      if (c === delimiter || c === '\r' || c === '\n' || c === '"') break;
      j += 1;
    }
    field += source.slice(i, j);
    fieldStarted = true;
    if (field.length > CSV_LIMITS.field) {
      return fail('field-too-long', line, `A field holds at most ${CSV_LIMITS.field} characters.`);
    }
    i = j;
    // A quote inside an unquoted field is kept as text.
    if (source[i] === '"') {
      field += '"';
      i += 1;
    }
  }
  // The last row, unless the text ended with a line break.
  if (field.length > 0 || fieldStarted || row.length > 0) {
    const problem = endRow();
    if (problem) return problem;
  }
  return { ok: true, rows };
}

/** A value CSV export writes. */
export type CsvValue = SheetValue | SheetInput;

export interface CsvWriteOptions {
  readonly delimiter?: CsvDelimiter;
  /** Line break (default `\r\n`, as RFC 4180 writes it). */
  readonly newline?: '\r\n' | '\n';
  /**
   * Prefix text that a spreadsheet would run as a formula with `'`
   * (default `true`). Turn it off only for a consumer that never evaluates
   * cells.
   */
  readonly neutralize?: boolean;
}

// What spreadsheets treat as the start of a formula (OWASP CSV injection), with full-width forms.
const RISKY_START = /^[=+\-@\t\r＝＋－＠]/;

/** Whether text would run as a formula when a spreadsheet opens it. */
export function isRiskyCsvText(text: string): boolean {
  return RISKY_START.test(text);
}

function fieldText(value: CsvValue, neutralize: boolean): string {
  if (value === null || value === undefined) return '';
  if (isExpressionError(value)) return value.error;
  if (typeof value === 'number') return numberText(value);
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  const text = String(value);
  return neutralize && isRiskyCsvText(text) ? `'${text}` : text;
}

/** Write rows as CSV. Text that could run as a formula is neutralized (see `neutralize`). */
export function toCsv(
  rows: readonly (readonly CsvValue[])[],
  options: CsvWriteOptions = {}
): string {
  const delimiter = options.delimiter ?? ',';
  const newline = options.newline ?? '\r\n';
  const neutralize = options.neutralize !== false;
  const out: string[] = [];
  for (const row of rows) {
    out.push(
      row
        .map((value) => {
          const text = fieldText(value, neutralize);
          if (
            text.includes(delimiter) ||
            text.includes('"') ||
            text.includes('\n') ||
            text.includes('\r')
          ) {
            return `"${text.replace(/"/g, '""')}"`;
          }
          return text;
        })
        .join(delimiter)
    );
  }
  return out.join(newline);
}

export interface CsvToSheetOptions extends CsvParseOptions {
  readonly id?: string;
  readonly name?: string;
  readonly title?: string;
  /**
   * Read fields that start with `=` as formulas (default `false`: they stay
   * text, because a CSV from elsewhere is untrusted).
   */
  readonly formulas?: boolean;
  /** Read plain numbers and TRUE/FALSE as numbers and booleans (default `true`). */
  readonly types?: boolean;
}

/**
 * Import CSV as a one-sheet document, validated by `validateSheet`. Fields
 * starting with `=` stay text unless `formulas` is set; with it, formulas
 * still pass the sheet grammar and caps.
 */
export function csvToSheet(
  text: string,
  options: CsvToSheetOptions = {}
): SheetValidation & { readonly csv?: CsvIssue } {
  const parsed = parseCsv(text, options.delimiter ? { delimiter: options.delimiter } : {});
  if (!parsed.ok) {
    return Object.freeze({
      ok: false,
      sheet: null,
      issues: Object.freeze([
        Object.freeze({
          code: 'too-large' as const,
          path: `$:${parsed.issue.line}`,
          message: parsed.issue.message,
          severity: 'error' as const,
        }),
      ]),
      csv: parsed.issue,
    });
  }
  const types = options.types !== false;
  const cells: Record<string, SheetInput> = {};
  let columns = 1;
  parsed.rows.forEach((row, r) => {
    if (row.length > columns) columns = row.length;
    row.forEach((field, c) => {
      if (field === '') return;
      let input: SheetInput;
      if (field.startsWith('=')) input = options.formulas ? field : `'${field}`;
      else input = types ? parseSheetInput(field) : field;
      if (input !== null) cells[cellAddress(r, c)] = input;
    });
  });
  return validateSheet({
    format: 'texuli-sheet',
    formatVersion: 1,
    ...(options.title ? { meta: { title: options.title } } : {}),
    sheets: [
      {
        id: options.id ?? 'sheet1',
        name: options.name ?? 'Sheet1',
        rows: Math.max(1, parsed.rows.length),
        columns,
        cells,
      },
    ],
  });
}

export interface SheetToCsvOptions extends CsvWriteOptions {
  /** Write computed values (default) or the inputs as typed (formulas are then neutralized text). */
  readonly values?: 'computed' | 'inputs';
}

/** Export one sheet of a workbook as CSV, trimmed to its used range. */
export function sheetToCsv(
  workbook: Workbook,
  sheetId: string,
  options: SheetToCsvOptions = {}
): string {
  const sheet = workbook.sheet(sheetId);
  if (!sheet) return '';
  const inputs = options.values === 'inputs';
  const read = (r: number, c: number): CsvValue =>
    inputs ? workbook.input(sheetId, r, c) : workbook.value(sheetId, r, c);
  let lastRow = -1;
  let lastCol = -1;
  for (let r = 0; r < sheet.rowIds.length; r += 1) {
    for (let c = 0; c < sheet.columnIds.length; c += 1) {
      const value = read(r, c);
      if (value !== null && value !== '') {
        if (r > lastRow) lastRow = r;
        if (c > lastCol) lastCol = c;
      }
    }
  }
  const rows: CsvValue[][] = [];
  for (let r = 0; r <= lastRow; r += 1) {
    const row: CsvValue[] = [];
    for (let c = 0; c <= lastCol; c += 1) row.push(read(r, c));
    rows.push(row);
  }
  return toCsv(rows, options);
}
