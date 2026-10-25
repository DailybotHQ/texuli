<script lang="ts">
import { Trigger as Primitive } from '@texuli/primitives/menu';
import type { ComponentProps, Snippet } from 'svelte';
import { type ClassValue } from '../../internal/cx.ts';
import { type MenuSize, type MenuVariant, menuTriggerClass } from './variants.ts';
import './menus.css';

type Props = ComponentProps<typeof Primitive> & {
  children?: Snippet;
  class?: ClassValue;
  size?: MenuSize;
  variant?: MenuVariant;
};

let { children, class: className, size = 'md', variant = 'default', ...rest }: Props = $props();

const classes = $derived(
  menuTriggerClass({
    size,
    variant,
    class: className,
  })
);
</script>

<Primitive class={classes} data-tx-dropdown-menu-trigger data-size={size} data-variant={variant} {...rest}>
  {@render children?.()}
</Primitive>
