export interface GridEditingLabels {
  invalidNumber: string;
  invalidEnum: string;
  required: string;
  saved: string;
  notSaved: (header: string, message: string) => string;
  undo: string;
  redo: string;
  editInstructions: string;
  editorCouldNotLoad: string;
}

export type GridEditingLabelOverrides = Partial<GridEditingLabels>;

export const DEFAULT_GRID_EDITING_LABELS: Readonly<GridEditingLabels> =
  /* @__PURE__ */ Object.freeze({
    invalidNumber: 'Enter a valid number.',
    invalidEnum: 'Choose a listed option.',
    required: 'A value is required.',
    saved: 'Saved.',
    notSaved: (header: string, message: string) => `${header} was not saved: ${message}`,
    undo: 'Undo',
    redo: 'Redo',
    editInstructions:
      'Enter or F2 edits the cell. Escape cancels. Control or Command plus Z undoes; Shift plus Z or Y redoes. Control or Command plus C copies; V pastes.',
    editorCouldNotLoad: 'The cell editor could not load.',
  });

export function resolveGridEditingLabels(
  overrides: GridEditingLabelOverrides = {}
): GridEditingLabels {
  const labels = { ...DEFAULT_GRID_EDITING_LABELS } as Record<string, unknown>;
  for (const [key, value] of Object.entries(overrides)) {
    if (key in labels && typeof value === typeof labels[key]) labels[key] = value;
  }
  return labels as unknown as GridEditingLabels;
}
