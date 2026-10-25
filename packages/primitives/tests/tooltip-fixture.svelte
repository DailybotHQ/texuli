<script lang="ts">
import { Tooltip } from '../src/tooltip/index.ts';

let firstOpen = $state(false);
</script>

<Tooltip.Provider delayDuration={300} skipDelayDuration={400}>
  <Tooltip.Root bind:open={firstOpen}>
    <Tooltip.Trigger>
      {#snippet child({ props })}
        <button {...props}>First action</button>
      {/snippet}
    </Tooltip.Trigger>
    <Tooltip.Content side="top">First hint</Tooltip.Content>
  </Tooltip.Root>
  <Tooltip.Root>
    <Tooltip.Trigger>
      {#snippet child({ props })}
        <button {...props}>Second action</button>
      {/snippet}
    </Tooltip.Trigger>
    <Tooltip.Content side="bottom">Second hint</Tooltip.Content>
  </Tooltip.Root>
  <Tooltip.Root disabled>
    <Tooltip.Trigger>
      {#snippet child({ props })}
        <button {...props}>Disabled action</button>
      {/snippet}
    </Tooltip.Trigger>
    <Tooltip.Content>Disabled hint</Tooltip.Content>
  </Tooltip.Root>
  <output data-open-state>{firstOpen ? 'open' : 'closed'}</output>
</Tooltip.Provider>
