import { defineExample } from '../registry.ts';

const component = 'media/Gallery';

/** Gallery and lightbox examples (T-media-gallery). The demos load lazily. */
export const mediaGalleryExamples = [
  defineExample({
    id: 'media-gallery',
    title: 'Gallery',
    description:
      'A grid of fictional landscape photos with captions. A tile opens an accessible lightbox with keyboard, swipe and zoom.',
    tags: ['media', 'gallery', 'lightbox', 'keyboard'],
    component,
    props: ['items', 'layout', 'aspectRatio', 'loop', 'open', 'index'],
    load: () => import('./GalleryDemo.svelte'),
  }),
  defineExample({
    id: 'media-gallery-masonry',
    title: 'Masonry gallery',
    description:
      'The same photos in a masonry layout: each keeps its shape, packed into the shortest column, with captions over the image.',
    tags: ['media', 'gallery', 'masonry', 'layout'],
    component,
    props: ['layout', 'columns', 'minColumnWidth', 'gap'],
    load: () => import('./GalleryMasonryDemo.svelte'),
  }),
  defineExample({
    id: 'media-gallery-blocked',
    title: 'Gallery refusing unsafe sources',
    description:
      'HTTP, script and data URLs fail the media URL policy: their tiles show a labeled fallback, are never requested and are skipped by the lightbox.',
    tags: ['media', 'gallery', 'security'],
    component,
    props: ['items', 'trust'],
    load: () => import('./GalleryBlockedDemo.svelte'),
  }),
] as const;
