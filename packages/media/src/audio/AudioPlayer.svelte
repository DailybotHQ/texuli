<script lang="ts">
import { Slider } from 'texuli/slider';
import { AUDIO_LIMITS, decodeWaveformPeaks, formatAudioTime, resolveAudioSource } from './model.ts';
import type { AudioPlayerLabels, AudioPlayerProps } from './types.ts';
import Waveform from './Waveform.svelte';
import './audio.css';

const DEFAULT_LABELS: AudioPlayerLabels = {
  play: 'Play',
  pause: 'Pause',
  seek: 'Seek',
  waveform: 'Waveform',
  unavailable: 'Audio unavailable',
};

/**
 * Accessible audio player with optional decoded waveform and keyboard seek.
 * Untrusted sources go through `safeMediaSrc`.
 */
let {
  src,
  trust = 'untrusted',
  allowedOrigins,
  label = 'Audio player',
  peaks: peaksProp,
  barCount = AUDIO_LIMITS.defaultBars,
  muted = false,
  playbackRate = 1,
  labels,
  class: className,
  onPlay,
  onPause,
  onTimeUpdate,
  onEnded,
  onError,
}: AudioPlayerProps = $props();

const text = $derived({ ...DEFAULT_LABELS, ...labels });
const resolved = $derived(resolveAudioSource({ src, trust, allowedOrigins }));

let audioEl = $state<HTMLAudioElement | null>(null);
let playing = $state(false);
let currentTime = $state(0);
let duration = $state(0);
let status = $state<'ready' | 'loading' | 'blocked' | 'error'>('loading');
let peaks = $state<number[]>([]);

const progress = $derived(duration > 0 ? currentTime / duration : 0);
const rate = $derived(Math.min(2, Math.max(0.5, playbackRate)));

$effect(() => {
  if (peaksProp && peaksProp.length > 0) {
    peaks = [...peaksProp];
  }
});

$effect(() => {
  const url = resolved.src;
  if (!url) {
    status = 'blocked';
    playing = false;
    peaks = peaksProp ? [...peaksProp] : [];
    return;
  }
  status = 'loading';
  if (peaksProp && peaksProp.length > 0) {
    status = 'ready';
    return;
  }
  let cancelled = false;
  void decodeWaveformPeaks(url, { barCount }).then((result) => {
    if (cancelled) return;
    if (result) {
      peaks = result.peaks;
      if (result.duration > 0 && duration === 0) duration = result.duration;
    }
  });
  return () => {
    cancelled = true;
  };
});

$effect(() => {
  const node = audioEl;
  if (!node) return;
  node.playbackRate = rate;
  node.muted = muted;
});

function toggle(): void {
  const node = audioEl;
  if (!node || !resolved.src) return;
  if (node.paused) {
    void node.play().then(
      () => {
        playing = true;
        onPlay?.();
      },
      () => {
        status = 'error';
        onError?.();
      }
    );
  } else {
    node.pause();
    playing = false;
    onPause?.();
  }
}

function seekRatio(ratio: number): void {
  const node = audioEl;
  if (!node || !Number.isFinite(node.duration) || node.duration <= 0) return;
  node.currentTime = ratio * node.duration;
  currentTime = node.currentTime;
  onTimeUpdate?.(currentTime);
}

function onLoadedMetadata(): void {
  const node = audioEl;
  if (!node) return;
  duration = Number.isFinite(node.duration) ? node.duration : 0;
  status = 'ready';
}

function onTime(): void {
  const node = audioEl;
  if (!node) return;
  currentTime = node.currentTime;
  onTimeUpdate?.(currentTime);
}

function onPlayEvent(): void {
  playing = true;
}

function onPauseEvent(): void {
  playing = false;
}

function onEnd(): void {
  playing = false;
  onEnded?.();
}

function onAudioError(): void {
  status = 'error';
  playing = false;
  onError?.();
}
</script>

<section
  class={['tx-audio-player', className]}
  data-tx-audio-player=""
  data-status={status}
  aria-label={label}
>
  {#if resolved.src}
    <!-- svelte-ignore a11y_media_has_caption -->
    <audio
      bind:this={audioEl}
      src={resolved.src}
      preload="metadata"
      {muted}
      onloadedmetadata={onLoadedMetadata}
      ontimeupdate={onTime}
      onplay={onPlayEvent}
      onpause={onPauseEvent}
      onended={onEnd}
      onerror={onAudioError}
    ></audio>
  {/if}

  <div class="tx-audio-player__row">
    <button
      type="button"
      class="tx-audio-player__play"
      data-tx-audio-play=""
      aria-label={playing ? text.pause : text.play}
      disabled={!resolved.src || status === 'error' || status === 'blocked'}
      onclick={toggle}
    >
      {#if playing}
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <rect x="6" y="5" width="4" height="14" fill="currentColor" />
          <rect x="14" y="5" width="4" height="14" fill="currentColor" />
        </svg>
      {:else}
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path d="M8 5v14l11-7z" fill="currentColor" />
        </svg>
      {/if}
    </button>
    <div class="tx-audio-player__times" aria-live="off">
      <span data-tx-audio-current="">{formatAudioTime(currentTime)}</span>
      <span data-tx-audio-duration="">{formatAudioTime(duration)}</span>
    </div>
  </div>

  {#if peaks.length > 0}
    <Waveform
      {peaks}
      progress={progress}
      label={text.waveform}
      disabled={!resolved.src || duration <= 0}
      onSeek={seekRatio}
    />
  {:else if resolved.src && status !== 'blocked'}
    <Slider
      type="single"
      value={progress}
      min={0}
      max={1}
      step={0.001}
      label={text.seek}
      disabled={duration <= 0}
      onValueChange={(v) => {
        const next = Array.isArray(v) ? (v[0] ?? 0) : v;
        seekRatio(next);
      }}
    />
  {/if}

  {#if status === 'blocked' || status === 'error'}
    <p class="tx-audio-player__message" role="status" data-tx-audio-message="">
      {text.unavailable}
    </p>
  {/if}
</section>
