<script lang="ts">
import { NumberField as Primitive } from '@texuli/primitives/number-field';
import type { Snippet } from 'svelte';
import type { HTMLButtonAttributes } from 'svelte/elements';
import { type ClassValue, cx } from '../../internal/cx.ts';

let {
  class: className,
  children,
  ...rest
}: Omit<HTMLButtonAttributes, 'class'> & { class?: ClassValue; children?: Snippet } = $props();
</script>

<Primitive.Increment {...rest} class={cx('tx-number-field__stepper', className)}>
  {#if children}{@render children()}{:else}<span aria-hidden="true">+</span>{/if}
</Primitive.Increment>
