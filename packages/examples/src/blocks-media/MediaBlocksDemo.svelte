<script lang="ts">
import { MediaBlockView } from '@texuli/blocks/media/renderers';
import { MEDIA_FAMILY_SAMPLES } from './samples.ts';
</script>

<article class="demo" data-example="blocks-media" aria-label="Media blocks">
  <h2>Media blocks</h2>
  <p class="lede">
    Image, figure, video and gallery — validated block data only. Fictional Harbor Notes copy;
    embedded raster swatches stand in for product photos.
  </p>
  {#each MEDIA_FAMILY_SAMPLES as block, i (i)}
    <section class="block" aria-label={`Sample ${block.type}`}>
      <h3>{block.type}</h3>
      <MediaBlockView {block} />
    </section>
  {/each}
</article>

<style>
  .demo {
    display: grid;
    gap: 1.5rem;
    max-inline-size: 48rem;
    padding: 1.5rem;
  }
  .lede {
    margin: 0;
    color: var(--tx-muted-foreground, GrayText);
    font-size: 0.9375rem;
  }
  .block {
    display: grid;
    gap: 0.5rem;
  }
  .block h3 {
    margin: 0;
    font-size: 0.8125rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--tx-muted-foreground, GrayText);
  }
</style>
