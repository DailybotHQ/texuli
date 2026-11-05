<script lang="ts">
import type { MotionDurationName, MotionLevel } from '../../src/motion/contract.ts';
import type { MotionLoopPreset, MotionLoopStagger } from '../../src/motion/loop/loop.ts';
import MotionLoop from '../../src/motion/loop/MotionLoop.svelte';
import MotionProvider from '../../src/motion/MotionProvider.svelte';

let {
  level = 'full',
  reducedMotion,
  preset,
  playing,
  duration,
  stagger,
}: {
  level?: MotionLevel;
  reducedMotion?: boolean;
  preset?: MotionLoopPreset;
  playing?: boolean;
  duration?: MotionDurationName;
  stagger?: MotionLoopStagger;
} = $props();
</script>

<MotionProvider {level} {reducedMotion}>
  <MotionLoop {preset} {playing} {duration} {stagger} data-probe="loop" aria-hidden="true">
    {#each [1, 2, 3, 4, 5] as bar (bar)}<span></span>{/each}
  </MotionLoop>
</MotionProvider>
