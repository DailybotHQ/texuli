<script lang="ts">
import { MediaBlockView } from '@texuli/blocks/media/renderers';
import { MEDIA_HOSTILE_SAMPLES } from './samples.ts';
</script>

<article class="demo" data-example="blocks-media-hostile" aria-label="Hostile media blocks">
  <h2>Media blocks reject hostile input</h2>
  <p class="lede">
    Remote URLs, executable schemes and SVG paths never render. Each rejected block becomes an
    inert notice.
  </p>
  {#each MEDIA_HOSTILE_SAMPLES as block, i (i)}
    <MediaBlockView {block} />
  {/each}
</article>

<style>
  .demo {
    display: grid;
    gap: 1rem;
    max-inline-size: 36rem;
    padding: 1.5rem;
  }
  .lede {
    margin: 0;
    color: var(--tx-muted-foreground, GrayText);
    font-size: 0.9375rem;
  }
</style>
