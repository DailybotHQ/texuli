import {
  cellAddress,
  formatReference,
  parseCellAddress,
  parseFormula,
} from '@texuli/sheets/formula';
import {
  createWorkbook,
  displayValue,
  inputText,
  isFormula,
  parseSheetInput,
  type RecalcResult,
  type SheetCellAddress,
  type SheetDocument,
  type SheetInput,
  validateSheet,
  type Workbook,
} from '@texuli/sheets/model';
import { createProjectBudgetFixture } from './fixtures/project-budget.ts';

export type SheetsDemoAction =
  | { type: 'edit-cell'; address: string; value: string }
  | { type: 'add-line-item' }
  | { type: 'toggle-formulas' }
  | { type: 'reset' };

export interface SheetsDemoFormulaRow {
  readonly key: string;
  readonly sheet: string;
  readonly address: string;
  readonly formula: string;
  readonly value: string;
  readonly reads: readonly string[];
  readonly changed: boolean;
}

export interface SheetsDemoState {
  readonly document: SheetDocument;
  readonly showFormulas: boolean;
  readonly formulas: readonly SheetsDemoFormulaRow[];
  readonly formulaCount: number;
  readonly recalculated: readonly string[];
  readonly lastAction: string;
  readonly error: string | null;
}

export interface SheetsDemoModel {
  readonly state: SheetsDemoState;
  dispatch(action: SheetsDemoAction): SheetsDemoState;
  subscribe(listener: (state: SheetsDemoState) => void): () => void;
}

const BUDGET_SHEET = 'budget';
const FIRST_TOTAL_ROW = 4;

interface FormulaCell {
  readonly id: string;
  readonly address: string;
  readonly input: string;
}

function freshWorkbook(): Workbook {
  const result = validateSheet(createProjectBudgetFixture());
  if (!result.ok) throw new Error('The Project budget demo fixture did not validate.');
  return createWorkbook(result.sheet);
}

function formulaCells(document: SheetDocument): FormulaCell[] {
  const cells: FormulaCell[] = [];
  for (const sheet of document.sheets) {
    for (const [address, input] of Object.entries(sheet.cells ?? {})) {
      if (typeof input === 'string' && isFormula(input)) {
        cells.push({ id: sheet.id, address, input });
      }
    }
  }
  return cells;
}

function dependencyLabels(formula: string): string[] {
  const parsed = parseFormula(formula);
  if (!parsed.ok) return [];
  return [
    ...parsed.formula.refs.map((ref) => formatReference(ref)),
    ...parsed.formula.ranges.map(
      ({ from, to }) => `${formatReference(from)}:${formatReference(to)}`
    ),
  ];
}

function formatRecalculated(pass: RecalcResult, document: SheetDocument): string[] {
  const names = new Map(document.sheets.map((sheet) => [sheet.id, sheet.name]));
  return pass.changed.map(
    ({ sheet, row, col }: SheetCellAddress) =>
      `${names.get(sheet) ?? sheet}!${cellAddress(row, col)}`
  );
}

/**
 * A DOM-free state adapter for the Project budget demo. Workbook edits,
 * formula parsing, recalculation and row insertion all use @texuli/sheets.
 */
export function createSheetsDemoModel(): SheetsDemoModel {
  let workbook = freshWorkbook();
  let totalRow = FIRST_TOTAL_ROW;
  let showFormulas = false;
  let lastPass = workbook.lastPass;
  let lastAction = 'Project budget loaded from the sample fixture.';
  let error: string | null = null;
  const listeners = new Set<(state: SheetsDemoState) => void>();

  const snapshot = (): SheetsDemoState => {
    const document = workbook.toDocument();
    const allFormulaCells = formulaCells(document);
    const changed = new Set(formatRecalculated(lastPass, document));
    const formulas = allFormulaCells.map(({ id, address, input }) => {
      const cell = parseCellAddress(address);
      const sheet = document.sheets.find((entry) => entry.id === id);
      const key = `${sheet?.name ?? id}!${address}`;
      return {
        key,
        sheet: sheet?.name ?? id,
        address,
        formula: inputText(input),
        value: cell === null ? '' : displayValue(workbook.value(id, cell.row, cell.col)),
        reads: dependencyLabels(input),
        changed: changed.has(key),
      };
    });
    return {
      document,
      showFormulas,
      formulas: showFormulas ? formulas : [],
      formulaCount: formulas.length,
      recalculated: [...changed],
      lastAction,
      error,
    };
  };

  let state = snapshot();

  const publish = (): SheetsDemoState => {
    state = snapshot();
    for (const listener of listeners) listener(state);
    return state;
  };

  const recordPass = (pass: RecalcResult, message: string): void => {
    lastPass = pass;
    error = null;
    const changed = formatRecalculated(pass, workbook.toDocument());
    lastAction = `${message}: ${pass.evaluated} formulas evaluated; ${changed.length} cells changed.`;
  };

  const editCell = (address: string, value: string): void => {
    const cell = parseCellAddress(address);
    const sheet = workbook.sheet(BUDGET_SHEET);
    if (!cell || !sheet || cell.row >= sheet.rowIds.length || cell.col >= sheet.columnIds.length) {
      error = 'Choose a cell inside the Project budget sheet.';
      lastAction = 'The cell edit was not applied.';
      return;
    }
    const input: SheetInput = parseSheetInput(value);
    const pass = workbook.setInput(BUDGET_SHEET, cell.row, cell.col, input);
    recordPass(pass, `Edited Budget!${cellAddress(cell.row, cell.col)}`);
  };

  const addLineItem = (): void => {
    // Insert before the final existing item, inside the SUM range, so the
    // package rewrites the formula endpoint to include the new blank row.
    const row = totalRow - 1;
    workbook.insertRows(BUDGET_SHEET, row, 1);
    const pass = workbook.setInputs([
      { sheet: BUDGET_SHEET, row, col: 0, input: 'Accessibility review' },
      { sheet: BUDGET_SHEET, row, col: 1, input: 2 },
      { sheet: BUDGET_SHEET, row, col: 2, input: 85 },
      { sheet: BUDGET_SHEET, row, col: 3, input: `=B${row + 1}*C${row + 1}` },
    ]);
    totalRow += 1;
    recordPass(pass, 'Added an accessibility review row');
  };

  const run = (action: SheetsDemoAction): void => {
    error = null;
    switch (action.type) {
      case 'edit-cell':
        editCell(action.address, action.value);
        return;
      case 'add-line-item':
        addLineItem();
        return;
      case 'toggle-formulas':
        showFormulas = !showFormulas;
        lastAction = showFormulas ? 'Formula details are shown.' : 'Formula details are hidden.';
        return;
      case 'reset':
        workbook = freshWorkbook();
        totalRow = FIRST_TOTAL_ROW;
        showFormulas = false;
        lastPass = workbook.lastPass;
        lastAction = 'Reset to the original Project budget.';
        return;
    }
  };

  return {
    get state() {
      return state;
    },
    dispatch(action) {
      run(action);
      return publish();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
