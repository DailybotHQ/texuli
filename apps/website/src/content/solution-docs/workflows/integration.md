## Editor

`WorkflowEditor` from `@texuli/workflows/editor` is the Svelte 5 authoring surface: toolbar, palette, canvas with minimap, inspector and a treegrid outline. Parts also import on their own (`WorkflowCanvas`, `WorkflowToolbar`, `WorkflowPalette`, `WorkflowMinimap`, `WorkflowOutline`, `WorkflowNodeBody`).

The editor reports each change with `onchange(graph, event)`. Undo and redo run on `createWorkflowHistory`. The host stores the graph.

## Viewer and inspector

`WorkflowViewer` from `@texuli/workflows/viewer` is a read-only figure whose nodes are a list that says where each one leads. Pass a `label`. `WorkflowInspector` from `@texuli/workflows/inspector` edits the selected node's typed props.

## Player

`@texuli/player` paints a `workflow-graph` node with this package: the viewer in `view` mode, the editor in `edit` mode, through the spec adapter. An agent can send a workflow as JSON. That painter is in development with the rest of Workflows.

The JSON live preview on this site is `/workflows-page/json/`.
