<script lang="ts">
import { Carousel } from 'texuli';
import SlideCard from './SlideCard.svelte';
import { DESTINATIONS, type DemoSlide } from './slides.ts';
</script>

<!-- A dark stage: `color-scheme: dark` flips every light-dark() fallback in the carousel. -->
<div class="stage" data-tx-mode="dark">
  <Carousel items={[...DESTINATIONS]} label="Destinations at night">
    {#snippet children(item)}
      <SlideCard slide={item as DemoSlide} />
    {/snippet}
  </Carousel>
</div>

<style>
  .stage {
    color-scheme: dark;
    max-inline-size: 36rem;
    padding: 1.25rem;
    border-radius: 0.75rem;
    background: #111114;
    color: #f4f4f5;
  }
  @media (forced-colors: active) {
    .stage {
      background: Canvas;
      color: CanvasText;
    }
  }
</style>
