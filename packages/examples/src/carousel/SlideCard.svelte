<script lang="ts">
import type { DemoSlide } from './slides.ts';

/** Heading level of the card title, so it fits the page outline (default 2). */
let { slide, level = 2 }: { slide: DemoSlide; level?: 2 | 3 } = $props();
</script>

<article class="slide-card" data-tone={slide.tone}>
  <div class="art" aria-hidden="true"></div>
  <div class="copy">
    <svelte:element this={`h${level}`} class="title">{slide.label}</svelte:element>
    <p>{slide.text}</p>
  </div>
</article>

<style>
  .slide-card {
    display: grid;
    grid-template-rows: 9rem auto;
    overflow: hidden;
    border: 1px solid var(--tx-border, light-dark(#d4d4d8, #3f3f46));
    border-radius: var(--tx-radius, 0.5rem);
    background: var(--tx-surface, light-dark(#ffffff, #18181b));
    color: var(--tx-foreground, light-dark(#18181b, #f4f4f5));
  }
  .art {
    background: linear-gradient(135deg, var(--from), var(--to));
  }
  [data-tone='dawn'] .art {
    --from: #fdba74;
    --to: #f472b6;
  }
  [data-tone='night'] .art {
    --from: #312e81;
    --to: #7c3aed;
  }
  [data-tone='forest'] .art {
    --from: #166534;
    --to: #84cc16;
  }
  [data-tone='sea'] .art {
    --from: #0e7490;
    --to: #38bdf8;
  }
  .copy {
    padding: 1rem;
  }
  .title {
    margin: 0 0 0.25rem;
    font-size: 1.0625rem;
  }
  p {
    margin: 0;
    line-height: 1.5;
    color: var(--tx-muted-foreground, light-dark(#52525b, #c4c4cc));
  }
  @media (forced-colors: active) {
    .slide-card {
      border-color: CanvasText;
      background: Canvas;
      color: CanvasText;
    }
    p {
      color: CanvasText;
    }
    .art {
      background: CanvasText;
    }
  }
</style>
