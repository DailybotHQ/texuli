<script lang="ts">
import type { Placement } from '@texuli/core/position-math';
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type { OverlayMotionHooks } from '../internal/motion-hold.ts';
import type { RefProp } from '../internal/ref.ts';
import ContentImpl from './ContentImpl.svelte';
import { menuLevelContext } from './context.ts';

type Props = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
  sideOffset?: number;
  /** Enter and exit motion (texuli passes `texuli/motion` hooks). */
  motionHooks?: OverlayMotionHooks;
  children?: Snippet;
} & RefProp;

let {
  side = 'bottom',
  align = 'start',
  sideOffset = 4,
  children,
  ref = $bindable(null),
  ...rest
}: Props = $props();
const level = menuLevelContext.get();
const placement = $derived((align === 'center' ? side : `${side}-${align}`) as Placement);
</script>

<ContentImpl bind:ref {...rest} {level} {placement} {sideOffset}>{@render children?.()}</ContentImpl>
