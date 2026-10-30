<script lang="ts">
import { HoverCardContent as PrimitiveContent } from '@texuli/primitives/hover-card';
import type { ComponentProps, Snippet } from 'svelte';
import { type ClassValue } from '../../internal/cx.ts';
import type { MotionProp } from '../../motion/contract.ts';
import { createOverlayMotion } from '../../motion/seam.ts';
import {
  hoverCardArrowClass,
  hoverCardContentClass,
  type PopoverSize,
  type PopoverVariant,
} from './variants.ts';
import './popover.css';
import { designDefaults, withDefault } from '../../internal/design-defaults.ts';

type Props = ComponentProps<typeof PrimitiveContent> & {
  children?: Snippet;
  class?: ClassValue;
  variant?: PopoverVariant;
  size?: PopoverSize;
  arrow?: boolean;
  /** Enter and exit motion (`texuli/motion`): default a quick scale-and-fade in, a fade out; `false` for none. */
  motion?: MotionProp;
};

let {
  children,
  class: className,
  variant: variantProp,
  size: sizeProp,
  arrow = true,
  motion,
  ref = $bindable(null),
  ...rest
}: Props = $props();
const txDefaults = designDefaults('popover');
const variant = $derived(withDefault(variantProp, txDefaults().variant, 'elevated'));
const size = $derived(withDefault(sizeProp, txDefaults().size, 'md'));

const overlayMotion = createOverlayMotion({
  motion: () => motion,
  defaults: { enter: 'scale', exit: 'fade', duration: 'fast' },
});

const classes = $derived(
  hoverCardContentClass({
    variant,
    size,
    class: className,
  })
);
</script>

<PrimitiveContent bind:ref
  motionHooks={overlayMotion}
  class={classes}
  data-tx-hover-card-content
  data-variant={variant}
  data-size={size}
  {...rest}
>
  {#if arrow}
    <span class={hoverCardArrowClass()} data-tx-hover-card-arrow aria-hidden="true"></span>
  {/if}
  {@render children?.()}
</PrimitiveContent>
