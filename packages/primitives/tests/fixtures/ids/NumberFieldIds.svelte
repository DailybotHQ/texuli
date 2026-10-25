<script lang="ts">
import { NumberField } from '../../../src/number-field/index.ts';
</script>

<label for="quantity">Quantity</label>
<NumberField.Root value={2}>
  <NumberField.Decrement aria-label="Decrease">-</NumberField.Decrement>
  <NumberField.Input id="quantity" />
  <NumberField.Increment aria-label="Increase">+</NumberField.Increment>
</NumberField.Root>
