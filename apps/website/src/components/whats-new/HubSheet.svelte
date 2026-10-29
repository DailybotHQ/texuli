<script lang="ts">
/**
 * /whats-new/ sheets demo: type a formula and the engine of
 * `@texuli/sheets` evaluates it against the order log of /sheets-page/
 * (`evaluateInLab`); a formula outside the language shows its error.
 */
import { evaluateInLab } from '../sheets-site/workbook.ts';

let formula = $state('=SUMIF(C2:C9, "paid", B2:B9)');
const result = $derived(evaluateInLab(formula, () => Date.now()));
</script>

<div class="hub-demo" data-hub-demo="sheets">
  <label class="hub-demo__field hub-demo__field--wide">
    <span>Formula over the order log (B: amounts, C: status)</span>
    <input type="text" spellcheck="false" autocomplete="off" bind:value={formula} />
  </label>
  <p class="hub-demo__out" role="status" data-hub-sheet-result="">
    {result.error ? `${result.value}: ${result.error}` : `= ${result.value}`}
  </p>
</div>
