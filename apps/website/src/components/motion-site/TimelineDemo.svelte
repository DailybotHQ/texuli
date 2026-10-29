<script lang="ts">
/**
 * /motion-page/ timelines: a heading step, then six tiles in parallel with
 * staggered offsets, on one clock (`timeline`, `parallel` and `stagger` from
 * `@texuli/core/motion`). Play, pause, reverse and seek; choose where the
 * stagger starts. A new timeline is built for each play, at the settings
 * chosen now.
 */
import { parallel, stagger, type Timeline, timeline } from '@texuli/core/motion';
import SettingsNote from './SettingsNote.svelte';
import { describeRun, runtimeTiming } from './settings.svelte.ts';

const TILES = ['Plan', 'Design', 'Build', 'Test', 'Ship', 'Learn'];
const FROM = [
  { value: 'start', label: 'Start' },
  { value: 'center', label: 'Center' },
  { value: 'end', label: 'End' },
] as const;

let from = $state<'start' | 'center' | 'end'>('start');
let each = $state(80);
let heading = $state<HTMLElement | null>(null);
let tiles = $state<HTMLElement[]>([]);
let current: Timeline | null = null;
let paused = false;
let total = $state(0);
let position = $state(0);
let outcome = $state('Not played yet');
let offsets = $derived(stagger(TILES.length, each, { from }));

function build(): Timeline {
  current?.cancel();
  const tl = timeline(
    [
      {
        target: heading,
        keyframes: [
          { opacity: 0, transform: 'translateY(-8px)' },
          { opacity: 1, transform: 'none' },
        ],
        duration: 200,
      },
      parallel(
        ...tiles.map((target, index) => ({
          target,
          keyframes: [
            { opacity: 0, transform: 'translateY(16px) scale(0.92)' },
            { opacity: 1, transform: 'none' },
          ],
          duration: 300,
          at: offsets[index] ?? 0,
        }))
      ),
    ],
    { ...runtimeTiming(), easing: 'cubic-bezier(0.2, 0, 0, 1)' }
  );
  current = tl;
  total = Math.round(tl.duration);
  position = 0;
  outcome = describeRun(tl);
  void tl.finished.then((result) => {
    if (current !== tl) return;
    outcome = describeRun(tl, result);
    position = result === 'finished' ? total : position;
  });
  return tl;
}

function play(): void {
  const tl = current && paused ? current : build();
  paused = false;
  tl.play();
  if (tl.instantReason === null) outcome = 'Playing';
}

function pause(): void {
  if (!current || current.instantReason !== null) return;
  current.pause();
  paused = true;
  outcome = 'Paused';
}

function reverse(): void {
  if (!current) build().finish();
  paused = false;
  current?.reverse();
  if (current?.instantReason === null) outcome = 'Reversed';
}

function seek(event: Event): void {
  const value = Number((event.currentTarget as HTMLInputElement).value);
  if (!current || current.instantReason !== null) build();
  if (!current || current.instantReason !== null) return;
  current.pause();
  current.seek(value);
  paused = true;
  position = value;
  outcome = 'Paused';
}
</script>

<div class="timeline" data-motion-timeline="">
  <div class="timeline__controls">
    <div class="timeline__buttons" role="toolbar" aria-label="Timeline">
      <button type="button" onclick={play}>Play</button>
      <button type="button" onclick={pause}>Pause</button>
      <button type="button" onclick={reverse}>Reverse</button>
    </div>
    <label class="timeline__field">
      <span>Stagger from</span>
      <select bind:value={from}>
        {#each FROM as option (option.value)}
          <option value={option.value}>{option.label}</option>
        {/each}
      </select>
    </label>
    <label class="timeline__field">
      <span>Offset per tile: {each} ms</span>
      <input type="range" min="0" max="200" step="20" bind:value={each} />
    </label>
  </div>

  <div class="stage" aria-hidden="true">
    <p class="stage__heading" bind:this={heading}>Release train, week 44</p>
    <div class="stage__tiles">
      {#each TILES as tile, index (tile)}
        <span class="tile" bind:this={tiles[index]}>
          <strong>{tile}</strong>
          <small>+{Math.round(offsets[index] ?? 0)} ms</small>
        </span>
      {/each}
    </div>
  </div>

  <label class="timeline__field timeline__scrub">
    <span>Seek: {position} of {total || '…'} ms</span>
    <input
      type="range"
      min="0"
      max={Math.max(total, 1)}
      step="10"
      value={position}
      oninput={seek}
      data-motion-seek=""
    />
  </label>
  <SettingsNote name="timeline" {outcome} />
</div>

<style>
  .timeline {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 0.9rem;
    padding: clamp(0.75rem, 2vw, 1.25rem);
    border: 1px solid var(--tx-border, CanvasText);
    border-radius: 1rem;
    background: var(--tx-surface, Canvas);
    color: var(--tx-foreground, CanvasText);
  }
  .timeline__controls {
    display: flex;
    flex-wrap: wrap;
    align-items: end;
    gap: 0.75rem 1.25rem;
  }
  .timeline__buttons {
    display: flex;
    gap: 0.4rem;
  }
  .timeline__field {
    display: grid;
    gap: 0.25rem;
    font-size: 0.8125rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
  .timeline__field select {
    min-block-size: 2.25rem;
    padding-inline: 0.5rem;
    border: 1px solid var(--tx-border, CanvasText);
    border-radius: 0.5rem;
    background: var(--tx-background, Canvas);
    color: var(--tx-foreground, CanvasText);
    font: inherit;
    font-weight: 400;
  }
  .timeline__field input[type='range'] {
    min-inline-size: 10rem;
    accent-color: var(--tx-primary, Highlight);
  }
  .timeline__scrub input[type='range'] {
    inline-size: 100%;
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
  }
  button:focus-visible,
  select:focus-visible,
  input:focus-visible {
    outline: 2px solid var(--tx-ring, Highlight);
    outline-offset: 2px;
  }
  .stage {
    display: grid;
    gap: 0.75rem;
    padding: 1rem;
    border-radius: 0.75rem;
    background: var(--tx-muted, Canvas);
  }
  .stage__heading {
    margin: 0;
    font-weight: 700;
  }
  .stage__tiles {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 5.5rem), 1fr));
    gap: 0.5rem;
  }
  .tile {
    display: grid;
    gap: 0.15rem;
    padding: 0.75rem 0.5rem;
    border: 1px solid var(--tx-border, CanvasText);
    border-radius: 0.6rem;
    background: var(--tx-surface, Canvas);
    text-align: center;
    font-size: 0.875rem;
  }
  .tile small {
    color: var(--tx-muted-foreground, CanvasText);
    font-variant-numeric: tabular-nums;
  }
</style>
