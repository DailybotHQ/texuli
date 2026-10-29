<script lang="ts">
import { NumberField as Primitive } from '@texuli/primitives/number-field';
import type { HTMLInputAttributes } from 'svelte/elements';
import { type ClassValue, cx } from '../../internal/cx.ts';
import type { RefProp } from '../../internal/ref.ts';

let {
  class: className,
  ref = $bindable(null),
  ...rest
}: Omit<HTMLInputAttributes, 'class'> & { class?: ClassValue } & RefProp = $props();
</script>

<Primitive.Input bind:ref {...rest} class={cx('tx-number-field__input', className)} />
