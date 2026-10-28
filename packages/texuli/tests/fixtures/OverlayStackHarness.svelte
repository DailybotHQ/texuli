<script lang="ts">
import { getInertRegistry } from '@texuli/core/inert';
import type { LayerStack } from '@texuli/core/layer-stack';
import { AlertDialog, Dialog } from '../../src/components/dialog/index.ts';
import { Sheet } from '../../src/components/sheet/index.ts';

let {
  kind = 'dialog',
  stack,
  open = $bindable(true),
}: { kind?: 'dialog' | 'alert' | 'sheet'; stack?: LayerStack; open?: boolean } = $props();

// A focus-exempt region outside the modal, like an undo toaster.
function exempt(node: HTMLElement) {
  const handle = getInertRegistry().exempt({ element: node, label: 'undo-toaster' });
  return () => handle.release();
}
</script>

<main><button type="button">Page action</button></main>
<section aria-label="Undo" {@attach exempt}>
  <button type="button">Undo</button>
  <button type="button">Dismiss</button>
</section>

{#if kind === 'dialog'}
  <Dialog bind:open title="Rename board" {stack}>
    <button type="button">Inside</button>
  </Dialog>
{:else if kind === 'alert'}
  <AlertDialog bind:open title="Delete board?" {stack} />
{:else}
  <Sheet.Root bind:open {stack}>
    <Sheet.Portal>
      <Sheet.Overlay />
      <Sheet.Content>
        <Sheet.Title>Filters</Sheet.Title>
        <Sheet.Close>Apply</Sheet.Close>
      </Sheet.Content>
    </Sheet.Portal>
  </Sheet.Root>
{/if}
