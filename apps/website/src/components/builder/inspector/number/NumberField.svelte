<script lang="ts">
import {
  describeBounds,
  type NumberHints,
  type NumberProp,
  numberControl,
  numberIssues,
  parseNumberInput,
  readNumber,
  shownDefault,
  showRaw,
  sliderStep,
} from './model.ts';

/**
 * One number prop: a number input, or a slider plus a number input when a
 * schema documents both ends of its range. Only finite numbers are stored;
 * a refused value from the payload is shown as text and can be cleared.
 * Defaults are placeholders and are never written. `onchange(undefined)`
 * removes the prop.
 */
let {
  prop,
  value,
  hints,
  onchange,
}: {
  prop: NumberProp;
  value: unknown;
  hints?: NumberHints;
  onchange: (next: number | undefined) => void;
} = $props();

const uid = $props.id();
const reading = $derived(readNumber(prop, value));
const issues = $derived(numberIssues(prop, value, hints));
const invalid = $derived(reading.state === 'invalid');
const control = $derived(numberControl(hints));
const fallback = $derived(shownDefault(prop, hints));
const range = $derived(hints?.bounds ? describeBounds(hints.bounds) : undefined);
const current = $derived(reading.state === 'set' ? reading.value : undefined);
const label = $derived(`${prop.name}${prop.required ? ' · required' : ''}`);
let inputMessage = $state('');

const hint = $derived(
  [
    prop.description,
    range ? `Documented range: ${range} (${hints?.source}).` : '',
    fallback !== undefined ? `Default: ${fallback}. A default is not saved.` : '',
  ]
    .filter(Boolean)
    .join(' ')
);
const describedBy = $derived(
  [hint ? `${uid}-hint` : '', issues.length || inputMessage ? `${uid}-issues` : '']
    .filter(Boolean)
    .join(' ') || undefined
);

/**
 * On leaving the box: an entry the browser could not read as a number is
 * reported, not stored. `blur`, not `change`: the value stays "" throughout,
 * so no change event fires.
 */
function onblurBox(event: FocusEvent & { currentTarget: HTMLInputElement }) {
  if (event.currentTarget.validity.badInput) inputMessage = 'Enter a finite number.';
}

function oninput(event: Event & { currentTarget: HTMLInputElement }) {
  const element = event.currentTarget;
  // An unfinished entry ("-", "1e") reads as "" with badInput; keep typing, store nothing.
  if (element.value === '' && element.validity.badInput) return;
  const next = parseNumberInput(prop, element.value);
  if (!next.ok) {
    inputMessage = next.message;
    return;
  }
  inputMessage = '';
  onchange(next.value);
}
</script>

<div class="number" data-tx-number={prop.name} data-state={reading.state} data-control={control}>
  <label class="number__label" for={`${uid}-input`}>{label}</label>
  <div class="number__controls">
    {#if control === 'slider' && hints?.bounds}
      <input
        class="number__slider"
        type="range"
        min={hints.bounds.min}
        max={hints.bounds.max}
        step={sliderStep(hints.bounds)}
        value={current ?? fallback ?? hints.bounds.min}
        aria-label={`${prop.name} slider`}
        aria-describedby={describedBy}
        oninput={(event) => onchange(Number(event.currentTarget.value))}
      />
    {/if}
    <input
      id={`${uid}-input`}
      class="number__input"
      type="number"
      inputmode="decimal"
      step="any"
      value={current ?? ''}
      placeholder={fallback === undefined ? '' : String(fallback)}
      aria-invalid={invalid || issues.some((issue) => issue.severity === 'error') ? 'true' : undefined}
      aria-describedby={describedBy}
      {oninput}
      onblur={onblurBox}
    />
  </div>
  {#if hint}<p id={`${uid}-hint`} class="number__hint">{hint}</p>{/if}
  {#if issues.length || inputMessage}
    <ul id={`${uid}-issues`} class="number__issues">
      {#if inputMessage}<li data-severity="error">{inputMessage}</li>{/if}
      {#each issues as issue, index (index)}<li data-severity={issue.severity}>{issue.message}</li>{/each}
    </ul>
  {/if}
  {#if invalid}
    <p class="number__raw">Stored value: <code>{showRaw(value)}</code></p>
  {/if}
  {#if invalid || (reading.state === 'set' && prop.required !== true)}
    <button
      type="button"
      class="number__reset"
      onclick={() => {
        inputMessage = '';
        onchange(undefined);
      }}
    >
      {invalid ? `Clear invalid ${prop.name}` : `Reset ${prop.name} to default`}
    </button>
  {/if}
</div>

<style>
  .number {
    display: grid;
    gap: 0.35rem;
  }
  .number__controls {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.6rem;
  }
  .number__slider {
    flex: 1 1 10rem;
    accent-color: var(--tx-primary, AccentColor);
  }
  .number__input {
    box-sizing: border-box;
    flex: 1 1 8rem;
    min-inline-size: 0;
    padding: 0.5rem;
    border: 1px solid var(--tx-border, ButtonBorder);
    border-radius: 0.4rem;
    font: inherit;
    color: inherit;
    background: var(--tx-background, Canvas);
  }
  .number :is(input, button):focus-visible {
    outline: 3px solid var(--tx-ring, Highlight);
    outline-offset: 2px;
  }
  .number [aria-invalid='true'] {
    border-color: var(--tx-destructive, Mark);
  }
  .number__hint,
  .number__raw {
    margin: 0;
    font-size: 0.8125rem;
    color: var(--tx-muted-foreground, GrayText);
  }
  .number__issues {
    margin: 0;
    padding-inline-start: 1.1rem;
    font-size: 0.8125rem;
    font-weight: 600;
  }
  .number__reset {
    justify-self: start;
    font: inherit;
    font-size: 0.8125rem;
    padding: 0.35rem 0.6rem;
    border: 1px solid var(--tx-border, ButtonBorder);
    border-radius: 0.4rem;
    color: inherit;
    background: var(--tx-surface, Canvas);
    cursor: pointer;
  }
</style>
