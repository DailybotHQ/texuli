<script lang="ts">
import { Content as PrimitiveContent } from '@texuli/primitives/combobox';
import type { ComponentProps, Snippet } from 'svelte';
import { type ClassValue } from '../../internal/cx.ts';
import { type ComboboxSize, comboboxContentClass } from './variants.ts';
import './combobox.css';
import { designDefaults, withDefault } from '../../internal/design-defaults.ts';

type Props = ComponentProps<typeof PrimitiveContent> & {
  children?: Snippet;
  size?: ComboboxSize;
  class?: ClassValue;
};

let {
  children,
  class: className,
  size: sizeProp,
  ref = $bindable(null),
  ...rest
}: Props = $props();
const txDefaults = designDefaults('combobox');
const size = $derived(withDefault(sizeProp, txDefaults().size, 'md'));

const classes = $derived(
  comboboxContentClass({
    size,
    class: className,
  })
);
</script>

<PrimitiveContent bind:ref class={classes} data-tx-combobox-content data-size={size} {...rest}>
  {@render children?.()}
</PrimitiveContent>
