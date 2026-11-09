## Untrusted graphs

A graph from an agent, a paste or a share link is untrusted data. Use `parseWorkflow` or `applyWorkflowOps` so every operation is checked. Labels are text. There is no HTML sink.

## Catalog and skill

Agents can emit a `workflow-graph` catalog node (view or edit). `@texuli/player` paints it with `@texuli/workflows`. The Texuli skill covers the editor, viewer, inspector, model and layout under `skills/texuli/build-ui/SKILL.md`.

Do not invent a hosted runner or an MCP operation that is not in `@texuli/tools`. Convert blueprint JSON with `fromSpecWorkflow` / `toSpecWorkflow`.
