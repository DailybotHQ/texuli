<script lang="ts">
import { Tooltip } from '../../src/tooltip/index.ts';
import type { HarnessProps } from '../support/contract.ts';

let { p, refs }: HarnessProps = $props();
</script>

<Tooltip.Provider>
  <Tooltip.Root open>
    <Tooltip.Trigger {...p('tooltip/TooltipTrigger')} bind:ref={refs['tooltip/TooltipTrigger']}>Save</Tooltip.Trigger>
    <Tooltip.Content {...p('tooltip/TooltipContent')} bind:ref={refs['tooltip/TooltipContent']}>Saves the file</Tooltip.Content>
  </Tooltip.Root>
</Tooltip.Provider>
