<script lang="ts">
import { Tooltip } from '../../../src/tooltip/index.ts';
</script>

<Tooltip.Provider delayDuration={0}>
  <Tooltip.Root open>
    <Tooltip.Trigger id="save-trigger">Save draft</Tooltip.Trigger>
    <Tooltip.Content id="save-tip">Saves without publishing</Tooltip.Content>
  </Tooltip.Root>
</Tooltip.Provider>
