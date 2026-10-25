/**
 * Framework-free data grid editing: drafts, parse, validate, cell keys.
 * Used by EditableDataGrid and unit tests; no Svelte, no DOM.
 */

import type { GridValue } from '../engines/grid/columns.ts';
import { normalize, readValue } from '../engines/grid/columns.ts';
import type { DataGridColumn } from '../grid-core/model.ts';
import { cellText } from '../grid-core/model.ts';
import { DEFAULT_GRID_EDITING_LABELS, type GridEditingLabels } from './labels.ts';

/** Draft held while a cell is open for edit. */
export type EditorDraft = string | boolean;

/** A grid column that may be edited inline. */
export interface EditableColumn<T> extends DataGridColumn<T> {
  /** Cells open an inline editor (needs `onCommit` on the view). */
  editable?: boolean;
  /**
   * Extra validation after the draft is parsed. Return a message to reject,
   * or `null` / `undefined` to accept.
   */
  validate?: (value: GridValue, row: T) => string | null | undefined;
}

/** Stable map key for one cell. */
export function cellKey(rowId: string, columnKey: string): string {
  return `${rowId}\u0000${columnKey}`;
}

export function parseCellKey(key: string): { rowId: string; columnKey: string } | null {
  const split = key.indexOf('\u0000');
  if (split <= 0 || split === key.length - 1) return null;
  return { rowId: key.slice(0, split), columnKey: key.slice(split + 1) };
}

/** Seed the editor from the current cell value. */
export function draftFromValue<T>(
  column: EditableColumn<T>,
  value: GridValue,
  row: T
): EditorDraft {
  if (column.type === 'boolean') return value === true || value === 'true';
  if (column.type === 'date') {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return value.toISOString().slice(0, 10);
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return new Date(value).toISOString().slice(0, 10);
    }
    if (typeof value === 'string' && value.length >= 10) return value.slice(0, 10);
    return '';
  }
  if (value === null || value === undefined) return '';
  return String(value);
}

/** Convert a draft into the column's stored value (`null` for an empty field). */
export function parseEditorValue<T>(column: EditableColumn<T>, draft: EditorDraft): GridValue {
  if (column.type === 'boolean') return draft === true || draft === 'true';
  if (typeof draft !== 'string') return draft === true;
  if (draft === '') return null;
  if (column.type === 'number') {
    const n = Number(draft);
    return Number.isFinite(n) ? n : Number.NaN;
  }
  // Text, enum and ISO day strings stay text (hosts store a date as string or Date).
  return draft;
}

export type CellValidation = { ok: true; value: GridValue } | { ok: false; message: string };

/**
 * Parse and validate a draft for a column. Empty text becomes `null`. Invalid
 * numbers, enum options outside the list, and host `validate` failures reject.
 */
export function validateCell<T>(
  column: EditableColumn<T>,
  row: T,
  draft: EditorDraft,
  labels: Pick<
    GridEditingLabels,
    'invalidNumber' | 'invalidEnum' | 'required'
  > = DEFAULT_GRID_EDITING_LABELS
): CellValidation {
  const value = parseEditorValue(column, draft);

  if (column.type === 'number' && typeof value === 'number' && Number.isNaN(value)) {
    return { ok: false, message: labels.invalidNumber };
  }

  if (column.type === 'enum' && column.options) {
    if (value === null || value === undefined || value === '') {
      return { ok: true, value: null };
    }
    if (!column.options.includes(String(value))) {
      return { ok: false, message: labels.invalidEnum };
    }
  }

  if (column.type === 'date' && typeof value === 'string' && value !== '') {
    const ms = Date.parse(value);
    if (!Number.isFinite(ms)) {
      return { ok: false, message: labels.invalidNumber };
    }
  }

  const custom = column.validate?.(value, row);
  if (typeof custom === 'string' && custom.length > 0) {
    return { ok: false, message: custom };
  }

  return { ok: true, value };
}

/** Whether two cell values compare equal for the column type. */
export function valuesEqual(
  columnType: EditableColumn<unknown>['type'],
  a: GridValue,
  b: GridValue
): boolean {
  return normalize(a, columnType) === normalize(b, columnType);
}

/** Current value of a cell, preferring an optimistic overlay. */
export function resolveCellValue<T>(
  row: T,
  column: EditableColumn<T>,
  rowId: string,
  optimistic: Readonly<Record<string, GridValue>>
): GridValue {
  const key = cellKey(rowId, column.key);
  if (Object.hasOwn(optimistic, key)) return optimistic[key];
  return readValue(row, column);
}

/** Display text for a cell, with optional optimistic value. */
export function displayCellText<T>(
  row: T,
  column: EditableColumn<T>,
  rowId: string,
  optimistic: Readonly<Record<string, GridValue>>
): string {
  const value = resolveCellValue(row, column, rowId, optimistic);
  if (column.format) return column.format(value, row);
  if (value === null || value === undefined) return '';
  if (value instanceof Date)
    return Number.isNaN(value.getTime()) ? '' : value.toISOString().slice(0, 10);
  if (column.type === 'boolean') return value === true || value === 'true' ? 'Yes' : 'No';
  return String(value);
}

/** Apply a committed value onto a plain row object (immutable). */
export function applyRowValue<T>(row: T, columnKey: string, value: GridValue): T {
  return { ...(row as object), [columnKey]: value } as T;
}

export { cellText, readValue };
