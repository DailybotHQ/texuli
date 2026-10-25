<script lang="ts">
import type { ScrollAreaDir, ScrollAreaType } from '@texuli/primitives/scroll-area';
import { ScrollArea } from '../../src/components/scroll-area/index.ts';
import type { ScrollAreaSize } from '../../src/components/scroll-area/variants.ts';
import { type ClassValue } from '../../src/internal/cx.ts';

let {
  label = 'Activity',
  size,
  type,
  dir,
  class: className,
}: {
  label?: string;
  size?: ScrollAreaSize;
  type?: ScrollAreaType;
  dir?: ScrollAreaDir;
  class?: ClassValue;
} = $props();
</script>

<ScrollArea {label} {size} {type} {dir} class={className}>
  <span>Activity item</span>
</ScrollArea>
