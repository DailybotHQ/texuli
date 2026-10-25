<script lang="ts">
// Slider scenario: @texuli/primitives Slider public API only. A single slider, a
// two-thumb range, an RTL slider and a disabled one.
import { Slider } from '@texuli/primitives/slider';
import { behaviorEvent } from '../../harness/client/events.ts';

let volume = $state(40);
let price = $state([200, 800]);
let balance = $state(50);
let locked = $state(30);
</script>

<div class="behavior-sliders">
  <Slider.Root
    type="single"
    bind:value={volume}
    min={0}
    max={100}
    step={5}
    class="behavior-track"
    data-behavior-track="volume"
    onValueCommit={(next) => behaviorEvent('commit', next)}
  >
    <Slider.Range class="behavior-range" />
    <Slider.Thumb index={0} class="behavior-thumb" aria-label="Volume" />
  </Slider.Root>

  <Slider.Root type="multiple" bind:value={price} min={0} max={1000} step={10} class="behavior-track" data-behavior-track="price">
    <Slider.Range class="behavior-range" />
    <Slider.Thumb index={0} class="behavior-thumb" aria-label="Minimum price" />
    <Slider.Thumb index={1} class="behavior-thumb" aria-label="Maximum price" />
  </Slider.Root>

  <Slider.Root type="single" bind:value={balance} dir="rtl" class="behavior-track" data-behavior-track="balance">
    <Slider.Range class="behavior-range" />
    <Slider.Thumb index={0} class="behavior-thumb" aria-label="Balance" />
  </Slider.Root>

  <Slider.Root type="single" bind:value={locked} disabled class="behavior-track" data-behavior-track="locked">
    <Slider.Range class="behavior-range" />
    <Slider.Thumb index={0} class="behavior-thumb" aria-label="Locked" />
  </Slider.Root>
</div>

<style>
  .behavior-sliders {
    display: grid;
    gap: 2rem;
    padding: 1rem;
  }
  .behavior-sliders :global(.behavior-track) {
    position: relative;
    display: block;
    inline-size: 300px;
    block-size: 8px;
    border-radius: 4px;
    background: #d4d4d8;
  }
  .behavior-sliders :global(.behavior-range) {
    position: absolute;
    block-size: 100%;
    border-radius: 4px;
    background: #4338ca;
  }
  .behavior-sliders :global(.behavior-thumb) {
    position: absolute;
    inset-block-start: 50%;
    inline-size: 20px;
    block-size: 20px;
    border-radius: 50%;
    background: #ffffff;
    border: 2px solid #4338ca;
    translate: -50% -50%;
  }
</style>
