<script lang="ts">
import { Input as PrimitiveInput } from '@texuli/primitives/combobox';
import type { ComponentProps } from 'svelte';
import { type ClassValue } from '../../internal/cx.ts';
import { type ComboboxSize, comboboxInputClass } from './variants.ts';
import './combobox.css';

type Props = Omit<ComponentProps<typeof PrimitiveInput>, 'size'> & {
  size?: ComboboxSize;
  class?: ClassValue;
};

let { class: className, size = 'md', ref = $bindable(null), ...rest }: Props = $props();

const classes = $derived(
  comboboxInputClass({
    size,
    class: className,
  })
);
</script>

<PrimitiveInput bind:ref class={classes} data-tx-combobox-input data-size={size} {...rest} />
