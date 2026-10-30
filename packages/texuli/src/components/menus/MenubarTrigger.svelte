<script lang="ts">
import * as MenubarPrimitive from '@texuli/primitives/menubar';
import type { ComponentProps, Snippet } from 'svelte';
import { type ClassValue } from '../../internal/cx.ts';
import { type MenuSize, type MenuVariant, menuTriggerClass } from './variants.ts';
import './menus.css';
import { designDefaults, withDefault } from '../../internal/design-defaults.ts';

type Props = ComponentProps<typeof MenubarPrimitive.Trigger> & {
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

<MenubarPrimitive.Trigger bind:ref
  class={classes}
  data-tx-menubar-trigger
  data-size={size}
  data-variant={variant}
  {...rest}
>
  {@render children?.()}
</MenubarPrimitive.Trigger>
