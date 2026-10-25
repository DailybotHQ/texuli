import { defineExample } from '../registry.ts';

export const texuliToolbarExample = defineExample({
  id: 'texuli-toolbar',
  title: 'Toolbar',
  description:
    'Styled toolbars with buttons, links, separators and single/multiple groups. Variants, vertical, RTL and dark. Fictional actions only.',
  tags: ['texuli', 'toolbar', 'rtl', 'dark'],
  component: 'texuli/Toolbar',
  props: ['variant', 'size', 'orientation', 'type'],
  load: () => import('./ToolbarDemo.svelte'),
});
