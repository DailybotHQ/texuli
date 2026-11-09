<script lang="ts">
import { SheetView } from '@texuli/sheets/view';
import { createProjectBudgetFixture } from './fixtures/project-budget.ts';

const sheet = createProjectBudgetFixture();
</script>

<SheetView
  {sheet}
  readonly
  label="Project budget spreadsheet preview"
  density="compact"
  viewportHeight={240}
/>
