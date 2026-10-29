<script lang="ts">
import { ContextMenu } from '@texuli/primitives/context-menu';
import type { ComponentProps, Snippet } from 'svelte';
import { type ClassValue } from '../../internal/cx.ts';
import type { MotionProp } from '../../motion/contract.ts';
import { createOverlayMotion } from '../../motion/seam.ts';
import { type MenuSize, type MenuVariant, menuContentClass } from './variants.ts';
import './menus.css';

type Props = ComponentProps<typeof ContextMenu.Content> & {
  children?: Snippet;
  class?: ClassValue;
  size?: MenuSize;
  variant?: MenuVariant;
  /** Enter and exit motion (`texuli/motion`): default a quick scale-and-fade in, a fade out; `false` for none. */
  motion?: MotionProp;
};

let {
  children,
  class: className,
  size = 'md',
  variant = 'default',
  motion,
  ref = $bindable(null),
  ...rest
}: Props = $props();

const overlayMotion = createOverlayMotion({
  motion: () => motion,
  defaults: { enter: 'scale', exit: 'fade', duration: 'fast' },
});

const classes = $derived(
  menuContentClass({
    size,
    variant,
    class: className,
  })
);
</script>

<ContextMenu.Content bind:ref
  motionHooks={overlayMotion}
  class={classes}
  data-tx-context-menu-content
  data-size={size}
  data-variant={variant}
  {...rest}
>
  {@render children?.()}
</ContextMenu.Content>
