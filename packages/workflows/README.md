# @texuli/workflows

An accessible workflow graph editor and viewer for Svelte 5: automations,
pipelines, approvals and state diagrams as typed nodes, ports and edges.
A framework-free model (operations, validation, cycles, history) and a
deterministic layered auto-layout sit under an editor with a toolbar, a
palette, a canvas with a minimap, an inspector and a treegrid outline that
edits the graph without the canvas. It is part of
[Texuli](https://texuli.com), "Small pieces. Infinite possibilities.": an
MIT Svelte 5 component library by Dailybot, Inc.

> **Status: in development (pre-1.0).** `@texuli/workflows` is on npm as
> `0.10.0`, with provenance (first published as `0.3.0` on 2026-10-28). It
> is the `workflow-graph` painter of `@texuli/player`, so an agent can send
> a workflow as JSON; that painter ships in `@texuli/player` from `0.4.0`
> (`0.3.0` predates it; see
> [RELEASE](https://github.com/DailybotHQ/texuli/blob/main/docs/RELEASE.md)).

## Install

```bash
npm install @texuli/workflows
```

In the Texuli workspace, depend on it as
`"@texuli/workflows": "workspace:*"`. It builds on `@texuli/core`,
`@texuli/drag`, `@texuli/primitives`, `@texuli/tokens` and `texuli`;
`svelte` (^5.57.2) is a peer dependency. Import the token stylesheet once
(`@texuli/tokens/base.css`); each view imports its own CSS.

## Quick start

Declare closed node types, build the graph with operations (each one
validated), lay it out, and show it read-only or editable.

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
    { type: 'request', label: 'Request', category: 'Start',
      ports: [{ id: 'out', direction: 'out', dataType: 'any' }] },
    { type: 'approval', label: 'Approval', category: 'Review',
      ports: [
        { id: 'in', direction: 'in', dataType: 'any' },
        { id: 'yes', direction: 'out', dataType: 'any', label: 'Approved' },
      ] },
    { type: 'end', label: 'End', category: 'Done',
      ports: [{ id: 'in', direction: 'in', dataType: 'any' }] },
  ]);

  const at = { x: 0, y: 0 };
  const built = applyWorkflowOps(createWorkflow(), [
    { op: 'addNode', node: { id: 'ask', type: 'request', label: 'Expense submitted', position: at } },
    { op: 'addNode', node: { id: 'lead', type: 'approval', label: 'Team lead', position: at } },
    { op: 'addNode', node: { id: 'paid', type: 'end', label: 'Paid', position: at } },
    { op: 'connect', edge: { id: 'e1', from: { node: 'ask', port: 'out' }, to: { node: 'lead', port: 'in' } } },
    { op: 'connect', edge: { id: 'e2', from: { node: 'lead', port: 'yes' }, to: { node: 'paid', port: 'in' } } },
  ], { registry });
  if (!built.ok) throw new Error(built.error.message);

  const moves = layoutMoves(layoutWorkflow(built.graph, { direction: 'LR' }));
  const laid = applyWorkflowOps(built.graph, [{ op: 'moveNodes', moves }], { registry });

  // Controlled: keep the graph in $state.raw and take every change back.
  let graph = $state.raw<WorkflowGraph>(laid.ok ? laid.graph : built.graph);
</script>

<WorkflowEditor {graph} {registry} onchange={(next) => (graph = next)} />
```

For a read-only figure, use `WorkflowViewer` from
`@texuli/workflows/viewer` with the same `graph` and `registry` and a
`label`.

## Subpaths

| Import | What it gives you | gzip |
| --- | --- | --- |
| `@texuli/workflows/model` | `defineNodeTypes`, `createWorkflow`, `applyWorkflowOps` (add, connect, move, group, remove… each validated), cycle policy, `createWorkflowHistory` (undo and redo), `parseWorkflow` / `stringifyWorkflow` (canonical JSON), `WORKFLOW_LIMITS` | 11.10 KiB |
| `@texuli/workflows/layout` | `layoutWorkflow` and `layoutMoves`: deterministic layered auto-layout, left-to-right or top-to-bottom, right-to-left aware | 2.07 KiB |
| `@texuli/workflows/spec-adapter` | `fromSpecWorkflow` / `toSpecWorkflow`: the `@texuli/spec` `workflowGraph` JSON (blueprint `workflow-graph` nodes) to and from the model, fully checked | 8.52 KiB |
| `@texuli/workflows/editor` | `WorkflowEditor`, and each part on its own: `WorkflowCanvas`, `WorkflowToolbar`, `WorkflowPalette`, `WorkflowMinimap`, `WorkflowOutline`, `WorkflowNodeBody` | 35.79 KiB |
| `@texuli/workflows/viewer` | `WorkflowViewer`: a read-only figure whose nodes are a list that says where each one leads | 5.71 KiB |
| `@texuli/workflows/inspector` | `WorkflowInspector`: edits the selected node's typed props | 5.14 KiB |
| `@texuli/workflows` | Everything above | 41.83 KiB |

Sizes are gzip from `pnpm size --filter @texuli/workflows` (Svelte
external, JavaScript); each subpath has its own budget in
`texuli.budgets.json`.

## Key guarantees

- **Keyboard first.** On the canvas, arrows move focus to the nearest node
  in that direction, Alt+Arrow nudges one grid step, Space toggles
  selection, Enter on a port starts connect mode (arrows cycle compatible
  ports, Enter connects, Escape cancels), Delete removes, and Ctrl or Cmd
  with Z / Y undoes and redoes, with = / - zooms, and 0 fits the view. The
  outline is a WAI-ARIA treegrid that reads and edits the whole graph
  without the canvas, and the palette adds a node with a button press as
  well as a drag (WCAG 2.5.7). The shared
  [drag contract](https://github.com/DailybotHQ/texuli/blob/main/packages/drag/docs/contract.md)
  applies: localized announcements, 24 px targets, reduced motion and forced
  colors.
- **Closed, validated data.** Node types are declared up front; every
  operation checks ports, directions, data types, cardinality, duplicates,
  the cycle policy and hard limits (500 nodes, 2,000 edges, 5,000 operations
  per batch), and a refused operation changes nothing.
- **Untrusted-safe.** Labels are text (control and bidirectional override
  characters are refused); link and image props pass
  `@texuli/core/url-policy` at the `untrusted` tier. Nothing renders as
  HTML.
- **History is the host's to keep.** The editor reports each change with
  `onchange(graph, event)`; undo and redo run on `createWorkflowHistory`.
- **Measured performance.** `tests/perf/workflows.test.ts`
  (`pnpm test:perf`) holds a 500-node, 2,000-edge graph to budgets. One run
  on a loaded development machine (Node and happy-dom, so no real layout)
  measured: parse and validate 3.2 ms, a 2,500-operation batch build
  3.4 ms, layered layout 3.5 ms, a model drag frame 0.17 ms mean, connecting
  one edge with a full cycle check 0.13 ms, and the scene (boxes, ports,
  2,000 edge paths) 2.1 ms.

## Documentation

- Site: [texuli.com](https://texuli.com) and the
  [live examples](https://texuli.com/examples/)
- Drag engine:
  [`@texuli/drag`](https://github.com/DailybotHQ/texuli/blob/main/packages/drag/README.md)
  and its
  [accessibility contract](https://github.com/DailybotHQ/texuli/blob/main/packages/drag/docs/contract.md)
- As blueprint JSON: the `workflowGraph` schema in
  [`@texuli/spec`](https://github.com/DailybotHQ/texuli/blob/main/packages/spec/README.md)
  and the `workflow-graph` painter in
  [`@texuli/player`](https://github.com/DailybotHQ/texuli/blob/main/packages/player/README.md)
- Decisions: ADR-007 and ADR-008 in
  [DECISIONS](https://github.com/DailybotHQ/texuli/blob/main/docs/DECISIONS.md)
- Source: [github.com/DailybotHQ/texuli](https://github.com/DailybotHQ/texuli)
  · Issues: [github.com/DailybotHQ/texuli/issues](https://github.com/DailybotHQ/texuli/issues)

## Contributing

Contributions are welcome; start at the
[GitHub repository](https://github.com/DailybotHQ/texuli).

## License

MIT © Dailybot, Inc. Powered by [Dailybot](https://www.dailybot.com?utm_source=dailybotopensource&utm_medium=texuli-workflows).
