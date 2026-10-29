<script lang="ts">
import { createOverlayCore, type OverlayController } from '@texuli/core/overlay-core';
import { positionFloating } from '@texuli/core/position-dom';
import { untrack } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type { RefProp } from '../internal/ref.ts';
import { getSelectContext } from './context.ts';

type Props = Omit<HTMLAttributes<HTMLElement>, 'children'> & {
  children?: import('svelte').Snippet;
  sideOffset?: number;
} & RefProp;

let { children, sideOffset, class: className, ref = $bindable(null), ...rest }: Props = $props();
const context = getSelectContext();
// A consumer id wins: the context records it, so every reference follows.
context.claimId(
  'content',
  untrack(() => rest.id)
);
$effect(() => {
  context.claimId('content', rest.id);
  return () => context.claimId('content', undefined);
});
let controller: OverlayController | undefined;
let listNode: HTMLElement | undefined;

function attach(node: HTMLElement): () => void {
  listNode = node;
  context.registerContent(node);
  const trigger =
    (node.ownerDocument.getElementById(context.triggerId) as HTMLElement | null) ?? undefined;

  controller = createOverlayCore(
    {
      element: node,
      modal: false,
      trapFocus: false,
      inertOutside: false,
      lockScroll: false,
      ...(context.positioning && trigger
        ? {
            anchor: trigger,
            position: {
              placement: 'bottom-start',
              offset: sideOffset ?? context.sideOffset,
              flip: true,
              shift: true,
              boundaryPadding: 8,
              // Match trigger width every position frame (ResizeObserver + trailing rAF).
              sameWidth: true,
            },
          }
        : {}),
      branches: () => [trigger],
      dismiss: {
        escape: true,
        pointerOutside: true,
        focusOutside: true,
        pointerPhase: 'pointerdown',
      },
      restoreFocus: false,
      label: 'select',
      onOpenChange: (next) => {
        if (!next) context.onOverlayOpenChange(false);
      },
    },
    // A select list is anchored and not modal: positioning only.
    { position: positionFloating }
  );

  controller.open();

  const onKeydown = (event: KeyboardEvent) => context.handleListKeydown(event);
  trigger?.addEventListener('keydown', onKeydown);
  node.addEventListener('keydown', onKeydown);

  return () => {
    trigger?.removeEventListener('keydown', onKeydown);
    node.removeEventListener('keydown', onKeydown);
    controller?.destroy();
    controller = undefined;
    listNode = undefined;
    context.registerContent(undefined);
  };
}

const contentProps = $derived({
  ...rest,
  id: context.contentId,
  role: 'listbox' as const,
  'data-state': context.open ? 'open' : 'closed',
  class: className,
  tabindex: -1,
  popover: 'manual' as const,
});
</script>

{#if context.open}
  <div bind:this={ref} {...contentProps} {@attach attach}>
    {@render children?.()}
  </div>
{/if}
