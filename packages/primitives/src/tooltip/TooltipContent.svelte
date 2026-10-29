<script lang="ts">
import { createOverlayCore, type OverlayController } from '@texuli/core/overlay-core';
import { positionFloating } from '@texuli/core/position-dom';
import type { Placement } from '@texuli/core/position-math';
import { getContext, type Snippet, untrack } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { createMotionHold, type OverlayMotionHooks } from '../internal/motion-hold.ts';
import type { RefProp } from '../internal/ref.ts';
import { TOOLTIP_CONTEXT, type TooltipContext } from './context.ts';

interface Props extends HTMLAttributes<HTMLDivElement> {
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
  sideOffset?: number;
  class?: string;
  /**
   * Enter and exit motion (texuli passes `texuli/motion` hooks): while the
   * exit plays, the closed tooltip stays shown, inert.
   */
  motionHooks?: OverlayMotionHooks;
  children?: Snippet;
}

let {
  side = 'top',
  align = 'center',
  sideOffset = 6,
  class: className,
  motionHooks,
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

let held = $state(false);
let overlay: OverlayController | null = null;
// Open when it is created (first render, hydration): no enter animation.
let appeared = untrack(() => tooltip.isOpen());
let wasOpen = untrack(() => tooltip.isOpen());
let pendingEnter = false;
const hold = createMotionHold(
  () => motionHooks,
  (next) => (held = next)
);
/** Shown: open, or closed while its exit plays. */
const visible = $derived(tooltip.isOpen() || held);

// Before the DOM update: a closing tooltip is still shown when its exit starts.
$effect.pre(() => {
  const open = tooltip.isOpen();
  untrack(() => {
    if (open === wasOpen) return;
    wasOpen = open;
    if (!open) {
      appeared = false;
      pendingEnter = false;
      if (hold.begin(element)) overlay?.close();
      return;
    }
    if (appeared) {
      appeared = false;
      return;
    }
    if (!hold.held() || !element) {
      pendingEnter = true;
      return;
    }
    // Reopened during its exit: the same element opens again.
    overlay?.open();
    hold.enter(element);
  });
});
$effect(() => () => hold.cancel());

$effect(() => {
  const floating = element;
  const trigger = tooltip.trigger();
  if (!floating || !trigger || !visible) return;

  const created = createOverlayCore(
    {
      element: floating,
      anchor: trigger,
      position: { placement, offset: sideOffset, flip: true, shift: true, boundaryPadding: 8 },
      dismiss: { escape: true, pointerOutside: false, focusOutside: false },
      onDismissRequest: (request) => {
        if (request.reason === 'escape') tooltip.requestClose();
      },
      label: 'Tooltip',
      presence: { isMotionPending: hold.isMotionPending },
    },
    // Positioning only: a tooltip never traps focus, makes the page inert or locks scroll.
    { position: positionFloating }
  );
  overlay = created;
  if (untrack(() => tooltip.isOpen())) created.open();
  if (pendingEnter) {
    pendingEnter = false;
    hold.enter(floating);
  }
  return () => {
    created.destroy();
    if (overlay === created) overlay = null;
  };
});
</script>

{#if visible}
  <div
    bind:this={element}
    {...attributes}
    id={tooltip.contentId}
    class={className}
    role="tooltip"
    data-state={tooltip.isOpen() ? 'open' : 'closed'}
    inert={!tooltip.isOpen() || undefined}
    onpointerenter={(event) => tooltip.pointerEnter(event)}
    onpointerleave={(event) => tooltip.pointerLeave(event)}
  >
    {@render children?.()}
  </div>
{/if}
