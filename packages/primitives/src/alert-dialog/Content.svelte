<script lang="ts">
import { createFocusScope } from '@texuli/core/focus-scope';
import { getInertRegistry } from '@texuli/core/inert';
import { createOverlayCore } from '@texuli/core/overlay-core';
import { lockScroll } from '@texuli/core/scroll-lock';
import { untrack } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { ensurePositioned } from '../internal/backdrop.ts';
import { getAlertDialogContext, getAlertDialogPortalContext } from './context.ts';

type Props = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  children?: import('svelte').Snippet;
  onCloseAutoFocus?: (event: import('@texuli/core/focus-scope').FocusRestoreEvent) => void;
};

let { children, onCloseAutoFocus, ...rest }: Props = $props();
const context = getAlertDialogContext();
const portal = getAlertDialogPortalContext();
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

$effect(() => context.subscribeOpen((next) => (isOpen = next)));

function attach(node: HTMLDivElement): () => void {
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
      // Alert dialogs never close on outside pointer or focus loss.
      dismiss: {
        escape: true,
        pointerOutside: false,
        focusOutside: false,
      },
      restoreFocusTarget: () => context.triggerElement ?? null,
      initialFocus: context.initialFocus,
      branches: () => [context.triggerElement],
      label: 'alert-dialog',
      onOpenChange: (open) => {
        context.onOverlayOpenChange(open);
        if (!open) return;
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

{#if isOpen}
  <div
    {...rest}
    id={context.contentId}
    role="alertdialog"
    aria-modal="true"
    aria-labelledby={rest['aria-labelledby'] ?? context.titleId}
    aria-describedby={rest['aria-describedby'] ??
    (context.hasDescription ? context.descriptionId : undefined)}
    data-state={isOpen ? 'open' : 'closed'}
    tabindex="-1"
    {@attach attach}
  >
    {@render children?.()}
  </div>
{/if}
