<script lang="ts">
import { Tooltip, type TooltipSide } from '../../src/components/tooltip/index.ts';

let {
  content = 'Saves without publishing',
  shortcut = undefined as string | readonly string[] | undefined,
  side = 'top' as TooltipSide,
  open = false,
  disabled = false,
  label = 'Save draft',
}: {
  content?: string;
  shortcut?: string | readonly string[];
  side?: TooltipSide;
  open?: boolean;
  disabled?: boolean;
  label?: string;
} = $props();

// Controlled open is driven only by the prop (tests force open when needed).
let isOpen = $state(false);

$effect(() => {
  isOpen = open;
});
</script>

<div data-tooltip-harness>
  <Tooltip {content} {shortcut} {side} {disabled} bind:open={isOpen}>
    {#snippet children({ props })}
      <button type="button" {...props} data-tooltip-trigger>{label}</button>
    {/snippet}
  </Tooltip>
</div>
