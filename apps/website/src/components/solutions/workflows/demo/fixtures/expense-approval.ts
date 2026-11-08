import { layoutMoves, layoutWorkflow } from '@texuli/workflows/layout';
import {
  applyWorkflowOps,
  createWorkflow,
  defineNodeTypes,
  type WorkflowGraph,
  type WorkflowOp,
} from '@texuli/workflows/model';

/** Closed node types for the fictional expense-approval walkthrough. */
export const EXPENSE_APPROVAL_REGISTRY = defineNodeTypes([
  {
    type: 'request',
    label: 'Expense request',
    category: 'Start',
    ports: [{ id: 'submitted', direction: 'out', dataType: 'expense', label: 'Submitted' }],
    props: { source: { kind: 'text', label: 'Source', default: 'example.com' } },
  },
  {
    type: 'manager-review',
    label: 'Manager review',
    category: 'Review',
    ports: [
      { id: 'request', direction: 'in', dataType: 'expense', label: 'Request' },
      { id: 'approved', direction: 'out', dataType: 'decision', label: 'Approved' },
      { id: 'rejected', direction: 'out', dataType: 'decision', label: 'Rejected' },
    ],
    props: { team: { kind: 'text', label: 'Team', default: 'Finance' } },
  },
  {
    type: 'outcome',
    label: 'Outcome',
    category: 'Finish',
    ports: [{ id: 'decision', direction: 'in', dataType: 'decision', label: 'Decision' }],
    props: { status: { kind: 'enum', label: 'Status', values: ['Approved', 'Rejected'] } },
  },
  {
    type: 'notification',
    label: 'Notify requester',
    category: 'Actions',
    ports: [
      { id: 'decision', direction: 'in', dataType: 'decision', label: 'Decision' },
      { id: 'sent', direction: 'out', dataType: 'decision', label: 'Sent' },
    ],
    props: { recipient: { kind: 'text', label: 'Recipient', default: 'requester@example.com' } },
  },
]);

const ORIGIN = { x: 0, y: 0 };

/** Builds the same deterministic, fictional graph each time. */
export function createExpenseApprovalGraph(): WorkflowGraph {
  const operations: WorkflowOp[] = [
    {
      op: 'addNode',
      node: {
        id: 'expense-request',
        type: 'request',
        label: 'Submit expense',
        position: ORIGIN,
        props: { source: 'example.com' },
      },
    },
    {
      op: 'addNode',
      node: {
        id: 'manager-review',
        type: 'manager-review',
        label: 'Manager review',
        position: ORIGIN,
        props: { team: 'Finance' },
      },
    },
    {
      op: 'addNode',
      node: {
        id: 'expense-approved',
        type: 'outcome',
        label: 'Approved',
        position: ORIGIN,
        props: { status: 'Approved' },
      },
    },
    {
      op: 'addNode',
      node: {
        id: 'expense-rejected',
        type: 'outcome',
        label: 'Rejected',
        position: ORIGIN,
        props: { status: 'Rejected' },
      },
    },
    {
      op: 'connect',
      edge: {
        id: 'request-to-review',
        from: { node: 'expense-request', port: 'submitted' },
        to: { node: 'manager-review', port: 'request' },
      },
    },
    {
      op: 'connect',
      edge: {
        id: 'review-approved',
        from: { node: 'manager-review', port: 'approved' },
        to: { node: 'expense-approved', port: 'decision' },
      },
    },
    {
      op: 'connect',
      edge: {
        id: 'review-rejected',
        from: { node: 'manager-review', port: 'rejected' },
        to: { node: 'expense-rejected', port: 'decision' },
      },
    },
  ];
  const built = applyWorkflowOps(createWorkflow(), operations, {
    registry: EXPENSE_APPROVAL_REGISTRY,
  });
  if (!built.ok) throw new Error(built.error.message);

  const moves = layoutMoves(layoutWorkflow(built.graph, { direction: 'LR' }));
  const laidOut = applyWorkflowOps(built.graph, [{ op: 'moveNodes', moves }], {
    registry: EXPENSE_APPROVAL_REGISTRY,
  });
  if (!laidOut.ok) throw new Error(laidOut.error.message);
  return laidOut.graph;
}
