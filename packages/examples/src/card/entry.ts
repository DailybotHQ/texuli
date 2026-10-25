import { defineExample } from '../registry.ts';

export const texuliCardExample = defineExample({
  id: 'texuli-card',
  title: 'Card surfaces',
  description:
    'Elevated and flat cards, media, footer actions, auto-fit grid and a clickable card with URL policy. Fictional example.com only.',
  tags: ['texuli', 'card', 'layout', 'a11y'],
  component: 'texuli/Card',
  props: ['variant', 'href', 'linkLabel', 'minItemWidth', 'gap'],
  load: () => import('./CardDemo.svelte'),
});
