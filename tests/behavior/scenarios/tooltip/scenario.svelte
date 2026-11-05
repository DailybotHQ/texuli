<script lang="ts">
import { Tooltip } from '../../../../packages/primitives/src/tooltip/index.ts';
import { behaviorEvent } from '../../harness/client/events.ts';
</script>

<Tooltip.Provider delayDuration={300} skipDelayDuration={300}>
  <Tooltip.Root onOpenChange={(next) => behaviorEvent('openChange', next)}>
    <Tooltip.Trigger>
      {#snippet child({ props })}
        <button {...props}>Save draft</button>
      {/snippet}
    </Tooltip.Trigger>
    <Tooltip.Content side="top" sideOffset={6} data-behavior-layer>
      Saves without publishing
    </Tooltip.Content>
  </Tooltip.Root>
  <!-- A disabled tooltip only stays closed; its trigger still works (D-G-042). -->
  <Tooltip.Root disabled>
    <Tooltip.Trigger>
      {#snippet child({ props })}
        <button {...props} onclick={() => behaviorEvent('publish')}>Publish</button>
      {/snippet}
    </Tooltip.Trigger>
    <Tooltip.Content side="top" sideOffset={6} data-behavior-layer>Publishes now</Tooltip.Content>
  </Tooltip.Root>
</Tooltip.Provider>
