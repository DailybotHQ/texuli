<script lang="ts">
/**
 * /sheets-page/ function lab: pick any function of the closed set (read
 * from `SHEET_FUNCTION_INFO`), edit its formula, and the engine evaluates
 * it in K1 of the order log (`evaluateInLab`, the same helper the page's
 * build-time table uses, here with the visitor's clock). A formula that
 * does not parse shows its error code and message instead.
 */
import { SHEET_FUNCTION_INFO } from '@texuli/sheets/formula';
import { CATEGORY_NAMES, evaluateInLab, FUNCTION_EXAMPLES } from './workbook.ts';

const names = Object.keys(SHEET_FUNCTION_INFO);
const groups = Object.keys(CATEGORY_NAMES).map((category) => ({
  category,
  label: CATEGORY_NAMES[category] ?? category,
  names: names.filter((name) => SHEET_FUNCTION_INFO[name]?.category === category),
}));

let chosen = $state('SUMIF');
let formula = $state(FUNCTION_EXAMPLES.SUMIF ?? '=SUMIF(C2:C9, "paid", B2:B9)');
const info = $derived(SHEET_FUNCTION_INFO[chosen]);
const result = $derived(evaluateInLab(formula, () => Date.now()));

function pick(name: string): void {
  chosen = name;
  formula = FUNCTION_EXAMPLES[name] ?? SHEET_FUNCTION_INFO[name]?.example ?? '=';
}
</script>

<div class="lab" data-sheets-lab="">
  <div class="lab__controls">
    <label class="lab__field">
      <span>Function</span>
      <select value={chosen} onchange={(event) => pick(event.currentTarget.value)} data-sheets-lab-pick="">
        {#each groups as group (group.category)}
          <optgroup label={group.label}>
            {#each group.names as name (name)}
              <option value={name}>{name}</option>
            {/each}
          </optgroup>
        {/each}
      </select>
    </label>
    <label class="lab__field lab__field--wide">
      <span>Formula in K1</span>
      <input
        type="text"
        spellcheck="false"
        autocomplete="off"
        bind:value={formula}
        data-sheets-lab-formula=""
      />
    </label>
  </div>
  {#if info}
    <p class="lab__info">
      <code>{info.signature}</code>: {info.description}
    </p>
  {/if}
  <div class="lab__result" role="status" aria-live="polite" data-sheets-lab-result="">
    {#if result.error}
      <span>Does not parse:</span>
      <span class="lab__error" data-sheets-lab-error="">{result.value}</span>
      <span>{result.error}</span>
    {:else}
      <span>Result:</span>
      <output data-sheets-lab-value="">{result.value}</output>
    {/if}
  </div>
</div>

<style>
  .lab {
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
  .lab__controls {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
  }
  .lab__field {
    display: grid;
    gap: 0.25rem;
    font-size: 0.875rem;
    font-weight: 600;
  }
  .lab__field--wide {
    flex: 1 1 16rem;
  }
  .lab__field select,
  .lab__field input {
    min-block-size: 2.25rem;
    padding-inline: 0.6rem;
    border: 1px solid var(--tx-border, ButtonBorder);
    border-radius: 0.5rem;
    background: var(--tx-background, Field);
    color: var(--tx-foreground, FieldText);
    font: inherit;
    font-weight: 400;
  }
  .lab__field input {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  }
  .lab__field select:focus-visible,
  .lab__field input:focus-visible {
    outline: 2px solid var(--tx-ring, Highlight);
    outline-offset: 2px;
  }
  .lab__info {
    margin: 0;
    font-size: 0.9rem;
  }
  .lab__result {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: baseline;
    padding: 0.6rem 0.8rem;
    border-inline-start: 4px solid var(--tx-primary, CanvasText);
    border-radius: 0.4rem;
    background: var(--tx-background, Canvas);
    overflow-wrap: anywhere;
  }
  .lab__result output {
    font-size: 1.25rem;
    font-weight: 700;
  }
  .lab__error {
    font-weight: 700;
  }
</style>
