<script lang="ts">
/**
 * The /motion-page/ settings panel: the motion level (full, subtle, none)
 * and a reduced-motion override that every demo on the page reads (see
 * settings.svelte.ts), the reader's own system setting, the durations the
 * level gives each token, and a sample that plays (or commits at once).
 */
import {
  createReducedMotionSource,
  MOTION_LEVELS,
  type MotionLevel,
  motionDuration,
  parallel,
  sequence,
  stagger,
} from '@texuli/core/motion';
import { MOTION_DURATIONS } from '@texuli/tokens/motion';
import { MOTION_LEVEL_ROWS } from './page.ts';
import { describeRun, MOTION_SETTINGS, runtimeTiming } from './settings.svelte.ts';

const STEPS = ['fast', 'base', 'slow', 'slower'] as const;
const LEVEL_LABEL: Record<MotionLevel, string> = { full: 'Full', subtle: 'Subtle', none: 'None' };

let system = $state<boolean | null>(null);
let outcome = $state('Not played yet');
let tiles = $state<HTMLElement[]>([]);

$effect(() => {
  const source = createReducedMotionSource({ window });
  system = source.get();
  const stop = source.subscribe((value) => {
    system = value;
  });
  return () => {
    stop();
    source.dispose();
  };
});

const effective = $derived(
  STEPS.map((step) => ({
    step,
    // Without the override the runtime reads the system setting, so it zeroes them too.
    ms:
      MOTION_SETTINGS.reduced || system === true
        ? 0
        : motionDuration(MOTION_DURATIONS[step], MOTION_SETTINGS.level),
  }))
);

function playSample(): void {
  const offsets = stagger(tiles.length, 60);
  const run = sequence(
    [
      parallel(
        ...tiles.map((target, index) => ({
          target,
          keyframes: [
            { opacity: 0, transform: 'translateY(12px) scale(0.96)' },
            { opacity: 1, transform: 'none' },
          ],
          duration: MOTION_DURATIONS.slow,
          at: offsets[index] ?? 0,
        }))
      ),
    ],
    { ...runtimeTiming(), easing: 'cubic-bezier(0, 0, 0.2, 1)' }
  );
  outcome = describeRun(run);
  void run.finished.then((result) => {
    outcome = describeRun(run, result);
  });
}
</script>

