<script lang="ts">
import { ScrollArea } from '../../src/scroll-area/index.ts';
import type { HarnessProps } from '../support/contract.ts';

let { p, refs }: HarnessProps = $props();
</script>

<ScrollArea.Root type="always" aria-label="Log" {...p('scroll-area/Root')} bind:ref={refs['scroll-area/Root']}>
  <ScrollArea.Viewport {...p('scroll-area/Viewport')} bind:ref={refs['scroll-area/Viewport']}><p>Line</p></ScrollArea.Viewport>
  <ScrollArea.Scrollbar orientation="vertical" forceMount {...p('scroll-area/Scrollbar')} bind:ref={refs['scroll-area/Scrollbar']}>
    <ScrollArea.Thumb forceMount {...p('scroll-area/Thumb')} bind:ref={refs['scroll-area/Thumb']} />
  </ScrollArea.Scrollbar>
  <ScrollArea.Scrollbar orientation="horizontal"><ScrollArea.Thumb /></ScrollArea.Scrollbar>
  <ScrollArea.Corner forceMount {...p('scroll-area/Corner')} bind:ref={refs['scroll-area/Corner']} />
</ScrollArea.Root>
