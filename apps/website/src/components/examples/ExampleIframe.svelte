<script lang="ts">
/**
 * Same-origin iframe for an isolated example preview document.
 * Listing: click-to-load (avoids mass parallel loads that stall networkidle).
 * Detail (eager): mount immediately. mode/dir applied via query string.
 */
import { examplePreviewHref } from './full-page.ts';

type Props = {
  id: string;
  title: string;
  base?: string;
  mode?: 'light' | 'dark';
  dir?: 'ltr' | 'rtl';
  /** Fixed slot height (CSS length). */
  height?: string;
  /** Mount immediately (detail pages). */
  eager?: boolean;
};

let {
  id,
  title,
  base = '/',
  mode = 'light',
  dir = 'ltr',
  height = '22rem',
  eager = false,
}: Props = $props();

let active = $state(eager);
let loaded = $state(false);

const src = $derived(examplePreviewHref(base, id, { mode, dir, embed: true }));

$effect(() => {
  if (eager) active = true;
});

function loadPreview(): void {
  active = true;
}
</script>

<div
  class="iframe-slot"
  style:--slot-h={height}
  data-tx-example-iframe={id}
  data-active={active ? 'true' : 'false'}
  data-loaded={loaded ? 'true' : 'false'}
>
  {#if active}
    <!--
      Embed previews set body/host inert (ExamplePreviewMount) so focus stays on
      the docs shell. No tabindex=-1: axe frame-focusable-content fails when a
      negative-tabindex frame still has focusable descendants during load.
    -->
    <iframe
      title={`Live example: ${title}`}
      src={src}
      loading={eager ? 'eager' : 'lazy'}
      referrerpolicy="no-referrer"
      onload={() => (loaded = true)}
    ></iframe>
  {:else}
    <div class="iframe-slot__idle">
      <p class="iframe-slot__hint" role="status">Live example loads in an isolated preview frame.</p>
      <button type="button" class="iframe-slot__load" onclick={loadPreview}>
        Load live example
      </button>
    </div>
  {/if}
</div>

<style>
  .iframe-slot {
    block-size: var(--slot-h, 22rem);
    min-block-size: 12rem;
    border: 0;
    border-radius: var(--tx-radius, 0.375rem);
    overflow: hidden;
    background: var(--tx-muted, var(--tx-background));
  }
  .iframe-slot iframe {
    display: block;
    inline-size: 100%;
    block-size: 100%;
    border: 0;
    background: var(--tx-background);
  }
  .iframe-slot__idle {
    display: grid;
    gap: 0.75rem;
    align-content: center;
    justify-items: start;
    block-size: 100%;
    padding: 1rem;
  }
  .iframe-slot__hint {
    margin: 0;
    color: var(--tx-foreground);
    font-size: 0.9rem;
  }
  .iframe-slot__load {
    margin: 0;
    min-block-size: 2.5rem;
    min-inline-size: 1.5rem;
    padding: 0.5rem 1rem;
    border: 1px solid var(--tx-border, CanvasText);
    border-radius: var(--tx-radius, 0.375rem);
    background: var(--tx-surface, Canvas);
    color: var(--tx-foreground, CanvasText);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }
  .iframe-slot__load:focus-visible {
    outline: 2px solid var(--tx-ring, Highlight);
    outline-offset: 2px;
  }
</style>
