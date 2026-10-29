/**
 * Static copy for /sheets-page/: the status, the pieces of `@texuli/sheets`,
 * the sections, the keyboard table, the rules and the docs. Plain data, so
 * the page and its tests share one source (labels are text, never HTML).
 */

/** The release `@texuli/sheets` is planned for. It is not on npm. */
export const SHEETS_RELEASE = '0.8.0';

export const SHEETS_STATUS = `In development, coming in ${SHEETS_RELEASE}: not published to npm yet.`;

export const SHEETS_PIECES: readonly { readonly name: string; readonly role: string }[] = [
  { name: 'sheets/formula', role: 'parser, functions, criteria' },
  { name: 'sheets/model', role: 'format, validation, graph, workbook' },
  { name: 'sheets/csv', role: 'import and export' },
  { name: 'sheets/view', role: 'SheetView: grid, tabs, formula bar' },
  { name: 'sheets/host', role: 'agent sheets in the player' },
];

export interface SheetsSection {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
}

export const SHEETS_SECTIONS: readonly SheetsSection[] = [
  {
    id: 'workbook',
    title: 'A live workbook',
    summary:
      'An order log and a summary tab that reads it through cross-sheet references. Move with the arrow keys, press Enter or F2 to edit, type a number or a formula, and press Enter. The formula bar shows the focused cell and what was typed; beside the grid, every formula of the workbook shows whether your last edit recalculated it.',
  },
  {
    id: 'functions',
    title: 'Every function, evaluated',
    summary:
      'The function set is closed: these are all of them, read from the package and each evaluated by the engine on the order log below. Pick one in the lab, change its formula and see the result.',
  },
  {
    id: 'recalc',
    title: 'Incremental recalculation',
    summary:
      'Formulas sit in a dependency graph keyed by stable cell ids: a single reference is one edge, a range one interval per column. An edit evaluates only the formulas that depend on it, in dependency order, and the structural edits rewrite references as rows come and go.',
  },
  {
    id: 'safety',
    title: 'Cycles, limits and refused formulas',
    summary:
      'Every case below was evaluated by the real validator and engine when this page was built. Cycles show #CYCLE!, overruns #LIMIT!, and anything that would build a reference from text or reach the host does not exist in the language.',
  },
  {
    id: 'csv',
    title: 'CSV in and out',
    summary:
      'CSV from elsewhere is untrusted: on import a field that starts with = stays text unless you opt in, and even then it must pass the sheet grammar. On export, text a spreadsheet would run as a formula is written with a leading apostrophe.',
  },
  {
    id: 'agents',
    title: 'Spreadsheets as agent data',
    summary:
      'An agent sends a whole workbook as one spreadsheet node of a blueprint (spec 0.8.0). The player checks every formula through the sheet host of @texuli/sheets/host at the untrusted tier and paints a read-only SheetView. A workbook with a formula outside the language is refused before anything paints.',
  },
  {
    id: 'in-code',
    title: 'In code',
    summary:
      'Validate anything from outside first, then hand it to the view, the engine or the player. The formula, model and CSV subpaths import no Svelte and no DOM.',
  },
];

export interface SheetKey {
  readonly keys: string;
  readonly does: string;
}

/** The keyboard model of packages/sheets/docs/view.md. */
export const SHEET_KEYS: readonly SheetKey[] = [
  { keys: 'Tab', does: 'Enter or leave the grid (one tab stop)' },
  { keys: 'Arrow keys', does: 'Move one cell' },
  { keys: 'Home, End', does: 'First or last cell of the row' },
  { keys: 'Page Up, Page Down', does: 'Move a page of rows' },
  { keys: 'Enter or F2', does: 'Edit the cell: the editor opens on what was typed' },
  { keys: 'Escape', does: 'Cancel the edit' },
  { keys: 'Ctrl/Cmd+Z, Ctrl/Cmd+Y', does: 'Undo, redo' },
  { keys: 'Ctrl/Cmd+C, Ctrl/Cmd+V', does: 'Copy and paste blocks as tab-separated text' },
];

export const SHEETS_RULES: readonly { readonly title: string; readonly body: string }[] = [
  {
    title: 'A closed language',
    body: 'No INDIRECT, OFFSET, LAMBDA, RAND or anything that builds a reference from text. Every dependency is visible in the parsed tree, so the graph is static and the bounds hold.',
  },
  {
    title: 'Bounded evaluation',
    body: 'Per-formula and per-pass step budgets, a graph work cap, 10,000-item ranges and 32,768-character strings. An overrun is #LIMIT!; nothing throws or hangs.',
  },
  {
    title: 'Validated in linear time',
    body: 'Unknown members, sizes past the caps, control and bidi characters in text and formulas that do not parse are refused with a JSON path before a workbook is built.',
  },
  {
    title: 'Values are text',
    body: 'Cells paint their values as text; there is no HTML sink. Only TODAY and NOW read the clock, and only the one the host passes.',
  },
];

export const SHEETS_DOCS: readonly { readonly label: string; readonly path: string }[] = [
  { label: '@texuli/sheets', path: 'packages/sheets/README.md' },
  { label: 'Formulas and functions', path: 'packages/sheets/docs/formula.md' },
  { label: 'Workbook model', path: 'packages/sheets/docs/model.md' },
  { label: 'CSV', path: 'packages/sheets/docs/csv.md' },
  { label: 'Sheet view', path: 'packages/sheets/docs/view.md' },
  { label: 'Player host', path: 'packages/sheets/docs/host.md' },
];
