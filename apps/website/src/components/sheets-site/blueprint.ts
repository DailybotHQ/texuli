/**
 * Spreadsheets as agent data on /sheets-page/ (spec 0.8.0): a blueprint
 * whose `spreadsheet` node carries a whole workbook, and a hostile copy
 * with a formula outside the language (`INDIRECT` builds a reference from
 * text), which the sheet check refuses before anything paints. Fictional
 * data only. Checked by apps/website/tests/site-sheets.test.ts.
 */

/** The spec version that admits `spreadsheet` nodes. */
export const SHEETS_SPEC = '0.8.0';

const CATALOG_PIN = '0'.repeat(64);

export const AGENT_SHEET = {
  format: 'texuli-sheet',
  formatVersion: 1,
  meta: { title: 'Team offsite budget' },
  sheets: [
    {
      id: 'costs',
      name: 'Costs',
      rows: 9,
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
        A5: 'Train tickets',
        B5: 42,
        C5: 12,
        D5: '=B5*C5',
        A7: 'Total',
        D7: '=SUM(D2:D5)',
        A8: 'Over budget?',
        D8: '=IF(D7 > Limits!B1, "yes", "no")',
      },
    },
    {
      id: 'limits',
      name: 'Limits',
      rows: 3,
      columns: 2,
      cells: { A1: 'Budget', B1: 2500 },
    },
  ],
};

/** The same workbook with one formula that builds a reference from text. */
export const HOSTILE_SHEET = {
  ...AGENT_SHEET,
  sheets: [
    {
      ...AGENT_SHEET.sheets[0],
      cells: { ...AGENT_SHEET.sheets[0]?.cells, D7: '=SUM(INDIRECT("D2:D" & C2))' },
    },
    AGENT_SHEET.sheets[1],
  ],
};

export function sheetEnvelope(sheet: unknown): Record<string, unknown> {
  return {
    format: 'texuli-blueprint',
    version: 1,
    spec: SHEETS_SPEC,
    id: 'offsite-budget',
    catalog: CATALOG_PIN,
    status: 'draft',
    createdAt: '2026-10-29T09:00:00Z',
    updatedAt: '2026-10-29T09:00:00Z',
    generator: { kind: 'agent', name: 'Harbor assistant', model: 'example-model' },
    tier: 'untrusted',
    profile: 'web',
    tree: {
      id: 'layout-page',
      props: { title: 'Offsite budget', description: 'Drafted by the assistant from the chat.' },
      children: [
        { id: 'spreadsheet', key: 'budget', props: { label: 'Offsite budget sheet', sheet } },
      ],
    },
  };
}

export const AGENT_SHEET_BLUEPRINT = sheetEnvelope(AGENT_SHEET);
export const HOSTILE_SHEET_BLUEPRINT = sheetEnvelope(HOSTILE_SHEET);
export const AGENT_SHEET_JSON = JSON.stringify(AGENT_SHEET_BLUEPRINT, null, 2);
export const HOSTILE_CELL_JSON = JSON.stringify({ D7: HOSTILE_SHEET.sheets[0]?.cells.D7 }, null, 2);
