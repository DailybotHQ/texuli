<script lang="ts">
import { layoutMoves, layoutWorkflow } from '@texuli/workflows/layout';
import {
  applyWorkflowOps,
  createWorkflow,
  defineNodeTypes,
  type WorkflowOp,
} from '@texuli/workflows/model';
import { WorkflowViewer } from '@texuli/workflows/viewer';

/** A fictional expense approval, laid out top to bottom by the layered auto-layout. */
const registry = defineNodeTypes([
  {
    type: 'request',
    label: 'Request',
    category: 'Start',
    ports: [{ id: 'out', direction: 'out', dataType: 'any', label: 'Submitted' }],
    props: { form: { kind: 'url', label: 'Form' } },
  },
  {
    type: 'approval',
    label: 'Approval',
    category: 'Review',
    ports: [
      { id: 'in', direction: 'in', dataType: 'any' },
      { id: 'yes', direction: 'out', dataType: 'any', cardinality: 'one', label: 'Approved' },
      { id: 'no', direction: 'out', dataType: 'any', cardinality: 'one', label: 'Declined' },
    ],
  },
  {
    type: 'end',
    label: 'End',
    category: 'Done',
    ports: [{ id: 'in', direction: 'in', dataType: 'any' }],
  },
]);

const at = { x: 0, y: 0 };
const ops: WorkflowOp[] = [
  {
    op: 'addNode',
    node: {
      id: 'ask',
      type: 'request',
      label: 'Expense submitted',
      position: at,
      props: { form: 'https://forms.example.com/expense' },
    },
  },
  { op: 'addNode', node: { id: 'lead', type: 'approval', label: 'Team lead', position: at } },
  { op: 'addNode', node: { id: 'finance', type: 'approval', label: 'Finance', position: at } },
  { op: 'addNode', node: { id: 'paid', type: 'end', label: 'Paid', position: at } },
  { op: 'addNode', node: { id: 'declined', type: 'end', label: 'Declined', position: at } },
  {
    op: 'connect',
    edge: { id: 'e1', from: { node: 'ask', port: 'out' }, to: { node: 'lead', port: 'in' } },
  },
  {
    op: 'connect',
    edge: { id: 'e2', from: { node: 'lead', port: 'yes' }, to: { node: 'finance', port: 'in' } },
  },
  {
    op: 'connect',
    edge: { id: 'e3', from: { node: 'lead', port: 'no' }, to: { node: 'declined', port: 'in' } },
  },
  {
    op: 'connect',
    edge: { id: 'e4', from: { node: 'finance', port: 'yes' }, to: { node: 'paid', port: 'in' } },
  },
  {
    op: 'connect',
    edge: { id: 'e5', from: { node: 'finance', port: 'no' }, to: { node: 'declined', port: 'in' } },
  },
];

const built = applyWorkflowOps(createWorkflow(), ops, { registry });
if (!built.ok) throw new Error(built.error.message);
const nodeSize = () => ({ width: 200, height: 72 });
const laid = applyWorkflowOps(
  built.graph,
  [
    {
      op: 'moveNodes',
      moves: layoutMoves(layoutWorkflow(built.graph, { direction: 'TB', nodeSize, rankGap: 64 })),
    },
  ],
  { registry }
);
const graph = laid.ok ? laid.graph : built.graph;
</script>

<WorkflowViewer {graph} {registry} {nodeSize} flow="TB" label="Expense approval" />
