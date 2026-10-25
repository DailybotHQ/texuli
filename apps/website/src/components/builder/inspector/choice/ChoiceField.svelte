<script lang="ts">
import {
  type ChoiceProp,
  choiceIssues,
  defaultText,
  enumControl,
  enumInput,
  readChoice,
  showRaw,
  switchChecked,
} from './model.ts';

/**
 * One enum or boolean prop: radios (up to four values) or a select for an
 * enum, a switch for a boolean. Only values from the manifest's closed set
 * can be chosen; a refused value from the payload is shown as text with
 * its reason and can be cleared. `onchange(undefined)` removes the prop.
 */
let {
  prop,
  value,
  pinned,
  onchange,
}: {
  prop: ChoiceProp;
  value: unknown;
  /** The value the player forces for this prop, if any. */
  pinned?: string;
  onchange: (next: string | boolean | undefined) => void;
} = $props();

const uid = $props.id();
const reading = $derived(readChoice(prop, value));
const issues = $derived(choiceIssues(prop, value, pinned));
const invalid = $derived(reading.state === 'invalid');
const hint = $derived(prop.description ?? defaultText(prop));
const describedBy = $derived(
  [hint ? `${uid}-hint` : '', issues.length ? `${uid}-issues` : ''].filter(Boolean).join(' ') ||
    undefined
);
const label = $derived(`${prop.name}${prop.required ? ' · required' : ''}`);
const selected = $derived(reading.state === 'set' ? reading.value : undefined);

function pick(input: string) {
  const next = enumInput(prop, input);
  if (next.ok) onchange(next.value);
}
</script>

<div class="choice" data-tx-choice={prop.name} data-state={reading.state}>
  {#if prop.kind === 'boolean'}
    <div class="choice__switch">
      <label for={`${uid}-switch`}>{label}</label>
      <input
        id={`${uid}-switch`}
        type="checkbox"
        role="switch"
        checked={switchChecked(prop, value)}
        aria-invalid={invalid ? 'true' : undefined}
        aria-describedby={describedBy}
        onchange={(event) => onchange(event.currentTarget.checked)}
      />
      <span class="choice__state" aria-hidden="true">
        {switchChecked(prop, value) ? 'On' : 'Off'}{reading.state === 'unset' ? ' (default)' : ''}
      </span>
    </div>
  {:else if enumControl(prop) === 'radio'}
    <fieldset
      class="choice__radios"
      role="radiogroup"
      aria-invalid={invalid ? 'true' : undefined}
      aria-describedby={describedBy}
    >
      <legend>{label}</legend>
      {#if prop.required !== true}
        <label>
          <input
            type="radio"
            name={`${uid}-radio`}
            value=""
            checked={reading.state === 'unset'}
            onchange={() => pick('')}
          />
          Not set
        </label>
      {/if}
      {#each prop.enumValues ?? [] as choice (choice)}
        <label>
          <input
            type="radio"
            name={`${uid}-radio`}
            value={choice}
            checked={selected === choice}
            onchange={() => pick(choice)}
          />
          {choice}
        </label>
      {/each}
    </fieldset>
  {:else}
    <label class="choice__field" for={`${uid}-select`}>
      <span>{label}</span>
      <select
        id={`${uid}-select`}
        value={invalid ? '__invalid__' : typeof selected === 'string' ? selected : ''}
        aria-invalid={invalid ? 'true' : undefined}
        aria-describedby={describedBy}
        onchange={(event) => pick(event.currentTarget.value)}
      >
        {#if invalid}
          <option value="__invalid__" disabled>Invalid: {showRaw(value)}</option>
        {/if}
        {#if prop.required !== true}
          <option value="">Not set</option>
        {:else if reading.state === 'unset'}
          <option value="" disabled>Choose a value</option>
        {/if}
        {#each prop.enumValues ?? [] as choice (choice)}<option value={choice}>{choice}</option>{/each}
      </select>
    </label>
  {/if}

  {#if hint}<p id={`${uid}-hint`} class="choice__hint">{hint}</p>{/if}
  {#if issues.length}
    <ul id={`${uid}-issues`} class="choice__issues">
      {#each issues as issue, index (index)}
        <li data-severity={issue.severity}>{issue.message}</li>
      {/each}
    </ul>
  {/if}
  {#if invalid || (prop.kind === 'boolean' && reading.state === 'set' && prop.required !== true)}
    <button type="button" class="choice__reset" onclick={() => onchange(undefined)}>
      {invalid ? `Clear invalid ${prop.name}` : `Reset ${prop.name} to default`}
    </button>
  {/if}
</div>

<style>
  .choice {
    display: grid;
    gap: 0.35rem;
  }
  .choice__switch {
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }
  .choice__switch input {
    inline-size: 2.4rem;
    block-size: 1.3rem;
    accent-color: var(--tx-primary, AccentColor);
  }
  .choice__state {
    font-size: 0.8125rem;
    color: var(--tx-muted-foreground, GrayText);
  }
  .choice__radios {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem 0.9rem;
    margin: 0;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--tx-border, ButtonBorder);
    border-radius: 0.4rem;
  }
  .choice__radios legend {
    padding-inline: 0.25rem;
  }
  .choice__field {
    display: grid;
    gap: 0.25rem;
  }
  .choice select {
    box-sizing: border-box;
    inline-size: 100%;
    padding: 0.5rem;
    border: 1px solid var(--tx-border, ButtonBorder);
    border-radius: 0.4rem;
    font: inherit;
    color: inherit;
    background: var(--tx-background, Canvas);
  }
  .choice :is(input, select, button):focus-visible {
    outline: 3px solid var(--tx-ring, Highlight);
    outline-offset: 2px;
  }
  .choice [aria-invalid='true'] {
    border-color: var(--tx-destructive, Mark);
  }
  .choice__hint {
    margin: 0;
    font-size: 0.8125rem;
    color: var(--tx-muted-foreground, GrayText);
  }
  .choice__issues {
    margin: 0;
    padding-inline-start: 1.1rem;
    font-size: 0.8125rem;
    font-weight: 600;
  }
  .choice__reset {
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
