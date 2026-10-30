import { FORMULA_LIMITS, parseFormula } from '../formula/parse.ts';
import { isSheetName, parseCellAddress } from '../formula/reference.ts';
import { hasUnsafeCharacters } from '../formula/unsafe.ts';
import {
  SHEET_ID,
  SHEET_LIMITS,
  type SheetDocument,
  type SheetInput,
  type SheetTab,
} from './types.ts';

/*
 * The untrusted-input validator: every sheet from a file, an agent, a
 * clipboard or a sync peer passes here before a workbook is built. Closed
 * members, the caps of `SHEET_LIMITS`, A1 keys inside the sheet, no control
 * or bidi characters in text, and every formula parsed by the sheet grammar
 * (unknown functions and names, syntax, references to sheets that do not
 * exist). Linear in the input; a hostile document stops at the first cap it
 * crosses.
 */

/** One problem in a sheet document. */
export interface SheetIssue {
  readonly code:
    | 'not-an-object'
    | 'format'
    | 'unknown-member'
    | 'missing-member'
    | 'bad-id'
    | 'duplicate-id'
    | 'bad-name'
    | 'duplicate-name'
    | 'bad-size'
    | 'bad-address'
    | 'bad-input'
    | 'unsafe-text'
    | 'formula'
    | 'too-many'
    | 'too-large'
    // From `csvToSheet` only: the `CsvIssue` code of the CSV that could not be read.
    | 'unterminated-quote'
    | 'too-many-rows'
    | 'too-many-columns'
    | 'field-too-long'
    | 'not-text';
  /** A JSON path (`sheets[0].cells.B3`). */
  readonly path: string;
  readonly message: string;
  readonly severity: 'error' | 'warning';
}

export type SheetValidation =
  | { readonly ok: true; readonly sheet: SheetDocument; readonly issues: readonly SheetIssue[] }
  | { readonly ok: false; readonly sheet: null; readonly issues: readonly SheetIssue[] };

const MAX_ISSUES = 50;
// Control characters (tab and line breaks are allowed in text) and bidi controls.
const UNSAFE = { test: (text: string) => hasUnsafeCharacters(text, true) };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const DOC_KEYS = new Set(['format', 'formatVersion', 'meta', 'sheets']);
const TAB_KEYS = new Set(['id', 'name', 'rows', 'columns', 'cells']);

/**
 * Validate an untrusted sheet document. Never throws. On success the sheet
 * is a normalized, frozen copy holding only known members; warnings (such
 * as a formula reading past the sheet's edge, which shows `#REF!`) do not
 * fail it.
 */
