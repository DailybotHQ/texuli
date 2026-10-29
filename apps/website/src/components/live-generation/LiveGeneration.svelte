<script lang="ts">
/**
 * /live-generation/ playground: a recorded agent draft replayed chunk by
 * chunk into the real `<Player stream>` (ADR-014). The page controls the
 * replay (start, pause, one chunk, drop the connection, speed); the player
 * does the rest: skeletons for pending nodes, validated nodes painted as
 * they complete, a held node outside the catalog, the interrupted state
 * and its Try again. `@texuli/player` loads on the first Start, so nothing
 * large is on the first paint. Reduced motion (the system setting, or the
 * page override) is passed to the player and stops every transition here.
 */
import type { PlayerStreamProgress } from '@texuli/player';
import { onMount } from 'svelte';
import {
  chunk,
  delayFor,
  SCENARIOS,
  type ScenarioId,
  SPEEDS,
  type SpeedId,
  scenario,
} from './recording.ts';
import { Replay, type ReplayState } from './replay.ts';

type PlayerModule = typeof import('@texuli/player');

interface LogEntry {
  id: number;
  text: string;
}

let scenarioId = $state<ScenarioId>('report');
let speed = $state<SpeedId>('normal');
let systemReduced = $state(false);
let reducedOverride = $state(false);
const reduced = $derived(systemReduced || reducedOverride);

let player = $state.raw<PlayerModule | null>(null);
let failed = $state(false);
let loading = $state(false);
let replay = $state.raw<Replay | null>(null);
let run = $state(0);
let replayState = $state<ReplayState>('idle');
let sent = $state(0);
let total = $state(0);
let progress = $state.raw<PlayerStreamProgress | null>(null);
let log = $state.raw<readonly LogEntry[]>([]);
let logId = 0;

const current = $derived(scenario(scenarioId));
const chunkCount = $derived(chunk(current.text).length);
const playing = $derived(replayState === 'playing');
const live = $derived(replay !== null && !replay.finished);

onMount(() => {
  const media = window.matchMedia('(prefers-reduced-motion: reduce)');
  systemReduced = media.matches;
  const onMedia = () => {
    systemReduced = media.matches;
  };
  media.addEventListener('change', onMedia);
  return () => {
    media.removeEventListener('change', onMedia);
    replay?.dispose();
  };
});

function note(text: string): void {
  logId += 1;
  log = [...log, { id: logId, text }].slice(-8);
}

function track(next: Replay): void {
  replayState = next.state;
  sent = next.sent;
  total = next.total;
}

function newReplay(drop: boolean): Replay {
  replay?.dispose();
  const next = new Replay(chunk(current.text), {
    delay: () => delayFor(speed),
    ...(drop && current.dropAt !== undefined ? { dropAt: current.dropAt } : {}),
    onChange: (changed) => {
      if (changed === replay) track(changed);
    },
  });
  replay = next;
  track(next);
  return next;
}

async function ensurePlayer(): Promise<boolean> {
  if (player) return true;
  loading = true;
  try {
    player = await import('@texuli/player');
    return true;
  } catch {
    failed = true;
    return false;
  } finally {
    loading = false;
  }
}

async function start(): Promise<void> {
  if (loading) return;
  if (!(await ensurePlayer())) return;
  run += 1;
  progress = null;
  log = [];
  note(`Started: ${current.label.toLowerCase()}.`);
  newReplay(true).play();
}

function retry(): void {
  // A retry is a new stream from the start; the dropped connection does not repeat.
  note('Try again: streaming the draft from the start.');
  newReplay(false).play();
}

function togglePause(): void {
  if (!replay) return;
  if (playing) replay.pause();
  else replay.play();
}

function onProgress(event: PlayerStreamProgress): void {
  const before = progress;
  progress = event;
  if (event.phase !== before?.phase) {
    if (event.phase === 'complete')
      note(`Complete: ${event.painted} nodes painted, final verdict in.`);
    else if (event.phase === 'interrupted')
      note(`Interrupted after ${event.bytes} bytes: ${event.painted} nodes stay painted.`);
  } else if (event.held > (before?.held ?? 0)) {
    note(`Held a node: ${event.held} waiting for the complete draft.`);
  } else if (event.painted > (before?.painted ?? 0) && event.painted % 3 === 0) {
    note(`${event.painted} nodes painted.`);
  }
}
</script>

