<script lang="ts">
import type { Placement } from '@texuli/core/position-math';
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import ContentImpl from './ContentImpl.svelte';
import { menuLevelContext } from './context.ts';

type Props = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
  sideOffset?: number;
  children?: Snippet;
};

let { side = 'bottom', align = 'start', sideOffset = 4, children, ...rest }: Props = $props();
const level = menuLevelContext.get();
const placement = $derived((align === 'center' ? side : `${side}-${align}`) as Placement);
</script>

<ContentImpl {...rest} {level} {placement} {sideOffset}>{@render children?.()}</ContentImpl>
