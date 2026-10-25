<script lang="ts">
import type { CatalogPropSchema } from '@texuli/catalog';
import { readUrl, SOURCE_KIND_LABELS, type UrlRole } from './model.ts';

/**
 * One `media-image` URL prop (`src`, `srcset`, `href`): a text box with two
 * verdicts. The renderer's (`sanitizeProps`) decides whether the prop is
 * kept; the core URL policy, called as the image component calls it at the
 * tier the player paints blueprints at, decides whether the URL is used.
 * Values show as text only. `onchange(undefined)` removes the prop.
 */
let {
  prop,
  role,
  value,
  onchange,
}: {
  prop: CatalogPropSchema;
  role: UrlRole;
  value: unknown;
  onchange: (next: string | undefined) => void;
} = $props();

const uid = $props.id();
const reading = $derived(readUrl(prop, role, value));
const what = $derived(
  role === 'href' ? 'link' : role === 'image-srcset' ? 'candidate list' : 'image source'
);
const error = $derived(
  reading.state === 'refused' ||
    reading.state === 'blocked' ||
    (reading.state === 'unset' && reading.required)
);
</script>

<div class="media-url" data-tx-media-url={prop.name} data-state={reading.state}>
  <label class="media-url__label" for={`${uid}-input`}>{prop.name}{prop.required ? ' · required' : ''}</label>
  <input
    id={`${uid}-input`}
    class="media-url__input"
    type="text"
    inputmode="url"
    spellcheck="false"
    autocomplete="off"
    value={typeof value === 'string' ? value : ''}
    placeholder={role === 'href' ? 'https://example.com/page' : 'https://images.example.com/photo.png'}
    aria-invalid={error ? 'true' : undefined}
    aria-describedby={`${uid}-verdict ${uid}-tier`}
    oninput={(event) => {
      const raw = event.currentTarget.value;
      onchange(raw === '' ? undefined : raw);
    }}
  />
  <p id={`${uid}-verdict`} class="media-url__verdict" data-verdict={reading.state}>
    {#if reading.state === 'unset'}
      {reading.required ? `Required: the renderer drops the image without an ${what}.` : `Not set.`}
    {:else if reading.state === 'refused'}
      Refused by the renderer: {reading.message}
    {:else if reading.state === 'blocked'}
      Blocked by the URL policy ({reading.tier} tier), {SOURCE_KIND_LABELS[reading.kind]}: {reading.reason}
    {:else}
      Used as is: {SOURCE_KIND_LABELS[reading.kind]} at the {reading.tier} tier.
    {/if}
  </p>
  <p id={`${uid}-tier`} class="media-url__hint">
    {#if role === 'href'}
      Links are checked at the untrusted tier: https:, mailto: or #fragment only.
    {:else}
      Blueprint images are checked at the untrusted tier (the player pins this component's trust): HTTPS URLs and relative paths only. HTTP, blob and data sources need a host app passing trust="developer" to the component directly.
    {/if}
  </p>
  {#if reading.state === 'refused'}
    <button type="button" class="media-url__button" onclick={() => onchange(undefined)}>Clear invalid {prop.name}</button>
  {/if}
</div>

<style>
  .media-url {
    display: grid;
    gap: 0.35rem;
  }
  .media-url__input {
    box-sizing: border-box;
    inline-size: 100%;
    padding: 0.5rem;
    border: 1px solid var(--tx-border, ButtonBorder);
    border-radius: 0.4rem;
    font: inherit;
    color: inherit;
    background: var(--tx-background, Canvas);
  }
  .media-url__input[aria-invalid='true'] {
    border-color: var(--tx-destructive, Mark);
  }
  .media-url__verdict {
    margin: 0;
    font-size: 0.8125rem;
    font-weight: 600;
    overflow-wrap: anywhere;
  }
  .media-url__hint {
    margin: 0;
    font-size: 0.8125rem;
    color: var(--tx-muted-foreground, GrayText);
  }
  .media-url__button {
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
  .media-url :is(input, button):focus-visible {
    outline: 3px solid var(--tx-ring, Highlight);
    outline-offset: 2px;
  }
</style>
