<script lang="ts">
import { getOwnerWindow } from '@texuli/core/env';
import { prefersReducedMotion } from '@texuli/core/presence';
import type { Component } from 'svelte';
import { type ClassValue, cx } from 'texuli/cx';
import './animation.css';

type Props = {
  composition: unknown;
  animation: unknown;
  trust?: 'developer' | 'untrusted';
  title?: string;
  class?: ClassValue;
  reducedMotion?: boolean;
  initialTimeMs?: number;
  autoplay?: boolean;
};

let {
  composition: compositionInput,
  animation: animationInput,
  trust = 'untrusted',
  title = 'Animated composition',
  class: className,
  reducedMotion: reducedMotionProp,
  initialTimeMs = 0,
  autoplay = false,
}: Props = $props();

type Engine = {
  validateComposition: (
    input: unknown,
    opts?: { trust?: 'developer' | 'untrusted' }
  ) =>
    | { ok: true; composition: unknown }
    | { ok: false; errors: { path: string; code: string; message: string }[] };
  validateAnimation: (
    input: unknown,
    opts?: { composition?: unknown }
  ) =>
    | { ok: true; animation: { durationMs: number; loop?: boolean } }
    | { ok: false; errors: { path: string; code: string; message: string }[] };
  sampleComposition: (
    composition: unknown,
    animation: unknown,
    timeMs: number,
    opts?: { reducedMotion?: boolean; stillTimeMs?: number }
  ) => unknown;
  createTimeline: (opts: {
    durationMs: number;
    loop?: boolean;
    reducedMotion?: boolean;
    stillTimeMs?: number;
  }) => {
    play: () => void;
    pause: () => void;
    seek: (t: number) => void;
    setReducedMotion: (v: boolean) => void;
    subscribe: (fn: (s: { timeMs: number; playing: boolean }) => void) => () => void;
    dispose: () => void;
  };
};

let rootEl: HTMLElement | null = $state(null);
let engine: Engine | null = $state(null);
let SvgHost: Component<any> | null = $state(null);
// biome-ignore lint/suspicious/noExplicitAny: timeline handle is opaque
let timeline: any = null;

let timeMs = $state(0);
let playing = $state(false);
let durationMs = $state(1);
let reducedMotionFlag = $state(false);
let loadError = $state<string | null>(null);
let animErrors = $state<{ path: string; message: string }[] | null>(null);
let sampled = $state<unknown | null>(null);
let ready = $state(false);

$effect(() => {
  let cancelled = false;
  Promise.all([
    import('../composition-model/index.ts'),
    import('./validate.ts'),
    import('./sample.ts'),
    import('./timeline.ts'),
    import('../composition-svg/CompositionSvg.svelte'),
  ])
    .then(([model, validate, sample, timelineMod, svgMod]) => {
      if (cancelled) return;
      engine = {
        validateComposition: model.validateComposition as Engine['validateComposition'],
        validateAnimation: validate.validateAnimation as Engine['validateAnimation'],
        sampleComposition: sample.sampleComposition as Engine['sampleComposition'],
        createTimeline: timelineMod.createTimeline as Engine['createTimeline'],
      };
      SvgHost = svgMod.default as Component<any>;
    })
    .catch(() => {
      if (!cancelled) loadError = 'Failed to load animation engine.';
    });
  return () => {
    cancelled = true;
  };
});

$effect(() => {
  const win = getOwnerWindow(rootEl);
  const reduced =
    reducedMotionProp !== undefined
      ? reducedMotionProp
      : prefersReducedMotion(win ?? undefined, false);
  if (reducedMotionFlag !== reduced) reducedMotionFlag = reduced;
  timeline?.setReducedMotion?.(reduced);
});

$effect(() => {
  if (!engine) return;
  const compositionResult = engine.validateComposition(compositionInput, { trust });
  if (!compositionResult.ok) {
    animErrors = compositionResult.errors.map((e) => ({ path: e.path, message: e.message }));
    ready = false;
    sampled = null;
    return;
  }
  const animationResult = engine.validateAnimation(animationInput, {
    composition: compositionResult.composition,
  });
  if (!animationResult.ok) {
    animErrors = animationResult.errors.map((e) => ({ path: e.path, message: e.message }));
    ready = false;
    sampled = null;
    return;
  }
  animErrors = null;
  ready = true;

  const anim = animationResult.animation;
  const reduced = reducedMotionFlag;
  const start = initialTimeMs;

  timeline?.dispose?.();
  const next = engine.createTimeline({
    durationMs: anim.durationMs,
    loop: anim.loop === true,
    reducedMotion: reduced,
    stillTimeMs: start,
  });
  if (durationMs !== anim.durationMs) durationMs = anim.durationMs;
  next.seek(start);
  const unsub = next.subscribe((s) => {
    if (timeMs !== s.timeMs) timeMs = s.timeMs;
    if (playing !== s.playing) playing = s.playing;
    sampled = engine!.sampleComposition(compositionResult.composition, anim, s.timeMs, {
      reducedMotion: reduced,
      stillTimeMs: start,
    });
  });
  timeline = next;
  if (autoplay && !reduced) next.play();

  return () => {
    unsub();
    next.dispose();
    if (timeline === next) timeline = null;
  };
});

function formatTime(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

function onScrub(event: Event): void {
  const value = Number((event.currentTarget as HTMLInputElement).value);
  timeline?.seek(value);
}

function togglePlay(): void {
  if (!timeline) return;
  if (playing) timeline.pause();
  else timeline.play();
}
</script>

<div
  class={cx('tx-composition-animation', className)}
  data-tx-composition-animation="true"
  data-reduced-motion={reducedMotionFlag ? 'true' : 'false'}
  bind:this={rootEl}
>
  {#if loadError}
    <p class="tx-composition-animation__error" role="alert">{loadError}</p>
  {:else if animErrors}
    <p class="tx-composition-animation__error" role="alert">Invalid animation.</p>
    <ul>
      {#each animErrors as issue (issue.path + issue.message)}
        <li><code>{issue.path}</code>: {issue.message}</li>
      {/each}
    </ul>
  {:else if ready && sampled}
    <div class="tx-composition-animation__stage" data-tx-animation-stage>
      {#if SvgHost}
        <SvgHost composition={sampled} {title} {trust} validate={false} />
      {:else}
        <p role="status">Loading renderer…</p>
      {/if}
    </div>

    <div class="tx-composition-animation__controls" role="group" aria-label="Animation timeline">
      <button
        type="button"
        class="tx-composition-animation__btn"
        data-tx-animation-play
        disabled={reducedMotionFlag}
        aria-pressed={playing}
        onclick={togglePlay}
      >
        {playing ? 'Pause' : 'Play'}
      </button>
      <input
        class="tx-composition-animation__scrubber"
        type="range"
        min="0"
        max={durationMs}
        step="16"
        value={timeMs}
        aria-label="Scrub timeline"
        data-tx-animation-scrubber
        disabled={reducedMotionFlag}
        oninput={onScrub}
      />
      <span class="tx-composition-animation__time" data-tx-animation-time>
        {formatTime(timeMs)} / {formatTime(durationMs)}
      </span>
    </div>

    {#if reducedMotionFlag}
      <p class="tx-composition-animation__note" data-tx-animation-still>
        Reduced motion: showing a still frame. Playback is paused.
      </p>
    {/if}
  {:else}
    <p role="status">Loading animation…</p>
  {/if}
</div>
