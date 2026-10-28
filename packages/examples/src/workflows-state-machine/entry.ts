import { defineExample } from '../registry.ts';

export const workflowsStateMachineExample = defineExample({
  id: 'workflows-state-machine',
  title: 'State diagram',
  description:
    'The same editor as a state machine: cycles allowed, custom node bodies through a snippet, and every label localized in Spanish.',
  tags: ['workflows', 'graph', 'i18n', 'snippet'],
  component: 'workflows/WorkflowEditor',
  props: ['graph', 'registry', 'node', 'labels', 'messages', 'palette', 'outline'],
  load: () => import('./WorkflowsStateMachineDemo.svelte'),
});
