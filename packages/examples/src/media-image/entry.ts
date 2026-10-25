import { defineExample } from '../registry.ts';

/** Image example (T-media-image). The demo loads lazily. */
export const mediaImageExample = defineExample({
  id: 'media-image',
  title: 'Image',
  description:
    'Responsive srcset, focal-point crops, blur-up and color placeholders, link and button images, and fallbacks for blocked or missing sources.',
  tags: ['media', 'image', 'security'],
  component: 'media/Image',
  props: [
    'src',
    'widths',
    'loader',
    'sizes',
    'focalPoint',
    'placeholder',
    'fit',
    'href',
    'onactivate',
  ],
  load: () => import('./MediaImageDemo.svelte'),
});
