<script lang="ts">
import type { PinCell } from '@texuli/primitives/pin-input';
import { PinInput as Primitive } from '@texuli/primitives/pin-input';
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { type ClassValue, cx } from '../../internal/cx.ts';

let {
  cell,
  class: className,
  children,
  ...rest
}: Omit<HTMLAttributes<HTMLDivElement>, 'class'> & {
  class?: ClassValue;
  cell: PinCell;
  children?: Snippet;
} = $props();
</script>

{#if children}
  <Primitive.Cell {cell} {...rest} class={cx('tx-pin-input__cell', className)}>
    {@render children()}
  </Primitive.Cell>
{:else}
  <Primitive.Cell {cell} {...rest} class={cx('tx-pin-input__cell', className)} />
{/if}
