/** Every text the sheet view shows or announces (pass `labels` to translate). */
export interface SheetViewLabels {
  /** The name of the sheet tab group. */
  sheets: string;
  /** The header of the row-number column. */
  row: string;
  /** The name of the formula bar. */
  formulaBar: string;
  /** The grid caption when the document has no title (the sheet name follows). */
  sheet: string;
  /** Why a formula was not saved. */
  formulaError: (message: string) => string;
}

export const DEFAULT_SHEET_VIEW_LABELS: Readonly<SheetViewLabels> = /* @__PURE__ */ Object.freeze({
  sheets: 'Sheets',
  row: 'Row',
  formulaBar: 'Formula bar',
  sheet: 'Sheet',
  formulaError: (message: string) => `The formula has an error: ${message}`,
});

/** Merge label overrides onto the defaults (unknown keys and wrong types are ignored). */
export function resolveSheetViewLabels(overrides: Partial<SheetViewLabels> = {}): SheetViewLabels {
  const labels = { ...DEFAULT_SHEET_VIEW_LABELS } as Record<string, unknown>;
  for (const [key, value] of Object.entries(overrides)) {
    if (key in labels && typeof value === typeof labels[key]) labels[key] = value;
  }
  return labels as unknown as SheetViewLabels;
}
