<script lang="ts">
/**
 * /sheets-page/ CSV lab: the CSV below (with fields a spreadsheet would
 * run as formulas) goes through `csvToSheet` from `@texuli/sheets/csv`:
 * formulas stay text unless "Import formulas" is on, and then they must
 * pass the sheet grammar. Export is `sheetToCsv`, which writes risky text
 * with a leading apostrophe (`isRiskyCsvText` marks those cells). The
 * download is a Blob this island creates; nothing is uploaded.
 */
import { csvToSheet, isRiskyCsvText, sheetToCsv } from '@texuli/sheets/csv';
import { cellAddress } from '@texuli/sheets/formula';
import { createWorkbook, displayValue, inputText } from '@texuli/sheets/model';
import { saveBlob } from '../canvas-site/download.ts';
import { HOSTILE_CSV } from './csv.ts';

let text = $state(HOSTILE_CSV);
let formulas = $state(false);
let status = $state('');

const imported = $derived(csvToSheet(text, { name: 'Imported', formulas }));

interface CellRow {
  readonly address: string;
  readonly stored: string;
  readonly value: string;
  readonly risky: boolean;
}

const view = $derived.by(() => {
  if (!imported.ok) return null;
  const book = createWorkbook(imported.sheet);
  const tab = book.sheets[0];
  if (!tab) return null;
  const cells: CellRow[] = [];
  for (let row = 0; row < tab.rowIds.length; row += 1) {
    for (let col = 0; col < tab.columnIds.length; col += 1) {
      const input = book.input(tab.id, row, col);
      if (input === null) continue;
      const value = displayValue(book.value(tab.id, row, col));
      cells.push({
        address: cellAddress(row, col),
        stored: typeof input === 'string' ? inputText(input) : String(input),
        value,
        risky: typeof input === 'string' && isRiskyCsvText(value),
      });
    }
  }
  return { cells, csv: sheetToCsv(book, tab.id) };
});

function download(): void {
  if (!view) return;
  saveBlob(new Blob([view.csv], { type: 'text/csv;charset=utf-8' }), 'orders-export.csv');
  status = 'Saved orders-export.csv.';
}
</script>

