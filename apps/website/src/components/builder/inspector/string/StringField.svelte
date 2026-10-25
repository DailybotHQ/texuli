<script lang="ts">
import {
  readString,
  type StringProp,
  type StringRule,
  stringInput,
  stringIssues,
} from './model.ts';

/**
 * One text prop: a text box with the renderer's verdict and the prop's own
 * rule (when the painting code or a schema has one) shown as it is typed.
 * A refused value is still stored, as typed, and flagged; an empty box
 * clears the prop. Text renders as text, never markup.
 */
let {
  prop,
  value,
  rule,
  onchange,
}: {
  prop: StringProp;
  value: unknown;
  rule?: StringRule;
  onchange: (next: string | undefined) => void;
} = $props();

const uid = $props.id();
const reading = $derived(readString(prop, value));
const issues = $derived(stringIssues(prop, value, rule));
const label = $derived(`${prop.name}${prop.required ? ' · required' : ''}`);
const hint = $derived(
  [
    prop.description,
    rule ? `${rule.describe} (${rule.source}).` : '',
    typeof prop.default === 'string' ? `Default: ${prop.default}. A default is not saved.` : '',
  ]
    .filter(Boolean)
    .join(' ') || 'Optional text.'
);
const describedBy = $derived(
  [`${uid}-hint`, issues.length ? `${uid}-issues` : ''].filter(Boolean).join(' ')
);
</script>

<div class="string" data-tx-string={prop.name} data-state={reading.state}>
  <label class="string__label" for={`${uid}-input`}>{label}</label>
  <input
    id={`${uid}-input`}
    class="string__input"
    type="text"
    value={reading.state === 'set' ? reading.value : ''}
    placeholder={typeof prop.default === 'string' ? prop.default : ''}
    aria-invalid={issues.some((issue) => issue.severity === 'error') ? 'true' : undefined}
    aria-describedby={describedBy}
    oninput={(event) => onchange(stringInput(event.currentTarget.value))}
  />
  <p id={`${uid}-hint`} class="string__hint">{hint}</p>
  {#if issues.length}
    <ul id={`${uid}-issues`} class="string__issues">
      {#each issues as issue, index (index)}<li data-severity={issue.severity}>{issue.message}</li>{/each}
    </ul>
  {/if}
  {#if reading.state === 'invalid'}
    <button type="button" class="string__reset" onclick={() => onchange(undefined)}>
      Clear invalid {prop.name}
    </button>
  {/if}
</div>

<style>
  .string {
    display: grid;
    gap: 0.35rem;
    margin-block: 0.75rem;
    font-size: 0.875rem;
  }
  .string__label {
    font-weight: 600;
  }
  .string__input {
    box-sizing: border-box;
    inline-size: 100%;
    padding: 0.55rem;
    border: 1px solid var(--tx-border, ButtonBorder);
    border-radius: 0.4rem;
    font: inherit;
    color: inherit;
    background: var(--tx-background, Canvas);
  }
  .string :is(input, button):focus-visible {
    outline: 3px solid var(--tx-ring, Highlight);
    outline-offset: 2px;
  }
  .string [aria-invalid='true'] {
    border-color: var(--tx-destructive, Mark);
  }
  .string__hint {
    margin: 0;
    font-size: 0.75rem;
    color: var(--tx-muted-foreground, GrayText);
  }
  .string__issues {
    margin: 0;
    padding-inline-start: 1.1rem;
    font-size: 0.8125rem;
    font-weight: 600;
  }
  .string__reset {
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
