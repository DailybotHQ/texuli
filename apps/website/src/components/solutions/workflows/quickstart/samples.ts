import type { SolutionEntry } from '../../../../data/solutions/schema.ts';
import type { SolutionQuickstartProps } from '../../shared/types.ts';

export const WORKFLOWS_QUICKSTART_VERIFIED_BY =
  'apps/website/tests/solutions/workflows-quickstart.test.ts';

export const WORKFLOWS_INSTALL = 'pnpm add @texuli/workflows';

export const WORKFLOWS_NODE_TYPES = [
  {
    type: 'request',
    label: 'Request',
    category: 'Start',
    ports: [{ id: 'out', direction: 'out' as const, dataType: 'any' }],
  },
  {
    type: 'approval',
    label: 'Approval',
    category: 'Review',
    ports: [
      { id: 'in', direction: 'in' as const, dataType: 'any' },
      { id: 'yes', direction: 'out' as const, dataType: 'any', label: 'Approved' },
    ],
  },
  {
    type: 'end',
    label: 'End',
    category: 'Done',
    ports: [{ id: 'in', direction: 'in' as const, dataType: 'any' }],
  },
];

const at = { x: 0, y: 0 };

export const WORKFLOWS_BUILD_OPS = [
  {
    op: 'addNode' as const,
    node: { id: 'ask', type: 'request', label: 'Expense submitted', position: at },
  },
  {
    op: 'addNode' as const,
    node: { id: 'lead', type: 'approval', label: 'Team lead', position: at },
  },
  {
    op: 'addNode' as const,
    node: { id: 'paid', type: 'end', label: 'Paid', position: at },
  },
  {
    op: 'connect' as const,
    edge: { id: 'e1', from: { node: 'ask', port: 'out' }, to: { node: 'lead', port: 'in' } },
  },
  {
    op: 'connect' as const,
    edge: { id: 'e2', from: { node: 'lead', port: 'yes' }, to: { node: 'paid', port: 'in' } },
  },
];

export const WORKFLOWS_CREATE_SAMPLE = `import { applyWorkflowOps, createWorkflow, defineNodeTypes } from '@texuli/workflows/model';

const registry = defineNodeTypes(${JSON.stringify(WORKFLOWS_NODE_TYPES, null, 2)});
const built = applyWorkflowOps(createWorkflow(), ${JSON.stringify(WORKFLOWS_BUILD_OPS, null, 2)}, { registry });

if (built.ok) {
  console.log(built.graph.nodes.map((node) => node.id));
}
`;

export const WORKFLOWS_LAYOUT_SAMPLE = `import { layoutMoves, layoutWorkflow } from '@texuli/workflows/layout';
import { applyWorkflowOps, createWorkflow, defineNodeTypes } from '@texuli/workflows/model';

const registry = defineNodeTypes(${JSON.stringify(WORKFLOWS_NODE_TYPES, null, 2)});
const built = applyWorkflowOps(createWorkflow(), ${JSON.stringify(WORKFLOWS_BUILD_OPS, null, 2)}, { registry });
if (built.ok) {
  const moves = layoutMoves(layoutWorkflow(built.graph, { direction: 'LR' }));
  const laid = applyWorkflowOps(built.graph, [{ op: 'moveNodes', moves }], { registry });
  if (laid.ok) {
    console.log(laid.graph.nodes.length);
  }
}
`;

export const WORKFLOWS_EDITOR_SAMPLE = `<script lang="ts">
  import { WorkflowEditor } from '@texuli/workflows/editor';
  import { applyWorkflowOps, createWorkflow, defineNodeTypes } from '@texuli/workflows/model';
  import '@texuli/tokens/base.css';

  const registry = defineNodeTypes(${JSON.stringify(WORKFLOWS_NODE_TYPES)});
  const built = applyWorkflowOps(createWorkflow(), ${JSON.stringify(WORKFLOWS_BUILD_OPS)}, { registry });
  let graph = $state.raw(built.ok ? built.graph : createWorkflow());
</script>

<WorkflowEditor {graph} {registry} onchange={(next) => (graph = next)} />
`;

export function workflowsQuickstart(entry: SolutionEntry): SolutionQuickstartProps {
  return {
    entry,
    title: 'Start with a workflow graph',
    install: { label: 'Install', language: 'bash', code: WORKFLOWS_INSTALL },
    samples: [
      { label: 'Create a graph', language: 'ts', code: WORKFLOWS_CREATE_SAMPLE },
      { label: 'Lay the graph out', language: 'ts', code: WORKFLOWS_LAYOUT_SAMPLE },
      { label: 'Edit with WorkflowEditor', language: 'svelte', code: WORKFLOWS_EDITOR_SAMPLE },
    ],
    verifiedBy: WORKFLOWS_QUICKSTART_VERIFIED_BY,
  };
}
