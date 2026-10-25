import { defineExample } from '../registry.ts';

const component = 'data/grid-columns';

/** Column operations examples (T-data-grid-columns). The demos load lazily. */
export const dataGridColumnsExamples = [
  defineExample({
    id: 'data-grid-columns',
    title: 'Data grid column operations',
    description:
      'Resize, reorder, pin, hide and group the columns of a grid of fictional deals; every pointer action has a keyboard path in the column menu.',
    tags: ['data', 'grid', 'columns', 'keyboard'],
    component,
    props: ['columnState', 'groups', 'resizable', 'reorderable', 'pinnable', 'hideable'],
    load: () => import('./GridColumnsDemo.svelte'),
  }),
  defineExample({
    id: 'data-grid-columns-rtl',
    title: 'Data grid column operations, right to left',
    description:
      'The same grid in a right-to-left layout: the start pin sits on the right and the resize edges, arrows and drags follow the reading direction.',
    tags: ['data', 'grid', 'columns', 'rtl'],
    component,
    props: ['columnState', 'density'],
    load: () => import('./GridColumnsRtlDemo.svelte'),
  }),
] as const;
