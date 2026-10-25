import { defineExample } from '../registry.ts';

export const blocksDiagramExample = defineExample({
  id: 'blocks-diagram',
  title: 'Diagram blocks',
  description:
    'Flow, org chart, board and terminal diagrams from validated data, plus a hostile rejection. Fictional Harbor team copy only.',
  tags: ['blocks', 'diagram', 'flow', 'org', 'a11y'],
  component: 'blocks/DiagramFamily',
  props: ['block', 'oninvalid'],
  load: () => import('./DiagramDemo.svelte'),
});
