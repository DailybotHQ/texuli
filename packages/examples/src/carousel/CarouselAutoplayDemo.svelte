<script lang="ts">
import { Carousel } from 'texuli';
import SlideCard from './SlideCard.svelte';
import { DESTINATIONS, type DemoSlide } from './slides.ts';

let playing = $state(false);
</script>

<div class="demo">
  <Carousel
    items={[...DESTINATIONS]}
    label="Rotating destinations"
    autoplay
    interval={4000}
    onPlayingChange={(next) => (playing = next)}
  >
    {#snippet children(item)}
      <SlideCard slide={item as DemoSlide} />
    {/snippet}
  </Carousel>
  <p class="note">
    {playing
      ? 'Rotating every 4 seconds. Hover to pause; focus a control to stop.'
      : 'Rotation is stopped (or reduced motion is on). Use the play button to start it.'}
  </p>
</div>

<style>
  .demo {
    max-inline-size: 36rem;
  }
  .note {
    margin-block: 0.75rem 0;
    font-size: 0.875rem;
  }
</style>
