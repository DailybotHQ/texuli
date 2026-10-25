<script lang="ts">
import { REGEXP_ONLY_DIGITS } from '@texuli/primitives/pin-input';
import { NumberField, PinInput } from '../../src/components/number-pin/index.ts';

let amount = $state<number | null>(1);
let code = $state('12');
</script>

<label for="test-amount">Quantity</label>
<NumberField.Root id="test-amount" bind:value={amount} min={0} max={3} class="custom-number-field">
  <NumberField.Decrement />
  <NumberField.Input aria-label="Quantity" />
  <NumberField.Increment />
</NumberField.Root>

<label for="test-pin">Verification code</label>
<PinInput.Root bind:value={code} inputId="test-pin" maxlength={4} pattern={REGEXP_ONLY_DIGITS} class="custom-pin-input">
  {#snippet children({ cells })}
    {#each cells as cell, index (index)}<PinInput.Cell {cell} />{/each}
  {/snippet}
</PinInput.Root>
