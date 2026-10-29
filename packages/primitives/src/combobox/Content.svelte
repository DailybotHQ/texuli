<script lang="ts">
import { createOverlayCore, type OverlayController } from '@texuli/core/overlay-core';
import { positionFloating } from '@texuli/core/position-dom';
import { type Snippet, untrack } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type { RefProp } from '../internal/ref.ts';
import { getComboboxContext } from './context.ts';

type Props = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  children?: Snippet;
  sideOffset?: number;
} & RefProp;
let { children, sideOffset = 4, ref = $bindable(null), ...rest }: Props = $props();
const context = getComboboxContext();
// A consumer id wins: the context records it, so every reference follows.
context.claimId(
  'list',
  untrack(() => rest.id)
);
$effect(() => {
  context.claimId('list', rest.id);
  return () => context.claimId('list', undefined);
});
let controller: OverlayController | undefined;

function attach(node: HTMLDivElement): () => void {
  // An attachment flushed after the list left the document opens nothing.
  if (!node.isConnected) return () => {};
  const input = node.ownerDocument.querySelector<HTMLInputElement>(
    `[aria-controls="${context.listId}"][role="combobox"]`
  );

  controller = createOverlayCore(
    {
      element: node,
      modal: false,
      trapFocus: false,
      inertOutside: false,
      lockScroll: false,
      ...(input
        ? {
            anchor: input,
            position: {
              placement: 'bottom-start',
              offset: sideOffset,
              flip: true,
              shift: true,
              boundaryPadding: 8,
              // Match field width every position frame (ResizeObserver + trailing rAF).
              sameWidth: true,
            },
            branches: () => [input],
          }
        : {}),
      dismiss: {
        escape: true,
        pointerOutside: true,
        focusOutside: false,
        pointerPhase: 'pointerdown',
      },
      restoreFocus: false,
      label: 'combobox',
      onOpenChange(next) {
        if (!next) context.setOpen(false);
      },
    },
    { position: positionFloating }
  );
  context.registerOverlay(controller);
  controller.open();
  return () => {
    controller?.destroy();
    controller = undefined;
    context.registerOverlay(undefined);
  };
}
</script>

{#if context.open}
  <div bind:this={ref} {...rest} id={context.listId} role="listbox" aria-multiselectable={context.multiple ? 'true' : undefined} tabindex="-1" data-state="open" {@attach attach}>
    {@render children?.()}
  </div>
{/if}
