<script lang="ts">
/**
 * /motion-page/ spring lab: any spring, not only the three tokens. Drag
 * stiffness, damping, mass and the initial velocity; the owned solver of
 * `@texuli/core/motion/spring` redraws the curve (`springSamples`), reports
 * the damping ratio, the settle time (capped at 1,000 ms), the overshoot
 * and the `linear()` easing the browser will play (`springEasing`), and
 * "Play" runs it on a puck through `animate(…, { spring })` at the page's
 * settings. Start from a token or the default.
 */
import { animate } from '@texuli/core/motion';
import {
  DEFAULT_SPRING,
  dampingRatio,
  MAX_SPRING_MS,
  springEasing,
  springSamples,
} from '@texuli/core/motion/spring';
import { MOTION_SPRING_NAMES, MOTION_SPRINGS } from '@texuli/tokens/motion';
import SettingsNote from './SettingsNote.svelte';
import { describeRun, runtimeTiming } from './settings.svelte.ts';

const W = 560;
const H = 220;
const PAD = 28;
const TOP = 1.6;

let stiffness = $state(DEFAULT_SPRING.stiffness);
let damping = $state(DEFAULT_SPRING.damping);
let mass = $state(DEFAULT_SPRING.mass);
let velocity = $state(0);
let outcome = $state<string | undefined>(undefined);
let track = $state<HTMLElement | null>(null);
let puck = $state<HTMLElement | null>(null);

const params = $derived({ stiffness, damping, mass });
const curve = $derived(springSamples(params, { samples: 80, velocity }));
const easing = $derived(springEasing(params, { samples: 24, velocity }));
const ratio = $derived(Math.round(dampingRatio(params) * 100) / 100);
const peak = $derived(Math.round(Math.max(...curve.points) * 100) / 100);
const kind = $derived(
  ratio < 1
    ? 'underdamped: it overshoots'
    : ratio === 1
      ? 'critically damped'
      : 'overdamped: no overshoot'
);

const x = (index: number) => PAD + (index / Math.max(1, curve.points.length - 1)) * (W - PAD * 2);
const y = (position: number) =>
  H - PAD - (Math.max(-0.2, Math.min(TOP, position)) / TOP) * (H - PAD * 2);
const path = $derived(
  curve.points
    .map(
      (point, index) => `${index === 0 ? 'M' : 'L'}${x(index).toFixed(1)} ${y(point).toFixed(1)}`
    )
    .join(' ')
);

function preset(name: 'default' | (typeof MOTION_SPRING_NAMES)[number]): void {
  const source = name === 'default' ? DEFAULT_SPRING : MOTION_SPRINGS[name];
  stiffness = source.stiffness;
  damping = source.damping;
  mass = source.mass;
  velocity = 0;
}

function play(): void {
  if (!track || !puck) return;
  const distance = Math.max(0, track.clientWidth - puck.offsetWidth - 8);
  const rtl = getComputedStyle(track).direction === 'rtl';
  const run = animate(
    puck,
    [{ transform: 'translateX(0)' }, { transform: `translateX(${rtl ? -distance : distance}px)` }],
    { ...runtimeTiming(), spring: params }
  );
  outcome = describeRun(run);
  void run.finished.then((result) => {
    outcome = describeRun(run, result);
  });
}
</script>

