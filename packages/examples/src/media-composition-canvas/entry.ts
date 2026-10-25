import { defineExample } from '../registry.ts';

export const mediaCompositionCanvasExample = defineExample({
  id: 'media-composition-canvas',
  title: 'Composition rendered on a canvas',
  description:
    'Draws a fictional layered poster with gradients, a blend mode, a luminance mask and 160 shapes on a canvas, with keyboard zoom and pan, and refuses a hostile scene.',
  tags: ['media', 'composition', 'canvas', 'keyboard', 'safety'],
  component: 'media/CompositionCanvas',
  props: ['composition', 'trust', 'label', 'labels', 'pixelRatio', 'dir', 'onrender'],
  load: () => import('./MediaCompositionCanvasExample.svelte'),
});
