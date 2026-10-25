import { defineExample } from '../registry.ts';

export const texuliResizableExample = defineExample({
  id: 'texuli-resizable',
  title: 'Resizable panels',
  description:
    'Styled resizable panel groups: plain and bordered, side by side and stacked, collapsible, disabled, RTL and a remembered layout. Fictional content only.',
  tags: ['texuli', 'resizable', 'splitter', 'layout', 'rtl', 'dark'],
  component: 'texuli/ResizablePanelGroup',
  props: ['direction', 'variant', 'layout', 'autoSaveId', 'withGrip', 'size', 'collapsible'],
  load: () => import('./ResizableDemo.svelte'),
});
