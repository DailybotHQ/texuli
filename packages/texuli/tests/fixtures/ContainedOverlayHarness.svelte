<script lang="ts">
import type { FocusRestoreEvent } from '@texuli/core/focus-scope';
import type { OverlayDismissEvent } from '@texuli/core/overlay';
import { CommandPalette } from '../../src/components/command/index.ts';
import { AlertDialog, Dialog } from '../../src/components/dialog/index.ts';

/** A styled overlay contained in a framed preview (G53). */
let {
  kind = 'dialog',
  open = $bindable(true),
  onDismissRequest,
  onCloseAutoFocus,
}: {
  kind?: 'dialog' | 'alert' | 'palette';
  open?: boolean;
  onDismissRequest?: (event: OverlayDismissEvent) => void;
  onCloseAutoFocus?: (event: FocusRestoreEvent) => void;
} = $props();
let frame = $state<HTMLElement | null>(null);
</script>

<button type="button">Outside action</button>
<div bind:this={frame} data-testid="frame">
  <button type="button">Frame action</button>
  {#if frame}
    {#if kind === 'dialog'}
      <Dialog bind:open title="Edit" mode="contained" container={frame} {onDismissRequest} {onCloseAutoFocus}>
        <input aria-label="Name" />
      </Dialog>
    {:else if kind === 'alert'}
      <AlertDialog bind:open title="Delete?" mode="contained" container={frame} {onDismissRequest} {onCloseAutoFocus} />
    {:else}
      <CommandPalette bind:open mode="contained" container={frame} {onDismissRequest} {onCloseAutoFocus} />
    {/if}
  {/if}
</div>
