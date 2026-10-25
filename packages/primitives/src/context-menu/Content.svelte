<script lang="ts">
import type { Placement } from '@texuli/core/position-math';
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import ContentImpl from '../menu/ContentImpl.svelte';
import { menuLevelContext } from '../menu/context.ts';

type Props = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  /** Where the menu opens from the pointer; it flips and shifts to stay in view. */
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
  sideOffset?: number;
  children?: Snippet;
};

let { side = 'right', align = 'start', sideOffset = 2, children, ...rest }: Props = $props();
const level = menuLevelContext.get();
const placement = $derived((align === 'center' ? side : `${side}-${align}`) as Placement);
</script>

<ContentImpl {...rest} {level} {placement} {sideOffset}>{@render children?.()}</ContentImpl>
