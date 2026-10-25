<script lang="ts">
import type { CatalogPropSchema } from '@texuli/catalog';
import { readAlt } from './model.ts';

/**
 * `media-image` `alt`: required by the manifest, but a blank value is legal
 * and the player's media policy then paints its own "no description" label.
 * The field says so instead of letting the image look described.
 */
let {
  prop,
  value,
  onchange,
}: {
  prop: CatalogPropSchema;
  value: unknown;
  onchange: (next: string | undefined) => void;
} = $props();

const uid = $props.id();
const reading = $derived(readAlt(prop, value));
</script>

<div class="media-alt" data-tx-media-alt data-state={reading.state}>
  <label for={`${uid}-input`}>{prop.name}{prop.required ? ' · required' : ''}</label>
  <input
    id={`${uid}-input`}
    type="text"
    value={typeof value === 'string' ? value : ''}
    aria-invalid={reading.state === 'refused' || (reading.state === 'unset' && prop.required) ? 'true' : undefined}
    aria-describedby={`${uid}-verdict`}
    oninput={(event) => onchange(event.currentTarget.value)}
  />
  <p id={`${uid}-verdict`} class="media-alt__verdict">
    {#if reading.state === 'unset'}
      Required: the renderer drops the image without alt. Describe the image.
    {:else if reading.state === 'refused'}
      Refused by the renderer: {reading.message}
    {:else if reading.state === 'replaced'}
      Blank: the player paints its "no description" label instead. Describe the image.
    {:else}
      Read aloud as the image's description.
    {/if}
  </p>
</div>

<style>
  .media-alt {
    display: grid;
    gap: 0.35rem;
  }
  .media-alt input {
    box-sizing: border-box;
    inline-size: 100%;
    padding: 0.5rem;
    border: 1px solid var(--tx-border, ButtonBorder);
    border-radius: 0.4rem;
    font: inherit;
    color: inherit;
    background: var(--tx-background, Canvas);
  }
  .media-alt input[aria-invalid='true'] {
    border-color: var(--tx-destructive, Mark);
  }
  .media-alt input:focus-visible {
    outline: 3px solid var(--tx-ring, Highlight);
    outline-offset: 2px;
  }
  .media-alt__verdict {
    margin: 0;
    font-size: 0.8125rem;
    color: var(--tx-muted-foreground, GrayText);
  }
</style>
