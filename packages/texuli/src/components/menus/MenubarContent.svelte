<script lang="ts">
import * as MenubarPrimitive from '@texuli/primitives/menubar';
import type { ComponentProps, Snippet } from 'svelte';
import { type ClassValue } from '../../internal/cx.ts';
import { type MenuSize, type MenuVariant, menuContentClass } from './variants.ts';
import './menus.css';

type Props = ComponentProps<typeof MenubarPrimitive.Content> & {
  children?: Snippet;
  class?: ClassValue;
  size?: MenuSize;
  variant?: MenuVariant;
};

let { children, class: className, size = 'md', variant = 'default', ...rest }: Props = $props();

const classes = $derived(
  menuContentClass({
    size,
    variant,
    class: className,
  })
);
</script>

<MenubarPrimitive.Content
  class={classes}
  data-tx-menubar-content
  data-size={size}
  data-variant={variant}
  {...rest}
>
  {@render children?.()}
</MenubarPrimitive.Content>
