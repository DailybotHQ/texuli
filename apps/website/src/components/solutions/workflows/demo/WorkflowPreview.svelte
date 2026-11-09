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
