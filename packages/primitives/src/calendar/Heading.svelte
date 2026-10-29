<script lang="ts">
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type { ChildSnippet } from '../internal/child.ts';
import type { RefProp } from '../internal/ref.ts';
import { getCalendarContext } from './context.ts';

type Props = Omit<HTMLAttributes<HTMLHeadingElement>, 'children'> & {
  child?: ChildSnippet<Record<string, unknown>>;
  children?: Snippet;
} & RefProp;
let { child, children, ref = $bindable(null), ...rest }: Props = $props();
const calendar = getCalendarContext();
const partProps = $derived({
  ...rest,
  'aria-live': 'polite' as const,
  'data-tx-calendar-heading': '',
});
</script>

{#if child}
  {@render child({ props: partProps })}
{:else}
  <h2 bind:this={ref} {...partProps}>{calendar.monthLabel}{@render children?.()}</h2>
{/if}
