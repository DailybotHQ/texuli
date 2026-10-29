<script lang="ts">
/**
 * /motion-page/ springs: the three spring tokens plotted from the solver
 * (server-rendered SVG), and a track per spring that plays it through
 * `animate(…, { spring })`: the duration is the settle time and the easing
 * the spring's `linear()` curve.
 */
import { animate } from '@texuli/core/motion';
import SettingsNote from './SettingsNote.svelte';
import { describeRun, runtimeTiming } from './settings.svelte.ts';
import { PLOT, plotX, plotY, SPRING_CURVES, TIME_TICKS } from './springs.ts';

let tracks = $state<HTMLElement[]>([]);
let dots = $state<HTMLElement[]>([]);
let outcome = $state('Not played yet');

function playOne(index: number): void {
  const curve = SPRING_CURVES[index];
  const track = tracks[index];
  const dot = dots[index];
  if (!curve || !track || !dot) return;
  const distance = Math.max(0, track.clientWidth - dot.offsetWidth - 8);
  const rtl = getComputedStyle(track).direction === 'rtl';
  const run = animate(
    dot,
    [{ transform: 'translateX(0)' }, { transform: `translateX(${rtl ? -distance : distance}px)` }],
    {
      ...runtimeTiming(),
      spring: { stiffness: curve.stiffness, damping: curve.damping, mass: curve.mass },
    }
  );
  outcome = `${curve.name}: ${describeRun(run)}`;
  void run.finished.then((result) => {
    outcome = `${curve.name}: ${describeRun(run, result)}`;
  });
}

function playAll(): void {
  for (let index = 0; index < SPRING_CURVES.length; index += 1) playOne(index);
}
</script>

