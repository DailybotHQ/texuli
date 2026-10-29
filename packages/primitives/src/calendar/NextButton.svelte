<script lang="ts">
import type { Snippet } from 'svelte';
import type { HTMLButtonAttributes } from 'svelte/elements';
import type { ChildSnippet } from '../internal/child.ts';
import type { RefProp } from '../internal/ref.ts';
import { getCalendarContext } from './context.ts';

type Props = Omit<HTMLButtonAttributes, 'children'> & {
  child?: ChildSnippet<Record<string, unknown>>;
  children?: Snippet;
} & RefProp;
let { child, children, onclick, ref = $bindable(null), ...rest }: Props = $props();
const calendar = getCalendarContext();
function handleClick(event: MouseEvent & { currentTarget: EventTarget & HTMLButtonElement }) {
  onclick?.(event);
  if (!event.defaultPrevented) calendar.next();
}
const partProps = $derived({
  ...rest,
  type: 'button' as const,
  disabled: !calendar.canNext || rest.disabled,
  'aria-label': rest['aria-label'] ?? calendar.nextLabel,
  'data-tx-calendar-next': '',
  onclick: handleClick,
});
</script>

{#if child}
  {@render child({ props: partProps })}
{:else}
  <button bind:this={ref} {...partProps}>{#if children}{@render children()}{:else}Next{/if}</button>
{/if}
