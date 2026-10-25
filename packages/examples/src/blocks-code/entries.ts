import { defineExample } from '../registry.ts';

/** Code family examples (T-blocks-code). Demos load lazily. */
export const blocksCodeExample = defineExample({
  id: 'blocks-code',
  title: 'Code blocks',
  description:
    'Code blocks with an owned tokenizer: TypeScript, Python, SQL, JSON, shell and plain text, line numbers, stepped highlights and a caption from block data, copy and an RTL page. Fictional content.',
  tags: ['blocks', 'code', 'rtl', 'dark'],
  component: 'blocks/CodeBlockView',
  props: ['block', 'labels', 'lineNumbers', 'highlights', 'hostStep', 'step', 'copyable'],
  load: () => import('./CodeBlocksDemo.svelte'),
});

export const blocksCodeHostileExample = defineExample({
  id: 'blocks-code-hostile',
  title: 'Code blocks reject hostile input',
  description:
    'Markup in code stays text, and bidi overrides, injected language tokens or foreign block types show a notice.',
  tags: ['blocks', 'code', 'security'],
  component: 'blocks/CodeBlockView',
  props: ['block', 'oninvalid'],
  load: () => import('./CodeBlocksHostileDemo.svelte'),
});
