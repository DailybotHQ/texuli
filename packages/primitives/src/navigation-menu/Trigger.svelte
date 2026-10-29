<script lang="ts">
import { getTabbableElements } from '@texuli/core/tabbable';
import { type Snippet, untrack } from 'svelte';
import type { HTMLButtonAttributes } from 'svelte/elements';
import { type ChildSnippet, composeChildProps } from '../internal/child.ts';
import { chainHandlers, composeHandlers } from '../internal/handlers.ts';
import type { RefProp } from '../internal/ref.ts';
import { navigationMenuContext, navigationMenuItemContext } from './context.ts';

type TriggerProps = HTMLButtonAttributes & {
  child?: ChildSnippet<Record<string, unknown>>;
  children?: Snippet;
};

let {
  child,
  children,
  disabled = false,
  ref = $bindable(null),
  ...rest
}: TriggerProps & RefProp = $props();
const context = navigationMenuContext.get();
const item = navigationMenuItemContext.get();
// A consumer id wins: the context records it, so every reference follows.
context.claimId(
  'trigger',
  untrack(() => item.value),
  untrack(() => rest.id)
);
$effect(() => {
  const value = item.value;
  context.claimId('trigger', value, rest.id);
  return () => context.claimId('trigger', value, undefined);
});
const open = $derived(context.value === item.value);

function contentElement(): HTMLElement | null {
  return context.root?.ownerDocument.getElementById(context.contentId(item.value)) ?? null;
}

function focusContent(edge: 'first' | 'last'): boolean {
  const content = contentElement();
  if (!content) return false;
  const tabbable = getTabbableElements(content);
  const target = edge === 'first' ? tabbable[0] : tabbable.at(-1);
  target?.focus();
  return Boolean(target);
}

function onKeydown(event: KeyboardEvent): void {
  if (disabled) return;
  const into = context.orientation === 'horizontal' ? 'ArrowDown' : 'ArrowRight';
  if (event.key === into && open) {
    if (focusContent('first')) event.preventDefault();
  } else if (event.key === 'Tab' && !event.shiftKey && open) {
    // Tab from an open trigger goes into its content, wherever it renders.
    if (focusContent('first')) event.preventDefault();
  }
}

const triggerProps = $derived({
  ...rest,
  type: 'button' as const,
  id: context.triggerId(item.value),
  disabled,
  'aria-expanded': open,
  'aria-controls': context.contentId(item.value),
  'data-state': open ? 'open' : 'closed',
  'data-disabled': disabled ? '' : undefined,
  'data-nav-trigger': '',
  onclick: composeHandlers(rest.onclick, () => {
    if (!disabled) context.toggle(item.value);
  }),
  onpointerenter: chainHandlers(rest.onpointerenter, (event: PointerEvent) => {
    if (!disabled && event.pointerType === 'mouse') context.pointerEnterTrigger(item.value);
  }),
  onkeydown: composeHandlers(rest.onkeydown, onKeydown),
});
</script>

{#if child}
  {@render child({ props: composeChildProps(triggerProps, {}) })}
{:else}
  <button bind:this={ref} {...triggerProps}>{@render children?.()}</button>
{/if}
