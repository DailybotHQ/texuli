<script lang="ts">
import { Carousel } from 'texuli';
import SlideCard from './SlideCard.svelte';
import { DESTINATIONS, type DemoSlide } from './slides.ts';
</script>

<div class="demo">
  <Carousel items={[...DESTINATIONS]} label="Destinations, overlay controls" controls="overlay">
    {#snippet children(item)}
      <SlideCard slide={item as DemoSlide} />
    {/snippet}
  </Carousel>
</div>

<style>
  .demo {
    max-inline-size: 36rem;
  }
</style>
