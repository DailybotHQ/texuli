<script lang="ts">
import { PinInput } from '../../src/pin-input/index.ts';
import type { HarnessProps } from '../support/contract.ts';

let { p, refs }: HarnessProps = $props();
</script>

<PinInput.Root aria-label="Code" maxlength={4} value="12" {...p('pin-input/Root')} bind:ref={refs['pin-input/Root']}>
  {#snippet children({ cells })}
    {#each cells as cell, index (index)}
      {#if index === 1}
        <PinInput.Cell {cell} {...p('pin-input/Cell')} bind:ref={refs['pin-input/Cell']} />
      {:else}
        <PinInput.Cell {cell} />
      {/if}
    {/each}
  {/snippet}
</PinInput.Root>
