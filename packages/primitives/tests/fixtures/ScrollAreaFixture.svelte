<script lang="ts">
import { ScrollArea } from '../../src/scroll-area/index.ts';
import type { ScrollAreaType } from '../../src/scroll-area/types.ts';

let {
  type = 'always' as ScrollAreaType,
  label = 'Item list',
  itemCount = 40,
  height = 120,
}: {
  type?: ScrollAreaType;
  label?: string;
  itemCount?: number;
  height?: number;
} = $props();

const items = $derived(Array.from({ length: itemCount }, (_, i) => `Item ${i + 1}`));
</script>

<div style={`block-size:${height}px;inline-size:240px`}>
  <ScrollArea.Root {type} aria-label={label} data-testid="scroll-root">
    <ScrollArea.Viewport data-testid="scroll-viewport" style={`block-size:${height}px`}>
      <div data-testid="scroll-content">
        {#each items as item (item)}
          <div style="padding-block:0.35rem">{item}</div>
        {/each}
      </div>
    </ScrollArea.Viewport>
    <ScrollArea.Scrollbar orientation="vertical" data-testid="scroll-y">
      <ScrollArea.Thumb data-testid="scroll-y-thumb" />
    </ScrollArea.Scrollbar>
    <ScrollArea.Scrollbar orientation="horizontal" data-testid="scroll-x">
      <ScrollArea.Thumb data-testid="scroll-x-thumb" />
    </ScrollArea.Scrollbar>
    <ScrollArea.Corner data-testid="scroll-corner" />
  </ScrollArea.Root>
</div>