export function validateSheet(input: unknown): SheetValidation {
  const issues: SheetIssue[] = [];
  let stopped = false;
  const report = (
    code: SheetIssue['code'],
    path: string,
    message: string,
    severity: SheetIssue['severity'] = 'error'
  ) => {
    if (issues.length < MAX_ISSUES) issues.push(Object.freeze({ code, path, message, severity }));
    if (issues.length >= MAX_ISSUES || code === 'too-large' || code === 'too-many') stopped = true;
  };
  const done = (): SheetValidation =>
    Object.freeze({ ok: false, sheet: null, issues: Object.freeze(issues) });

  if (!isRecord(input)) {
    report(
      'not-an-object',
      '$',
      'A sheet is an object { format: "texuli-sheet", formatVersion: 1, sheets }.'
    );
    return done();
  }
  for (const key of Object.keys(input)) {
    if (!DOC_KEYS.has(key))
      report('unknown-member', key.slice(0, 32), `A sheet takes no "${key.slice(0, 32)}".`);
  }
  if (input.format !== 'texuli-sheet') report('format', 'format', 'The format is "texuli-sheet".');
  if (input.formatVersion !== 1) report('format', 'formatVersion', 'The format version is 1.');
  let title: string | undefined;
  if (input.meta !== undefined) {
    if (!isRecord(input.meta)) report('bad-input', 'meta', 'meta is an object { title }.');
    else {
      for (const key of Object.keys(input.meta)) {
        if (key !== 'title')
          report(
            'unknown-member',
            `meta.${key.slice(0, 32)}`,
            `meta takes no "${key.slice(0, 32)}".`
          );
      }
      const raw = input.meta.title;
      if (raw !== undefined) {
        if (typeof raw !== 'string' || raw.length > SHEET_LIMITS.title) {
          report(
            'bad-input',
            'meta.title',
            `The title is text of at most ${SHEET_LIMITS.title} characters.`
          );
        } else if (UNSAFE.test(raw))
          report('unsafe-text', 'meta.title', 'The title has control or bidi characters.');
        else title = raw;
      }
    }
  }
  const sheets = input.sheets;
  if (!Array.isArray(sheets) || sheets.length === 0) {
    report('missing-member', 'sheets', 'sheets is a list of 1 or more sheets.');
    return done();
  }
  if (sheets.length > SHEET_LIMITS.sheets) {
    report('too-many', 'sheets', `A document has at most ${SHEET_LIMITS.sheets} sheets.`);
    return done();
  }

  const ids = new Set<string>();
  const names = new Map<string, string>();
  const tabs: {
    id: string;
    name: string;
    rows: number;
    columns: number;
    raw: Record<string, unknown> | null;
    path: string;
  }[] = [];
  sheets.forEach((tab, index) => {
    const path = `sheets[${index}]`;
    if (!isRecord(tab)) {
      report('not-an-object', path, 'A sheet tab is an object { id, name, rows, columns, cells }.');
      return;
    }
    for (const key of Object.keys(tab)) {
      if (!TAB_KEYS.has(key))
        report(
          'unknown-member',
          `${path}.${key.slice(0, 32)}`,
          `A sheet tab takes no "${key.slice(0, 32)}".`
        );
    }
    const id = typeof tab.id === 'string' && SHEET_ID.test(tab.id) ? tab.id : null;
    if (id === null) report('bad-id', `${path}.id`, 'A sheet id is 1–64 of A–Z a–z 0–9 _ -.');
    else if (ids.has(id)) report('duplicate-id', `${path}.id`, `The id "${id}" is used twice.`);
    else ids.add(id);
    const name =
      typeof tab.name === 'string' && isSheetName(tab.name) && !UNSAFE.test(tab.name)
        ? tab.name
        : null;
    if (name === null)
      report(
        'bad-name',
        `${path}.name`,
        'A sheet name is 1–64 characters without control characters or []*?/\\:.'
      );
    else if (names.has(name.toLowerCase()))
      report('duplicate-name', `${path}.name`, `The name "${name}" is used twice.`);
    else names.set(name.toLowerCase(), name);
    const rows = tab.rows;
    const columns = tab.columns;
    const okRows =
      Number.isInteger(rows) && (rows as number) >= 1 && (rows as number) <= SHEET_LIMITS.rows;
    const okCols =
      Number.isInteger(columns) &&
      (columns as number) >= 1 &&
      (columns as number) <= SHEET_LIMITS.columns;
    if (!okRows)
      report('bad-size', `${path}.rows`, `rows is an integer from 1 to ${SHEET_LIMITS.rows}.`);
    if (!okCols)
      report(
        'bad-size',
        `${path}.columns`,
        `columns is an integer from 1 to ${SHEET_LIMITS.columns}.`
      );
    let raw: Record<string, unknown> | null = null;
    if (tab.cells !== undefined) {
      if (!isRecord(tab.cells))
        report('bad-input', `${path}.cells`, 'cells is an object of A1 addresses to inputs.');
      else raw = tab.cells;
    }
    if (id !== null && name !== null && okRows && okCols) {
      tabs.push({ id, name, rows: rows as number, columns: columns as number, raw, path });
    }
  });
  if (issues.some((issue) => issue.severity === 'error')) return done();

  let cellCount = 0;
  let textTotal = 0;
  const out: SheetTab[] = [];
  for (const tab of tabs) {
    if (stopped) break;
    const cells: Record<string, SheetInput> = {};
    for (const [key, value] of Object.entries(tab.raw ?? {})) {
      if (stopped) break;
      const at = `${tab.path}.cells.${key.slice(0, 16)}`;
      cellCount += 1;
      if (cellCount > SHEET_LIMITS.cells) {
        report(
          'too-many',
          `${tab.path}.cells`,
          `A document has at most ${SHEET_LIMITS.cells} non-blank cells.`
        );
        break;
      }
      const address = parseCellAddress(key);
      if (!address || address.row >= tab.rows || address.col >= tab.columns) {
        report(
          'bad-address',
          at,
          `"${key.slice(0, 16)}" is not a cell of this ${tab.rows}×${tab.columns} sheet.`
        );
        continue;
      }
      if (value === null) continue;
      if (typeof value === 'number') {
        if (!Number.isFinite(value)) report('bad-input', at, 'A number input is finite.');
        else cells[key.toUpperCase()] = value === 0 ? 0 : value;
        continue;
      }
      if (typeof value === 'boolean') {
        cells[key.toUpperCase()] = value;
        continue;
      }
      if (typeof value !== 'string') {
        report('bad-input', at, 'A cell input is a number, a boolean, text or a formula.');
        continue;
      }
      textTotal += value.length;
      if (textTotal > SHEET_LIMITS.totalText) {
        report(
          'too-large',
          at,
          `A document holds at most ${SHEET_LIMITS.totalText} characters of text.`
        );
        break;
      }
      if (UNSAFE.test(value)) {
        report('unsafe-text', at, 'Text has control or bidi characters.');
        continue;
      }
      if (value.length > 1 && value.startsWith('=')) {
        if (value.length > FORMULA_LIMITS.length) {
          report('formula', at, `A formula has at most ${FORMULA_LIMITS.length} characters.`);
          continue;
        }
        const parsed = parseFormula(value);
        if (!parsed.ok) {
          const first = parsed.diagnostics[0];
          report(
            'formula',
            at,
            `${parsed.error} ${first?.message ?? 'The formula does not parse.'}`
          );
          continue;
        }
        const targets = [
          ...parsed.formula.refs.map((ref) => ({ ref, row: ref.row, col: ref.col })),
          ...parsed.formula.ranges.map((range) => ({
            ref: range.from,
            row: range.from.row,
            col: range.from.col,
          })),
        ];
        for (const { ref, row, col } of targets) {
          if (ref.sheet !== null && !names.has(ref.sheet.toLowerCase())) {
            report(
              'formula',
              at,
              `The formula reads the sheet "${ref.sheet.slice(0, 64)}", which does not exist.`
            );
            break;
          }
          const target =
            ref.sheet === null
              ? tab
              : tabs.find((t) => t.name.toLowerCase() === (ref.sheet as string).toLowerCase());
          if (target && ((row !== null && row >= target.rows) || col >= target.columns)) {
            report(
              'formula',
              at,
              'The formula reads past the edge of its sheet (it shows #REF!).',
              'warning'
            );
            break;
          }
        }
        cells[key.toUpperCase()] = value;
        continue;
      }
      if (value.length > SHEET_LIMITS.text) {
        report('bad-input', at, `Text holds at most ${SHEET_LIMITS.text} characters.`);
        continue;
      }
      cells[key.toUpperCase()] = value;
    }
    out.push(
      Object.freeze({
        id: tab.id,
        name: tab.name,
        rows: tab.rows,
        columns: tab.columns,
        cells: Object.freeze(cells),
      })
    );
  }
  if (issues.some((issue) => issue.severity === 'error')) return done();
  const sheet: SheetDocument = Object.freeze({
    format: 'texuli-sheet',
    formatVersion: 1,
    ...(title !== undefined ? { meta: Object.freeze({ title }) } : {}),
    sheets: Object.freeze(out),
  });
  return Object.freeze({ ok: true, sheet, issues: Object.freeze(issues) });
}

