import { defineExample } from '../registry.ts';

export const texuliKbdCodeExample = defineExample({
  id: 'texuli-kbd-code',
  title: 'Kbd, Code and CopyButton',
  description:
    'Keyboard keys, escaped inline and block code, and copy-with-feedback on the token contract. Fictional example.com only.',
  tags: ['texuli', 'kbd', 'code', 'copy', 'a11y', 'rtl', 'dark'],
  component: 'texuli/Kbd',
  props: ['variant', 'value', 'label', 'size'],
  load: () => import('./KbdCodeDemo.svelte'),
});
