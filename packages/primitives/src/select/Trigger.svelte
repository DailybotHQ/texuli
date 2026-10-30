<script lang="ts">
import { untrack } from 'svelte';
import type { HTMLButtonAttributes } from 'svelte/elements';
import type { ChildSnippet } from '../internal/child.ts';
import type { RefProp } from '../internal/ref.ts';
import { stateAttributes } from '../internal/state.ts';
import { getSelectContext } from './context.ts';

type Props = Omit<HTMLButtonAttributes, 'children'> & {
  children?: import('svelte').Snippet;
  child?: ChildSnippet<Record<string, unknown>>;
} & RefProp;
type ButtonClickEvent = Parameters<NonNullable<HTMLButtonAttributes['onclick']>>[0];

let {
  children,
  child,
  onclick,
  onkeydown,
  type = 'button',
  ref = $bindable(null),
  ...rest
}: Props = $props();
const context = getSelectContext();
// A consumer id wins: the context records it, so every reference follows.
context.claimId(
  'trigger',
  untrack(() => rest.id)
);
$effect(() => {
  context.claimId('trigger', rest.id);
  return () => context.claimId('trigger', undefined);
});

function register(node: HTMLButtonElement): () => void {
  context.registerTrigger(node);
  return () => context.registerTrigger(undefined);
}

function handleClick(event: ButtonClickEvent): void {
  onclick?.(event);
  if (event.defaultPrevented || rest.disabled || context.disabled) return;
  context.toggle(event);
}

function handleKeydown(event: KeyboardEvent): void {
  if (typeof onkeydown === 'function') {
    // @ts-expect-error handler shape
    onkeydown(event);
  }
  if (event.defaultPrevented || rest.disabled || context.disabled) return;
  if (
    event.key === 'Enter' ||
    event.key === ' ' ||
    event.key === 'ArrowDown' ||
    event.key === 'ArrowUp'
  ) {
    event.preventDefault();
    if (!context.open) context.setOpen(true, event);
    else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      context.handleListKeydown(event);
    }
    return;
  }
  if (context.open) context.handleListKeydown(event);
}

const triggerProps = $derived({
  ...rest,
  id: context.triggerId,
  type,
  role: 'combobox' as const,
  'aria-expanded': context.open,
  'aria-controls': context.contentId,
  'aria-haspopup': 'listbox' as const,
  // A Field's `aria-required` on the trigger is kept, like `disabled`.
  'aria-required':
    context.required ||
    rest['aria-required'] === true ||
    rest['aria-required'] === 'true' ||
    undefined,
  disabled: Boolean(rest.disabled || context.disabled) || undefined,
  ...stateAttributes(context.open ? 'open' : 'closed', Boolean(rest.disabled || context.disabled)),
  onclick: handleClick,
  onkeydown: handleKeydown,
});
</script>

{#if child}
  {@render child({ props: triggerProps })}
{:else}
  <button bind:this={ref} {...triggerProps} {@attach register}>
    {@render children?.()}
  </button>
{/if}
