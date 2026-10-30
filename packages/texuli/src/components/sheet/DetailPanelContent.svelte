<script lang="ts">
import { Panel as Primitive } from '@texuli/primitives/sheet';
import type { ComponentProps } from 'svelte';
import { type ClassValue, cx } from '../../internal/cx.ts';
import type { MotionProp } from '../../motion/contract.ts';
import { createOverlayMotion, sheetEdge } from '../../motion/seam.ts';
import { detailPanelContentClass, type SheetSize } from './variants.ts';
import './sheet.css';
import { designDefaults, withDefault } from '../../internal/design-defaults.ts';

type Props = ComponentProps<typeof Primitive.Content> & {
  size?: SheetSize;
  class?: ClassValue;
  /** Enter and exit motion (`texuli/motion`): default a slide from its edge (centered: a rise); `false` for none. */
  motion?: MotionProp;
};
let {
  size: sizeProp,
  side = 'end',
  class: className,
  motion,
  ref = $bindable(null),
  ...rest
}: Props = $props();
const txDefaults = designDefaults('sheet');
const size = $derived(withDefault(sizeProp, txDefaults().size, 'md'));
const sheetMotion = createOverlayMotion({
  motion: () => motion,
  defaults: { enter: 'rise', exit: 'rise', duration: 'base' },
  edge: sheetEdge,
});
const classes = $derived(cx(detailPanelContentClass({ size }), className));
</script>

<Primitive.Content bind:ref {...rest} motionHooks={sheetMotion} {side} class={classes} data-tx-detail-panel="" data-size={size} />
