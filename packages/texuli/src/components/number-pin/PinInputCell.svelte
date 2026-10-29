<script lang="ts">
import type { PinCell } from '@texuli/primitives/pin-input';
import { PinInput as Primitive } from '@texuli/primitives/pin-input';
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { type ClassValue, cx } from '../../internal/cx.ts';
import type { RefProp } from '../../internal/ref.ts';

let {
  cell,
  class: className,
  children,
  ref = $bindable(null),
  ...rest
}: Omit<HTMLAttributes<HTMLDivElement>, 'class'> & {
  class?: ClassValue;
  cell: PinCell;
  children?: Snippet;
} & RefProp = $props();
</script>

{#if children}
  <Primitive.Cell bind:ref {cell} {...rest} class={cx('tx-pin-input__cell', className)}>
    {@render children()}
  </Primitive.Cell>
{:else}
  <Primitive.Cell bind:ref {cell} {...rest} class={cx('tx-pin-input__cell', className)} />
{/if}
