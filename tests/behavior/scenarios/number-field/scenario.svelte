<script lang="ts">
// NumberField scenario: @texuli/primitives' NumberField, held to the WAI-ARIA
// APG spinbutton pattern.
import { Label } from '@texuli/primitives/label';
import { NumberField } from '@texuli/primitives/number-field';
import { behaviorEvent } from '../../harness/client/events.ts';

let quantity = $state<number | null>(2);
let price = $state<number | null>(1234.5);

function submit(event: SubmitEvent) {
  event.preventDefault();
  behaviorEvent('submit', Object.fromEntries(new FormData(event.currentTarget as HTMLFormElement)));
}
</script>

<form aria-label="Number field examples" class="behavior-stack" onsubmit={submit}>
  <Label.Root for="quantity-input">Quantity</Label.Root>
  <NumberField.Root
    id="quantity"
    bind:value={quantity}
    min={0}
    max={10}
    name="quantity"
    class="behavior-row"
    onValueChange={(value) => behaviorEvent('valueChange', value)}
  >
    <NumberField.Decrement />
    <NumberField.Input />
    <NumberField.Increment />
  </NumberField.Root>

  <Label.Root for="price-input">Price</Label.Root>
  <NumberField.Root
    id="price"
    bind:value={price}
    locale="de-DE"
    step={0.01}
    min={0}
    formatOptions={{ style: 'currency', currency: 'EUR' }}
    name="price"
    class="behavior-row"
  >
    <NumberField.Decrement />
    <NumberField.Input />
    <NumberField.Increment />
  </NumberField.Root>

  <button type="submit">Save</button>
</form>

<style>
  .behavior-stack {
    display: grid;
    gap: 0.5rem;
    justify-items: start;
  }
  :global(.behavior-row) {
    display: flex;
    gap: 0.25rem;
    align-items: center;
  }
  :global(.behavior-row button) {
    min-inline-size: 2.75rem;
    min-block-size: 2.75rem;
  }
</style>
