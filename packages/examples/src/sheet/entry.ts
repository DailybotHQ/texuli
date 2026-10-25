import { defineExample } from '../registry.ts';

export const texuliSheetExample = defineExample({
  id: 'texuli-sheet',
  title: 'Sheet, Drawer, DetailPanel and ResponsiveModal',
  description:
    'Token-styled sheets, snap-point drawer, non-modal detail panel and responsive modal with logical sides.',
  tags: ['texuli', 'sheet', 'drawer', 'dialog', 'a11y'],
  component: 'texuli/Sheet',
  props: ['side', 'size', 'modal', 'snapPoints', 'dir', 'open'],
  load: () => import('./SheetDemo.svelte'),
});
