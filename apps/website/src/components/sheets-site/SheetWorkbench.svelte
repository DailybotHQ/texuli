<script lang="ts">
/**
 * /sheets-page/ live workbook: `SheetView` (tabs, formula bar, the data
 * grid's keyboard model) over the order log, and beside it a panel that
 * lists every formula with its value and marks the ones the last edit
 * changed. The panel runs its own workbook from the same engine and
 * applies the same edits (`setInputs`), so the counts are the engine's own
 * `RecalcResult`. The structural buttons insert and delete rows through
 * the workbook, which rewrites the references, then hand the new document
 * to the view.
 */
import { cellAddress } from '@texuli/sheets/formula';
import {
  type CellEdit,
  createWorkbook,
  displayValue,
  inputText,
  isFormula,
  type RecalcResult,
  type SheetDocument,
  type SheetInput,
  validateSheet,
  type Workbook,
} from '@texuli/sheets/model';
import { SheetView } from '@texuli/sheets/view';
import { ORDERS_WORKBOOK } from './workbook.ts';

const now = () => Date.now();

function fresh(): Workbook {
  const checked = validateSheet(ORDERS_WORKBOOK);
  if (!checked.ok) throw new Error('The order log did not validate.');
  return createWorkbook(checked.sheet, { now });
}

let mirror = fresh();
let sheet = $state.raw<SheetDocument>(mirror.toDocument());
let activeSheet = $state('orders');
let last = $state.raw<RecalcResult | null>(null);
let lastWhat = $state('No edit yet: every formula was evaluated once when the workbook loaded.');
let version = $state(0);

interface FormulaRow {
  readonly key: string;
  readonly sheet: string;
  readonly address: string;
  readonly formula: string;
  readonly value: string;
  readonly changed: boolean;
}

const formulas = $derived.by((): FormulaRow[] => {
  void version;
  const changed = new Set(
    (last?.changed ?? []).map((cell) => `${cell.sheet}!${cell.row}:${cell.col}`)
  );
  const out: FormulaRow[] = [];
  for (const tab of mirror.sheets) {
    for (let row = 0; row < tab.rowIds.length; row += 1) {
      for (let col = 0; col < tab.columnIds.length; col += 1) {
        const input = mirror.input(tab.id, row, col);
        if (!isFormula(input)) continue;
        out.push({
          key: `${tab.id}!${row}:${col}`,
          sheet: tab.name,
          address: cellAddress(row, col),
          formula: inputText(input),
          value: displayValue(mirror.value(tab.id, row, col)),
          changed: changed.has(`${tab.id}!${row}:${col}`),
        });
      }
    }
  }
  return out;
});

/** The cells two documents disagree on, as workbook edits (same sheets, same sizes). */
function diff(before: SheetDocument, after: SheetDocument): CellEdit[] {
  const edits: CellEdit[] = [];
  for (const tab of after.sheets) {
    const old = before.sheets.find((candidate) => candidate.id === tab.id);
    if (!old) continue;
    const oldCells = old.cells ?? {};
    const newCells = tab.cells ?? {};
    const keys = new Set([...Object.keys(oldCells), ...Object.keys(newCells)]);
    for (const key of keys) {
      const next: SheetInput = newCells[key] ?? null;
      const prev: SheetInput = oldCells[key] ?? null;
      if (next === prev) continue;
      const match = /^([A-Z]+)(\d+)$/.exec(key);
      if (!match) continue;
      const letters = match[1] ?? 'A';
      let col = 0;
      for (const letter of letters) col = col * 26 + (letter.charCodeAt(0) - 64);
      edits.push({ sheet: tab.id, row: Number(match[2]) - 1, col: col - 1, input: next });
    }
  }
  return edits;
}

function describe(result: RecalcResult, what: string): void {
  last = result;
  const total = formulas.length;
  lastWhat = `${what}: ${result.evaluated} of ${total} formulas evaluated, ${result.changed.length} cells changed, ${result.steps} evaluation steps${result.cycles > 0 ? `, ${result.cycles} cells in a cycle` : ''}.`;
  version += 1;
}

function onchange(next: SheetDocument): void {
  const before = mirror.toDocument();
  const edits = diff(before, next);
  if (edits.length === 0) return;
  const result = mirror.setInputs(edits);
  const names = edits
    .map(
      (edit) => `${mirror.sheet(edit.sheet)?.name ?? edit.sheet}!${cellAddress(edit.row, edit.col)}`
    )
    .join(', ');
  describe(result, `Edited ${names}`);
}

