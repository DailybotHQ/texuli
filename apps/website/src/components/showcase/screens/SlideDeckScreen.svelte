<script lang="ts">
import { Badge } from 'texuli/badge';
import { Button } from 'texuli/button';
import { Card, CardContent, CardHeader, CardTitle } from 'texuli/card';

const slides = [
  {
    id: '1',
    title: 'Harbor Notes',
    body: 'Small pieces. Infinite possibilities.',
  },
  {
    id: '2',
    title: 'Why Texuli',
    body: 'Accessible primitives, themed components, safe media, static sites.',
  },
  {
    id: '3',
    title: 'Next steps',
    body: 'Browse the showcase screens, then open the foundation and brand stories.',
  },
];

let index = $state(0);
const current = $derived(slides[index] ?? slides[0]!);
</script>

<section class="deck" aria-label="Slide deck">
  <div class="deck__toolbar">
    <Badge variant="secondary">Slide {index + 1} of {slides.length}</Badge>
    <div class="deck__nav">
      <Button
        type="button"
        size="sm"
        variant="secondary"
        disabled={index === 0}
        onclick={() => (index = Math.max(0, index - 1))}
      >
        Previous
      </Button>
      <Button
        type="button"
        size="sm"
        disabled={index >= slides.length - 1}
        onclick={() => (index = Math.min(slides.length - 1, index + 1))}
      >
        Next
      </Button>
    </div>
  </div>
  <Card variant="elevated" class="slide">
    <CardHeader>
      <CardTitle level={2}>{current.title}</CardTitle>
    </CardHeader>
    <CardContent>
      <p class="slide__body">{current.body}</p>
    </CardContent>
  </Card>
  <ol class="thumbs" aria-label="Slide list">
    {#each slides as s, i (s.id)}
      <li>
        <button
          type="button"
          class="thumb"
          class:active={i === index}
          aria-current={i === index ? 'true' : undefined}
          onclick={() => (index = i)}
        >
          {s.title}
        </button>
      </li>
    {/each}
  </ol>
</section>

<style>
  .deck {
    display: grid;
    gap: 1rem;
    max-inline-size: 40rem;
  }
  .deck__toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }
  .deck__nav {
    display: flex;
    gap: 0.4rem;
  }
  .slide__body {
    margin: 0;
    font-size: 1.15rem;
    line-height: 1.5;
  }
  .thumbs {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }
  .thumb {
    padding: 0.35rem 0.65rem;
    border: 1px solid var(--tx-border, ButtonBorder);
    border-radius: var(--tx-radius, 0.375rem);
    background: var(--tx-surface, Canvas);
    color: inherit;
    font: inherit;
    font-size: 0.85rem;
    cursor: pointer;
  }
  .thumb.active,
  .thumb:focus-visible {
    outline: 2px solid var(--tx-ring, Highlight);
    outline-offset: 2px;
  }
</style>
