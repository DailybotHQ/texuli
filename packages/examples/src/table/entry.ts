import { defineExample } from '../registry.ts';

export const texuliTableExample = defineExample({
  id: 'texuli-table',
  title: 'Table',
  description:
    'Static tables with caption, plain, striped and grid rows, three densities, numeric and footer cells, a selected row, an empty state, a sticky header in a capped area, stacked rows on narrow widths and RTL. Fictional data only.',
  tags: ['texuli', 'table', 'data', 'rtl', 'dark', 'a11y'],
  component: 'texuli/Table',
  props: ['variant', 'density', 'stack', 'stickyHeader', 'maxBlockSize', 'label', 'busy'],
  load: () => import('./TableDemo.svelte'),
});
