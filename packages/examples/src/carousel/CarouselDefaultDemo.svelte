<script lang="ts">
import { Carousel } from 'texuli';
import SlideCard from './SlideCard.svelte';
import { DESTINATIONS, type DemoSlide } from './slides.ts';

let index = $state(0);
</script>

<div class="demo">
  <Carousel items={[...DESTINATIONS]} label="Featured destinations" bind:index>
    {#snippet children(item)}
      <SlideCard slide={item as DemoSlide} />
    {/snippet}
  </Carousel>
  <p class="note">Showing {DESTINATIONS[index]?.label}.</p>
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
