import { defineExample } from '../registry.ts';

export const texuliButtonExample = defineExample({
  id: 'texuli-button',
  title: 'Button, IconButton and ButtonGroup',
  description:
    'Styled buttons on the token contract: every variant and size, loading, safe href, groups, RTL and dark. Fictional example.com copy only.',
  tags: ['texuli', 'button', 'a11y', 'rtl', 'dark'],
  component: 'texuli/Button',
  props: ['variant', 'size', 'loading', 'href', 'disabled'],
  load: () => import('./ButtonDemo.svelte'),
});
