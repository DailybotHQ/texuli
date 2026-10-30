import type { ExpressionError } from '@texuli/core/expression';

/*
 * The sheet format: what hosts store and what agents emit as data (spec
 * 0.8.0, the `sheet` catalog id). Cells are keyed by their A1 address and
 * hold inputs: numbers, booleans, text, or formula text that starts with
 * `=`. A text that must start with `=` is written with a leading `'`
 * (`'=not a formula`), as in other spreadsheets.
 */

/** What a cell holds as typed: a number, a boolean, text or formula text (`=…`). */
export type SheetInput = number | string | boolean | null;

/** What a cell shows: a number, text, a boolean, blank (`null`) or an error value. */
export type SheetValue = number | string | boolean | null | ExpressionError;

/** One sheet (a tab) of a workbook. */
export interface SheetTab {
  /** Stable id (`[A-Za-z0-9_-]`, 1–64), unique in the document. */
  readonly id: string;
  /** The name formulas use (`Sheet2!A1`, `'Q1 plan'!A1`), unique ignoring case. */
  readonly name: string;
  /** Row count (1 to `SHEET_LIMITS.rows`). */
  readonly rows: number;
  /** Column count (1 to `SHEET_LIMITS.columns`). */
  readonly columns: number;
  /** Inputs by A1 address (`B3`); blank cells are absent. */
  readonly cells?: Readonly<Record<string, SheetInput>>;
}

/** A Texuli workbook: `{ format: "texuli-sheet", formatVersion: 1, sheets }`. */
export interface SheetDocument {
  readonly format: 'texuli-sheet';
  readonly formatVersion: 1;
  readonly meta?: { readonly title?: string };
  readonly sheets: readonly SheetTab[];
}

/** The caps every sheet document and workbook keeps (hostile input stops here). */
export const SHEET_LIMITS = Object.freeze({
  /** Sheets per document. */
  sheets: 16,
  /** Rows per sheet. */
  rows: 10_000,
  /** Columns per sheet (`IV`). */
  columns: 256,
  /** Non-blank cells per document. */
  cells: 100_000,
  /** Characters of one text input (formula text is capped at `FORMULA_LIMITS.length`). */
  text: 32_768,
  /** Characters of every text and formula input together. */
  totalText: 4_000_000,
  /** Characters of the document title. */
  title: 200,
  /** Bytes of JSON `loadUntrustedSheet` reads. */
  jsonBytes: 8_000_000,
  /**
   * Dependency edges and range entries one recalculation pass may visit;
   * past it every formula of the pass is `#LIMIT!` (the evaluation steps
   * have their own budget, `EXPRESSION_LIMITS.passSteps`).
   */
  passWork: 2_000_000,
});

/** The id pattern of sheets. */
export const SHEET_ID = /^[A-Za-z0-9_-]{1,64}$/;

/** A cell position: a sheet id and 0-based row and column. */
export interface SheetCellAddress {
  readonly sheet: string;
  readonly row: number;
  readonly col: number;
}
