<script lang="ts">
import { Slider } from '../../src/slider/index.ts';
import type { HarnessProps } from '../support/contract.ts';

let { p, refs }: HarnessProps = $props();
</script>

<Slider.Root type="single" value={40} step={50} {...p('slider/SliderRoot')} bind:ref={refs['slider/SliderRoot']}>
  {#snippet children({ tickItems })}
    <Slider.Range {...p('slider/SliderRange')} bind:ref={refs['slider/SliderRange']} />
    <Slider.Thumb aria-label="Volume" {...p('slider/SliderThumb')} bind:ref={refs['slider/SliderThumb']} />
    {#each tickItems as tick (tick.index)}
      {#if tick.index === 1}
        <Slider.Tick index={tick.index} {...p('slider/SliderTick')} bind:ref={refs['slider/SliderTick']} />
      {:else}
        <Slider.Tick index={tick.index} />
      {/if}
    {/each}
  {/snippet}
</Slider.Root>
