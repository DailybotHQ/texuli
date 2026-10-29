import { defineExample } from '../registry.ts';

export const sheetsBudgetExample = defineExample({
  id: 'sheets-budget',
  title: 'Spreadsheet',
  description:
    'A two-tab budget with formulas (SUM, SUMIF, IF and a cross-sheet reference) that recalculate as cells change, a formula bar and keyboard editing on the data grid.',
  tags: ['sheets', 'spreadsheet', 'formulas', 'grid'],
  component: 'sheets/SheetView',
  props: ['sheet', 'activeSheet', 'readonly', 'label', 'onchange', 'now', 'formulaBar', 'labels'],
  load: () => import('./SheetsBudgetDemo.svelte'),
});
