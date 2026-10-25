<script lang="ts">
import { type Snippet, untrack } from 'svelte';
import type { Attachment } from 'svelte/attachments';
import type { HTMLButtonAttributes } from 'svelte/elements';
import { type ChildSnippet, composeChildProps } from '../internal/child.ts';
import { getHoverCardContext } from './context.ts';

type TriggerProps = Record<string, unknown> & { attach: Attachment<HTMLElement> };
type Props = Omit<HTMLButtonAttributes, 'children'> & {
  child?: ChildSnippet<TriggerProps>;
  children?: Snippet;
};

let { child, children, ...consumerProps }: Props = $props();
const context = getHoverCardContext();
// A consumer id wins: the context records it, so every reference follows.
context.claimId(
  'trigger',
  untrack(() => consumerProps.id)
);
$effect(() => {
  context.claimId('trigger', consumerProps.id);
  return () => context.claimId('trigger', undefined);
});

function triggerAttachment(node: HTMLElement) {
  context.setTrigger(node);
  return () => context.setTrigger(undefined);
}

const baseProps: TriggerProps = $derived({
  id: context.triggerId,
  attach: triggerAttachment,
  type: 'button',
  'aria-haspopup': 'dialog',
  'aria-expanded': String(context.open),
  'aria-controls': context.contentId,
  'data-state': context.open ? 'open' : 'closed',
  onpointerenter: (event: PointerEvent) => context.triggerPointerEnter(event),
  onpointerleave: (event: PointerEvent) => context.triggerPointerLeave(event),
  onpointerdown: (event: PointerEvent) => context.triggerPointerDown(event),
  onfocus: () => context.triggerFocus(),
  onblur: (event: FocusEvent) => context.triggerBlur(event),
});
const triggerProps = $derived(composeChildProps(baseProps, consumerProps));
</script>

{#if child}
  {@render child({ props: triggerProps })}
{:else}
  {@const { attach: _attach, ...domProps } = triggerProps}
  <button {@attach triggerAttachment} {...domProps}>
    {@render children?.()}
  </button>
{/if}
