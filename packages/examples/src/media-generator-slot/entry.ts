import { defineExample } from '../registry.ts';

export const mediaGeneratorSlotExample = defineExample({
  id: 'media-generator-slot',
  title: 'Media generator slot',
  description:
    'Host-provided generate UI with loading, cancel and error states. Texuli ships no model; the demo mock returns a local SVG. Unsafe results are blocked.',
  tags: ['media', 'generator', 'security', 'a11y', 'dark'],
  component: 'media/GeneratorSlot',
  props: ['generate', 'prompt', 'kind', 'trust', 'allowedOrigins'],
  load: () => import('./MediaGeneratorSlotDemo.svelte'),
});
