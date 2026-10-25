import { defineExample } from '../registry.ts';

/** Text family examples (T-blocks-text). Demos load lazily. */
export const blocksTextExample = defineExample({
  id: 'blocks-text',
  title: 'Text blocks',
  description:
    'Heading, rich text, list, quote and callout blocks rendered from validated data. Fictional example.com content.',
  tags: ['blocks', 'text', 'markdown'],
  component: 'blocks/TextBlockView',
  props: ['block', 'labels'],
  load: () => import('./TextBlocksDemo.svelte'),
});

export const blocksTextHostileExample = defineExample({
  id: 'blocks-text-hostile',
  title: 'Text blocks reject hostile input',
  description:
    'Raw HTML stays text, executable links lose their href, and bidi overrides or foreign block types show a notice.',
  tags: ['blocks', 'text', 'security'],
  component: 'blocks/TextBlockView',
  props: ['block', 'oninvalid'],
  load: () => import('./TextBlocksHostileDemo.svelte'),
});
