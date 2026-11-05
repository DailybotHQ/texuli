import { defineExample } from '../registry.ts';

/** Theme-aware image pair (D-G-023). The demo loads lazily. */
export const mediaImageDarkExample = defineExample({
  id: 'media-image-dark',
  title: 'Image, light and dark pair',
  description:
    'One image with a light and a dark source: it follows the page theme, a forced dark or light scope wins over the OS preference, or a <picture> follows the OS alone.',
  tags: ['media', 'image', 'dark'],
  component: 'media/Image',
  props: ['src', 'srcDark', 'darkMode', 'alt'],
  load: () => import('./MediaImageDarkDemo.svelte'),
});
