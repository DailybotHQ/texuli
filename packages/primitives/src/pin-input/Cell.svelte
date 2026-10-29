<script lang="ts">
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { type ChildSnippet, composeChildProps } from '../internal/child.ts';
import type { RefProp } from '../internal/ref.ts';
import type { PinCell } from './pin-input.ts';

type CellProps = HTMLAttributes<HTMLDivElement> & {
  cell: PinCell;
  child?: ChildSnippet<Record<string, unknown>>;
  children?: Snippet;
};

let { cell, child, children, ref = $bindable(null), ...rest }: CellProps & RefProp = $props();

// Cells only draw the code: the real input carries name, value and state.
const cellProps = $derived({
  ...rest,
  'aria-hidden': 'true' as const,
  'data-state': cell.char === null ? 'empty' : 'filled',
  'data-active': cell.isActive ? '' : undefined,
  'data-fake-caret': cell.hasFakeCaret ? '' : undefined,
});
</script>

{#if child}
  {@render child({ props: composeChildProps(cellProps, {}) })}
{:else}
  <div bind:this={ref} {...cellProps}>{#if children}{@render children()}{:else}{cell.char ?? ''}{/if}</div>
{/if}