<div class="springs" data-motion-springs="">
  <figure class="plot">
    <svg
      viewBox={`0 0 ${PLOT.width} ${PLOT.height}`}
      role="img"
      aria-labelledby="springs-plot-title"
      class="plot__svg"
    >
      <title id="springs-plot-title">
        Position over time for the gentle, snappy and bouncy springs: each rises from 0 to 1;
        bouncy overshoots the most.
      </title>
      {#each TIME_TICKS as tick (tick)}
        <line class="plot__grid" x1={plotX(tick)} x2={plotX(tick)} y1={PLOT.top} y2={PLOT.height - PLOT.bottom} />
        <text class="plot__tick" x={plotX(tick)} y={PLOT.height - PLOT.bottom + 18} text-anchor="middle">{tick} ms</text>
      {/each}
      <line class="plot__rest" x1={PLOT.left} x2={PLOT.width - 16} y1={plotY(1)} y2={plotY(1)} />
      <text class="plot__tick" x={PLOT.left - 6} y={plotY(1) + 4} text-anchor="end">1</text>
      <text class="plot__tick" x={PLOT.left - 6} y={plotY(0) + 4} text-anchor="end">0</text>
      {#each SPRING_CURVES as curve (curve.name)}
        <path class={`plot__curve curve-${curve.name}`} d={curve.path} />
      {/each}
    </svg>
    <figcaption>
      Drawn from <code>springSamples</code> in <code>@texuli/core/motion/spring</code>, the solver that
      precomputed each token's <code>linear()</code> easing.
    </figcaption>
  </figure>

  <ul class="legend">
    {#each SPRING_CURVES as curve, index (curve.name)}
      <li class="legend__item">
        <div class="legend__head">
          <span class={`swatch curve-${curve.name}`} aria-hidden="true"></span>
          <strong>{curve.name}</strong>
          <span class="legend__meta"
            >stiffness {curve.stiffness}, damping {curve.damping}, mass {curve.mass}; ratio
            {curve.ratio}; settles in {curve.durationMs} ms; peak {curve.peak}</span
          >
        </div>
        <code class="legend__var">{curve.vars.easing}</code>
        <div class="track" bind:this={tracks[index]}>
          <span class={`dot curve-${curve.name}`} bind:this={dots[index]} aria-hidden="true"></span>
        </div>
        <button type="button" onclick={() => playOne(index)} data-spring-play={curve.name}>
          Play {curve.name}
        </button>
      </li>
    {/each}
  </ul>
  <div class="springs__foot">
    <button type="button" onclick={playAll}>Play all three</button>
    <SettingsNote name="springs" {outcome} />
  </div>
</div>

<style>
  .springs {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 1rem;
    padding: clamp(0.75rem, 2vw, 1.25rem);
    border: 1px solid var(--tx-border, CanvasText);
    border-radius: 1rem;
    background: var(--tx-surface, Canvas);
    color: var(--tx-foreground, CanvasText);
  }
  .plot {
    display: grid;
    gap: 0.4rem;
    margin: 0;
  }
  .plot__svg {
    inline-size: 100%;
    block-size: auto;
    border-radius: 0.75rem;
    background: var(--tx-background, Canvas);
  }
  .plot figcaption {
    font-size: 0.8125rem;
    color: var(--tx-muted-foreground, CanvasText);
  }
  .plot__grid {
    stroke: var(--tx-border, GrayText);
    stroke-width: 1;
  }
  .plot__rest {
    stroke: var(--tx-muted-foreground, CanvasText);
    stroke-width: 1;
    stroke-dasharray: 4 4;
  }
  .plot__tick {
    fill: var(--tx-muted-foreground, CanvasText);
    font-size: 12px;
  }
  .plot__curve {
    fill: none;
    stroke-width: 3;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .curve-gentle {
    --curve: var(--tx-info, CanvasText);
    stroke: var(--curve);
  }
  .curve-snappy {
    --curve: var(--tx-primary, CanvasText);
    stroke: var(--curve);
    stroke-dasharray: 10 5;
  }
  .curve-bouncy {
    --curve: var(--tx-destructive, CanvasText);
    stroke: var(--curve);
    stroke-dasharray: 2 5;
  }
  .legend {
    display: grid;
    gap: 0.75rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .legend__item {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 0.4rem 0.75rem;
    align-items: center;
    padding-block-end: 0.75rem;
    border-block-end: 1px solid var(--tx-border, CanvasText);
  }
  .legend__head {
    grid-column: 1 / -1;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.25rem 0.6rem;
  }
  .legend__meta {
    font-size: 0.8125rem;
    color: var(--tx-muted-foreground, CanvasText);
    font-variant-numeric: tabular-nums;
  }
  .legend__var {
    grid-column: 1 / -1;
    font-size: 0.75rem;
  }
  .swatch {
    display: inline-block;
    inline-size: 1.5rem;
    block-size: 0;
    border-block-start: 3px solid var(--curve);
  }
  .swatch.curve-snappy {
    border-block-start-style: dashed;
  }
  .swatch.curve-bouncy {
    border-block-start-style: dotted;
  }
  .track {
    position: relative;
    block-size: 2rem;
    padding: 0.25rem;
    border-radius: 999px;
    background: var(--tx-muted, Canvas);
    border: 1px solid var(--tx-border, CanvasText);
  }
  .dot {
    display: block;
    inline-size: 1.5rem;
    block-size: 1.5rem;
    border-radius: 999px;
    background: var(--curve);
  }
  button {
    min-block-size: 2.25rem;
    padding-inline: 0.85rem;
    border: 1px solid var(--tx-border, ButtonText);
    border-radius: 0.5rem;
    background: var(--tx-background, ButtonFace);
    color: var(--tx-foreground, ButtonText);
    font: inherit;
    cursor: pointer;
    white-space: nowrap;
  }
  button:focus-visible {
    outline: 2px solid var(--tx-ring, Highlight);
    outline-offset: 2px;
  }
  .springs__foot {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem 1rem;
  }
  @media (forced-colors: active) {
    .curve-gentle,
    .curve-snappy,
    .curve-bouncy {
      --curve: CanvasText;
    }
    .dot {
      forced-color-adjust: none;
      background: CanvasText;
    }
  }
</style>
