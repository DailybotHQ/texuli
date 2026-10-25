<script lang="ts">
import { Carousel } from 'texuli';
import { scopedTheme } from '../scoped-theme.ts';
import SlideCard from './SlideCard.svelte';
import { DESTINATIONS, type DemoSlide } from './slides.ts';
</script>

<!-- A dark stage: a real dark theme scope, so every token (and light-dark() fallback) flips together. -->
<div class="stage" use:scopedTheme={'dark'}>
  <Carousel items={[...DESTINATIONS]} label="Destinations at night">
    {#snippet children(item)}
      <SlideCard slide={item as DemoSlide} />
    {/snippet}
  </Carousel>
</div>

<style>
  .stage {
    max-inline-size: 36rem;
    padding: 1.25rem;
    border-radius: 0.75rem;
    background: var(--tx-background, Canvas);
    color: var(--tx-foreground, CanvasText);
  }
</style>
