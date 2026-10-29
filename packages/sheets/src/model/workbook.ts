import {
  createExpressionBudget,
  EXPRESSION_LIMITS,
  type ExpressionDiagnostic,
  type ExpressionValue,
  expressionError,
  isExpressionError,
} from '@texuli/core/expression';
import { evaluateFormula } from '../formula/evaluate.ts';
import { parseFormula, REF_ERROR, type SheetFormula } from '../formula/parse.ts';
import {
  type CellReference,
  cellAddress,
  isSheetName,
  parseCellAddress,
  parseReference,
} from '../formula/reference.ts';
import { type ReferenceTarget, type ReferenceVisitor, rewriteFormula } from '../formula/rewrite.ts';
import { DependencyGraph, type FormulaDependencies, type GraphCell } from './graph.ts';
import { isFormula, literalValue } from './input.ts';
import {
  SHEET_ID,
  SHEET_LIMITS,
  type SheetCellAddress,
  type SheetDocument,
  type SheetInput,
  type SheetTab,
  type SheetValue,
} from './types.ts';

/*
 * The workbook engine: a validated sheet document turned into cells with
 * stable row and column ids, a dependency graph and computed values.
 *
 * - A cell edit recalculates only what depends on it: the graph walks the
 *   dirty subgraph and evaluates it in topological order (`lastPass`
 *   reports how many formulas ran).
 * - Cycles show `#CYCLE!`; nothing loops.
 * - Every pass shares one step budget (`EXPRESSION_LIMITS.passSteps`) and
 *   one graph work cap (`SHEET_LIMITS.passWork`); past them cells show
 *   `#LIMIT!`, so a hostile workbook costs bounded time.
 * - Inserting or deleting rows and columns, renaming, adding and removing
 *   sheets rewrite the references in formula text (deleted ones become
 *   `#REF!`) and recalculate everything once.
 *
 * Framework-free and DOM-free; the view drives it, and so can a server.
 */

/** Options for `createWorkbook`. */
export interface WorkbookOptions {
  /** The host clock for TODAY and NOW (milliseconds or a Date); without it they show `#N/A`. */
  readonly now?: () => number | Date;
  /** Evaluation steps per recalculation pass (default and maximum `EXPRESSION_LIMITS.passSteps`). */
  readonly passSteps?: number;
}

/** What one recalculation pass did. */
export interface RecalcResult {
  /** Formulas evaluated. */
  readonly evaluated: number;
  /** Cells whose value changed (the edited cells included). */
  readonly changed: readonly SheetCellAddress[];
  /** Formulas found on a cycle. */
  readonly cycles: number;
  /** The pass ran out of steps or graph work; some cells show `#LIMIT!`. */
  readonly limited: boolean;
  /** Evaluation steps spent. */
  readonly steps: number;
}

/** One cell edit. */
export interface CellEdit {
  readonly sheet: string;
  readonly row: number;
  readonly col: number;
  readonly input: SheetInput;
}

/** A sheet as the workbook holds it. */
export interface WorkbookSheet {
  readonly id: string;
  readonly name: string;
  /** Stable row ids, in order (they survive inserts and deletes around them). */
  readonly rowIds: readonly string[];
  /** Stable column ids, in order. */
  readonly columnIds: readonly string[];
}

