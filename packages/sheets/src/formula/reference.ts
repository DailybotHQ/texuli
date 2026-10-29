import { hasUnsafeCharacters } from './unsafe.ts';

/*
 * A1 references (ADR-015): `A1`, `$B$2` (anchors), `Sheet2!A1` and
 * `'Q1 plan'!A1` (sheet names), and column-only endpoints (`A`, `$C`) that
 * only stand inside a whole-column range such as `A:C`. Every reference is
 * static: nothing builds one from text at run time. Columns and rows are
 * 0-based here and 1-based in text.
 */

/** Largest column and row a reference may name (`XFD`, 1,048,576). Sheets cap lower. */
export const REFERENCE_LIMITS = Object.freeze({
  columns: 16_384,
  rows: 1_048_576,
  /** Characters of a sheet name. */
  sheetName: 64,
});

/** One parsed reference. `row` is `null` for a column-only endpoint. */
export interface CellReference {
  /** The sheet name as written (unquoted), or `null` for the formula's own sheet. */
  readonly sheet: string | null;
  /** 0-based column. */
  readonly col: number;
  /** 0-based row, or `null` for a whole-column endpoint (`A` in `A:C`). */
  readonly row: number | null;
  readonly colAbsolute: boolean;
  readonly rowAbsolute: boolean;
}

/** The column letters of a 0-based column (`0` → `A`, `27` → `AB`). */
export function columnName(col: number): string {
  if (!Number.isInteger(col) || col < 0 || col >= REFERENCE_LIMITS.columns) return '';
  let n = col + 1;
  let out = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

/** The 0-based column of letters (`A` → 0, case-insensitive), or -1. */
export function columnIndex(letters: string): number {
  if (letters.length === 0 || letters.length > 3) return -1;
  let n = 0;
  for (let i = 0; i < letters.length; i += 1) {
    const code = letters.charCodeAt(i) & ~32; // upper-case ASCII letters
    if (code < 65 || code > 90) return -1;
    n = n * 26 + (code - 64);
  }
  return n - 1 < REFERENCE_LIMITS.columns ? n - 1 : -1;
}

const CELL = /^(\$?)([A-Za-z]{1,3})(\$?)([1-9][0-9]{0,6})$/;
const COLUMN = /^(\$?)([A-Za-z]{1,3})$/;
const PLAIN_SHEET = /^[A-Za-z_][A-Za-z0-9_.]*$/;
const SHEET_FORBIDDEN = /[[\]*?/\\:]/;

/** Whether a sheet name is legal: 1–64 characters, no control, bidi or `[]*?/\:` characters. */
export function isSheetName(name: string): boolean {
  return (
    typeof name === 'string' &&
    name.length > 0 &&
    name.length <= REFERENCE_LIMITS.sheetName &&
    name.trim() === name &&
    !SHEET_FORBIDDEN.test(name) &&
    !hasUnsafeCharacters(name)
  );
}

/** A sheet name as a reference prefix: bare when it is a plain name, else quoted with `''` escapes. */
export function quoteSheetName(name: string): string {
  // A bare name must not read as a cell (`A1`) or a boolean.
  const bare = PLAIN_SHEET.test(name) && !CELL.test(name) && !/^(TRUE|FALSE)$/i.test(name);
  return bare ? name : `'${name.replace(/'/g, "''")}'`;
}

/** Parse a cell part (`A1`, `$B$2`) or a column endpoint (`A`, `$C`); `null` when it is neither. */
export function parseCellPart(
  text: string,
  sheet: string | null = null,
  allowColumn = false
): CellReference | null {
  const cell = CELL.exec(text);
  if (cell) {
    const col = columnIndex(cell[2] as string);
    const row = Number(cell[4]) - 1;
    if (col < 0 || row >= REFERENCE_LIMITS.rows) return null;
    return { sheet, col, row, colAbsolute: cell[1] === '$', rowAbsolute: cell[3] === '$' };
  }
  if (!allowColumn) return null;
  const column = COLUMN.exec(text);
  if (!column) return null;
  const col = columnIndex(column[2] as string);
  if (col < 0) return null;
  return { sheet, col, row: null, colAbsolute: column[1] === '$', rowAbsolute: false };
}

/**
 * Parse a full reference as the AST carries it: an optional sheet prefix
 * (`Sheet2!` or `'Q1 plan'!`), then a cell or, with `allowColumn`, a column.
 */
export function parseReference(text: string, allowColumn = false): CellReference | null {
  if (typeof text !== 'string' || text.length === 0 || text.length > 256) return null;
  const bang = text.lastIndexOf('!');
  if (bang < 0) return parseCellPart(text, null, allowColumn);
  const prefix = text.slice(0, bang);
  let sheet: string;
  if (prefix.startsWith("'")) {
    if (prefix.length < 3 || !prefix.endsWith("'")) return null;
    const inner = prefix.slice(1, -1);
    // Every quote inside is doubled.
    if (inner.replace(/''/g, '').includes("'")) return null;
    sheet = inner.replace(/''/g, "'");
  } else {
    if (!PLAIN_SHEET.test(prefix)) return null;
    sheet = prefix;
  }
  if (!isSheetName(sheet)) return null;
  return parseCellPart(text.slice(bang + 1), sheet, allowColumn);
}

/** Write a reference back as text (`$A$1`, `'Q1 plan'!B3`, `C`). */
export function formatReference(ref: CellReference): string {
  const prefix = ref.sheet === null ? '' : `${quoteSheetName(ref.sheet)}!`;
  const col = `${ref.colAbsolute ? '$' : ''}${columnName(ref.col)}`;
  if (ref.row === null) return `${prefix}${col}`;
  return `${prefix}${col}${ref.rowAbsolute ? '$' : ''}${ref.row + 1}`;
}

/** The plain `A1` address of a 0-based cell. */
export function cellAddress(row: number, col: number): string {
  return `${columnName(col)}${row + 1}`;
}

/** The 0-based row and column of a plain `A1` address (no sheet, no anchors), or `null`. */
export function parseCellAddress(text: string): { row: number; col: number } | null {
  if (typeof text !== 'string' || text.length > 10 || text.includes('$')) return null;
  const ref = parseCellPart(text);
  return ref && ref.row !== null ? { row: ref.row, col: ref.col } : null;
}
