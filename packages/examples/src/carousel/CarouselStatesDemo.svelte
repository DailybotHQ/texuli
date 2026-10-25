<script lang="ts">
import { Carousel } from 'texuli';
import SlideCard from './SlideCard.svelte';
import { DESTINATIONS, type DemoSlide } from './slides.ts';

const spanish = {
  carousel: 'Carrusel',
  slides: 'Diapositivas',
  previous: 'Diapositiva anterior',
  next: 'Diapositiva siguiente',
  goTo: 'Ir a la diapositiva {index}: {label}',
  slide: '{index} de {total}: {label}',
  status: 'Diapositiva {index} de {total}',
};
</script>

<div class="states">
  <section aria-labelledby="state-ends">
    <h2 id="state-ends">No loop, at the first slide</h2>
    <Carousel items={[...DESTINATIONS]} label="No loop" loop={false}>
      {#snippet children(item)}
        <SlideCard slide={item as DemoSlide} level={3} />
      {/snippet}
    </Carousel>
  </section>

  <section aria-labelledby="state-basic">
    <h2 id="state-basic">Buttons only (no picker)</h2>
    <Carousel items={[...DESTINATIONS]} label="Buttons only" showDots={false} />
  </section>

  <section aria-labelledby="state-single">
    <h2 id="state-single">A single slide (no controls)</h2>
    <Carousel items={[DESTINATIONS[0] as DemoSlide]} label="Single slide">
      {#snippet children(item)}
        <SlideCard slide={item as DemoSlide} level={3} />
      {/snippet}
    </Carousel>
  </section>

  <section aria-labelledby="state-translated" lang="es">
    <h2 id="state-translated">Etiquetas traducidas</h2>
    <Carousel items={[...DESTINATIONS]} messages={spanish} index={1} />
  </section>
</div>

<style>
  .states {
    display: grid;
    gap: 2rem;
    max-inline-size: 36rem;
  }
  h2 {
    margin: 0 0 0.75rem;
    font-size: 1rem;
  }
</style>
