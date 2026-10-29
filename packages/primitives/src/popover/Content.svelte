<script lang="ts">
import type { FocusTarget } from '@texuli/core/focus-scope';
import {
  createOverlayCore,
  type OverlayController,
  type OverlayFeatures,
} from '@texuli/core/overlay-core';
import { type PositionFloatingOptions, positionFloating } from '@texuli/core/position-dom';
import { untrack } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type { RefProp } from '../internal/ref.ts';
import { getPopoverContext } from './context.ts';

type PopoverContentProps = Omit<HTMLAttributes<HTMLElement>, 'children'> & {
  children?: import('svelte').Snippet;
  /**
   * What to focus when the popover opens: an element inside the content, or
   * a function returning one (for example the selected date in a date
   * picker). When it resolves to nothing focusable, the popover keeps its
   * usual behavior: it focuses its first control (a modal popover prefers an
   * `[autofocus]` element), else the content itself.
   */
  initialFocus?: FocusTarget | (() => FocusTarget | null);
};

let {
  children,
  initialFocus,
  ref = $bindable(null),
  ...rest
}: PopoverContentProps & RefProp = $props();
const context = getPopoverContext();
// A consumer id wins: the context records it, so every reference follows.
context.claimId(
  'content',
  untrack(() => rest.id)
);
$effect(() => {
  context.claimId('content', rest.id);
  return () => context.claimId('content', undefined);
});

/** The initial focus target, if it is a focusable element inside the content. */
function resolveInitialFocus(node: HTMLElement): HTMLElement | null {
  const target = typeof initialFocus === 'function' ? initialFocus() : initialFocus;
  if (!target || !node.contains(target) || !target.isConnected) return null;
  if (target.matches(':disabled') || target.closest('[inert]')) return null;
  return target;
}

function attach(node: HTMLElement): () => void {
  const anchor =
    context.triggerElement ??
    (node.ownerDocument.getElementById(context.triggerId) as HTMLElement | null) ??
    undefined;
  context.registerTrigger(anchor);
  context.registerContent(node);
  const position: Partial<PositionFloatingOptions> = {
    placement: context.placement,
    offset: context.sideOffset,
    flip: true,
    shift: true,
    boundaryPadding: 8,
  };
  const create = (features: OverlayFeatures) => {
    const controller = createOverlayCore(
      {
        element: node,
        modal: context.modal,
        ...(context.positioning && anchor ? { anchor } : {}),
        ...(context.positioning ? { position } : {}),
        branches: () => [context.triggerElement],
        // Modal, as Dialog: choose every Tab stop (WebKit skips buttons in
        // native order) and return focus to the trigger even when the browser
        // never focused it on click.
        ...(context.modal
          ? {
              cycleTabNavigation: true,
              restoreFocusTarget: () => context.triggerElement ?? null,
            }
          : {}),
        label: 'popover',
        // Modal: the focus trap takes the target and falls back on its own.
        ...(context.modal && initialFocus ? { initialFocus: () => resolveInitialFocus(node) } : {}),
        onOpenChange: (open: boolean) => {
          // Non-modal: the root focuses the first control on open; the target,
          // when there is one, takes focus right after, in the same task.
          context.onOverlayOpenChange(open);
          if (!open || context.modal || !initialFocus) return;
          resolveInitialFocus(node)?.focus({ preventScroll: true });
        },
        onDismissRequest: context.onDismissRequest,
      },
      { position: positionFloating, ...features }
    );
    context.registerController(controller);
    return controller;
  };
  // A non-modal popover needs positioning only (presence and dismissal are in
  // the core). The modal features load on demand, so non-modal consumers never
  // bundle them; the root opens the controller once it registers.
  let controller: OverlayController | undefined;
  let destroyed = false;
  if (context.modal) {
    void import('./modal-features.ts').then(({ modalFeatures }) => {
      if (!destroyed) controller = create(modalFeatures);
    });
  } else controller = create({});
  return () => {
    destroyed = true;
    controller?.destroy();
    context.registerController(undefined);
    context.registerContent(undefined);
  };
}

const contentProps = $derived({
  ...rest,
  id: context.contentId,
  role: 'dialog' as const,
  'aria-modal': context.modal ? ('true' as const) : undefined,
  'data-state': context.open ? 'open' : 'closed',
  tabindex: -1,
  popover: 'manual' as const,
});
</script>

{#if context.open}
<div bind:this={ref} {...contentProps} {@attach attach}>
  {@render children?.()}
</div>
{/if}
