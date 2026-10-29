<script lang="ts">
import { bindDismissLayer } from '@texuli/core/dismiss';
import { positionFloating } from '@texuli/core/position-dom';
import { type Snippet, untrack } from 'svelte';
import type { Attachment } from 'svelte/attachments';
import type { HTMLAttributes } from 'svelte/elements';
import { type ChildSnippet, composeChildProps } from '../internal/child.ts';
import { createMotionHold, type OverlayMotionHooks } from '../internal/motion-hold.ts';
import type { RefProp } from '../internal/ref.ts';
import { getHoverCardContext } from './context.ts';

type ContentProps = Record<string, unknown> & { attach: Attachment<HTMLDivElement> };
type Props = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  'aria-label': string;
  child?: ChildSnippet<ContentProps>;
  children?: Snippet;
  /**
   * Enter and exit motion (texuli passes `texuli/motion` hooks): while the
   * exit plays, the closed card stays shown, inert.
   */
  motionHooks?: OverlayMotionHooks;
} & RefProp;

let { child, children, motionHooks, ref = $bindable(null), ...consumerProps }: Props = $props();
const context = getHoverCardContext();
let node: HTMLDivElement | null = null;
let held = $state(false);
// Open when it is created (first render, hydration): no enter animation.
let appeared = untrack(() => context.open);
let wasOpen = untrack(() => context.open);
const hold = createMotionHold(
  () => motionHooks,
  (next) => (held = next)
);
// Before the DOM update, so a closing card is still shown when its exit starts.
$effect.pre(() => {
  const open = context.open;
  untrack(() => {
    if (open === wasOpen) return;
    wasOpen = open;
    if (!open) {
      appeared = false;
      hold.begin(node);
    } else if (appeared) appeared = false;
    else hold.enter(node);
  });
});
$effect(() => () => hold.cancel());
// A consumer id wins: the context records it, so every reference follows.
context.claimId(
  'content',
  untrack(() => consumerProps.id)
);
$effect(() => {
  context.claimId('content', consumerProps.id);
  return () => context.claimId('content', undefined);
});

function overlayAttachment(element: HTMLDivElement) {
  node = element;
  return attachOverlay(element);
}

function attachOverlay(node: HTMLDivElement) {
  context.setContent(node);
  const dismiss = bindDismissLayer({
    element: node,
    document: node.ownerDocument,
    branches: () => [context.trigger],
    pointerOutside: true,
    focusOutside: false,
    onPointerOutside: () => context.setOpen(false),
  });
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Escape' || !context.open) return;
    event.preventDefault();
    context.setOpen(false);
    if (node.contains(node.ownerDocument.activeElement)) context.trigger?.focus();
  };
  node.ownerDocument.addEventListener('keydown', onKeyDown, true);
  // Flip and shift inside the viewport (8px inset), as Popover does: without
  // them a card wider than the space beside its trigger left the screen.
  const position = context.trigger
    ? positionFloating(context.trigger, node, {
        placement: 'bottom',
        offset: 6,
        flip: true,
        shift: true,
        boundaryPadding: 8,
      })
    : undefined;

  return () => {
    dismiss.disconnect();
    node.ownerDocument.removeEventListener('keydown', onKeyDown, true);
    position?.destroy();
    context.setContent(undefined);
  };
}

const baseProps: ContentProps = $derived({
  attach: overlayAttachment,
  id: context.contentId,
  role: 'dialog',
  'aria-label': consumerProps['aria-label'],
  'data-state': context.open ? 'open' : 'closed',
  'data-tx-hover-card-content': '',
  hidden: !context.open && !held,
  inert: (!context.open && held) || undefined,
  onpointerenter: (event: PointerEvent) => context.contentPointerEnter(event),
  onpointerleave: (event: PointerEvent) => context.contentPointerLeave(event),
  onfocusin: () => context.contentFocusIn(),
  onfocusout: (event: FocusEvent) => context.contentFocusOut(event),
});
const composedProps = $derived(composeChildProps(baseProps, consumerProps));
const contentProps: ContentProps = $derived({
  ...composedProps,
  id: context.contentId,
  role: 'dialog',
  'data-state': context.open ? 'open' : 'closed',
  'data-tx-hover-card-content': '',
  hidden: !context.open && !held,
  inert: (!context.open && held) || undefined,
});
</script>

{#if child}
  {@render child({ props: contentProps })}
{:else}
  {@const { attach: _attach, ...domProps } = contentProps}
  <div bind:this={ref} {@attach overlayAttachment} {...domProps}>
    {@render children?.()}
  </div>
{/if}

<style>
  :global([data-tx-hover-card-content][hidden]) {
    display: none;
  }
</style>
