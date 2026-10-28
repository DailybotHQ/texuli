import { defineExample } from '../registry.ts';

export const workflowsViewerExample = defineExample({
  id: 'workflows-viewer',
  title: 'Workflow viewer',
  description:
    'A read-only approval flow: nodes read as a list that says where each one leads, edges drawn behind, scaled to fit, with no editing code.',
  tags: ['workflows', 'graph', 'read-only'],
  component: 'workflows/WorkflowViewer',
  props: ['graph', 'registry', 'label', 'flow', 'dir'],
  load: () => import('./WorkflowsViewerDemo.svelte'),
});
