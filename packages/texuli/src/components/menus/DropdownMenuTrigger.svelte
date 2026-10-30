<script lang="ts">
import { Trigger as Primitive } from '@texuli/primitives/menu';
import type { ComponentProps, Snippet } from 'svelte';
import { type ClassValue } from '../../internal/cx.ts';
import { type MenuSize, type MenuVariant, menuTriggerClass } from './variants.ts';
import './menus.css';
import { designDefaults, withDefault } from '../../internal/design-defaults.ts';

type Props = ComponentProps<typeof Primitive> & {
  children?: Snippet;
  class?: ClassValue;
  size?: MenuSize;
  variant?: MenuVariant;
};

let {
  children,
  class: className,
  size: sizeProp,
  variant: variantProp,
  ref = $bindable(null),
  ...rest
}: Props = $props();
const txDefaults = designDefaults('menu');
const size = $derived(withDefault(sizeProp, txDefaults().size, 'md'));
const variant = $derived(withDefault(variantProp, txDefaults().variant, 'default'));

const classes = $derived(
  menuTriggerClass({
    size,
    variant,
    class: className,
  })
);
</script>

<Primitive bind:ref class={classes} data-tx-dropdown-menu-trigger data-size={size} data-variant={variant} {...rest}>
  {@render children?.()}
</Primitive>
