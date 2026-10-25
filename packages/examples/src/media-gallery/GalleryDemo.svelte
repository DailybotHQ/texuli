<script lang="ts">
import { Gallery } from '@texuli/media/gallery';
import { GALLERY_SCENES } from './scenes.ts';

/** Grid gallery: square tiles with captions; a tile opens the lightbox. */
let index = $state(0);
let open = $state(false);
</script>

<article class="demo" data-example="media-gallery" aria-labelledby="media-gallery-title">
  <h2 id="media-gallery-title">Trip photos</h2>
  <p class="hint">
    Open a photo, then use the arrow keys, a swipe, or the buttons. <kbd>+</kbd> and <kbd>-</kbd> zoom.
  </p>
  <Gallery items={GALLERY_SCENES} aria-label="Trip photos" loading="eager" loop bind:index bind:open />
  <p class="status" aria-live="polite">{open ? `Viewing photo ${index + 1}` : 'Lightbox closed'}</p>
</article>

<style>
  .demo {
    display: grid;
    gap: 0.75rem;
    max-inline-size: 48rem;
  }
  h2,
  .hint,
  .status {
    margin: 0;
  }
  .hint,
  .status {
    color: var(--tx-muted-foreground, CanvasText);
    font-size: 0.875rem;
  }
</style>
