<script lang="ts">
import * as AlertDialog from '../../src/alert-dialog/index.ts';
import * as Dialog from '../../src/dialog/index.ts';
import { Sheet } from '../../src/sheet/index.ts';

let {
  contained = false,
  kind = 'dialog',
}: { contained?: boolean; kind?: 'dialog' | 'alert' | 'sheet' } = $props();
let container = $state<HTMLElement | null>(null);
let open = $state(true);
const mode = $derived(contained ? 'contained' : 'top-layer');
</script>

<!-- Mounted already open (a lazily imported palette), optionally contained. -->
<div bind:this={container} data-container>
  {#if !contained || container}
    {#if kind === 'dialog'}
      <Dialog.Root bind:open {mode} {container}>
        <Dialog.Portal>
          <Dialog.Overlay data-testid="backdrop" />
          <Dialog.Content>
            <Dialog.Title>Command palette</Dialog.Title>
            <input aria-label="Search commands" />
            <Dialog.Close>Close</Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    {:else if kind === 'alert'}
      <AlertDialog.Root bind:open {mode} {container}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay data-testid="backdrop" />
          <AlertDialog.Content>
            <AlertDialog.Title>Delete project?</AlertDialog.Title>
            <input aria-label="Search commands" />
            <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
            <AlertDialog.Action>Delete</AlertDialog.Action>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    {:else}
      <Sheet.Root bind:open {mode} {container}>
        <Sheet.Portal>
          <Sheet.Overlay data-testid="backdrop" />
          <Sheet.Content side="right">
            <Sheet.Title>Filters</Sheet.Title>
            <input aria-label="Search commands" />
            <Sheet.Close>Close</Sheet.Close>
          </Sheet.Content>
        </Sheet.Portal>
      </Sheet.Root>
    {/if}
  {/if}
</div>
