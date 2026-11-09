<script lang="ts">
import { inputText, type SheetDocument } from '@texuli/sheets/model';
import { SheetView } from '@texuli/sheets/view';
import type { SheetsDemoAction, SheetsDemoState } from './model.ts';
import { createSheetsDemoModel } from './model.ts';

const model = createSheetsDemoModel();
const initialState = model.state;
let state = $state.raw<SheetsDemoState>(initialState);
let sheet = $state.raw<SheetDocument>(initialState.document);
let sourceVisible = $state(false);
let announcement = $state(
  'Project budget loaded. Select a cell or use the controls to explore the formula engine.'
);

const source = $derived(JSON.stringify(state.document, null, 2));

function announce(next: SheetsDemoState, prefix = ''): void {
  state = next;
  sheet = next.document;
  announcement = prefix ? `${prefix} ${next.lastAction}` : next.lastAction;
}

function dispatch(action: SheetsDemoAction): void {
  const next = model.dispatch(action);
  announce(next);
}

function handleSheetChange(nextDocument: SheetDocument): void {
  const currentSheets = new Map(state.document.sheets.map((entry) => [entry.id, entry]));
  for (const nextSheet of nextDocument.sheets) {
    const previous = currentSheets.get(nextSheet.id);
    const previousCells = previous?.cells ?? {};
    for (const [address, value] of Object.entries(nextSheet.cells ?? {})) {
      if (JSON.stringify(previousCells[address]) === JSON.stringify(value)) continue;
      const next = model.dispatch({
        type: 'edit-cell',
        address,
        value: inputText(value),
      });
      state = next;
      announcement = next.error ?? next.lastAction;
    }
  }
  sheet = state.document;
}

function reset(): void {
  sourceVisible = false;
  announce(model.dispatch({ type: 'reset' }), 'Example reset.');
}
</script>

<section class="sheets-demo" aria-label="Interactive Project budget spreadsheet">
  <div class="sheets-demo__toolbar" aria-label="Spreadsheet actions">
    <button type="button" onclick={() => dispatch({ type: 'add-line-item' })}>Add line item</button>
    <button type="button" onclick={() => dispatch({ type: 'toggle-formulas' })}>
      {state.showFormulas ? 'Hide formula details' : 'Show formula details'}
    </button>
    <button
      type="button"
      aria-expanded={sourceVisible}
      aria-controls="sheets-demo-source"
      onclick={() => (sourceVisible = !sourceVisible)}
    >
      {sourceVisible ? 'Hide source' : 'View source'}
    </button>
    <button type="button" onclick={reset}>Reset</button>
  </div>

  <p class="sheets-demo__announcement" role="status" aria-live="polite" aria-atomic="true">
    {announcement}
  </p>
  {#if state.error}
    <p class="sheets-demo__error" role="alert">{state.error}</p>
  {/if}

  <div class="sheets-demo__grid">
    <SheetView
      bind:sheet
      onchange={handleSheetChange}
      label="Project budget spreadsheet"
      density="compact"
      viewportHeight={280}
    />
  </div>

  {#if state.showFormulas}
    <section class="sheets-demo__formulas" aria-labelledby="sheets-demo-formulas-title">
      <h3 id="sheets-demo-formulas-title">Formula dependencies</h3>
      <p>{state.formulaCount} formulas in this workbook</p>
      <ul>
        {#each state.formulas as formula (formula.key)}
          <li>
            <code>{formula.sheet}!{formula.address}</code>
            <code>{formula.formula}</code>
            <span>Value: {formula.value}</span>
            <span>Reads: {formula.reads.join(', ')}</span>
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  <pre id="sheets-demo-source" class="sheets-demo__source" hidden={!sourceVisible}><code>{source}</code></pre>
</section>

<style>
  .sheets-demo {
    display: grid;
    gap: 0.75rem;
    min-inline-size: 0;
    color: var(--tx-foreground, CanvasText);
  }
  .sheets-demo__toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .sheets-demo button {
    min-block-size: 2.75rem;
    padding-inline: 0.75rem;
    border: 1px solid var(--tx-border, ButtonBorder);
    border-radius: 0.5rem;
    background: var(--tx-background, ButtonFace);
    color: inherit;
    font: inherit;
  }
  .sheets-demo button {
    cursor: pointer;
    touch-action: manipulation;
  }
  .sheets-demo button:focus-visible {
    outline: 2px solid var(--tx-ring, Highlight);
    outline-offset: 2px;
  }
  .sheets-demo__announcement,
  .sheets-demo__error {
    min-block-size: 1.25em;
    margin: 0;
    font-size: 0.875rem;
  }
  .sheets-demo__announcement {
    color: var(--tx-muted-foreground, GrayText);
  }
  .sheets-demo__error {
    color: var(--tx-danger, #a11212);
  }
  .sheets-demo__grid {
    min-inline-size: 0;
    overflow: auto;
  }
  .sheets-demo__formulas {
    display: grid;
    gap: 0.5rem;
  }
  .sheets-demo__formulas h3,
  .sheets-demo__formulas p {
    margin: 0;
  }
  .sheets-demo__formulas h3 {
    font-size: 1rem;
  }
  .sheets-demo__formulas ul {
    display: grid;
    gap: 0.5rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .sheets-demo__formulas li {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 10rem), 1fr));
    gap: 0.35rem 0.75rem;
    padding: 0.65rem;
    border: 1px solid var(--tx-border, ButtonBorder);
    border-radius: 0.5rem;
    overflow-wrap: anywhere;
  }
  .sheets-demo__source {
    max-block-size: 18rem;
    overflow: auto;
    margin: 0;
    padding: 0.75rem;
    border: 1px solid var(--tx-border, ButtonBorder);
    border-radius: 0.5rem;
    background: var(--tx-surface, Canvas);
    font: 0.8rem/1.5 var(--tx-font-mono, ui-monospace, monospace);
    white-space: pre;
  }
  @media (prefers-reduced-motion: reduce) {
    .sheets-demo,
    .sheets-demo * {
      scroll-behavior: auto;
      animation-duration: 0.01ms;
      animation-iteration-count: 1;
      transition-duration: 0.01ms;
    }
  }
  @media (forced-colors: active) {
    .sheets-demo button,
    .sheets-demo__source,
    .sheets-demo__formulas li {
      border-color: ButtonText;
    }
  }
</style>
