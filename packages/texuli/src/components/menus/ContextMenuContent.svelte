<script lang="ts">
import { ContextMenu } from '@texuli/primitives/context-menu';
import type { ComponentProps, Snippet } from 'svelte';
import { type ClassValue } from '../../internal/cx.ts';
import { type MenuSize, type MenuVariant, menuContentClass } from './variants.ts';
import './menus.css';

type Props = ComponentProps<typeof ContextMenu.Content> & {
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

<ContextMenu.Content bind:ref
  class={classes}
  data-tx-context-menu-content
  data-size={size}
  data-variant={variant}
  {...rest}
>
  {@render children?.()}
</ContextMenu.Content>
