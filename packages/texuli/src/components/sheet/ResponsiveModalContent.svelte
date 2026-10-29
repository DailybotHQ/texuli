<script lang="ts">
import { ResponsiveModal as Primitive } from '@texuli/primitives/sheet';
import type { ComponentProps } from 'svelte';
import { type ClassValue, cx } from '../../internal/cx.ts';
import type { MotionProp } from '../../motion/contract.ts';
import { createOverlayMotion, sheetEdge } from '../../motion/seam.ts';
import { responsiveModalContentClass, type SheetSize } from './variants.ts';
import './sheet.css';

type Props = ComponentProps<typeof Primitive.Content> & {
  size?: SheetSize;
  class?: ClassValue;
  /** Enter and exit motion (`texuli/motion`): default a slide from its edge (centered: a rise); `false` for none. */
  motion?: MotionProp;
};
let { size = 'md', class: className, motion, ref = $bindable(null), ...rest }: Props = $props();
const sheetMotion = createOverlayMotion({
  motion: () => motion,
  defaults: { enter: 'rise', exit: 'rise', duration: 'base' },
  edge: sheetEdge,
});
const classes = $derived(cx(responsiveModalContentClass({ size }), className));
</script>

<Primitive.Content bind:ref {...rest} motionHooks={sheetMotion} class={classes} data-tx-responsive-modal="" data-size={size} />
