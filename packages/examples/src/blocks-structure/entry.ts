import { defineExample } from '../registry.ts';

export const blocksStructureExample = defineExample({
  id: 'blocks-structure',
  title: 'Structure blocks',
  description:
    'Columns, grid, tabs, accordion, cards, divider and CTA from validated data, plus a hostile rejection. Fictional Harbor copy only.',
  tags: ['blocks', 'structure', 'columns', 'tabs', 'accordion', 'cards', 'a11y'],
  component: 'blocks/StructureFamily',
  props: ['block', 'oninvalid'],
  load: () => import('./StructureDemo.svelte'),
});
