/**
 * Catalog manifest for sheets as data (spec 0.8.0, ADR-012, ADR-015): one
 * `spreadsheet` id whose `sheet` prop carries a Texuli sheet (the
 * `@texuli/sheets` format: tabs of A1-addressed inputs, where text that
 * starts with `=` is a formula in the closed sheet grammar). `validateDraft`
 * refuses a `spreadsheet` node unless the host supplies the sheet validator
 * (`checkSheet`, usually `checkSheetDraft` from `@texuli/sheets/model`), so
 * every agent formula is parsed at draft time. Painting `spreadsheet` nodes in
 * `@texuli/player` (a sheet host) is planned. Build-time only; a subpath
 * group the catalog root does not re-export.
 */
import { manifestData } from '../../manifest/data.ts';
import type { CatalogManifest } from '../../manifest/types.ts';
import type { GrammarComponentMeta } from '../../render/grammar/types.ts';

/**
 * The catalog id of a spreadsheet (spec 0.8.0). Not `sheet`: that id is the
 * texuli `Sheet` overlay (a drawer).
 */
export const SPREADSHEET_CATALOG_ID = 'spreadsheet' as const;

export const spreadsheetManifest: CatalogManifest = /* @__PURE__ */ manifestData({
  id: SPREADSHEET_CATALOG_ID,
  package: '@texuli/sheets',
  label: 'Spreadsheet',
  summary:
    'A spreadsheet as data: tabs of cells holding numbers, text, booleans and formulas that recalculate.',
  tier: 'content',
  agentEmittable: true,
  useWhen: [
    'A budget, an estimate, a price list or a tracker whose totals people keep editing',
    'Numbers that depend on other numbers through formulas (SUM, IF, VLOOKUP, DATE…)',
  ],
  dontUseWhen: [
    'Read-only records with typed columns, sorting and search: use data-grid',
    'A chart of values: use a chart family',
    'A form people fill in once: use schema-form',
  ],
  a11y: [
    'Painted as an APG grid with column letters, row numbers and one tab stop',
    'Values are text, never HTML; formulas are a closed language with no references built from text and no network',
    'A formula error shows its code in the cell (#DIV/0!, #REF!, #CYCLE!…)',
  ],
  props: [
    {
      name: 'sheet',
      kind: 'object',
      required: true,
      description:
        'A Texuli sheet: { format: "texuli-sheet", formatVersion: 1, meta: { title }, sheets: [{ id, name, rows, columns, cells }] }. cells maps A1 addresses ("B3") to a number, a boolean, text, or a formula that starts with "=" ("=SUM(B1:B2)", "=IF(C2>100, \\"high\\", \\"low\\")", "=Rates!A1*B2"). About 50 functions: SUM, AVERAGE, MIN, MAX, COUNT, COUNTA, ROUND, SUMIF, COUNTIF, IF, IFS, AND, OR, IFERROR, CONCAT, LEFT, TEXT, INDEX, MATCH, VLOOKUP, XLOOKUP, DATE, TODAY and more. No INDIRECT, OFFSET or RAND. Dates are "YYYY-MM-DD" text. Text that must start with "=" is written "\'=…". At most 16 sheets, 10,000 rows, 256 columns and 100,000 cells.',
      schema: { $ref: '#/$defs/sheet' },
    },
    {
      name: 'label',
      kind: 'string',
      trust: 'untrusted',
      description: 'Accessible name; defaults to the sheet title.',
    },
  ],
  examples: [
    {
      id: 'budget',
      title: 'Team offsite budget',
      props: {
        sheet: {
          format: 'texuli-sheet',
          formatVersion: 1,
          meta: { title: 'Team offsite budget' },
          sheets: [
            {
              id: 'costs',
              name: 'Costs',
              rows: 8,
              columns: 4,
              cells: {
                A1: 'Item',
                B1: 'Unit cost',
                C1: 'Quantity',
                D1: 'Total',
                A2: 'Venue',
                B2: 1200,
                C2: 1,
                D2: '=B2*C2',
                A3: 'Lunch',
                B3: 18.5,
                C3: 24,
                D3: '=B3*C3',
                A4: 'Coffee',
                B4: 3.25,
                C4: 48,
                D4: '=B4*C4',
                A6: 'Total',
                D6: '=SUM(D2:D4)',
                A7: 'Over budget?',
                D7: '=IF(D6>2000, "yes", "no")',
              },
            },
          ],
        },
      },
    },
  ],
  related: ['data-grid', 'document'],
});

export const SPREADSHEET_MANIFESTS: readonly CatalogManifest[] = /* @__PURE__ */ Object.freeze([
  spreadsheetManifest,
]);

/** A spreadsheet is a static figure; its cells stay inside it. */
export const SPREADSHEET_GRAMMAR_ROLES: readonly GrammarComponentMeta[] =
  /* @__PURE__ */ Object.freeze([{ id: SPREADSHEET_CATALOG_ID, role: 'static' }]);
