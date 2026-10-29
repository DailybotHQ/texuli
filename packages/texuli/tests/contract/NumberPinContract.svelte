<script lang="ts">
import type { HarnessProps } from '../../../primitives/tests/support/contract.ts';
import { NumberField, PinInput } from '../../src/components/number-pin/index.ts';

let { p, refs }: HarnessProps = $props();
const k = (name: string) => `components/number-pin/${name}`;
</script>

<NumberField.Root value={5} {...p(k('NumberFieldRoot'))} bind:ref={refs[k('NumberFieldRoot')]}>
  <NumberField.Decrement {...p(k('NumberFieldDecrement'))} bind:ref={refs[k('NumberFieldDecrement')]} />
  <NumberField.Input aria-label="Count" {...p(k('NumberFieldInput'))} bind:ref={refs[k('NumberFieldInput')]} />
  <NumberField.Increment {...p(k('NumberFieldIncrement'))} bind:ref={refs[k('NumberFieldIncrement')]} />
</NumberField.Root>
<PinInput.Root aria-label="Code" maxlength={4} value="12" {...p(k('PinInputRoot'))} bind:ref={refs[k('PinInputRoot')]}>
  {#snippet children({ cells })}
    {#each cells as cell, index (index)}
      {#if index === 1}
        <PinInput.Cell {cell} {...p(k('PinInputCell'))} bind:ref={refs[k('PinInputCell')]} />
      {:else}
        <PinInput.Cell {cell} />
      {/if}
    {/each}
  {/snippet}
</PinInput.Root>
