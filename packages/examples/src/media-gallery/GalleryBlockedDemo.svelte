<script lang="ts">
import { Gallery, type GalleryItem } from '@texuli/media/gallery';
import { GALLERY_SCENES } from './scenes.ts';

/**
 * Untrusted items: an HTTP source, a script URL and a data URL fail the media
 * URL policy. Their tiles show a labeled fallback, are never requested, and
 * the lightbox skips them.
 */
const items: GalleryItem[] = [
  GALLERY_SCENES[0] as GalleryItem,
  {
    id: 'http',
    src: 'http://images.example/beach.jpg',
    alt: 'A beach photo sent over plain HTTP',
    caption: 'Refused: HTTP',
  },
  {
    id: 'script',
    src: 'javascript:alert(1)',
    alt: 'A script pretending to be a photo',
    caption: 'Refused: script URL',
  },
  GALLERY_SCENES[4] as GalleryItem,
  {
    id: 'data',
    src: 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%2F%3E',
    alt: 'An inline SVG from an untrusted message',
    caption: 'Refused: data URL',
  },
];
</script>

<article class="demo" data-example="media-gallery-blocked" aria-labelledby="media-gallery-blocked-title">
  <h2 id="media-gallery-blocked-title">Untrusted sources</h2>
  <Gallery {items} aria-label="Photos from a message" aspectRatio="4 / 3" loading="eager" />
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
