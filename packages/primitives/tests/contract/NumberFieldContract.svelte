<script lang="ts">
import {
  NumberFieldDecrement,
  NumberFieldIncrement,
  NumberFieldInput,
  NumberFieldRoot,
} from '../../src/number-field/index.ts';
import type { HarnessProps } from '../support/contract.ts';

let { p, refs }: HarnessProps = $props();
</script>

<NumberFieldRoot value={5} {...p('number-field/NumberFieldRoot')} bind:ref={refs['number-field/NumberFieldRoot']}>
  <NumberFieldDecrement {...p('number-field/NumberFieldDecrement')} bind:ref={refs['number-field/NumberFieldDecrement']} />
  <NumberFieldInput aria-label="Count" {...p('number-field/NumberFieldInput')} bind:ref={refs['number-field/NumberFieldInput']} />
  <NumberFieldIncrement {...p('number-field/NumberFieldIncrement')} bind:ref={refs['number-field/NumberFieldIncrement']} />
</NumberFieldRoot>
