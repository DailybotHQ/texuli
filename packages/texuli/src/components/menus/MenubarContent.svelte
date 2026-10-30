<script lang="ts">
import * as MenubarPrimitive from '@texuli/primitives/menubar';
import type { ComponentProps, Snippet } from 'svelte';
import { type ClassValue } from '../../internal/cx.ts';
import type { MotionProp } from '../../motion/contract.ts';
import { createOverlayMotion } from '../../motion/seam.ts';
import { type MenuSize, type MenuVariant, menuContentClass } from './variants.ts';
import './menus.css';
import { designDefaults, withDefault } from '../../internal/design-defaults.ts';

type Props = ComponentProps<typeof MenubarPrimitive.Content> & {
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
  size: sizeProp,
  variant: variantProp,
  motion,
  ref = $bindable(null),
  ...rest
}: Props = $props();
const txDefaults = designDefaults('menu');
const size = $derived(withDefault(sizeProp, txDefaults().size, 'md'));
const variant = $derived(withDefault(variantProp, txDefaults().variant, 'default'));

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

<MenubarPrimitive.Content bind:ref
  motionHooks={overlayMotion}
  class={classes}
  data-tx-menubar-content
  data-size={size}
  data-variant={variant}
  {...rest}
>
  {@render children?.()}
</MenubarPrimitive.Content>
