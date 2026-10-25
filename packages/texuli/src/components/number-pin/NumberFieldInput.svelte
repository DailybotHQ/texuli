<script lang="ts">
import { NumberField as Primitive } from '@texuli/primitives/number-field';
import type { HTMLInputAttributes } from 'svelte/elements';
import { type ClassValue, cx } from '../../internal/cx.ts';

let { class: className, ...rest }: Omit<HTMLInputAttributes, 'class'> & { class?: ClassValue } =
  $props();
</script>

<Primitive.Input {...rest} class={cx('tx-number-field__input', className)} />
