<script lang="ts">
import { safeHref } from '@texuli/core/url-policy';
import type { EmbedBlockLabels } from './family.ts';
import type { LinkPreviewBlock } from './schema.ts';

interface Props {
  block: LinkPreviewBlock;
  labels: EmbedBlockLabels;
}
let { block, labels }: Props = $props();
// Repeat the URL policy at the sink so this anchor remains safe if its caller changes.
const href = $derived(safeHref(block.href, 'untrusted'));
</script>

<article class="tx-link-preview" data-tx-block="link-preview">
  <div class="tx-link-copy">
    {#if block.site}<p class="tx-link-site">{block.site}</p>{/if}
    <h3>{block.title}</h3>
    {#if block.description}<p>{block.description}</p>{/if}
  </div>
  {#if href}
    <a href={href} target="_blank" rel="noopener noreferrer">{labels.link}<span class="tx-link-sr"> ({labels.newWindow})</span></a>
  {/if}
</article>

<style>
  .tx-link-preview { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 1rem; padding: 1rem; border: 1px solid var(--tx-color-border, #9ca3af); border-radius: 0.625rem; background: var(--tx-color-surface, Canvas); color: var(--tx-color-text, CanvasText); }
  .tx-link-copy { min-inline-size: 0; }
  h3, p { margin: 0; overflow-wrap: anywhere; }
  h3 { font-size: 1rem; }
  .tx-link-copy > p { margin-block-start: 0.375rem; }
  /* Site line uses foreground (not muted) so WCAG AA holds on surface in light/dark/HC. */
  .tx-link-site { color: var(--tx-color-text, CanvasText); font-size: 0.8125rem; }
  a { color: var(--tx-color-link, LinkText); font-weight: 600; }
  a:focus-visible { outline: 2px solid currentColor; outline-offset: 3px; }
  .tx-link-sr { position: absolute; inline-size: 1px; block-size: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
  @media (forced-colors: active) {
    .tx-link-preview {
      background: Canvas;
      color: CanvasText;
      border-color: CanvasText;
    }
    .tx-link-site,
    a {
      color: LinkText;
    }
  }
</style>
