<script lang="ts">
/**
 * The presenter status line: "Slide n of m" and, when `timers` is given,
 * the elapsed talk time, the time on this slide and the wall clock, with
 * pause or start and reset. The readings carry `role="timer"` with
 * `aria-live="off"`: readable on demand, never announced every second.
 */
import { untrack } from 'svelte';
import type { DeckTranslate } from '../messages.ts';
import { formatElapsed } from '../presenter.ts';
import { type DeckPresenterTimers, formatWallClock } from './timers.ts';

interface Props {
  t: DeckTranslate;
  locale?: string;
  /** 0-based position among the visible slides. */
  position: number;
  total: number;
  /** The shown slide (a new one restarts the slide stopwatch). */
  slideId?: string;
  timers?: DeckPresenterTimers | null;
}

let { t, locale, position, total, slideId, timers = null }: Props = $props();
const uid = $props.id();

// `version` makes the readings reactive: a pause or reset at the same clock reading still repaints.
// svelte-ignore state_referenced_locally
let clock = $state(timers ? timers.now() : 0);
let version = $state(0);
let running = $state(false);
let elapsed = $derived.by(() => {
  void version;
  return timers ? timers.elapsed() : 0;
});
let onSlide = $derived.by(() => {
  void version;
  return timers ? timers.slide() : 0;
});
let readings = $derived([
  { id: 'elapsed', label: t('presenter.elapsed'), value: formatElapsed(elapsed) },
  { id: 'slide', label: t('presenter.slideTime'), value: formatElapsed(onSlide) },
  { id: 'clock', label: t('presenter.now'), value: formatWallClock(clock, locale) },
]);

function refresh() {
  untrack(() => {
    if (!timers) return;
    clock = timers.now();
    running = timers.running;
    version += 1;
  });
}

$effect(() => {
  if (!timers) return;
  refresh();
  const interval = setInterval(refresh, 1000);
  return () => clearInterval(interval);
});

$effect(() => {
  if (!timers || !slideId) return;
  timers.markSlide(slideId);
  refresh();
});

function act(action: 'toggle' | 'reset') {
  timers?.[action]();
  refresh();
}
</script>

<div class="tx-deck-presenter__status">
  <p class="tx-deck-presenter__position">{t('stage.slideOf', { current: position + 1, total })}</p>
  {#if timers}
    <div
      class="tx-deck-stage__timer tx-deck-presenter__timers"
      role="group"
      aria-label={t('stage.presenterTimers')}
      data-running={running ? 'true' : 'false'}
    >
      {#each readings as reading (reading.id)}
        <p class="tx-deck-presenter__reading">
          <span id="{uid}-{reading.id}" class="tx-deck-presenter__label">{reading.label}</span>
          <span
            class="tx-deck-presenter__value"
            role="timer"
            aria-live="off"
            aria-labelledby="{uid}-{reading.id}"
            data-tx-deck-timer={reading.id}>{reading.value}</span
          >
        </p>
      {/each}
      <span class="tx-deck-presenter__buttons">
        <button type="button" class="tx-deck-stage__control" onclick={() => act('toggle')}>
          {running ? t('stage.pauseTimers') : t('stage.startTimers')}
        </button>
        <button type="button" class="tx-deck-stage__control" onclick={() => act('reset')}>
          {t('stage.resetTimers')}
        </button>
      </span>
    </div>
  {/if}
</div>

<style>
  .tx-deck-presenter__status {
    display: grid;
    gap: 0.5rem;
  }

  .tx-deck-presenter__position {
    margin: 0;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }

  .tx-deck-presenter__timers {
    column-gap: 1rem;
  }

  .tx-deck-presenter__reading {
    display: grid;
    margin: 0;
  }

  .tx-deck-presenter__label {
    color: var(--tx-muted-foreground, var(--tx-foreground));
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .tx-deck-presenter__value {
    font-size: 1.25rem;
    font-variant-numeric: tabular-nums;
  }

  .tx-deck-presenter__buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
</style>
