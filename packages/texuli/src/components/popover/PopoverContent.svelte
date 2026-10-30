<script lang="ts">
import { Content as PrimitiveContent } from '@texuli/primitives/popover';
import type { ComponentProps, Snippet } from 'svelte';
import { type ClassValue } from '../../internal/cx.ts';
import type { MotionProp } from '../../motion/contract.ts';
import { createOverlayMotion } from '../../motion/seam.ts';
import {
  type PopoverSize,
  type PopoverVariant,
  popoverArrowClass,
  popoverContentClass,
} from './variants.ts';
import './popover.css';
import { designDefaults, withDefault } from '../../internal/design-defaults.ts';

type Props = ComponentProps<typeof PrimitiveContent> & {
  children?: Snippet;
  class?: ClassValue;
  variant?: PopoverVariant;
  size?: PopoverSize;
  /** Show the decorative arrow (default true). */
  arrow?: boolean;
  /** Accessible name when content has no visible heading. */
  'aria-label'?: string;
  /** Enter and exit motion (`texuli/motion`): default a quick scale-and-fade; `false` for none. */
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
  defaults: { enter: 'scale', exit: 'scale', duration: 'fast' },
});

const classes = $derived(
  popoverContentClass({
    variant,
    size,
    class: className,
  })
);
</script>

<PrimitiveContent bind:ref
  motionHooks={overlayMotion}
  class={classes}
  data-tx-popover-content
  data-variant={variant}
  data-size={size}
  {...rest}
>
  {#if arrow}
    <span class={popoverArrowClass()} data-tx-popover-arrow aria-hidden="true"></span>
  {/if}
  {@render children?.()}
</PrimitiveContent>