<div class="live" data-live-generation="" data-reduced={reduced ? 'true' : 'false'}>
  <div class="live__controls">
    <fieldset class="live__group">
      <legend>Recorded draft</legend>
      {#each SCENARIOS as option (option.id)}
        <label>
          <input type="radio" name="live-scenario" value={option.id} bind:group={scenarioId} disabled={live} />
          {option.label}
        </label>
      {/each}
    </fieldset>
    <p class="live__summary" data-live-summary="">{current.summary}</p>
    <fieldset class="live__group">
      <legend>Speed</legend>
      {#each SPEEDS as option (option.id)}
        <label>
          <input type="radio" name="live-speed" value={option.id} bind:group={speed} />
          {option.label}
        </label>
      {/each}
    </fieldset>
    <label class="live__check">
      <input type="checkbox" bind:checked={reducedOverride} />
      Reduced motion
      <span class="live__hint">{systemReduced ? '(on in your system settings)' : ''}</span>
    </label>
    <div class="live__buttons" role="group" aria-label="Stream controls">
      <button type="button" class="live__button live__button--primary" onclick={start} aria-disabled={loading}>
        {replay ? 'Start over' : 'Start'}
      </button>
      <button type="button" class="live__button" onclick={togglePause} aria-disabled={!live}>
        {playing ? 'Pause' : 'Resume'}
      </button>
      <button type="button" class="live__button" onclick={() => replay?.step()} aria-disabled={!live}>
        Next chunk
      </button>
      <button
        type="button"
        class="live__button"
        onclick={() => replay?.interrupt('You dropped the connection.')}
        aria-disabled={!live}
      >
        Drop the connection
      </button>
    </div>
  </div>

  <div class="live__meter">
    <label for="live-progress">Chunks sent</label>
    <progress id="live-progress" max={Math.max(1, total)} value={sent}></progress>
    <span data-live-sent="">{sent} of {total || chunkCount}</span>
  </div>
  <dl class="live__stats" data-live-stats="">
    <div><dt>Phase</dt><dd data-live-phase="">{progress?.phase ?? (replay ? 'waiting' : 'not started')}</dd></div>
    <div><dt>Painted</dt><dd data-live-painted="">{progress?.painted ?? 0}</dd></div>
    <div><dt>Held</dt><dd data-live-held="">{progress?.held ?? 0}</dd></div>
    <div><dt>Bytes read</dt><dd data-live-bytes="">{progress?.bytes ?? 0}</dd></div>
  </dl>

  <div class="live__stage" data-live-stage="">
    {#if failed}
      <p role="alert">The player could not load. Reload the page to try again.</p>
    {:else if player && replay}
      {#key run}
        <player.Player
          stream={replay}
          onStreamProgress={onProgress}
          onStreamRetry={retry}
          tier="untrusted"
          label="Streamed draft (untrusted)"
          landmarks={false}
          loadTimeoutMs={8000}
          motion={reduced ? 'reduce' : 'auto'}
        />
      {/key}
    {:else}
      <p class="live__empty">{loading ? 'Loading the player…' : 'Press Start to stream the recorded draft into the player.'}</p>
    {/if}
  </div>

  <div class="live__log">
    <h3 id="live-log-title">What happened</h3>
    {#if log.length === 0}
      <p class="live__empty">Nothing yet.</p>
    {:else}
      <ol aria-labelledby="live-log-title" data-live-log="">
        {#each log as entry (entry.id)}
          <li>{entry.text}</li>
        {/each}
      </ol>
    {/if}
  </div>
</div>

<style>
  .live {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 0.9rem;
    min-inline-size: 0;
    padding: clamp(0.75rem, 2vw, 1.25rem);
    border: 1px solid var(--tx-border, CanvasText);
    border-radius: 1rem;
    background: var(--tx-surface, Canvas);
    color: var(--tx-foreground, CanvasText);
  }
  .live__controls {
    display: grid;
    gap: 0.6rem;
  }
  .live__group {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.25rem 1.1rem;
    margin: 0;
    padding: 0;
    border: 0;
  }
  .live__group legend {
    float: inline-start;
    margin-inline-end: 0.5rem;
    padding: 0;
    font-weight: 600;
  }
  .live__group label,
  .live__check {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    min-block-size: 2.25rem;
  }
  .live input {
    accent-color: var(--tx-primary, Highlight);
  }
  .live__hint {
    font-size: 0.8125rem;
    color: var(--tx-muted-foreground, CanvasText);
  }
  .live__summary {
    margin: 0;
    max-inline-size: 46rem;
    font-size: 0.875rem;
  }
  .live__buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .live__button {
    min-block-size: 2.25rem;
    padding-inline: 0.8rem;
    border: 1px solid var(--tx-border, ButtonBorder);
    border-radius: 0.5rem;
    background: var(--tx-background, ButtonFace);
    color: var(--tx-foreground, ButtonText);
    font: inherit;
    cursor: pointer;
  }
  .live__button--primary {
    border-color: var(--tx-primary, ButtonBorder);
    background: var(--tx-primary, ButtonFace);
    color: var(--tx-primary-foreground, ButtonText);
  }
  .live__button:focus-visible {
    outline: 2px solid var(--tx-ring, Highlight);
    outline-offset: 2px;
  }
  .live__button[aria-disabled='true'] {
    cursor: not-allowed;
    opacity: 0.7;
  }
  .live__meter {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem 0.75rem;
    font-size: 0.875rem;
  }
  .live__meter progress {
    flex: 1 1 10rem;
    min-inline-size: 0;
    block-size: 0.6rem;
    accent-color: var(--tx-primary, Highlight);
  }
  .live__stats {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 1.5rem;
    margin: 0;
    font-size: 0.875rem;
  }
  .live__stats div {
    display: flex;
    gap: 0.35rem;
  }
  .live__stats dt {
    font-weight: 600;
  }
  .live__stats dd {
    margin: 0;
    font-variant-numeric: tabular-nums;
  }
  .live__stage {
    min-block-size: 20rem;
    min-inline-size: 0;
    padding: 0.75rem;
    border: 1px dashed var(--tx-border, CanvasText);
    border-radius: 0.75rem;
    background: var(--tx-background, Canvas);
  }
  .live__empty {
    margin: 0;
    font-size: 0.875rem;
  }
  .live__log h3 {
    margin: 0 0 0.35rem;
    font-size: 1rem;
  }
  .live__log ol {
    margin: 0;
    padding-inline-start: 1.25rem;
    font-size: 0.875rem;
  }
  @media (prefers-reduced-motion: no-preference) {
    .live[data-reduced='false'] .live__button {
      transition: background-color 120ms ease;
    }
  }
  @media (forced-colors: active) {
    .live__button {
      border-color: ButtonText;
    }
    .live__button--primary {
      background: ButtonFace;
      color: ButtonText;
    }
    .live__button[aria-disabled='true'] {
      color: GrayText;
    }
  }
</style>
