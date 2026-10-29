<script lang="ts">
import { createOverlayCore } from '@texuli/core/overlay-core';
import { positionFloating } from '@texuli/core/position-dom';
import type { Placement } from '@texuli/core/position-math';
import { getContext, type Snippet, untrack } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type { RefProp } from '../internal/ref.ts';
import { TOOLTIP_CONTEXT, type TooltipContext } from './context.ts';

interface Props extends HTMLAttributes<HTMLDivElement> {
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
  sideOffset?: number;
  class?: string;
  children?: Snippet;
}

let {
  side = 'top',
  align = 'center',
  sideOffset = 6,
  class: className,
  children,
  ref = $bindable(null),
  ...attributes
}: Props & RefProp = $props();
const tooltip = getContext<TooltipContext>(TOOLTIP_CONTEXT);
// A consumer id wins: the context records it, so every reference follows.
tooltip.claimId(
  'content',
  untrack(() => attributes.id)
);
$effect(() => {
  tooltip.claimId('content', attributes.id);
  return () => tooltip.claimId('content', undefined);
});
let element = $state<HTMLDivElement | null>(null);
// `ref` follows the element the part binds for its own behavior.
$effect(() => {
  ref = element ?? null;
});

const placement = $derived((align === 'center' ? side : `${side}-${align}`) as Placement);

$effect(() => {
  const floating = element;
  const trigger = tooltip.trigger();
  if (!floating || !trigger || !tooltip.isOpen()) return;

  const overlay = createOverlayCore(
    {
      element: floating,
      anchor: trigger,
      position: { placement, offset: sideOffset, flip: true, shift: true, boundaryPadding: 8 },
      dismiss: { escape: true, pointerOutside: false, focusOutside: false },
      onDismissRequest: (request) => {
        if (request.reason === 'escape') tooltip.requestClose();
      },
      label: 'Tooltip',
    },
    // Positioning only: a tooltip never traps focus, makes the page inert or locks scroll.
    { position: positionFloating }
  );
  overlay.open();
  return () => overlay.destroy();
});
</script>

{#if tooltip.isOpen()}
  <div
    bind:this={element}
    {...attributes}
    id={tooltip.contentId}
    class={className}
    role="tooltip"
    data-state="open"
    onpointerenter={(event) => tooltip.pointerEnter(event)}
    onpointerleave={(event) => tooltip.pointerLeave(event)}
  >
    {@render children?.()}
  </div>
{/if}
