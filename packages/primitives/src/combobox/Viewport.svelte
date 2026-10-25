<script lang="ts">
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type { ComboboxItemData } from './context.ts';
import { getComboboxContext } from './context.ts';

type Props = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  children?: Snippet<[item: ComboboxItemData]>;
  itemSize?: number;
  windowSize?: number;
};
let { children, itemSize = 36, windowSize = 8, onscroll, ...rest }: Props = $props();
type ScrollEvent = Parameters<NonNullable<HTMLAttributes<HTMLDivElement>['onscroll']>>[0];
const context = getComboboxContext();
let scrollTop = $state(0);
const virtualized = $derived(context.items.length > 200);
const first = $derived(virtualized ? Math.max(0, Math.floor(scrollTop / itemSize) - 2) : 0);
const last = $derived(
  virtualized ? Math.min(context.items.length, first + windowSize + 4) : context.items.length
);
const visibleItems = $derived(context.items.slice(first, last));
let viewport: HTMLDivElement | undefined;

$effect(() => {
  if (!virtualized || !viewport || !context.activeValue) return;
  const activeIndex = context.items.findIndex((item) => item.value === context.activeValue);
  if (activeIndex < 0 || (activeIndex >= first && activeIndex < last)) return;
  scrollTop = Math.max(0, activeIndex * itemSize);
  viewport.scrollTop = scrollTop;
});

function handleScroll(event: ScrollEvent): void {
  onscroll?.(event);
  scrollTop = (event.currentTarget as HTMLDivElement).scrollTop;
}
</script>

<div {...rest} bind:this={viewport} data-tx-combobox-viewport="" onscroll={handleScroll}>
  {#if virtualized}<div aria-hidden="true" class="combobox-spacer" style={`--combobox-spacer-size: ${first * itemSize}px`}></div>{/if}
  {#each visibleItems as item (item.value)}
    {@render children?.(item)}
  {/each}
  {#if virtualized}<div aria-hidden="true" class="combobox-spacer" style={`--combobox-spacer-size: ${(context.items.length - last) * itemSize}px`}></div>{/if}
</div>

<style>
  [data-tx-combobox-viewport] { max-block-size: 18rem; overflow: auto; }
  .combobox-spacer { block-size: var(--combobox-spacer-size); }
</style>