export interface Workbook {
  /** The sheets, in order. */
  readonly sheets: readonly WorkbookSheet[];
  /** The document title, if any. */
  readonly title: string | undefined;
  /** A sheet by id. */
  sheet(id: string): WorkbookSheet | undefined;
  /** A cell's computed value (`null` when blank or outside the sheet). */
  value(sheet: string, row: number, col: number): SheetValue;
  /** A cell's input as typed (`null` when blank). */
  input(sheet: string, row: number, col: number): SheetInput;
  /** Why a formula cell shows an error it got from its own text (parse diagnostics). */
  diagnostics(sheet: string, row: number, col: number): readonly ExpressionDiagnostic[];
  /** Set one cell and recalculate what depends on it. */
  setInput(sheet: string, row: number, col: number, input: SheetInput): RecalcResult;
  /** Set many cells, then recalculate once. */
  setInputs(edits: readonly CellEdit[]): RecalcResult;
  insertRows(sheet: string, at: number, count?: number): RecalcResult;
  deleteRows(sheet: string, at: number, count?: number): RecalcResult;
  insertColumns(sheet: string, at: number, count?: number): RecalcResult;
  deleteColumns(sheet: string, at: number, count?: number): RecalcResult;
  /** Rename a sheet; formulas that read it follow the new name. */
  renameSheet(sheet: string, name: string): RecalcResult;
  /** Add an empty sheet at the end; returns its id. */
  addSheet(name: string, rows?: number, columns?: number): string;
  /** Remove a sheet; formulas that read it show `#REF!`. */
  removeSheet(sheet: string): RecalcResult;
  /** Recalculate every formula. */
  recalculate(): RecalcResult;
  /** The last pass. */
  readonly lastPass: RecalcResult;
  /** The workbook back as a sheet document (inputs only, row-major). */
  toDocument(): SheetDocument;
}

interface Cell {
  readonly key: string;
  readonly sheet: string;
  readonly rowId: string;
  readonly colId: string;
  input: SheetInput;
  formula: SheetFormula | null;
  diagnostics: readonly ExpressionDiagnostic[];
  value: SheetValue;
}

interface SheetState {
  id: string;
  name: string;
  rowIds: string[];
  colIds: string[];
  rowIndex: Map<string, number>;
  colIndex: Map<string, number>;
  keys: Set<string>;
  /** Cells by row id, then column id (fast reads without building keys). */
  grid: Map<string, Map<string, Cell>>;
  nextRow: number;
  nextCol: number;
}

const CYCLE = expressionError('#CYCLE!');
const LIMIT = expressionError('#LIMIT!');
const REF = expressionError('#REF!');
const VALUE = expressionError('#VALUE!');

const EMPTY_PASS: RecalcResult = Object.freeze({
  evaluated: 0,
  changed: Object.freeze([]),
  cycles: 0,
  limited: false,
  steps: 0,
});

function cellKey(sheet: string, rowId: string, colId: string): string {
  return `${sheet}\u0000${rowId}\u0001${colId}`;
}

function sameValue(a: SheetValue, b: SheetValue): boolean {
  if (isExpressionError(a) || isExpressionError(b)) {
    return isExpressionError(a) && isExpressionError(b) && a.error === b.error;
  }
  return a === b || (Number.isNaN(a) && Number.isNaN(b));
}

function settle(value: ExpressionValue): SheetValue {
  if (Array.isArray(value)) {
    // A formula that returns a range shows its only value; a larger one is #VALUE!.
    return value.length === 1 ? ((value[0] ?? null) as SheetValue) : VALUE;
  }
  return value as SheetValue;
}

