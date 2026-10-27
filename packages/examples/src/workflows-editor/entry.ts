import { defineExample } from '../registry.ts';

export const workflowsEditorExample = defineExample({
  id: 'workflows-editor',
  title: 'Workflow editor',
  description:
    'An automation pipeline with typed ports: keyboard connect mode, palette drops, marquee, undo and redo, minimap, an inspector and a treegrid outline.',
  tags: ['workflows', 'graph', 'keyboard', 'drag'],
  component: 'workflows/WorkflowEditor',
  props: ['graph', 'registry', 'onchange', 'node', 'palette', 'readonly'],
  load: () => import('./WorkflowsEditorDemo.svelte'),
});
