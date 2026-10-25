<script lang="ts">
import { Gallery } from '@texuli/media/gallery';
import { GALLERY_SCENES } from './scenes.ts';

/**
 * Masonry gallery: each photo keeps its own shape, packed into the shortest
 * column. The column count follows the width (at least 140 px each, at most 3).
 */
</script>

<article class="demo" data-example="media-gallery-masonry" aria-labelledby="media-gallery-masonry-title">
  <h2 id="media-gallery-masonry-title">Masonry</h2>
  <Gallery
    items={GALLERY_SCENES}
    layout="masonry"
    columns={3}
    minColumnWidth={140}
    gap={10}
    aria-label="Landscapes"
    loading="eager"
  />
</article>

<style>
  .demo {
    display: grid;
    gap: 0.75rem;
    max-inline-size: 48rem;
  }
  h2 {
    margin: 0;
  }
</style>
