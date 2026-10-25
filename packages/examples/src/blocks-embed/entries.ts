import { defineExample } from '../registry.ts';

export const blocksEmbedExample = defineExample({
  id: 'blocks-embed',
  title: 'Embedded app and safe link preview',
  description:
    'A host starts the validated app only after activation; link previews render bounded text and a safe HTTPS link.',
  tags: ['blocks', 'embed', 'links', 'security'],
  component: 'blocks/EmbedBlockView',
  props: ['block', 'mountEmbed'],
  load: () => import('./EmbedBlocksDemo.svelte'),
});
