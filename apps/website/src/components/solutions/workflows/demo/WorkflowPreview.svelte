<script lang="ts">
import { WorkflowViewer } from '@texuli/workflows/viewer';
import {
  createExpenseApprovalGraph,
  EXPENSE_APPROVAL_REGISTRY,
} from './fixtures/expense-approval.ts';

const graph = createExpenseApprovalGraph();
</script>

<div data-tx-workflows-demo-preview="expense-approval">
  <WorkflowViewer
    {graph}
    registry={EXPENSE_APPROVAL_REGISTRY}
    label="Expense approval workflow preview"
  />
</div>

<style>
  /*
   * The preview never hydrates, so the viewer never measures its box and stays at scale 1:
   * on a narrow screen its frame (overflow hidden) would cut the graph after the first step.
   * Let the frame scroll sideways instead; the interactive demo below fits the graph.
   */
  [data-tx-workflows-demo-preview] :global(.tx-workflow-viewer__frame) {
    overflow-x: auto;
    overflow-y: hidden;
    overscroll-behavior-inline: contain;
  }
</style>
