<script lang="ts">
import { NumberField as Primitive } from '@texuli/primitives/number-field';
import type { Snippet } from 'svelte';
import type { HTMLButtonAttributes } from 'svelte/elements';
import { type ClassValue, cx } from '../../internal/cx.ts';
import type { RefProp } from '../../internal/ref.ts';

let {
  class: className,
  children,
  ref = $bindable(null),
  ...rest
}: Omit<HTMLButtonAttributes, 'class'> & {
  class?: ClassValue;
  children?: Snippet;
} & RefProp = $props();
</script>

<Primitive.Decrement bind:ref {...rest} class={cx('tx-number-field__stepper', className)}>
  {#if children}{@render children()}{:else}<span aria-hidden="true">−</span>{/if}
</Primitive.Decrement>
