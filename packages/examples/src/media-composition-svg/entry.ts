import { defineExample } from '../registry.ts';

export const mediaCompositionSvgExample = defineExample({
  id: 'media-composition-svg',
  title: 'Composition SVG renderer',
  description:
    'Renders a validated composition document to an accessible SVG with real text nodes. Fictional example.com / example data only.',
  tags: ['media', 'composition', 'svg', 'a11y', 'rtl', 'dark'],
  component: 'media/composition-svg',
  props: ['composition', 'title', 'trust'],
  load: () => import('./MediaCompositionSvgDemo.svelte'),
});
