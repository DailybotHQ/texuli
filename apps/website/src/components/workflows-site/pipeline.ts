import { layoutMoves, layoutWorkflow } from '@texuli/workflows/layout';
import {
  applyWorkflowOps,
  createWorkflow,
  defineNodeTypes,
  type WorkflowGraph,
  type WorkflowOp,
} from '@texuli/workflows/model';

/**
 * A fictional order-automation pipeline for example.com, shared by the
 * /workflows-page/ editor and viewer. Plain data: node types are a closed
 * registry, props are scalars, and URLs pass the core URL policy.
 */
export const PIPELINE_REGISTRY = defineNodeTypes(
  [
    {
      type: 'webhook',
      label: 'Webhook',
      category: 'Triggers',
      description: 'Starts a run when example.com posts an event.',
      ports: [{ id: 'out', direction: 'out', dataType: 'event', label: 'Received' }],
      props: {
        path: { kind: 'text', label: 'Path', maxLength: 80, default: '/hooks/orders' },
      },
    },
    {
      type: 'schedule',
      label: 'Schedule',
      category: 'Triggers',
      description: 'Starts a run on a timer.',
      ports: [{ id: 'out', direction: 'out', dataType: 'event', label: 'Fired' }],
      props: {
        every: { kind: 'enum', label: 'Every', values: ['hour', 'day', 'week'], default: 'day' },
      },
    },
    {
      type: 'http',
      label: 'HTTP request',
      category: 'Actions',
      description: 'Calls an example.com endpoint.',
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
      type: 'branch',
      label: 'Branch',
      category: 'Logic',
      description: 'Routes items by a rule.',
      ports: [
        { id: 'in', direction: 'in', dataType: 'json', cardinality: 'one', label: 'Items' },
        { id: 'yes', direction: 'out', dataType: 'json', label: 'Match' },
        { id: 'no', direction: 'out', dataType: 'json', label: 'Rest' },
      ],
      props: { rule: { kind: 'text', label: 'Rule', maxLength: 120 } },
    },
    {
      type: 'transform',
      label: 'Transform',
      category: 'Logic',
      description: 'Reshapes the payload.',
      ports: [
        { id: 'in', direction: 'in', dataType: 'json', label: 'Input' },
        { id: 'out', direction: 'out', dataType: 'json', label: 'Output' },
      ],
      props: { template: { kind: 'text', label: 'Template', maxLength: 120 } },
    },
    {
      type: 'notify',
      label: 'Notify',
      category: 'Outputs',
      description: 'Posts a message to a team channel.',
      ports: [{ id: 'in', direction: 'in', dataType: 'json', label: 'Message' }],
      props: {
        channel: { kind: 'text', label: 'Channel', maxLength: 60 },
        urgent: { kind: 'boolean', label: 'Urgent', default: false },
      },
    },
    {
      type: 'store',
      label: 'Store',
      category: 'Outputs',
      description: 'Appends rows to a table.',
      ports: [{ id: 'in', direction: 'in', dataType: 'json', label: 'Rows' }],
      props: { table: { kind: 'text', label: 'Table', maxLength: 60 } },
    },
  ],
  { compatibility: { event: ['json'] } }
);

const origin = { x: 0, y: 0 };

const OPS: WorkflowOp[] = [
  {
    op: 'addNode',
    node: {
      id: 'orders-in',
      type: 'webhook',
      label: 'New order',
      position: origin,
      props: { path: '/hooks/orders' },
    },
  },
  {
    op: 'addNode',
    node: {
      id: 'fetch-customer',
      type: 'http',
      label: 'Fetch customer',
      position: origin,
      props: { url: 'https://api.example.com/customers', retries: 2 },
    },
  },
  {
    op: 'addNode',
    node: {
      id: 'large-order',
      type: 'branch',
      label: 'Order over 500?',
      position: origin,
      props: { rule: 'total > 500' },
    },
  },
  {
    op: 'addNode',
    node: {
      id: 'shape-alert',
      type: 'transform',
      label: 'Shape alert',
      position: origin,
      props: { template: 'Large order from {customer}' },
    },
  },
  {
    op: 'addNode',
    node: {
      id: 'tell-sales',
      type: 'notify',
      label: 'Tell sales',
      position: origin,
      props: { channel: 'sales', urgent: true },
    },
  },
  {
    op: 'addNode',
    node: {
      id: 'ledger',
      type: 'store',
      label: 'Order ledger',
      position: origin,
      props: { table: 'orders' },
    },
  },
  {
    op: 'connect',
    edge: {
      id: 'e1',
      from: { node: 'orders-in', port: 'out' },
      to: { node: 'fetch-customer', port: 'in' },
    },
  },
  {
    op: 'connect',
    edge: {
      id: 'e2',
      from: { node: 'fetch-customer', port: 'out' },
      to: { node: 'large-order', port: 'in' },
    },
  },
  {
    op: 'connect',
    edge: {
      id: 'e3',
      from: { node: 'large-order', port: 'yes' },
      to: { node: 'shape-alert', port: 'in' },
      label: 'match',
    },
  },
  {
    op: 'connect',
    edge: {
      id: 'e4',
      from: { node: 'shape-alert', port: 'out' },
      to: { node: 'tell-sales', port: 'in' },
    },
  },
  {
    op: 'connect',
    edge: {
      id: 'e5',
      from: { node: 'large-order', port: 'no' },
      to: { node: 'ledger', port: 'in' },
      label: 'rest',
    },
  },
  {
    op: 'connect',
    edge: {
      id: 'e6',
      from: { node: 'shape-alert', port: 'out' },
      to: { node: 'ledger', port: 'in' },
    },
  },
];

export const NODE_SIZE = { width: 200, height: 72 };

/** The pipeline, laid out by the layered auto-layout (left to right or top to bottom). */
export function pipelineGraph(direction: 'LR' | 'TB' = 'LR'): WorkflowGraph {
  const built = applyWorkflowOps(createWorkflow(), OPS, { registry: PIPELINE_REGISTRY });
  if (!built.ok) throw new Error(built.error.message);
  const laid = applyWorkflowOps(
    built.graph,
    [
      {
        op: 'moveNodes',
        moves: layoutMoves(
          layoutWorkflow(built.graph, { direction, nodeSize: () => NODE_SIZE, rankGap: 72 })
        ),
      },
    ],
    { registry: PIPELINE_REGISTRY }
  );
  return laid.ok ? laid.graph : built.graph;
}