<div class="console" data-motion-console="">
  <div class="console__controls">
    <fieldset class="levels">
      <legend>Motion level</legend>
      <div class="levels__options">
        {#each MOTION_LEVELS as level (level)}
          <label class="levels__option">
            <input type="radio" name="motion-level" value={level} bind:group={MOTION_SETTINGS.level} />
            <span>{LEVEL_LABEL[level]}</span>
          </label>
        {/each}
      </div>
    </fieldset>
    <label class="reduced">
      <input type="checkbox" bind:checked={MOTION_SETTINGS.reduced} data-motion-reduced="" />
      <span>Reduced motion</span>
    </label>
    <p class="console__system" data-motion-system="">
      Your system:
      <strong>{system === null ? 'checking' : system ? 'reduce motion' : 'no preference'}</strong>
    </p>
  </div>

  <ul class="console__levels" aria-label="What each level does">
    {#each MOTION_LEVEL_ROWS as row (row.level)}
      <li class:is-active={MOTION_SETTINGS.level === row.level}>
        <code>{row.level}</code>
        <span>{row.effect}</span>
      </li>
    {/each}
  </ul>

  <div class="console__sample">
    <div class="sample" aria-hidden="true">
      {#each ['Enter', 'Settle', 'Rest'] as word, index (word)}
        <span class="sample__tile" bind:this={tiles[index]}>{word}</span>
      {/each}
    </div>
    <div class="sample__side">
      <button type="button" class="button" onclick={playSample}>Play sample</button>
      <p class="outcome" data-motion-outcome="console" aria-live="polite">{outcome}</p>
    </div>
  </div>

  <table class="durations">
    <caption>Duration tokens at this level{MOTION_SETTINGS.reduced ? ', reduced motion on' : ''}</caption>
    <thead>
      <tr>
        {#each effective as row (row.step)}
          <th scope="col"><code>{row.step}</code></th>
        {/each}
      </tr>
    </thead>
    <tbody>
      <tr>
        {#each effective as row (row.step)}
          <td data-motion-duration={row.step}>{Math.round(row.ms)} ms</td>
        {/each}
      </tr>
    </tbody>
  </table>
</div>

<style>
  .console {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 1rem;
    padding: clamp(0.75rem, 2vw, 1.25rem);
    border: 1px solid var(--tx-border, CanvasText);
    border-radius: 1rem;
    background: var(--tx-surface, Canvas);
    color: var(--tx-foreground, CanvasText);
  }
  .console__controls {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem 1.5rem;
  }
  .levels {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem 0.75rem;
    margin: 0;
    padding: 0;
    border: 0;
  }
  .levels legend {
    float: inline-start;
    margin-inline-end: 0.75rem;
    padding: 0;
    font-weight: 600;
  }
  .levels__options {
    display: inline-flex;
    border: 1px solid var(--tx-border, CanvasText);
    border-radius: 999px;
    overflow: hidden;
  }
  .levels__option {
    position: relative;
    display: inline-flex;
  }
  .levels__option input {
    position: absolute;
    inset: 0;
    margin: 0;
    opacity: 0;
    cursor: pointer;
  }
  .levels__option span {
    display: inline-flex;
    align-items: center;
    min-block-size: 2.25rem;
    padding-inline: 0.9rem;
    font-size: 0.875rem;
  }
  .levels__option + .levels__option span {
    border-inline-start: 1px solid var(--tx-border, CanvasText);
  }
  .levels__option input:checked + span {
    background: var(--tx-primary, Highlight);
    color: var(--tx-primary-foreground, HighlightText);
    font-weight: 600;
  }
  .levels__option input:focus-visible + span {
    outline: 2px solid var(--tx-ring, Highlight);
    outline-offset: -4px;
  }
  .reduced {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    min-block-size: 2.25rem;
    font-weight: 600;
  }
  .reduced input {
    inline-size: 1.1rem;
    block-size: 1.1rem;
    accent-color: var(--tx-primary, Highlight);
  }
  .console__system {
    margin: 0;
    font-size: 0.875rem;
    color: var(--tx-muted-foreground, CanvasText);
  }
  .console__levels {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 13rem), 1fr));
    gap: 0.5rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .console__levels li {
    display: grid;
    gap: 0.2rem;
    padding: 0.6rem 0.75rem;
    border: 1px solid var(--tx-border, CanvasText);
    border-radius: 0.75rem;
    font-size: 0.8125rem;
  }
  .console__levels li.is-active {
    border-color: var(--tx-primary, Highlight);
    box-shadow: inset 0 0 0 1px var(--tx-primary, Highlight);
  }
  .console__levels code {
    font-weight: 700;
  }
  .console__sample {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 1rem;
  }
  .sample {
    display: flex;
    flex: 1 1 14rem;
    gap: 0.5rem;
    padding: 0.75rem;
    border-radius: 0.75rem;
    background: var(--tx-muted, Canvas);
  }
  .sample__tile {
    flex: 1;
    padding: 0.75rem 0.5rem;
    border-radius: 0.6rem;
    background: var(--tx-primary-soft, Canvas);
    color: var(--tx-primary-soft-foreground, CanvasText);
    border: 1px solid var(--tx-border, CanvasText);
    font-size: 0.8125rem;
    font-weight: 600;
    text-align: center;
  }
  .sample__side {
    display: grid;
    gap: 0.4rem;
  }
  .button {
    min-block-size: 2.25rem;
    padding-inline: 1rem;
    border: 1px solid var(--tx-primary, ButtonText);
    border-radius: 0.6rem;
    background: var(--tx-primary, ButtonFace);
    color: var(--tx-primary-foreground, ButtonText);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }
  .button:focus-visible {
    outline: 2px solid var(--tx-ring, Highlight);
    outline-offset: 2px;
  }
  .outcome {
    margin: 0;
    font-size: 0.8125rem;
    color: var(--tx-muted-foreground, CanvasText);
  }
  .durations {
    inline-size: 100%;
    border-collapse: collapse;
    font-size: 0.8125rem;
    font-variant-numeric: tabular-nums;
  }
  .durations caption {
    margin-block-end: 0.35rem;
    text-align: start;
    color: var(--tx-muted-foreground, CanvasText);
  }
  .durations th,
  .durations td {
    padding: 0.35rem 0.5rem;
    border: 1px solid var(--tx-border, CanvasText);
    text-align: center;
  }
  @media (forced-colors: active) {
    .levels__option input:checked + span {
      background: Highlight;
      color: HighlightText;
    }
    .console__levels li.is-active {
      border-color: Highlight;
    }
  }
</style>
