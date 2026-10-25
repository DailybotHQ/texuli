<script lang="ts">
import type { Snippet } from 'svelte';
import type { HTMLButtonAttributes } from 'svelte/elements';
import type { ChildSnippet } from '../internal/child.ts';
import { getComboboxContext } from './context.ts';

type Props = Omit<HTMLButtonAttributes, 'children'> & {
  children?: Snippet;
  child?: ChildSnippet<Record<string, unknown>>;
};
type ClickEvent = Parameters<NonNullable<HTMLButtonAttributes['onclick']>>[0];
let { children, child, onclick, ...rest }: Props = $props();
const context = getComboboxContext();

function handleClick(event: ClickEvent): void {
  onclick?.(event);
  if (!event.defaultPrevented) context.setOpen(!context.open, event);
}

const triggerProps = $derived({
  ...rest,
  type: 'button' as const,
  'aria-label': rest['aria-label'] ?? 'Show options',
  'aria-controls': context.listId,
  'aria-expanded': context.open,
  'data-state': context.open ? 'open' : 'closed',
  'data-disabled': context.disabled ? '' : undefined,
  disabled: context.disabled || rest.disabled || undefined,
  onclick: handleClick,
});
</script>

{#if child}
  {@render child({ props: triggerProps })}
{:else}
  <button {...triggerProps}>{@render children?.()}</button>
{/if}
