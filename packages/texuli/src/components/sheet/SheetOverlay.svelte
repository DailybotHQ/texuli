<script lang="ts">
import { Sheet as Primitive } from '@texuli/primitives/sheet';
import type { ComponentProps } from 'svelte';
import { type ClassValue, cx } from '../../internal/cx.ts';
import type { MotionProp } from '../../motion/contract.ts';
import { createOverlayMotion } from '../../motion/seam.ts';
import './sheet.css';

type Props = ComponentProps<typeof Primitive.Overlay> & {
  class?: ClassValue;
  /** Enter and exit motion (`texuli/motion`): default a fade; `false` for none. */
  motion?: MotionProp;
};
let { class: className, motion, ref = $bindable(null), ...rest }: Props = $props();
const backdropMotion = createOverlayMotion({
  motion: () => (motion === false ? false : { duration: motion?.duration ?? 'base' }),
  defaults: { enter: 'fade', exit: 'fade' },
});
</script>

<Primitive.Overlay bind:ref {...rest} motionHooks={backdropMotion} class={cx('tx-sheet-overlay', className)} data-tx-sheet-overlay="" />
