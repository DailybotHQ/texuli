import { type LayoutDirection, layoutMoves, layoutWorkflow } from '@texuli/workflows/layout';
import {
  createWorkflowHistory,
  type PortRef,
  type WorkflowError,
  type WorkflowGraph,
  type WorkflowHistory,
  type WorkflowOp,
} from '@texuli/workflows/model';
import {
  createExpenseApprovalGraph,
  EXPENSE_APPROVAL_REGISTRY,
} from './fixtures/expense-approval.ts';

export type WorkflowDemoResult =
  | { ok: true; graph: WorkflowGraph }
  | { ok: false; error: WorkflowError };

export interface WorkflowDemoModel {
  readonly graph: WorkflowGraph;
  readonly selectedNodeId: string | null;
  readonly lastError: WorkflowError | null;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  selectNode(id: string | null): boolean;
  changeSelectedNodeLabel(label: string): WorkflowDemoResult;
  addStepFromPalette(): WorkflowDemoResult;
  connectPorts(from: PortRef, to: PortRef): WorkflowDemoResult;
  autoLayout(direction?: LayoutDirection): WorkflowDemoResult;
  undo(): boolean;
  redo(): boolean;
  reset(): void;
}

const NO_SELECTION: WorkflowError = {
  code: 'unknown-id',
  message: 'Select a workflow step before changing its label.',
};

/**
 * A small, DOM-free action model for the workflow demo. All graph edits go
 * through @texuli/workflows operations and history so validation and undo
 * behavior match the package users install.
 */
export function createWorkflowDemoModel(): WorkflowDemoModel {
  let history = createHistory();
  let selectedNodeId: string | null = null;
  let lastError: WorkflowError | null = null;
  let nextStep = 1;
  let nextConnection = 1;

  function createHistory(): WorkflowHistory {
    return createWorkflowHistory(createExpenseApprovalGraph(), {
      registry: EXPENSE_APPROVAL_REGISTRY,
    });
  }

  function apply(ops: WorkflowOp | readonly WorkflowOp[]): WorkflowDemoResult {
    const result = history.apply(ops);
    if (!result.ok) {
      lastError = result.error;
      return result;
    }
    lastError = null;
    return { ok: true, graph: result.graph };
  }

  return {
    get graph() {
      return history.graph;
    },
    get selectedNodeId() {
      return selectedNodeId;
    },
    get lastError() {
      return lastError;
    },
    get canUndo() {
      return history.canUndo;
    },
    get canRedo() {
      return history.canRedo;
    },
    selectNode(id) {
      if (id !== null && !history.graph.nodes.some((node) => node.id === id)) return false;
      selectedNodeId = id;
      lastError = null;
      return true;
    },
    changeSelectedNodeLabel(label) {
      if (selectedNodeId === null) {
        lastError = NO_SELECTION;
        return { ok: false, error: NO_SELECTION };
      }
      return apply({ op: 'setProps', id: selectedNodeId, label });
    },
    addStepFromPalette() {
      const number = nextStep;
      const result = apply({
        op: 'addNode',
        node: {
          id: `notify-requester-${number}`,
          type: 'notification',
          label: 'Notify requester',
          position: { x: 0, y: 0 },
          props: { recipient: 'requester@example.com' },
        },
      });
      if (result.ok) nextStep += 1;
      return result;
    },
    connectPorts(from, to) {
      const number = nextConnection;
      const result = apply({
        op: 'connect',
        edge: { id: `demo-connection-${number}`, from, to },
      });
      if (result.ok) nextConnection += 1;
      return result;
    },
    autoLayout(direction = 'LR') {
      const moves = layoutMoves(layoutWorkflow(history.graph, { direction }));
      return apply({ op: 'moveNodes', moves });
    },
    undo() {
      const changed = history.undo();
      if (changed) {
        if (
          selectedNodeId !== null &&
          !history.graph.nodes.some((node) => node.id === selectedNodeId)
        ) {
          selectedNodeId = null;
        }
        lastError = null;
      }
      return changed;
    },
    redo() {
      const changed = history.redo();
      if (changed) lastError = null;
      return changed;
    },
    reset() {
      history = createHistory();
      selectedNodeId = null;
      lastError = null;
      nextStep = 1;
      nextConnection = 1;
    },
  };
}
