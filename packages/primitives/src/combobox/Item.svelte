<script lang="ts">
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type { RefProp } from '../internal/ref.ts';
import { getComboboxContext } from './context.ts';

type Props = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  value: string;
  label?: string;
  disabled?: boolean;
  children?: Snippet;
} & RefProp;
let {
  value,
  label,
  disabled = false,
  children,
  onpointermove,
  onclick,
  ref = $bindable(null),
  ...rest
}: Props = $props();
type ClickEvent = Parameters<NonNullable<HTMLAttributes<HTMLDivElement>['onclick']>>[0];
type PointerMoveEvent = Parameters<NonNullable<HTMLAttributes<HTMLDivElement>['onpointermove']>>[0];
const context = getComboboxContext();
const item = $derived(context.items.find((entry) => entry.value === value));
const text = $derived(label ?? item?.label ?? value);
const unavailable = $derived(Boolean(disabled || item?.disabled || context.disabled));
const selected = $derived(context.selected.includes(value));
const highlighted = $derived(context.activeValue === value);

function handleClick(event: ClickEvent): void {
  onclick?.(event);
  if (!event.defaultPrevented && !unavailable) context.select(value);
}
function handlePointerMove(event: PointerMoveEvent): void {
  onpointermove?.(event);
  if (!unavailable) context.setActive(value);
}
</script>

<div bind:this={ref}
  {...rest}
  id={context.itemId(value)}
  role="option"
  aria-selected={selected}
  aria-disabled={unavailable ? 'true' : undefined}
  data-state={selected ? 'selected' : 'unselected'}
  data-highlighted={highlighted ? '' : undefined}
  data-disabled={unavailable ? '' : undefined}
  aria-posinset={context.items.findIndex((entry) => entry.value === value) + 1}
  aria-setsize={context.items.length}
  onclick={handleClick}
  onpointermove={handlePointerMove}
>
  {#if children}
    {@render children()}
  {:else}
    {text}
  {/if}
</div>
