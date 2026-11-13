## What Workflows is

Workflows is an embeddable graph system: `@texuli/workflows` holds a typed model of nodes, ports and edges, a deterministic layout, an editor, an inspector, an accessible outline and a read-only viewer. The package is published as `0.18.0` and is **in development** (pre-1.0). Pin the exact version or use `^0.17.0`.

It authors and views workflow diagrams. It does not run automations, persist graphs, or host a workflow service. The host app stores the graph and owns any runner.

The JSON live preview on this site stays at `/workflows-page/json/`. The technical docs you are reading live at `/guides/solutions/workflows/`.

## What you get

- Closed node types, validated operations, cycle policy and hard limits.
- Layered auto-layout, left-to-right or top-to-bottom.
- `WorkflowEditor`, `WorkflowViewer` and `WorkflowInspector`.
- Canonical JSON (`parseWorkflow` / `stringifyWorkflow`) and a spec adapter for `workflow-graph` blueprints.

There is no hosted persistence. The host keeps the data.
