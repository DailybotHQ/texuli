<script lang="ts">
import { NumberField } from '../../src/components/number-pin/index.ts';

let {
  commit,
  onValueChange,
}: {
  commit?: 'input' | 'blur' | 'enter';
  onValueChange?: (value: number | null) => void;
} = $props();
let amount = $state<number | null>(1);
</script>

<NumberField.Root bind:value={amount} {commit} {onValueChange} min={0} max={500}>
  <NumberField.Decrement />
  <NumberField.Input aria-label="Quantity" />
  <NumberField.Increment />
</NumberField.Root>
<output data-testid="bound">{amount === null ? 'empty' : amount}</output>
