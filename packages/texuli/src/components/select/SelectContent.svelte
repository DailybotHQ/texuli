<script lang="ts">
import { Content as PrimitiveContent } from '@texuli/primitives/select';
import type { ComponentProps, Snippet } from 'svelte';
import { type ClassValue } from '../../internal/cx.ts';
import { type SelectSize, selectContentClass } from './variants.ts';
import './select.css';
import { designDefaults, withDefault } from '../../internal/design-defaults.ts';

type Props = ComponentProps<typeof PrimitiveContent> & {
  children?: Snippet;
  class?: ClassValue;
  size?: SelectSize;
};

let {
  children,
  class: className,
  size: sizeProp,
  ref = $bindable(null),
  ...rest
}: Props = $props();
const txDefaults = designDefaults('select');
const size = $derived(withDefault(sizeProp, txDefaults().size, 'md'));

const classes = $derived(
  selectContentClass({
    size,
    class: className,
  })
);
</script>

<PrimitiveContent bind:ref class={classes} data-tx-select-content data-size={size} {...rest}>
  {@render children?.()}
</PrimitiveContent>
