import { defineExample } from '../registry.ts';

export const texuliScrollAreaExample = defineExample({
  id: 'texuli-scroll-area',
  title: 'ScrollArea',
  description:
    'Native, keyboard-accessible scrolling with styled scrollbar visibility, size variants, RTL and dark mode.',
  tags: ['texuli', 'scroll', 'a11y', 'rtl', 'dark'],
  component: 'texuli/ScrollArea',
  props: ['label', 'size', 'type', 'dir'],
  load: () => import('./ScrollAreaDemo.svelte'),
});
