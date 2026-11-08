import type { SheetDocument } from '@texuli/sheets/model';

/** Deterministic, fictional project budget with live row and grand totals. */
export function createProjectBudgetFixture(): SheetDocument {
  return {
    format: 'texuli-sheet',
    formatVersion: 1,
    meta: { title: 'Project budget' },
    sheets: [
      {
        id: 'budget',
        name: 'Budget',
        rows: 8,
        columns: 4,
        cells: {
          A1: 'Work item',
          B1: 'Quantity',
          C1: 'Unit price',
          D1: 'Total',
          A2: 'Design workshop',
          B2: 3,
          C2: 120,
          D2: '=B2*C2',
          A3: 'Prototype materials',
          B3: 8,
          C3: 24.5,
          D3: '=B3*C3',
          A4: 'User interviews',
          B4: 5,
          C4: 42,
          D4: '=B4*C4',
          A5: 'Project total',
          D5: '=SUM(D2:D4)',
        },
      },
    ],
  };
}
