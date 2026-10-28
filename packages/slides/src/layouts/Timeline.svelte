<script lang="ts">
/**
 * `timeline`: 4–8 dated events on one axis. More than four events wrap onto a
 * second row (Protoyard's rule), each row with its own axis line.
 */
import { fitContent, fitText } from './fit.ts';
import LayoutFrame from './LayoutFrame.svelte';
import { type LayoutRendererProps, useLayoutSteps } from './steps.ts';

let { slide, context }: LayoutRendererProps<'timeline'> = $props();
const steps = useLayoutSteps(() => context);
let p = $derived(slide.props);
let rows = $derived.by(() => {
  const events = p.events.map((event, index) => ({ event, index }));
  if (events.length <= 4) return [events];
  const first = Math.ceil(events.length / 2);
  return [events.slice(0, first), events.slice(first)];
});
</script>

<LayoutFrame layout="timeline" root={steps.at([])}>
  {#if p.title}
    <h2 class="tx-deck-layout__title" data-slot="title" data-clamp="2" {@attach fitText(40)}>
      {p.title}
    </h2>
  {/if}
  <div class="timeline" data-slot="timeline" {@attach fitContent()}>
    {#each rows as row, r (r)}
      <ol class="axis" data-slot="axis" data-count={row.length}>
        <span class="line" aria-hidden="true" data-tx-deck-decor></span>
        {#each row as { event, index } (index)}
          <li class="event" data-slot="event" {...steps.at(['events', index])}>
            <p class="tx-deck-layout__label">{event.time}</p>
            <span class="marker" aria-hidden="true"></span>
            <p class="tx-deck-layout__text" data-clamp="3">{event.text}</p>
          </li>
        {/each}
      </ol>
    {/each}
  </div>
</LayoutFrame>

<style>
  .timeline {
    display: flex;
    flex: 1;
    flex-direction: column;
    justify-content: center;
    gap: clamp(28px, 4cqi, 56px);
    min-block-size: 0;
  }

  .axis {
    position: relative;
    display: grid;
    grid-auto-columns: minmax(0, 1fr);
    grid-auto-flow: column;
    gap: clamp(14px, 2cqi, 28px);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .line {
    position: absolute;
    inset-inline: 0;
    inset-block-start: calc(clamp(18px, 1.5cqi, 20px) * 1.25 + clamp(8px, 1.2cqi, 16px) + clamp(10px, 1.1cqi, 14px));
    block-size: clamp(3px, 0.35cqi, 5px);
    border-radius: 999px;
    background: color-mix(in oklch, var(--tx-deck-accent) 45%, transparent);
  }

  .event {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: clamp(8px, 1.2cqi, 16px);
    min-inline-size: 0;
  }

  .marker {
    position: relative;
    display: block;
    inline-size: clamp(20px, 2.2cqi, 28px);
    block-size: clamp(20px, 2.2cqi, 28px);
    border: clamp(4px, 0.5cqi, 6px) solid var(--tx-deck-accent);
    border-radius: 50%;
    background: var(--tx-deck-bg-color, var(--tx-background, Canvas));
  }

  @container (max-inline-size: 48rem) {
    .axis {
      grid-auto-flow: row;
    }

    .line {
      display: none;
    }
  }
</style>
