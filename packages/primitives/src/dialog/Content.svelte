<script lang="ts">
import { createFocusScope } from '@texuli/core/focus-scope';
import { getInertRegistry } from '@texuli/core/inert';
import { createOverlayCore } from '@texuli/core/overlay-core';
import { lockScroll } from '@texuli/core/scroll-lock';
import { untrack } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { ensurePositioned } from '../internal/backdrop.ts';
import { createMotionHold, type OverlayMotionHooks } from '../internal/motion-hold.ts';
import type { RefProp } from '../internal/ref.ts';
import { getDialogContext, getDialogPortalContext } from './context.ts';

type Props = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  children?: import('svelte').Snippet;
  onCloseAutoFocus?: (event: import('@texuli/core/focus-scope').FocusRestoreEvent) => void;
  /**
   * Enter and exit motion (texuli passes `texuli/motion` hooks): while the
   * exit plays, the closed content stays mounted, inert. Focus, inert and
   * the layer stack are released at close, as without motion.
   */
  motionHooks?: OverlayMotionHooks;
} & RefProp;

let { children, onCloseAutoFocus, motionHooks, ref = $bindable(null), ...rest }: Props = $props();
const context = getDialogContext();
const portal = getDialogPortalContext();
// A consumer id wins: the context records it, so every reference follows.
context.claimId(
  'content',
  untrack(() => rest.id)
);
$effect(() => {
  context.claimId('content', rest.id);
  return () => context.claimId('content', undefined);
});
let isOpen = $state(context.open);
let held = $state(false);
// Open when it is created (first render, hydration): no enter animation.
let appeared = untrack(() => context.open);
let entered: HTMLElement | null = null;
const hold = createMotionHold(
  () => motionHooks,
  (next) => (held = next)
);

let node: HTMLDivElement | null = null;
$effect(() =>
  context.subscribeOpen((next) => {
    // Closing: start the exit before the content would unmount (a bound
    // `open` changes before the engine closes).
    if (!next && isOpen) {
      entered = null;
      hold.begin(node);
    }
    isOpen = next;
  })
);
$effect(() => () => hold.cancel());

function attach(element: HTMLDivElement): () => void {
  node = element;
  // Inside a Portal, open only once it is placed (moving a focused node blurs
  // it). Re-registers if the mode or the container changes; the open state it
  // reads while registering must not re-run it (a close would hide it mid-exit).
  if (portal && !portal.placed) return () => {};
  void context.mode;
  void context.container;
  const release = untrack(() => attachContent(element));
  return () => {
    release();
    if (node === element) node = null;
  };
}

function attachContent(node: HTMLDivElement): () => void {
  // Inside a Portal, open only once it is placed: moving a focused node blurs it.
  if (portal && !portal.placed) return () => {};
  // Contained: positioned, so its z-index stacks it above the contained backdrop.
  const restorePosition = context.mode === 'contained' ? ensurePositioned(node) : () => {};
  context.registerContent(node);
  const controller = createOverlayCore(
    {
      element: node,
      mode: context.mode,
      container: context.container,
      ...(context.stack ? { stack: context.stack } : {}),
      modal: true,
      cycleTabNavigation: true,
      restoreFocusTarget: () => context.triggerElement ?? null,
      initialFocus: context.initialFocus,
      branches: () => [context.triggerElement],
      label: 'dialog',
      presence: { isMotionPending: hold.isMotionPending },
      onOpenChange: (open) => {
        // Before the engine's presence reads `isMotionPending`.
        if (!open) {
          entered = null;
          hold.begin(node);
        }
        context.onOverlayOpenChange(open);
        if (!open) return;
        // Once per opening (the attachment may re-run while open).
        if (entered !== node) {
          entered = node;
          if (appeared) appeared = false;
          else hold.enter(node);
        }
        node.ownerDocument.defaultView?.requestAnimationFrame(() => {
          const popover = node as HTMLDivElement & {
            hidePopover?: () => void;
            showPopover?: () => void;
          };
          if (!controller.isOpen()) return;
          try {
            if (!popover.matches(':popover-open')) return;
            popover.hidePopover?.();
            popover.showPopover?.();
          } catch {
            // The browser can omit top-layer APIs despite their type declarations.
          }
        });
      },
      onDismissRequest: context.onDismissRequest,
      onBeforeRestoreFocus: (event) => {
        context.onBeforeRestoreFocus(event);
        onCloseAutoFocus?.(event);
      },
    },
    // A dialog is modal and never anchored: focus scope, inert and scroll lock, no positioning.
    { focusScope: createFocusScope, inert: getInertRegistry, scrollLock: lockScroll }
  );
  context.registerController(controller);
  return () => {
    controller.destroy();
    context.registerController(undefined);
    context.registerContent(undefined);
    restorePosition();
  };
}
</script>

{#if isOpen || held}
<div bind:this={ref}
  {...rest}
  id={context.contentId}
  role="dialog"
  aria-modal="true"
  aria-labelledby={rest['aria-labelledby'] ?? context.titleId}
  aria-describedby={rest['aria-describedby'] ??
    (context.hasDescription ? context.descriptionId : undefined)}
  data-state={isOpen ? 'open' : 'closed'}
  inert={!isOpen || undefined}
  tabindex="-1"
  {@attach attach}
>
  {@render children?.()}
</div>
{/if}
