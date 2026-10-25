<script lang="ts">
import { bindDismissLayer } from '@texuli/core/dismiss';
import { positionFloating } from '@texuli/core/position-dom';
import { type Snippet, untrack } from 'svelte';
import type { Attachment } from 'svelte/attachments';
import type { HTMLAttributes } from 'svelte/elements';
import { type ChildSnippet, composeChildProps } from '../internal/child.ts';
import { getHoverCardContext } from './context.ts';

type ContentProps = Record<string, unknown> & { attach: Attachment<HTMLDivElement> };
type Props = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  'aria-label': string;
  child?: ChildSnippet<ContentProps>;
  children?: Snippet;
};

let { child, children, ...consumerProps }: Props = $props();
const context = getHoverCardContext();
// A consumer id wins: the context records it, so every reference follows.
context.claimId(
  'content',
  untrack(() => consumerProps.id)
);
$effect(() => {
  context.claimId('content', consumerProps.id);
  return () => context.claimId('content', undefined);
});

function overlayAttachment(node: HTMLDivElement) {
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
  hidden: !context.open,
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
  hidden: !context.open,
});
</script>

{#if child}
  {@render child({ props: contentProps })}
{:else}
  {@const { attach: _attach, ...domProps } = contentProps}
  <div {@attach overlayAttachment} {...domProps}>
    {@render children?.()}
  </div>
{/if}

<style>
  :global([data-tx-hover-card-content][hidden]) {
    display: none;
  }
</style>
