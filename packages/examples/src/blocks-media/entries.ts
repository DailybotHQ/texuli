import { defineExample } from '../registry.ts';

/** Media family examples (T-blocks-media). Demos load lazily. */
export const blocksMediaExample = defineExample({
  id: 'blocks-media',
  title: 'Media blocks',
  description:
    'Image, figure, video and gallery blocks rendered from validated data. Fictional Harbor Notes copy; embedded raster swatches only.',
  tags: ['blocks', 'media', 'image', 'video', 'a11y'],
  component: 'blocks/MediaBlockView',
  props: ['block', 'labels', 'resolveAvatar'],
  load: () => import('./MediaBlocksDemo.svelte'),
});

export const blocksMediaHostileExample = defineExample({
  id: 'blocks-media-hostile',
  title: 'Media blocks reject hostile input',
  description:
    'Remote image URLs, executable video sources and SVG paths are refused; rejected blocks show an inert notice.',
  tags: ['blocks', 'media', 'security'],
  component: 'blocks/MediaBlockView',
  props: ['block', 'oninvalid'],
  load: () => import('./MediaBlocksHostileDemo.svelte'),
});
