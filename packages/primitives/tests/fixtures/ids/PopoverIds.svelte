<script lang="ts">
import * as Popover from '../../../src/popover/index.ts';
</script>

<Popover.Root>
  <Popover.Trigger id="share-trigger">Share</Popover.Trigger>
  <Popover.Content id="share-popover" aria-label="Share options">
    <p>Copy the fictional link.</p>
    <Popover.Close>Close</Popover.Close>
  </Popover.Content>
</Popover.Root>
