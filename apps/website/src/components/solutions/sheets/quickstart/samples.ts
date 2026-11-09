import type { SolutionEntry } from '../../../../data/solutions/schema.ts';
import type { SolutionQuickstartProps } from '../../shared/types.ts';

export const SHEETS_QUICKSTART_VERIFIED_BY =
  'apps/website/tests/solutions/sheets-quickstart.test.ts';

export const SHEETS_INSTALL = 'pnpm add @texuli/sheets';

/** JSON passed to `loadUntrustedSheet` from `@texuli/sheets/model`. */
export const SHEETS_JSON = {
  format: 'texuli-sheet',
  formatVersion: 1,
  meta: { title: 'Office budget' },
  sheets: [
    {
      id: 'costs',
      name: 'Costs',
      rows: 20,
      columns: 4,
      cells: { A1: 'Desk', B1: 120, A2: 'Chair', B2: 80, B3: '=SUM(B1:B2)' },
    },
  ],
} as const;

export const SHEETS_CSV = 'item,amount\nDesk,120\nChair,80';

export const SHEETS_FORMULA_SAMPLE = `import { createWorkbook, displayValue, loadUntrustedSheet } from '@texuli/sheets/model';

const loaded = loadUntrustedSheet(${JSON.stringify(JSON.stringify(SHEETS_JSON))});
if (loaded.ok) {
  const workbook = createWorkbook(loaded.sheet, { now: () => Date.now() });
  console.log(displayValue(workbook.value('costs', 2, 1)));
}
`;

export const SHEETS_CSV_SAMPLE = `import { csvToSheet } from '@texuli/sheets/csv';

const imported = csvToSheet(${JSON.stringify(SHEETS_CSV)}, { name: 'Orders' });
if (imported.ok) {
  console.log(imported.sheet.sheets[0]?.name);
}
`;

export const SHEETS_VIEW_SAMPLE = `<script lang="ts">
  import { loadUntrustedSheet } from '@texuli/sheets/model';
  import { SheetView } from '@texuli/sheets/view';
  import '@texuli/tokens/base.css';

  const loaded = loadUntrustedSheet(${JSON.stringify(JSON.stringify(SHEETS_JSON))});
  let sheet = $state(loaded.ok ? loaded.sheet : null);
</script>

{#if sheet}
  <SheetView bind:sheet now={() => Date.now()} />
{/if}
`;

export function sheetsQuickstart(entry: SolutionEntry): SolutionQuickstartProps {
  return {
    entry,
    title: 'Start with a sheet',
    install: { label: 'Install', language: 'bash', code: SHEETS_INSTALL },
    samples: [
      { label: 'Evaluate a formula', language: 'ts', code: SHEETS_FORMULA_SAMPLE },
      { label: 'Import CSV', language: 'ts', code: SHEETS_CSV_SAMPLE },
      { label: 'Edit with SheetView', language: 'svelte', code: SHEETS_VIEW_SAMPLE },
    ],
    verifiedBy: SHEETS_QUICKSTART_VERIFIED_BY,
  };
}
