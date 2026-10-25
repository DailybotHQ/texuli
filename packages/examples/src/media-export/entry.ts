import { defineExample } from '../registry.ts';

export const mediaExportExample = defineExample({
  id: 'media-export',
  title: 'Media export',
  description:
    'Export a composition as PNG or SVG and its animation (with OKLCH color keyframes) as WebM in the browser; an unsafe image source is refused. Fictional data.',
  tags: ['media', 'export', 'animation', 'security'],
  component: 'media/CompositionExport',
  props: [
    'composition',
    'animation',
    'filename',
    'trust',
    'pixelRatio',
    'background',
    'fps',
    'labels',
  ],
  load: () => import('./MediaExportDemo.svelte'),
});