/** Build a workbook from a validated sheet document (`validateSheet` first for untrusted input). */
export function createWorkbook(document: SheetDocument, options: WorkbookOptions = {}): Workbook {
  const sheets: SheetState[] = [];
  const cells = new Map<string, Cell>();
  const graph = new DependencyGraph();
  const passSteps = Math.min(
    EXPRESSION_LIMITS.passSteps,
    options.passSteps !== undefined && options.passSteps > 0 ? options.passSteps : Infinity
  );
  let lastPass: RecalcResult = EMPTY_PASS;
  let sheetCounter = 0;
  const title = document.meta?.title;

  const byId = (id: string) => sheets.find((sheet) => sheet.id === id);
  const byName = (name: string) => {
    const lower = name.toLowerCase();
    return sheets.find((sheet) => sheet.name.toLowerCase() === lower);
  };

  function makeSheet(id: string, name: string, rows: number, columns: number): SheetState {
    const state: SheetState = {
      id,
      name,
      rowIds: [],
      colIds: [],
      rowIndex: new Map(),
      colIndex: new Map(),
      keys: new Set(),
      grid: new Map(),
      nextRow: 1,
      nextCol: 1,
    };
    for (let r = 0; r < rows; r += 1) state.rowIds.push(`r${state.nextRow++}`);
    for (let c = 0; c < columns; c += 1) state.colIds.push(`c${state.nextCol++}`);
    reindex(state);
    return state;
  }

  function reindex(state: SheetState): void {
    state.rowIndex = new Map(state.rowIds.map((id, index) => [id, index]));
    state.colIndex = new Map(state.colIds.map((id, index) => [id, index]));
  }

  function at(sheet: SheetState, row: number, col: number): string | null {
    const rowId = sheet.rowIds[row];
    const colId = sheet.colIds[col];
    return rowId === undefined || colId === undefined ? null : cellKey(sheet.id, rowId, colId);
  }

  function locate(key: string): GraphCell | null {
    const cell = cells.get(key);
    if (!cell) return null;
    const sheet = byId(cell.sheet);
    const row = sheet?.rowIndex.get(cell.rowId);
    const col = sheet?.colIndex.get(cell.colId);
    if (!sheet || row === undefined || col === undefined) return null;
    return { key, sheet: sheet.id, row, col };
  }

  function targetSheet(home: SheetState, ref: CellReference): SheetState | undefined {
    return ref.sheet === null ? home : byName(ref.sheet);
  }

  /** Resolve a formula's references to cell keys and intervals (out-of-sheet ones read #REF!). */
  function dependencies(home: SheetState, formula: SheetFormula): FormulaDependencies {
    const keys: string[] = [];
    for (const ref of formula.refs) {
      const sheet = targetSheet(home, ref);
      if (!sheet || ref.row === null) continue;
      const key = at(sheet, ref.row, ref.col);
      if (key) keys.push(key);
    }
    const ranges: { sheet: string; r1: number; r2: number; c1: number; c2: number }[] = [];
    for (const range of formula.ranges) {
      const sheet = targetSheet(home, range.from);
      if (!sheet) continue;
      const bounds = rangeBounds(sheet, range.from, range.to);
      if (bounds) ranges.push({ sheet: sheet.id, ...bounds });
    }
    return { cells: keys, ranges };
  }

  function rangeBounds(
    sheet: SheetState,
    from: CellReference,
    to: CellReference
  ): { r1: number; r2: number; c1: number; c2: number } | null {
    const rows = sheet.rowIds.length;
    const cols = sheet.colIds.length;
    const r1 = from.row ?? 0;
    const r2 = Math.min(to.row ?? rows - 1, rows - 1);
    const c1 = from.col;
    const c2 = Math.min(to.col, cols - 1);
    if (r1 >= rows || c1 >= cols || r2 < r1 || c2 < c1) return null;
    return { r1, r2, c1, c2 };
  }

  function readCell(sheet: SheetState, row: number, col: number): SheetValue {
    const rowId = sheet.rowIds[row];
    const colId = sheet.colIds[col];
    if (rowId === undefined || colId === undefined) return null;
    return sheet.grid.get(rowId)?.get(colId)?.value ?? null;
  }

  function place(sheet: SheetState, cell: Cell): void {
    cells.set(cell.key, cell);
    sheet.keys.add(cell.key);
    let line = sheet.grid.get(cell.rowId);
    if (!line) {
      line = new Map();
      sheet.grid.set(cell.rowId, line);
    }
    line.set(cell.colId, cell);
  }

  function drop(sheet: SheetState, cell: Cell): void {
    graph.delete(cell.key);
    cells.delete(cell.key);
    sheet.keys.delete(cell.key);
    const line = sheet.grid.get(cell.rowId);
    line?.delete(cell.colId);
    if (line && line.size === 0) sheet.grid.delete(cell.rowId);
  }

  function evaluateCell(cell: Cell, budget: ReturnType<typeof createExpressionBudget>): SheetValue {
    const home = byId(cell.sheet);
    if (!cell.formula || !home) return VALUE;
    const value = evaluateFormula(
      cell.formula,
      {
        ref: (text) => {
          if (text === REF_ERROR) return REF;
          const ref = parseReference(text);
          if (!ref || ref.row === null) return REF;
          const sheet = targetSheet(home, ref);
          if (!sheet || ref.row >= sheet.rowIds.length || ref.col >= sheet.colIds.length)
            return REF;
          return readCell(sheet, ref.row, ref.col);
        },
        range: (fromText, toText) => {
          const from = parseReference(fromText, true);
          const to = parseReference(toText, true);
          if (!from || !to) return REF;
          const sheet = targetSheet(home, from);
          if (!sheet) return REF;
          if (from.row !== null && from.row >= sheet.rowIds.length) return REF;
          if (from.col >= sheet.colIds.length) return REF;
          const bounds = rangeBounds(sheet, from, { ...to, sheet: from.sheet });
          if (!bounds) return REF;
          const count = (bounds.r2 - bounds.r1 + 1) * (bounds.c2 - bounds.c1 + 1);
          if (count > EXPRESSION_LIMITS.listItems) return LIMIT;
          const list: SheetValue[] = [];
          for (let r = bounds.r1; r <= bounds.r2; r += 1) {
            const line = sheet.grid.get(sheet.rowIds[r] as string);
            for (let c = bounds.c1; c <= bounds.c2; c += 1) {
              const value = line ? (line.get(sheet.colIds[c] as string)?.value ?? null) : null;
              if (isExpressionError(value)) return value;
              list.push(value);
            }
          }
          return list;
        },
        ...(options.now ? { now: options.now } : {}),
      },
      { budget }
    );
    return settle(value);
  }

  /** Parse a cell's formula and register its dependencies (or drop them). */
  function bind(cell: Cell): void {
    const home = byId(cell.sheet);
    if (!home || !isFormula(cell.input)) {
      cell.formula = null;
      cell.diagnostics = [];
      graph.delete(cell.key);
      return;
    }
    const parsed = parseFormula(cell.input);
    if (!parsed.ok) {
      cell.formula = null;
      cell.diagnostics = parsed.diagnostics;
      cell.value = expressionError(parsed.error);
      graph.delete(cell.key);
      return;
    }
    cell.formula = parsed.formula;
    cell.diagnostics = [];
    graph.set(cell.key, dependencies(home, parsed.formula));
  }

  function address(key: string): SheetCellAddress | null {
    const where = locate(key);
    return where ? { sheet: where.sheet, row: where.row, col: where.col } : null;
  }

  /** Recalculate from changed cells (all formulas when `changed` is null). */
  function recalc(changed: GraphCell[] | null, touched: SheetCellAddress[] = []): RecalcResult {
    const roots =
      changed ??
      [...cells.values()]
        .filter((cell) => cell.formula !== null || cell.diagnostics.length > 0)
        .map((cell) => locate(cell.key))
        .filter((cell): cell is GraphCell => cell !== null);
    const walk = graph.dirtyOrder(roots, locate, SHEET_LIMITS.passWork);
    const changes: SheetCellAddress[] = [...touched];
    const note = (cell: Cell, value: SheetValue) => {
      if (sameValue(cell.value, value)) return;
      cell.value = value;
      const where = address(cell.key);
      if (where) changes.push(where);
    };
    const budget = createExpressionBudget(passSteps);
    let evaluated = 0;
    if (walk.limited) {
      for (const key of walk.dirty) {
        const cell = cells.get(key);
        if (cell) note(cell, LIMIT);
      }
    } else {
      for (const key of walk.cycles) {
        const cell = cells.get(key);
        if (cell) note(cell, CYCLE);
      }
      for (const key of walk.order) {
        const cell = cells.get(key);
        if (!cell?.formula) continue;
        evaluated += 1;
        note(cell, evaluateCell(cell, budget));
      }
    }
    lastPass = Object.freeze({
      evaluated,
      changed: Object.freeze(changes),
      cycles: walk.cycles.length,
      limited: walk.limited || budget.exhausted,
      steps: budget.used,
    });
    return lastPass;
  }

  /** Write one cell (no recalculation); returns the graph position to walk from. */
  function write(sheet: SheetState, row: number, col: number, input: SheetInput): GraphCell | null {
    const key = at(sheet, row, col);
    if (!key) return null;
    const normalized =
      input === null ||
      input === '' ||
      (typeof input === 'number' && !Number.isFinite(input)) ||
      (typeof input !== 'number' && typeof input !== 'string' && typeof input !== 'boolean')
        ? null
        : input;
    let cell = cells.get(key);
    if (normalized === null) {
      if (cell) drop(sheet, cell);
      return { key, sheet: sheet.id, row, col };
    }
    if (!cell) {
      cell = {
        key,
        sheet: sheet.id,
        rowId: sheet.rowIds[row] as string,
        colId: sheet.colIds[col] as string,
        input: normalized,
        formula: null,
        diagnostics: [],
        value: null,
      };
      place(sheet, cell);
    }
    cell.input = normalized;
    bind(cell);
    if (!cell.formula && cell.diagnostics.length === 0) cell.value = literalValue(normalized);
    return { key, sheet: sheet.id, row, col };
  }

  function setInputs(edits: readonly CellEdit[]): RecalcResult {
    const roots: GraphCell[] = [];
    const touched: SheetCellAddress[] = [];
    for (const edit of edits) {
      const sheet = byId(edit.sheet);
      if (!sheet || !Number.isInteger(edit.row) || !Number.isInteger(edit.col)) continue;
      const key = at(sheet, edit.row, edit.col);
      if (!key) continue;
      const before = cells.get(key)?.value ?? null;
      const root = write(sheet, edit.row, edit.col, edit.input);
      if (!root) continue;
      roots.push(root);
      if (!sameValue(before, cells.get(key)?.value ?? null)) {
        touched.push({ sheet: sheet.id, row: edit.row, col: edit.col });
      }
    }
    if (roots.length === 0) return EMPTY_PASS;
    return recalc(roots, touched);
  }

  /** Rewrite the references of every formula with a visitor per home sheet. */
  function rewriteAll(visitorFor: (home: SheetState) => ReferenceVisitor | null): void {
    for (const cell of cells.values()) {
      if (!isFormula(cell.input)) continue;
      const home = byId(cell.sheet);
      const visit = home ? visitorFor(home) : null;
      if (!visit) continue;
      const next = rewriteFormula(cell.input, visit);
      if (next !== null && next !== cell.input) cell.input = next;
    }
  }

  function restructure(visitorFor: (home: SheetState) => ReferenceVisitor | null): RecalcResult {
    rewriteAll(visitorFor);
    return rebuild();
  }

  function rebuild(): RecalcResult {
    graph.clear();
    for (const sheet of sheets) reindex(sheet);
    for (const cell of cells.values()) bind(cell);
    return recalc(null);
  }

  /** A visitor that maps references on one sheet through a row or column mapping. */
  function shiftVisitor(
    target: SheetState,
    axis: 'row' | 'col',
    map: (index: number) => number | null,
    clampRange: (a: number, b: number) => [number, number] | null
  ): (home: SheetState) => ReferenceVisitor {
    return (home) => (ref: ReferenceTarget) => {
      const sheetOf = (r: CellReference) => (r.sheet === null ? home : byName(r.sheet));
      if (ref.kind === 'cell') {
        if (sheetOf(ref.ref) !== target) return undefined;
        const index = axis === 'row' ? ref.ref.row : ref.ref.col;
        if (index === null) return undefined;
        const next = map(index);
        if (next === null) return null;
        if (next === index) return undefined;
        return { kind: 'cell', ref: { ...ref.ref, [axis]: next } };
      }
      if (sheetOf(ref.from) !== target) return undefined;
      const a = axis === 'row' ? ref.from.row : ref.from.col;
      const b = axis === 'row' ? ref.to.row : ref.to.col;
      if (a === null || b === null) return undefined; // whole columns span every row
      const lo = Math.min(a, b);
      const hi = Math.max(a, b);
      const next = clampRange(lo, hi);
      if (next === null) return null;
      if (next[0] === lo && next[1] === hi) return undefined;
      return {
        kind: 'range',
        from: { ...ref.from, [axis]: next[0] },
        to: { ...ref.to, [axis]: next[1] },
      };
    };
  }

  function insert(
    axis: 'row' | 'col',
    sheetId: string,
    index: number,
    count: number
  ): RecalcResult {
    const sheet = byId(sheetId);
    const ids = axis === 'row' ? sheet?.rowIds : sheet?.colIds;
    const cap = axis === 'row' ? SHEET_LIMITS.rows : SHEET_LIMITS.columns;
    const n = Math.trunc(count);
    if (!sheet || !ids || !Number.isInteger(index) || index < 0 || index > ids.length)
      return EMPTY_PASS;
    if (!(n >= 1) || ids.length + n > cap) return EMPTY_PASS;
    const added: string[] = [];
    for (let i = 0; i < n; i += 1) {
      added.push(axis === 'row' ? `r${sheet.nextRow++}` : `c${sheet.nextCol++}`);
    }
    ids.splice(index, 0, ...added);
    return restructure(
      shiftVisitor(
        sheet,
        axis,
        (i) => (i >= index ? i + n : i),
        (lo, hi) => [lo >= index ? lo + n : lo, hi >= index ? hi + n : hi]
      )
    );
  }

  function remove(
    axis: 'row' | 'col',
    sheetId: string,
    index: number,
    count: number
  ): RecalcResult {
    const sheet = byId(sheetId);
    const ids = axis === 'row' ? sheet?.rowIds : sheet?.colIds;
    if (!sheet || !ids || !Number.isInteger(index) || index < 0 || index >= ids.length)
      return EMPTY_PASS;
    const n = Math.min(Math.trunc(count), ids.length - index);
    if (!(n >= 1) || n >= ids.length) return EMPTY_PASS; // a sheet keeps one row and column
    const end = index + n;
    const gone = new Set(ids.slice(index, end));
    for (const key of [...sheet.keys]) {
      const cell = cells.get(key);
      if (cell && gone.has(axis === 'row' ? cell.rowId : cell.colId)) drop(sheet, cell);
    }
    ids.splice(index, n);
    return restructure(
      shiftVisitor(
        sheet,
        axis,
        (i) => (i < index ? i : i < end ? null : i - n),
        (lo, hi) => {
          if (lo >= index && hi < end) return null;
          const a = lo < index ? lo : lo < end ? index : lo - n;
          const b = hi < index ? hi : hi < end ? index - 1 : hi - n;
          return b < a ? null : [a, b];
        }
      )
    );
  }

  // ── Load ──────────────────────────────────────────────────
  for (const tab of document.sheets as readonly SheetTab[]) {
    if (sheets.length >= SHEET_LIMITS.sheets || !SHEET_ID.test(tab.id) || byId(tab.id)) continue;
    const rows = Math.min(SHEET_LIMITS.rows, Math.max(1, Math.trunc(tab.rows)));
    const columns = Math.min(SHEET_LIMITS.columns, Math.max(1, Math.trunc(tab.columns)));
    sheets.push(makeSheet(tab.id, tab.name, rows, columns));
    sheetCounter += 1;
  }
  let loaded = 0;
  for (const tab of document.sheets) {
    const sheet = byId(tab.id);
    if (!sheet) continue;
    for (const [key, input] of Object.entries(tab.cells ?? {})) {
      if (loaded >= SHEET_LIMITS.cells) break;
      const where = parseCellAddress(key);
      if (!where) continue;
      if (write(sheet, where.row, where.col, input)) loaded += 1;
    }
  }
  recalc(null);

  const view = (sheet: SheetState): WorkbookSheet => ({
    id: sheet.id,
    name: sheet.name,
    rowIds: sheet.rowIds,
    columnIds: sheet.colIds,
  });

  return {
    get sheets() {
      return sheets.map(view);
    },
    get title() {
      return title;
    },
    get lastPass() {
      return lastPass;
    },
    sheet(id) {
      const sheet = byId(id);
      return sheet ? view(sheet) : undefined;
    },
    value(sheetId, row, col) {
      const sheet = byId(sheetId);
      return sheet ? readCell(sheet, row, col) : null;
    },
    input(sheetId, row, col) {
      const sheet = byId(sheetId);
      const key = sheet ? at(sheet, row, col) : null;
      return key ? (cells.get(key)?.input ?? null) : null;
    },
    diagnostics(sheetId, row, col) {
      const sheet = byId(sheetId);
      const key = sheet ? at(sheet, row, col) : null;
      return key ? (cells.get(key)?.diagnostics ?? []) : [];
    },
    setInput(sheet, row, col, input) {
      return setInputs([{ sheet, row, col, input }]);
    },
    setInputs,
    insertRows: (sheet, index, count = 1) => insert('row', sheet, index, count),
    deleteRows: (sheet, index, count = 1) => remove('row', sheet, index, count),
    insertColumns: (sheet, index, count = 1) => insert('col', sheet, index, count),
    deleteColumns: (sheet, index, count = 1) => remove('col', sheet, index, count),
    renameSheet(sheetId, name) {
      const sheet = byId(sheetId);
      if (!sheet || !isSheetName(name)) return EMPTY_PASS;
      const clash = byName(name);
      if (clash && clash !== sheet) return EMPTY_PASS;
      const old = sheet.name;
      const visitor: ReferenceVisitor = (ref) => {
        const r = ref.kind === 'cell' ? ref.ref : ref.from;
        if (r.sheet === null || r.sheet.toLowerCase() !== old.toLowerCase()) return undefined;
        return ref.kind === 'cell'
          ? { kind: 'cell', ref: { ...ref.ref, sheet: name } }
          : { kind: 'range', from: { ...ref.from, sheet: name }, to: { ...ref.to, sheet: name } };
      };
      // Rewrite with the old name still in place, then rename.
      rewriteAll(() => visitor);
      sheet.name = name;
      return rebuild();
    },
    addSheet(name, rows = 100, columns = 26) {
      if (sheets.length >= SHEET_LIMITS.sheets || !isSheetName(name) || byName(name)) return '';
      let id = `sheet${++sheetCounter}`;
      while (byId(id)) id = `sheet${++sheetCounter}`;
      sheets.push(
        makeSheet(
          id,
          name,
          Math.min(SHEET_LIMITS.rows, Math.max(1, Math.trunc(rows))),
          Math.min(SHEET_LIMITS.columns, Math.max(1, Math.trunc(columns)))
        )
      );
      // Formulas that already named this sheet now resolve.
      rebuild();
      return id;
    },
    removeSheet(sheetId) {
      const sheet = byId(sheetId);
      if (!sheet || sheets.length === 1) return EMPTY_PASS;
      for (const key of sheet.keys) cells.delete(key);
      const lower = sheet.name.toLowerCase();
      rewriteAll(() => (ref) => {
        const r = ref.kind === 'cell' ? ref.ref : ref.from;
        return r.sheet !== null && r.sheet.toLowerCase() === lower ? null : undefined;
      });
      sheets.splice(sheets.indexOf(sheet), 1);
      return rebuild();
    },
    recalculate: () => recalc(null),
    toDocument() {
      const tabs: SheetTab[] = sheets.map((sheet) => {
        const entries: { row: number; col: number; input: SheetInput }[] = [];
        for (const key of sheet.keys) {
          const cell = cells.get(key);
          const row = cell ? sheet.rowIndex.get(cell.rowId) : undefined;
          const col = cell ? sheet.colIndex.get(cell.colId) : undefined;
          if (cell && row !== undefined && col !== undefined)
            entries.push({ row, col, input: cell.input });
        }
        entries.sort((a, b) => a.row - b.row || a.col - b.col);
        const out: Record<string, SheetInput> = {};
        for (const entry of entries) out[cellAddress(entry.row, entry.col)] = entry.input;
        return {
          id: sheet.id,
          name: sheet.name,
          rows: sheet.rowIds.length,
          columns: sheet.colIds.length,
          cells: out,
        };
      });
      return {
        format: 'texuli-sheet',
        formatVersion: 1,
        ...(title !== undefined ? { meta: { title } } : {}),
        sheets: tabs,
      };
    },
  };
}
