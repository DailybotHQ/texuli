import { defineExample } from '../registry.ts';

export const dataVirtualListExample = defineExample({
  id: 'data-virtual-list',
  title: 'Variable-height virtual list',
  description:
    'Shows variable row measurements, keyboard navigation, RTL layout and threshold-based loading with fictional records.',
  tags: ['data', 'virtualization', 'keyboard', 'rtl'],
  component: 'data/virtual-list',
  props: ['count', 'estimateSize', 'overscan', 'threshold'],
  load: () => import('./DataVirtualListDemo.svelte'),
});
