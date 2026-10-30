<script lang="ts">
import * as MenubarPrimitive from '@texuli/primitives/menubar';
import type { ComponentProps, Snippet } from 'svelte';
import { type ClassValue } from '../../internal/cx.ts';
import { type MenuSize, type MenuVariant, menuTriggerClass } from './variants.ts';
import './menus.css';
import { designDefaults } from '../../internal/design-defaults.ts';

type Props = ComponentProps<typeof MenubarPrimitive.Trigger> & {
  children?: Snippet;
  class?: ClassValue;
  size?: MenuSize;
  variant?: MenuVariant;
};

const txDefaults = designDefaults('menu');
let {
  children,
  class: className,
  size = txDefaults().size ?? 'md',
  variant = txDefaults().variant ?? 'default',
  ref = $bindable(null),
  ...rest
}: Props = $props();

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
