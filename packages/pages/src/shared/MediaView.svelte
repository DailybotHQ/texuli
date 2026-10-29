<script lang="ts">
// A media block: the host resolves the reference and the source passes
// `safeImageSrc` at the untrusted tier; otherwise the alt text shows.
import type { MediaBlock } from '@texuli/document/model';
import { type MediaResolver, mediaSource } from './media.ts';

let {
  node,
  resolveMedia,
  fallback,
}: {
  node: MediaBlock;
  resolveMedia?: MediaResolver | undefined;
  fallback: (alt: string) => string;
} = $props();
const src = $derived(mediaSource(node.ref, resolveMedia));
</script>

<figure class="tx-pages-media">
  {#if src}
    <img {src} alt={node.alt} loading="lazy" decoding="async" />
  {:else}
    <p class="tx-pages-notice" role="note">{fallback(node.alt)}</p>
  {/if}
</figure>
