## Graph model

Everything in `@texuli/workflows/model` is a pure function. `defineNodeTypes` declares the closed vocabulary. `createWorkflow` starts empty. `applyWorkflowOps` applies add, connect, move, group and remove operations; a refused operation changes nothing.

```ts
import {
  applyWorkflowOps,
  createWorkflow,
  createWorkflowHistory,
  defineNodeTypes,
  parseWorkflow,
  stringifyWorkflow,
} from '@texuli/workflows/model';
```

Every operation checks ports, directions, data types, cardinality, duplicates, the cycle policy and hard limits (500 nodes, 2,000 edges, 5,000 operations per batch). Labels are text; control and bidirectional override characters are refused. Link and image props pass the URL policy at the `untrusted` tier.

`parseWorkflow` and `stringifyWorkflow` round-trip canonical JSON. `createWorkflowHistory` is undo and redo for the host to keep.

## Layout

`layoutWorkflow` and `layoutMoves` in `@texuli/workflows/layout` place nodes with a deterministic layered auto-layout, left-to-right or top-to-bottom, right-to-left aware. Apply the moves with `applyWorkflowOps`.

## Spec adapter

`fromSpecWorkflow` and `toSpecWorkflow` in `@texuli/workflows/spec-adapter` convert the `@texuli/spec` `workflowGraph` JSON used by blueprint `workflow-graph` nodes.
