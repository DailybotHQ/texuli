<script lang="ts">
import * as Popover from '../../src/popover/index.ts';
import type { HarnessProps } from '../support/contract.ts';

let { p, refs }: HarnessProps = $props();
</script>

<Popover.Root open>
  <Popover.Trigger {...p('popover/Trigger')} bind:ref={refs['popover/Trigger']}>Open</Popover.Trigger>
  <Popover.Content aria-label="Details" {...p('popover/Content')} bind:ref={refs['popover/Content']}>
    <Popover.Close {...p('popover/Close')} bind:ref={refs['popover/Close']}>Close</Popover.Close>
  </Popover.Content>
</Popover.Root>
