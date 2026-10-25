<!-- Used only by full-page layouts and gallery cards: carry the styles with the
     component, so other pages do not link them. -->
<svelte:options css="injected" />

<script lang="ts">
/**
 * A live stage in its isolated preview document: every gallery preview, and
 * full-page layouts on component pages. Follows the surrounding demo frame's
 * mode and direction. Full-page layouts render inert, with a link to their
 * live document, so a page never repeats a layout's landmarks and headings.
 */

import PreviewFrame from './PreviewFrame.svelte';
import { previewUrl } from './preview.ts';

type Props = {
  componentId: string;
  values: Readonly<Record<string, unknown>>;
  /** Preview height class, from the stage map. */
  height: 'sm' | 'md' | 'lg' | 'xl';
  /** A full-page layout: inert in place, operated in its own document. */
  fullPage?: boolean;
};

let { componentId, values, height, fullPage = false }: Props = $props();

let host = $state<HTMLDivElement | undefined>();
let mode = $state<'light' | 'dark'>('light');
let dir = $state<'ltr' | 'rtl'>('ltr');

$effect(() => {
  const node = host;
  if (!node) return;
  const surface = node.closest('[data-tx-demo-stage]') ?? node.ownerDocument.documentElement;
  const read = () => {
    mode = surface.getAttribute('data-tx-mode') === 'dark' ? 'dark' : 'light';
    dir = getComputedStyle(node).direction === 'rtl' ? 'rtl' : 'ltr';
  };
  read();
  const observer = new MutationObserver(read);
  observer.observe(surface, { attributes: true, attributeFilter: ['data-tx-mode', 'dir'] });
  return () => observer.disconnect();
});
</script>

<div
  bind:this={host}
  class="stage"
  data-tx-live-stage={componentId}
  data-tx-live-ready="true"
>
  <div class="component" data-tx-live-component={componentId}>
    <PreviewFrame
      {componentId}
      title={`${componentId} live preview`}
      {values}
      {mode}
      {dir}
      {height}
      interactive={!fullPage}
    />
  </div>
  {#if fullPage}
    <p class="open">
      <a href={previewUrl(componentId, mode, dir)} data-tx-open-preview={componentId}>
        Open the live layout<span class="sr-only"> for {componentId}</span>
      </a>
      <span class="hint">A full page: it runs in its own document.</span>
    </p>
  {/if}
</div>

<style>
  .stage {
    display: grid;
    align-content: start;
    min-inline-size: 0;
  }
  .component {
    display: grid;
  }
  .open {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.25rem 0.75rem;
    margin: 0;
    padding: 0.5rem 0.75rem;
    font-size: 0.875rem;
  }
  .open a {
    display: inline-flex;
    align-items: center;
    min-block-size: 1.5rem;
    color: var(--tx-link, LinkText);
  }
  .hint {
    color: var(--tx-muted-foreground, CanvasText);
  }
  .sr-only {
    position: absolute;
    inline-size: 1px;
    block-size: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
</style>
