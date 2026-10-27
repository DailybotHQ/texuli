/**
 * Catalog manifest for workflows as data (spec 0.3.0): one `workflow-graph`
 * id whose `graph` validates against the spec workflow schema (closed node
 * types, at most 500 nodes and 2,000 edges). `@texuli/player` paints it with
 * `@texuli/workflows`: the viewer in `view` mode, the editor in `edit` mode,
 * through the package's spec adapter. Build-time only; a subpath group the
 * catalog root does not re-export.
 */
import { manifestData } from '../../manifest/data.ts';
import type { CatalogManifest } from '../../manifest/types.ts';
import type { GrammarComponentMeta } from '../../render/grammar/types.ts';

export const WORKFLOW_GRAPH_MODES = ['view', 'edit'] as const;

export const workflowGraphManifest: CatalogManifest = /* @__PURE__ */ manifestData({
  id: 'workflow-graph',
  package: '@texuli/workflows',
  label: 'Workflow graph',
  summary:
    'A workflow of typed nodes and edges (automations, pipelines, approvals, state diagrams), read-only or editable.',
  tier: 'content',
  agentEmittable: true,
  useWhen: [
    'Show how a process flows from step to step',
    'Let people build or change a workflow, bound to a workflow state variable',
  ],
  dontUseWhen: [
    'A static diagram in a document: use blocks-diagram',
    'Quantities flowing between stages: use charts-sankey',
  ],
  a11y: [
    'View mode: a figure whose nodes are a list that says where each one leads',
    'Edit mode: focusable nodes with spatial arrow keys, keyboard connect mode on ports, and a treegrid outline that edits without the canvas',
    'Labels are text; links and images pass the untrusted URL policy',
  ],
  props: [
    {
      name: 'label',
      kind: 'string',
      required: true,
      trust: 'untrusted',
      description: 'Accessible name.',
    },
    {
      name: 'graph',
      kind: 'object',
      required: true,
      description: 'A spec WorkflowGraph (version 1): nodeTypes, nodes, edges, groups, cycles.',
      schema: { $ref: '#/$defs/workflowGraph' },
    },
    { name: 'mode', kind: 'enum', enumValues: WORKFLOW_GRAPH_MODES, default: 'view' },
    { name: 'flow', kind: 'enum', enumValues: ['LR', 'TB'], default: 'LR' },
  ],
  events: ['change', 'select'],
  bindable: ['graph'],
  examples: [
    {
      id: 'approval',
      title: 'Expense approval',
      props: {
        label: 'Expense approval',
        mode: 'view',
        graph: {
          version: 1,
          cycles: 'forbid',
          nodeTypes: [
            {
              id: 'step',
              label: 'Step',
              ports: [
                { id: 'in', direction: 'in' },
                { id: 'out', direction: 'out', multiple: true },
              ],
            },
          ],
          nodes: [
            { id: 'ask', type: 'step', label: 'Request', position: { x: 0, y: 0 } },
            { id: 'review', type: 'step', label: 'Review', position: { x: 260, y: 0 } },
            { id: 'paid', type: 'step', label: 'Paid', position: { x: 520, y: 0 } },
          ],
          edges: [
            { id: 'e1', from: { node: 'ask', port: 'out' }, to: { node: 'review', port: 'in' } },
            { id: 'e2', from: { node: 'review', port: 'out' }, to: { node: 'paid', port: 'in' } },
          ],
        },
      },
    },
  ],
  related: ['blocks-diagram', 'charts-sankey'],
});

export const WORKFLOWS_MANIFESTS: readonly CatalogManifest[] = /* @__PURE__ */ Object.freeze([
  workflowGraphManifest,
]);

export const WORKFLOWS_GRAMMAR_ROLES: readonly GrammarComponentMeta[] =
  /* @__PURE__ */ Object.freeze([{ id: 'workflow-graph', role: 'interactive' }]);
