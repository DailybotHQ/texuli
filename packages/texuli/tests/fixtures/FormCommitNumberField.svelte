<script lang="ts">
import { NumberField } from '../../src/components/number-pin/index.ts';
</script>

<NumberField.Root name="qty" defaultValue={1} commit="blur" min={0} max={500}>
  <NumberField.Input aria-label="Quantity" />
</NumberField.Root>
