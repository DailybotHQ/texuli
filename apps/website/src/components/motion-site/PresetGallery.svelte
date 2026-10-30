<script lang="ts">
/**
 * /motion-page/ preset gallery: every enter and exit preset of the closed
 * vocabulary (`MOTION_PRESETS` from `texuli/motion`, the spec's
 * `$defs.motionPreset`), plus the four edge slides sheets and drawers use,
 * each on its own card with replay buttons. The cards play through the
 * same runtime the components use (`loadMotionRuntime().playPresence`), at
 * the duration step picked here and the page's level and reduced-motion
 * settings, and show the keyframes each preset resolves to.
 */

import { onMount } from 'svelte';
import {
  loadMotionRuntime,
  MOTION_DURATION_NAMES,
  MOTION_PRESETS,
  type MotionDurationName,
  type MotionPreset,
} from 'texuli/motion';
import SettingsNote from './SettingsNote.svelte';
import { describeRun, MOTION_SETTINGS, providerReduced } from './settings.svelte.ts';

type Runtime = NonNullable<Awaited<ReturnType<typeof loadMotionRuntime>>>;
type Edge = 'left' | 'right' | 'top' | 'bottom';
interface Card {
  readonly id: string;
  readonly label: string;
  readonly preset: MotionPreset;
  readonly edge?: Edge;
}

const EDGES: readonly Edge[] = ['left', 'right', 'top', 'bottom'];
const CARDS: readonly Card[] = [
  ...MOTION_PRESETS.map((preset) => ({ id: preset, label: preset, preset })),
  ...EDGES.map((edge) => ({
    id: `edge-${edge}`,
    label: `edge slide, ${edge}`,
    preset: 'slide-start' as MotionPreset,
    edge,
  })),
];

let runtime = $state.raw<Runtime | null>(null);
let duration = $state<MotionDurationName>('slow');
let shown = $state<Record<string, boolean>>(
  Object.fromEntries(CARDS.map((card) => [card.id, true]))
);
let outcome = $state<string | undefined>(undefined);
const tiles: Record<string, HTMLElement | undefined> = {};

onMount(() => {
  void loadMotionRuntime().then((module) => {
    runtime = module;
  });
});

function frames(card: Card): string {
  if (!runtime) return '';
  return runtime
    .presetKeyframes(card.preset, false, card.edge)
    .map((frame) => JSON.stringify(frame))
    .join(' → ');
}

function play(card: Card, kind: 'enter' | 'exit'): void {
  const tile = tiles[card.id];
  if (!runtime || !tile) return;
  shown[card.id] = true;
  const run = runtime.playPresence(
    tile,
    kind,
    card.preset,
    { level: MOTION_SETTINGS.level, reducedMotion: providerReduced(), duration },
    card.edge
  );
  outcome = `${card.label} ${kind}: ${describeRun(run)}`;
  void run.finished.then((result) => {
    outcome = `${card.label} ${kind}: ${describeRun(run, result)}`;
    if (kind === 'exit') shown[card.id] = false;
  });
}

function playAll(): void {
  CARDS.forEach((card, index) => {
    setTimeout(() => play(card, 'enter'), index * 60);
  });
}
</script>

<div class="presets" data-motion-presets="">
  <div class="presets__bar">
    <label class="presets__field">
      <span>Duration step</span>
      <select bind:value={duration}>
        {#each MOTION_DURATION_NAMES as step (step)}
          <option value={step}>{step}</option>
        {/each}
      </select>
    </label>
    <button type="button" class="presets__button" onclick={playAll} aria-disabled={!runtime}>
      Play every enter
    </button>
  </div>
  <ul class="presets__grid" aria-label="Every preset">
    {#each CARDS as card (card.id)}
      <li class="presets__card" data-motion-preset={card.id}>
        <div class="presets__stage" aria-hidden="true">
          <span class="presets__tile" class:is-gone={!shown[card.id]} bind:this={tiles[card.id]}>
            {card.edge ? card.edge : card.preset}
          </span>
        </div>
        <h3 class="presets__name"><code>{card.label}</code></h3>
        <div class="presets__actions">
          <button
            type="button"
            class="presets__button"
            aria-label={`Play ${card.label} enter`}
            aria-disabled={!runtime}
            onclick={() => play(card, 'enter')}>Enter</button
          >
          <button
            type="button"
            class="presets__button"
            aria-label={`Play ${card.label} exit`}
            aria-disabled={!runtime}
            onclick={() => play(card, 'exit')}>Exit</button
          >
        </div>
        <p class="presets__frames">{frames(card) || 'Keyframes load with the runtime.'}</p>
      </li>
    {/each}
  </ul>
  <SettingsNote name="presets" {outcome} />
</div>

<style>
  .presets {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 0.9rem;
    padding: clamp(0.75rem, 2vw, 1.25rem);
    border: 1px solid var(--tx-border, CanvasText);
    border-radius: 1rem;
    background: var(--tx-surface, Canvas);
    color: var(--tx-foreground, CanvasText);
  }
  .presets__bar {
    display: flex;
    flex-wrap: wrap;
    align-items: end;
    gap: 0.75rem;
  }
  .presets__field {
    display: grid;
    gap: 0.25rem;
    font-size: 0.8125rem;
    font-weight: 600;
  }
  .presets__field select {
    min-block-size: 2.25rem;
    min-inline-size: 8rem;
    padding-inline: 0.5rem;
    border: 1px solid var(--tx-border, CanvasText);
    border-radius: 0.5rem;
    background: var(--tx-background, Canvas);
    color: var(--tx-foreground, CanvasText);
    font: inherit;
    font-weight: 400;
  }
  .presets__grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 12.5rem), 1fr));
    gap: 0.75rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .presets__card {
    display: grid;
    align-content: start;
    gap: 0.5rem;
    min-inline-size: 0;
    padding: 0.75rem;
    border: 1px solid var(--tx-border, CanvasText);
    border-radius: 0.75rem;
    background: var(--tx-background, Canvas);
  }
  .presets__stage {
    display: grid;
    place-items: center;
    block-size: 5.5rem;
    overflow: hidden;
    border-radius: 0.5rem;
    background: var(--tx-muted, Canvas);
  }
  .presets__tile {
    display: grid;
    place-items: center;
    inline-size: 6.5rem;
    block-size: 3.5rem;
    border-radius: 0.6rem;
    background: var(--tx-primary, Highlight);
    color: var(--tx-primary-foreground, HighlightText);
    font-size: 0.8125rem;
    font-weight: 600;
  }
  .presets__tile.is-gone {
    visibility: hidden;
  }
  .presets__name {
    margin: 0;
    font-size: 0.9375rem;
  }
  .presets__actions {
    display: flex;
    gap: 0.4rem;
  }
  .presets__button {
    min-block-size: 2.25rem;
    padding-inline: 0.75rem;
    border: 1px solid var(--tx-border, ButtonBorder);
    border-radius: 0.5rem;
    background: var(--tx-background, ButtonFace);
    color: var(--tx-foreground, ButtonText);
    font: inherit;
    cursor: pointer;
  }
  .presets__button:focus-visible,
  .presets__field select:focus-visible {
    outline: 2px solid var(--tx-ring, Highlight);
    outline-offset: 2px;
  }
  .presets__frames {
    margin: 0;
    font-family: ui-monospace, monospace;
    font-size: 0.6875rem;
    color: var(--tx-muted-foreground, CanvasText);
    overflow-wrap: anywhere;
  }
  @media (forced-colors: active) {
    .presets__tile {
      border: 2px solid CanvasText;
    }
  }
</style>