<div class="lab" data-motion-spring-lab="">
  <div class="lab__controls">
    <div class="lab__presets" role="group" aria-label="Start from">
      <button type="button" class="lab__button" onclick={() => preset('default')}>Default</button>
      {#each MOTION_SPRING_NAMES as name (name)}
        <button type="button" class="lab__button" onclick={() => preset(name)}>{name}</button>
      {/each}
    </div>
    <label class="lab__range">
      <span>Stiffness <output>{stiffness}</output></span>
      <input type="range" min="20" max="1000" step="10" bind:value={stiffness} data-spring="stiffness" />
    </label>
    <label class="lab__range">
      <span>Damping <output>{damping}</output></span>
      <input type="range" min="1" max="80" step="1" bind:value={damping} data-spring="damping" />
    </label>
    <label class="lab__range">
      <span>Mass <output>{mass}</output></span>
      <input type="range" min="0.2" max="5" step="0.1" bind:value={mass} data-spring="mass" />
    </label>
    <label class="lab__range">
      <span>Initial velocity <output>{velocity}</output></span>
      <input type="range" min="-10" max="10" step="0.5" bind:value={velocity} data-spring="velocity" />
    </label>
  </div>

  <figure class="lab__plot">
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby="spring-lab-title" class="lab__svg">
      <title id="spring-lab-title">
        Position over {curve.durationMs} ms for stiffness {stiffness}, damping {damping}, mass {mass}:
        peak {peak}.
      </title>
      <line class="lab__rest" x1={PAD} x2={W - PAD} y1={y(1)} y2={y(1)} />
      <line class="lab__axis" x1={PAD} x2={W - PAD} y1={y(0)} y2={y(0)} />
      <text class="lab__tick" x={PAD - 6} y={y(1) + 4} text-anchor="end">1</text>
      <text class="lab__tick" x={PAD - 6} y={y(0) + 4} text-anchor="end">0</text>
      <text class="lab__tick" x={W - PAD} y={H - 8} text-anchor="end">{curve.durationMs} ms</text>
      <path class="lab__curve" d={path} />
    </svg>
  </figure>

  <dl class="lab__facts" data-spring-facts="">
    <div><dt>Damping ratio</dt><dd data-spring-ratio="">{ratio} ({kind})</dd></div>
    <div><dt>Settles in</dt><dd data-spring-settle="">{curve.durationMs} ms{curve.settled ? '' : ` (capped at ${MAX_SPRING_MS} ms)`}</dd></div>
    <div><dt>Peak</dt><dd>{peak}</dd></div>
  </dl>
  <p class="lab__easing">
    <span>The easing the browser plays:</span>
    <code data-spring-easing="">{easing.easing.length > 140 ? `${easing.easing.slice(0, 137)}…` : easing.easing}</code>
  </p>

  <div class="lab__run">
    <div class="lab__track" bind:this={track} aria-hidden="true">
      <span class="lab__puck" bind:this={puck}></span>
    </div>
    <button type="button" class="lab__button" onclick={play}>Play this spring</button>
  </div>
  <SettingsNote name="spring-lab" {outcome} />
</div>

<style>
  .lab {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 0.9rem;
    padding: clamp(0.75rem, 2vw, 1.25rem);
    border: 1px solid var(--tx-border, CanvasText);
    border-radius: 1rem;
    background: var(--tx-surface, Canvas);
    color: var(--tx-foreground, CanvasText);
  }
  .lab__controls {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 12rem), 1fr));
    gap: 0.75rem 1rem;
    align-items: end;
  }
  .lab__presets {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    grid-column: 1 / -1;
  }
  .lab__range {
    display: grid;
    gap: 0.25rem;
    font-size: 0.8125rem;
    font-weight: 600;
  }
  .lab__range output {
    font-weight: 400;
    font-variant-numeric: tabular-nums;
  }
  .lab__range input {
    inline-size: 100%;
    accent-color: var(--tx-primary, Highlight);
  }
  .lab__button {
    min-block-size: 2.25rem;
    padding-inline: 0.8rem;
    border: 1px solid var(--tx-border, ButtonBorder);
    border-radius: 0.5rem;
    background: var(--tx-background, ButtonFace);
    color: var(--tx-foreground, ButtonText);
    font: inherit;
    cursor: pointer;
  }
  .lab__button:focus-visible,
  .lab__range input:focus-visible {
    outline: 2px solid var(--tx-ring, Highlight);
    outline-offset: 2px;
  }
  .lab__plot {
    margin: 0;
  }
  .lab__svg {
    display: block;
    inline-size: 100%;
    block-size: auto;
    max-block-size: 16rem;
  }
  .lab__rest {
    stroke: var(--tx-muted-foreground, GrayText);
    stroke-dasharray: 4 4;
  }
  .lab__axis {
    stroke: var(--tx-border, GrayText);
  }
  .lab__tick {
    fill: var(--tx-muted-foreground, CanvasText);
    font-size: 12px;
  }
  .lab__curve {
    fill: none;
    stroke: var(--tx-primary, Highlight);
    stroke-width: 3;
    stroke-linejoin: round;
  }
  .lab__facts {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 1.5rem;
    margin: 0;
    font-size: 0.875rem;
  }
  .lab__facts div {
    display: flex;
    gap: 0.4rem;
  }
  .lab__facts dt {
    font-weight: 600;
  }
  .lab__facts dd {
    margin: 0;
    font-variant-numeric: tabular-nums;
  }
  .lab__easing {
    display: grid;
    gap: 0.25rem;
    margin: 0;
    font-size: 0.8125rem;
  }
  .lab__easing code {
    overflow-wrap: anywhere;
  }
  .lab__run {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem;
  }
  .lab__track {
    position: relative;
    flex: 1 1 14rem;
    block-size: 2.25rem;
    border: 1px dashed var(--tx-border, CanvasText);
    border-radius: 999px;
  }
  .lab__puck {
    position: absolute;
    inset-block-start: 0.25rem;
    inset-inline-start: 0.25rem;
    inline-size: 1.75rem;
    block-size: 1.75rem;
    border-radius: 50%;
    background: var(--tx-primary, Highlight);
  }
  @media (forced-colors: active) {
    .lab__curve {
      stroke: CanvasText;
    }
    .lab__puck {
      background: Highlight;
    }
  }
</style>
