/**
 * `@texuli/data/grid-editing` (T-data-grid-editing): inline cell editors,
 * validation, undo/redo and TSV clipboard. The engine is framework-free; the
 * Svelte view loads through this subpath (or `EditableDataGrid` / `CellEditor`
 * directly).
 */

export { default as CellEditor } from './CellEditor.svelte';
export {
  type ClipboardPastePlan,
  parseClipboard,
  pastePlan,
  serializeClipboard,
} from './clipboard.ts';
export { default as EditableDataGrid } from './EditableDataGrid.svelte';
export {
  DEFAULT_GRID_EDITING_LABELS,
  type GridEditingLabelOverrides,
  type GridEditingLabels,
  resolveGridEditingLabels,
} from './labels.ts';
export {
  applyRowValue,
  type CellValidation,
  cellKey,
  displayCellText,
  draftFromValue,
  type EditableColumn,
  type EditorDraft,
  parseCellKey,
  parseEditorValue,
  resolveCellValue,
  validateCell,
  valuesEqual,
} from './model.ts';
export {
  type CellEditOp,
  createUndoStack,
  type UndoStack,
  type UndoStackOptions,
} from './undo.ts';
