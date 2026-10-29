<script lang="ts">
import { SubContent as Primitive } from '@texuli/primitives/menu';
import type { ComponentProps, Snippet } from 'svelte';
import { type ClassValue } from '../../internal/cx.ts';
import { type MenuSize, type MenuVariant, menuContentClass } from './variants.ts';
import './menus.css';

type Props = ComponentProps<typeof Primitive> & {
  children?: Snippet;
  class?: ClassValue;
  size?: MenuSize;
  variant?: MenuVariant;
};

let {
  children,
  class: className,
  size = 'md',
  variant = 'default',
  ref = $bindable(null),
  ...rest
}: Props = $props();

const classes = $derived(
  menuContentClass({
    size,
    variant,
    class: className,
  })
);
</script>

<Primitive bind:ref
  class={classes}
  data-tx-menu-sub-content
  data-size={size}
  data-variant={variant}
  {...rest}
>
  {@render children?.()}
</Primitive>
