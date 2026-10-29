<script lang="ts">
import { Chips as PrimitiveChips } from '@texuli/primitives/combobox';
import type { ComponentProps, Snippet } from 'svelte';
import { type ClassValue } from '../../internal/cx.ts';
import { comboboxChipsClass } from './variants.ts';
import './combobox.css';

type Props = ComponentProps<typeof PrimitiveChips> & {
  children?: Snippet;
  class?: ClassValue;
};

let { children, class: className, ref = $bindable(null), ...rest }: Props = $props();

const classes = $derived(
  comboboxChipsClass({
    class: className,
  })
);
</script>

<PrimitiveChips bind:ref class={classes} data-tx-combobox-chips {...rest}>
  {@render children?.()}
</PrimitiveChips>
