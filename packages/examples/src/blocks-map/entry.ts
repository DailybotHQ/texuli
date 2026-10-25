import { defineExample } from '../registry.ts';

/** Map block example (T-blocks-map). The demo loads lazily. */
export const blocksMapExample = defineExample({
  id: 'blocks-map',
  title: 'Map block',
  description:
    'Places and a delivery route on the fictional Port Meridian basemap, keyboard pan and zoom, and a hostile block the guard rejects. No tiles or network.',
  tags: ['blocks', 'map', 'security', 'a11y'],
  component: 'blocks/MapBlockView',
  props: ['block', 'labels', 'locale', 'headingLevel', 'onselect', 'oninvalid'],
  load: () => import('./BlocksMapDemo.svelte'),
});
