<script lang="ts">
import type { CatalogPropSchema } from '@texuli/catalog';
import { readContainer, sampleValue, showRaw, validate } from './model.ts';
import StructNode from './StructNode.svelte';
import type { StructSchema } from './sources.ts';

/**
 * One object or array prop with a sub-field schema. The renderer's own check
 * (`sanitizeProps`) decides whether the prop is kept at all; the schema's
 * verdicts on sub-fields are shown next to each field, as warnings the chart
 * may act on. Unknown keys are listed and can be removed; nothing is free
 * JSON. `onchange(undefined)` removes the prop.
 */
let {
  prop,
  value,
  struct,
  onchange,
}: {
  prop: CatalogPropSchema;
  value: unknown;
  struct: StructSchema;
  onchange: (next: unknown) => void;
} = $props();

const uid = $props.id();
const reading = $derived(readContainer(prop, value));
const issues = $derived(value === undefined ? [] : validate(struct.schema, value, struct.defs));
const fallback = $derived(
  prop.default ?? ('default' in struct.schema ? struct.schema.default : undefined)
);
</script>

<section class="struct" data-tx-struct={prop.name} data-state={reading.state} aria-labelledby={`${uid}-title`}>
  <h4 id={`${uid}-title`} class="struct__title">{prop.name}{prop.required ? ' · required' : ''}</h4>
  <p class="struct__note">
    {prop.description ? `${prop.description} ` : ''}Fields from the {struct.source}.
    {#if fallback !== undefined}Default: <code>{showRaw(fallback)}</code>. A default is not saved.{/if}
  </p>
  {#if reading.state === 'invalid'}
    <p class="struct__verdict" data-verdict="refused">Refused by the renderer: {reading.message}</p>
  {:else if reading.state === 'unset' && prop.required}
    <p class="struct__verdict" data-verdict="refused">Required: the renderer refuses this component without it.</p>
  {:else if issues.length}
    <p class="struct__verdict" data-verdict="warning">
      {issues.length === 1 ? '1 field breaks' : `${issues.length} fields break`} the chart schema; the chart may not draw this value.
    </p>
  {/if}
  {#if reading.state === 'unset'}
    <button type="button" class="struct__action" onclick={() => onchange(sampleValue(struct.schema, struct.defs))}>
      Add {prop.name}
    </button>
  {:else}
    <StructNode
      schema={struct.schema}
      {value}
      defs={struct.defs}
      {issues}
      path={[]}
      label={prop.name}
      required={prop.required === true}
      {onchange}
    />
    {#if !prop.required}
      <button type="button" class="struct__action" onclick={() => onchange(undefined)}>
        {reading.state === 'invalid' ? `Clear invalid ${prop.name}` : `Reset ${prop.name} to default`}
      </button>
    {/if}
  {/if}
</section>

<style>
  .struct {
    display: grid;
    gap: 0.45rem;
  }
  .struct__title {
    margin: 0;
    font-size: 0.9375rem;
  }
  .struct__note {
    margin: 0;
    font-size: 0.8125rem;
    color: var(--tx-muted-foreground, GrayText);
  }
  .struct__verdict {
    margin: 0;
    font-size: 0.8125rem;
    font-weight: 600;
  }
  .struct__action {
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
  .struct__action:focus-visible {
    outline: 3px solid var(--tx-ring, Highlight);
    outline-offset: 2px;
  }
</style>