/**
 * Parse and validate sheet JSON from a file, a share link or an agent.
 * The text is capped at `SHEET_LIMITS.jsonBytes` before it is parsed.
 */
export function loadUntrustedSheet(json: string): SheetValidation {
  if (typeof json !== 'string' || json.length > SHEET_LIMITS.jsonBytes) {
    return Object.freeze({
      ok: false,
      sheet: null,
      issues: Object.freeze([
        Object.freeze({
          code: 'too-large' as const,
          path: '$',
          message: `Sheet JSON is at most ${SHEET_LIMITS.jsonBytes} characters.`,
          severity: 'error' as const,
        }),
      ]),
    });
  }
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    return Object.freeze({
      ok: false,
      sheet: null,
      issues: Object.freeze([
        Object.freeze({
          code: 'not-an-object' as const,
          path: '$',
          message: 'The text is not JSON.',
          severity: 'error' as const,
        }),
      ]),
    });
  }
  return validateSheet(value);
}

/** An empty sheet document with one sheet (`Sheet1`). */
export function createSheet(
  options: { rows?: number; columns?: number; title?: string; name?: string } = {}
): SheetDocument {
  const rows = Math.min(SHEET_LIMITS.rows, Math.max(1, Math.trunc(options.rows ?? 100)));
  const columns = Math.min(SHEET_LIMITS.columns, Math.max(1, Math.trunc(options.columns ?? 26)));
  return {
    format: 'texuli-sheet',
    formatVersion: 1,
    ...(options.title ? { meta: { title: options.title } } : {}),
    sheets: [{ id: 'sheet1', name: options.name ?? 'Sheet1', rows, columns, cells: {} }],
  };
}

/**
 * The catalog's draft check for `sheet` nodes (inject as `checkSheet` into
 * `validateDraft` from `@texuli/catalog/validate`). Sheets are data at every
 * tier: the tier does not loosen anything.
 */
export function checkSheetDraft(
  sheet: unknown,
  _tier?: string
): { ok: boolean; sheet?: SheetDocument; issues: readonly SheetIssue[] } {
  const result = validateSheet(sheet);
  return result.ok
    ? { ok: true, sheet: result.sheet, issues: result.issues }
    : { ok: false, issues: result.issues };
}