<div class="csv" data-sheets-csv="">
  <div class="csv__in">
    <label class="csv__label" for="sheets-csv-input">CSV from elsewhere (untrusted)</label>
    <textarea
      id="sheets-csv-input"
      class="csv__text"
      rows="7"
      spellcheck="false"
      bind:value={text}
      data-sheets-csv-input=""
    ></textarea>
    <label class="csv__toggle">
      <input type="checkbox" bind:checked={formulas} data-sheets-csv-formulas="" />
      Import formulas (<code>formulas: true</code>)
    </label>
  </div>
  <div class="csv__out" role="status" data-sheets-csv-result="">
    {#if !imported.ok}
      <p class="csv__refused" data-sheets-csv-refused="">
        Refused: {imported.issues.map((issue) => `${issue.path}: ${issue.message}`).join(' ')}
      </p>
    {:else if view}
      <p class="csv__note">
        Imported {view.cells.length} cells. {formulas
          ? 'Formulas were parsed with the sheet grammar.'
          : 'Fields that start with = stayed text.'}
      </p>
    {/if}
  </div>
  {#if view}
    <div class="csv__grid">
      <div class="csv__table" role="region" aria-label="Imported cells" tabindex="0">
        <table>
          <caption>What the sheet holds</caption>
          <thead>
            <tr>
              <th scope="col">Cell</th>
              <th scope="col">Stored as</th>
              <th scope="col">Shows</th>
            </tr>
          </thead>
          <tbody>
            {#each view.cells as cell (cell.address)}
              <tr data-sheets-csv-cell={cell.address}>
                <th scope="row">{cell.address}</th>
                <td><code>{cell.stored}</code></td>
                <td>
                  {cell.value}
                  {#if cell.risky}<span class="csv__badge">neutralized on export</span>{/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      <div class="csv__export">
        <h3 class="csv__title">Exported CSV</h3>
        <pre class="csv__pre" tabindex="0" aria-label="Exported CSV" data-sheets-csv-export="">{view.csv}</pre>
        <button type="button" class="csv__button" onclick={download}>Download the CSV</button>
        <p class="csv__note" role="status">{status}</p>
      </div>
    </div>
  {/if}
</div>

<style>
  .csv {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 0.75rem;
    min-inline-size: 0;
    padding: clamp(0.75rem, 2vw, 1.25rem);
    border: 1px solid var(--tx-border, CanvasText);
    border-radius: 1rem;
    background: var(--tx-surface, Canvas);
    color: var(--tx-foreground, CanvasText);
  }
  .csv__in,
  .csv__export {
    display: grid;
    gap: 0.4rem;
    min-inline-size: 0;
  }
  .csv__label,
  .csv__title {
    margin: 0;
    font-size: 0.9rem;
    font-weight: 600;
  }
  .csv__text {
    inline-size: 100%;
    box-sizing: border-box;
    padding: 0.5rem 0.6rem;
    border: 1px solid var(--tx-border, ButtonBorder);
    border-radius: 0.5rem;
    background: var(--tx-background, Field);
    color: var(--tx-foreground, FieldText);
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.8125rem;
  }
  .csv__toggle {
    display: flex;
    gap: 0.4rem;
    align-items: center;
    font-size: 0.875rem;
  }
  .csv__grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 18rem), 1fr));
    gap: 0.75rem;
    align-items: start;
  }
  .csv__table {
    max-block-size: 20rem;
    overflow: auto;
    border: 1px solid var(--tx-border, CanvasText);
    border-radius: 0.6rem;
  }
  .csv__table table {
    inline-size: 100%;
    border-collapse: collapse;
    font-size: 0.8125rem;
  }
  .csv__table caption {
    padding: 0.4rem 0.6rem;
    text-align: start;
    font-weight: 600;
  }
  .csv__table th,
  .csv__table td {
    padding: 0.3rem 0.6rem;
    border-block-start: 1px solid var(--tx-border, CanvasText);
    text-align: start;
    vertical-align: top;
    overflow-wrap: anywhere;
  }
  .csv__pre {
    margin: 0;
    padding: 0.6rem;
    max-inline-size: 100%;
    overflow-x: auto;
    border: 1px solid var(--tx-border, CanvasText);
    border-radius: 0.5rem;
    background: var(--tx-background, Canvas);
    font-size: 0.8125rem;
  }
  .csv__button {
    justify-self: start;
    min-block-size: 2.25rem;
    padding-inline: 0.8rem;
    border: 1px solid var(--tx-border, ButtonBorder);
    border-radius: 0.5rem;
    background: var(--tx-background, ButtonFace);
    color: var(--tx-foreground, ButtonText);
    font: inherit;
    cursor: pointer;
  }
  .csv__text:focus-visible,
  .csv__button:focus-visible,
  .csv__table:focus-visible,
  .csv__pre:focus-visible {
    outline: 2px solid var(--tx-ring, Highlight);
    outline-offset: 2px;
  }
  .csv__note {
    margin: 0;
    font-size: 0.875rem;
  }
  .csv__refused {
    margin: 0;
    padding: 0.5rem 0.75rem;
    border-inline-start: 4px solid var(--tx-danger, CanvasText);
    border-radius: 0.4rem;
    background: var(--tx-danger-soft, Canvas);
    color: var(--tx-danger-soft-foreground, CanvasText);
    overflow-wrap: anywhere;
  }
  .csv__badge {
    display: inline-block;
    margin-inline-start: 0.35rem;
    padding-inline: 0.35rem;
    border: 1px solid currentColor;
    border-radius: 0.3rem;
    font-size: 0.6875rem;
    font-weight: 600;
  }
</style>
