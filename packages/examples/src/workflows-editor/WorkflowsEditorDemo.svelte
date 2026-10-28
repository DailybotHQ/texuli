<script lang="ts">
import { WorkflowEditor } from '@texuli/workflows/editor';
import {
  applyWorkflowOps,
  createWorkflow,
  defineNodeTypes,
  type WorkflowGraph,
  type WorkflowOp,
} from '@texuli/workflows/model';

/** A fictional order pipeline on example.com endpoints. */
const registry = defineNodeTypes(
  [
    {
      type: 'schedule',
      label: 'Schedule',
      category: 'Triggers',
      ports: [{ id: 'out', direction: 'out', dataType: 'event', label: 'Fired' }],
      props: {
        every: { kind: 'enum', label: 'Every', values: ['hour', 'day', 'week'], default: 'hour' },
      },
    },
    {
      type: 'http',
      label: 'HTTP request',
      category: 'Actions',
      ports: [
        { id: 'in', direction: 'in', dataType: 'any', label: 'Input' },
        { id: 'out', direction: 'out', dataType: 'json', label: 'Response' },
      ],
      props: {
        url: { kind: 'url', label: 'Address' },
        retries: { kind: 'number', label: 'Retries', min: 0, max: 5, default: 1 },
      },
    },
    {
      type: 'filter',
      label: 'Filter',
      category: 'Logic',
      ports: [
        { id: 'in', direction: 'in', dataType: 'json', cardinality: 'one', label: 'Items' },
        { id: 'match', direction: 'out', dataType: 'json', label: 'Match' },
        { id: 'rest', direction: 'out', dataType: 'json', label: 'Rest' },
      ],
      props: { rule: { kind: 'text', label: 'Rule', maxLength: 120 } },
    },
    {
      type: 'notify',
      label: 'Notify',
      category: 'Actions',
      ports: [{ id: 'in', direction: 'in', dataType: 'json', label: 'Message' }],
      props: { channel: { kind: 'text', label: 'Channel', maxLength: 60 } },
    },
  ],
  { compatibility: { event: ['json'] } }
);

const ops: WorkflowOp[] = [
  {
    op: 'addNode',
    node: {
      id: 'tick',
      type: 'schedule',
      label: 'Every hour',
      position: { x: 0, y: 96 },
      props: { every: 'hour' },
    },
  },
  {
    op: 'addNode',
    node: {
      id: 'orders',
      type: 'http',
      label: 'Fetch orders',
      position: { x: 272, y: 96 },
      props: { url: 'https://api.example.com/orders', retries: 2 },
    },
  },
  {
    op: 'addNode',
    node: {
      id: 'large',
      type: 'filter',
      label: 'Large orders',
      position: { x: 544, y: 96 },
      props: { rule: 'total > 500' },
    },
  },
  {
    op: 'addNode',
    node: {
      id: 'sales',
      type: 'notify',
      label: 'Tell sales',
      position: { x: 816, y: 0 },
      props: { channel: 'sales' },
    },
  },
  {
    op: 'addNode',
    node: {
      id: 'log',
      type: 'notify',
      label: 'Log the rest',
      position: { x: 816, y: 192 },
      props: { channel: 'audit' },
    },
  },
  {
    op: 'connect',
    edge: { id: 'e1', from: { node: 'tick', port: 'out' }, to: { node: 'orders', port: 'in' } },
  },
  {
    op: 'connect',
    edge: { id: 'e2', from: { node: 'orders', port: 'out' }, to: { node: 'large', port: 'in' } },
  },
  {
    op: 'connect',
    edge: {
      id: 'e3',
      from: { node: 'large', port: 'match' },
      to: { node: 'sales', port: 'in' },
      label: 'match',
    },
  },
];

function initial(): WorkflowGraph {
  const result = applyWorkflowOps(createWorkflow(), ops, { registry });
  if (!result.ok) throw new Error(result.error.message);
  return result.graph;
}

// Raw state: the editor emits new immutable graphs; a deep proxy would only cost time.
let graph = $state.raw(initial());
</script>

<WorkflowEditor {graph} {registry} onchange={(next) => (graph = next)} />
