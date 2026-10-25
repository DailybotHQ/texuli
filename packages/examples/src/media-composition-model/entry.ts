import { defineExample } from '../registry.ts';

export const mediaCompositionModelExample = defineExample({
  id: 'media-composition-model',
  title: 'Bounded media composition model',
  description:
    'Validates a fictional layered scene with a gradient, masked image, transforms and text without rendering untrusted markup.',
  tags: ['media', 'composition', 'safety'],
  component: 'media/compositionModel',
  props: ['layers', 'mask', 'blendMode', 'transform'],
  load: () => import('./MediaCompositionModelExample.svelte'),
});