function structural(kind: 'insert' | 'delete' | 'reset'): void {
  if (kind === 'reset') {
    mirror = fresh();
    last = null;
    lastWhat = 'Reset: the original order log.';
    version += 1;
  } else if (kind === 'insert') {
    describe(mirror.insertRows('orders', 4, 2), 'Inserted two rows above Orders row 5');
  } else {
    describe(mirror.deleteRows('orders', 2, 1), 'Deleted Orders row 3');
  }
  sheet = mirror.toDocument();
}
</script>

<div class="workbench" data-sheets-workbench="">
  <div class="workbench__sheet">
    <SheetView bind:sheet bind:activeSheet {now} {onchange} label="Harbor order log" />
    <div class="workbench__bar" role="group" aria-label="Structural edits">
      <button type="button" class="workbench__button" onclick={() => structural('insert')}
        >Insert two rows above row 5</button
      >
      <button type="button" class="workbench__button" onclick={() => structural('delete')}
        >Delete row 3</button
      >
      <button type="button" class="workbench__button" onclick={() => structural('reset')}>Reset</button>
    </div>
  </div>
  <div class="workbench__side">
    <h3 class="workbench__title">What the last change recalculated</h3>
    <p class="workbench__status" role="status" data-sheets-recalc="">{lastWhat}</p>
    <div class="workbench__list" role="region" aria-label="Every formula in the workbook" tabindex="0">
      <table class="workbench__table">
        <caption>{formulas.length} formulas</caption>
        <thead>
          <tr>
            <th scope="col">Cell</th>
            <th scope="col">Formula</th>
            <th scope="col">Value</th>
          </tr>
        </thead>
        <tbody>
          {#each formulas as row (row.key)}
            <tr data-sheets-formula={`${row.sheet}!${row.address}`} data-changed={row.changed ? 'true' : 'false'}>
              <th scope="row">
                {row.sheet}!{row.address}
                {#if row.changed}<span class="workbench__badge">recalculated</span>{/if}
              </th>
              <td><code>{row.formula}</code></td>
              <td data-sheets-value="">{row.value}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>
</div>

<style>
  .workbench {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 24rem), 1fr));
    gap: 1rem;
    align-items: start;
    min-inline-size: 0;
  }
  .workbench__sheet,
  .workbench__side {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 0.6rem;
    min-inline-size: 0;
  }
  .workbench__bar {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .workbench__button {
    min-block-size: 2.25rem;
    padding-inline: 0.8rem;
    border: 1px solid var(--tx-border, ButtonBorder);
    border-radius: 0.5rem;
    background: var(--tx-background, ButtonFace);
    color: var(--tx-foreground, ButtonText);
    font: inherit;
    cursor: pointer;
  }
  .workbench__button:focus-visible,
  .workbench__list:focus-visible {
    outline: 2px solid var(--tx-ring, Highlight);
    outline-offset: 2px;
  }
  .workbench__title {
    margin: 0;
    font-size: 1rem;
  }
  .workbench__status {
    margin: 0;
    font-size: 0.875rem;
  }
  .workbench__list {
    max-block-size: 26rem;
    overflow: auto;
    border: 1px solid var(--tx-border, CanvasText);
    border-radius: 0.75rem;
  }
  .workbench__table {
    inline-size: 100%;
    border-collapse: collapse;
    font-size: 0.8125rem;
  }
  .workbench__table caption {
    padding: 0.4rem 0.6rem;
    text-align: start;
    font-weight: 600;
  }
  .workbench__table th,
  .workbench__table td {
    padding: 0.35rem 0.6rem;
    border-block-start: 1px solid var(--tx-border, CanvasText);
    text-align: start;
    vertical-align: top;
  }
  .workbench__table code {
    overflow-wrap: anywhere;
  }
  tr[data-changed='true'] {
    background: var(--tx-success-soft, Canvas);
    color: var(--tx-success-soft-foreground, CanvasText);
  }
  .workbench__badge {
    display: inline-block;
    margin-inline-start: 0.35rem;
    padding-inline: 0.35rem;
    border: 1px solid currentColor;
    border-radius: 0.3rem;
    font-size: 0.6875rem;
    font-weight: 600;
  }
  @media (forced-colors: active) {
    tr[data-changed='true'] {
      outline: 2px solid Highlight;
      outline-offset: -2px;
    }
  }
</style>
