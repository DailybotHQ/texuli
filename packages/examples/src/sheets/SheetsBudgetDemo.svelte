<script lang="ts">
import { SheetView } from '@texuli/sheets/view';
import { offsiteBudget } from './budget.ts';

/** An editable budget: totals, a SUMIF and a cross-sheet reference recalculate as cells change. */
let sheet = $state(offsiteBudget());
</script>

<div data-example="sheets-budget">
  <SheetView bind:sheet viewportHeight={360} />
</div>
