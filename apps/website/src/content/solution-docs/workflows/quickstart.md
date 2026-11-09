## Install

Svelte 5 (`^5.57.2`) is a peer of `@texuli/workflows`. Import `@texuli/tokens/base.css` once; each view imports its own CSS.

```bash
npm install @texuli/workflows
```

## Build a graph and edit it

Declare node types, apply operations (each one is validated), lay the graph out, then pass it to `WorkflowEditor`.

```svelte
<script lang="ts">
  import { WorkflowEditor } from '@texuli/workflows/editor';
  import { layoutMoves, layoutWorkflow } from '@texuli/workflows/layout';
  import {
    applyWorkflowOps,
    createWorkflow,
    defineNodeTypes,
    type WorkflowGraph,
  } from '@texuli/workflows/model';

  const registry = defineNodeTypes([
    {
      type: 'request',
      label: 'Request',
      category: 'Start',
      ports: [{ id: 'out', direction: 'out', dataType: 'any' }],
    },
    {
      type: 'end',
      label: 'End',
      category: 'Done',
      ports: [{ id: 'in', direction: 'in', dataType: 'any' }],
    },
  ]);

  const at = { x: 0, y: 0 };
  const built = applyWorkflowOps(
    createWorkflow(),
    [
      { op: 'addNode', node: { id: 'ask', type: 'request', label: 'Expense submitted', position: at } },
      { op: 'addNode', node: { id: 'paid', type: 'end', label: 'Paid', position: at } },
      {
        op: 'connect',
        edge: { id: 'e1', from: { node: 'ask', port: 'out' }, to: { node: 'paid', port: 'in' } },
      },
    ],
    { registry }
  );
  if (!built.ok) throw new Error(built.error.message);

  const moves = layoutMoves(layoutWorkflow(built.graph, { direction: 'LR' }));
  const laid = applyWorkflowOps(built.graph, [{ op: 'moveNodes', moves }], { registry });
  let graph = $state.raw<WorkflowGraph>(laid.ok ? laid.graph : built.graph);
</script>

<WorkflowEditor {graph} {registry} onchange={(next) => (graph = next)} />
```

For a read-only figure, use `WorkflowViewer` from `@texuli/workflows/viewer` with the same `graph` and `registry` and a `label`.
