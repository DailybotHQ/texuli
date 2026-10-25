<script lang="ts">
// PinInput scenario: @texuli/primitives.
import { PinInput, REGEXP_ONLY_DIGITS } from '@texuli/primitives/pin-input';
import { behaviorEvent } from '../../harness/client/events.ts';

let value = $state('');
</script>

<label for="behavior-pin">Verification code</label>
<PinInput.Root
  bind:value
  inputId="behavior-pin"
  maxlength={6}
  pattern={REGEXP_ONLY_DIGITS}
  onComplete={(code: string) => behaviorEvent('complete', code)}
  class="behavior-pin"
>
  {#snippet children({ cells })}
    {#each cells as cell, index (index)}
      <PinInput.Cell {cell} class="behavior-pin-cell" />
    {/each}
  {/snippet}
</PinInput.Root>
<output data-behavior-value>{value}</output>

<style>
  :global(.behavior-pin) {
    display: flex;
    gap: 0.5rem;
    inline-size: max-content;
  }
  :global(.behavior-pin-cell) {
    display: grid;
    place-items: center;
    inline-size: 2.5rem;
    block-size: 3rem;
    border: 1px solid CanvasText;
    color: CanvasText;
  }
</style>
