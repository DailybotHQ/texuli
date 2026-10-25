<script lang="ts">
import { getOwnerWindow, listen } from '@texuli/core/env';
import { lazyChunk } from '@texuli/core/lazy';
import { REDUCED_MOTION_QUERY } from '@texuli/core/presence';
import type { Component } from 'svelte';
import { type ClassValue, cx } from 'texuli/cx';
import {
  formatVideoTime,
  normalizePlaybackRate,
  pickDefaultTextTrack,
  type ResolvedVideoTextTrack,
  resolveVideoSources,
  resolveVideoTextTracks,
  VIDEO_PLAYBACK_RATES,
} from './model.ts';
import { type VideoPlayerLabels, type VideoPlayerProps } from './types.ts';

const DEFAULT_LABELS: VideoPlayerLabels = {
  blocked: 'Video source blocked by URL policy.',
  failed: 'Video playback failed.',
  play: 'Play video',
  pause: 'Pause video',
  seek: 'Seek video',
  playbackRate: 'Playback speed',
  pictureInPicture: 'Picture in picture',
  durationSeparator: 'of',
  reducedMotion: 'Reduced motion is on. Video will not start automatically.',
  pictureInPictureFailed: 'Picture in picture is unavailable.',
  captions: 'Captions',
  captionsOff: 'Captions off',
  captionTrack: 'Caption track',
  chapters: 'Chapters',
  transcript: 'Transcript',
  chapterAnnouncement: 'Chapter',
};

type CaptionsHostProps = {
  tracks: readonly ResolvedVideoTextTrack[];
  currentTime: number;
  captionsOn: boolean;
  activeTrackId: string | undefined;
  trust?: VideoPlayerProps['trust'];
  allowedOrigins?: readonly string[];
  showTranscript?: boolean;
  showChapters?: boolean;
  chapterLabel: string;
  transcriptLabel: string;
  chapterAnnouncement: string;
  onSeek: (time: number) => void;
  onActiveCueText?: (text: string) => void;
};

let {
  src,
  poster,
  title,
  trust = 'untrusted',
  allowedOrigins,
  loop = false,
  muted = false,
  playsInline = true,
  tracks,
  captionsDefault = true,
  showTranscript = false,
  labels: labelOverrides,
  class: className,
}: VideoPlayerProps & { class?: ClassValue } = $props();

const labels = $derived({ ...DEFAULT_LABELS, ...labelOverrides });
const sources = $derived(resolveVideoSources({ src, poster, trust, allowedOrigins }));
const resolvedTracks = $derived(resolveVideoTextTracks(tracks, trust, allowedOrigins));
const captionTracks = $derived(
  resolvedTracks.filter((t) => t.kind === 'captions' || t.kind === 'subtitles')
);
const hasTextTracks = $derived(resolvedTracks.length > 0);

let video = $state<HTMLVideoElement>();
let root = $state<HTMLElement>();
let currentTime = $state(0);
let duration = $state(0);
let playbackRate = $state(1);
let playing = $state(false);
let failed = $state(false);
let reducedMotion = $state(false);
let pictureInPictureError = $state(false);
let pictureInPictureSupported = $state(false);
let captionsOn = $state(false);
let activeTrackId = $state<string | undefined>(undefined);
let activeCueText = $state('');
let CaptionsHost = $state<Component<CaptionsHostProps> | null>(null);
let captionsLoadError = $state(false);
let tracksInitialized = $state(false);

$effect(() => {
  // Reset default track when the resolved track list identity changes.
  resolvedTracks;
  tracksInitialized = false;
});

$effect(() => {
  if (tracksInitialized || resolvedTracks.length === 0) return;
  const defaults =
    pickDefaultTextTrack(resolvedTracks, 'captions') ??
    pickDefaultTextTrack(resolvedTracks, 'subtitles');
  if (defaults) {
    activeTrackId = defaults.id;
    captionsOn = captionsDefault && !defaults.blocked;
  }
  tracksInitialized = true;
});

$effect(() => {
  if (!hasTextTracks) {
    CaptionsHost = null;
    activeCueText = '';
    return;
  }
  let cancelled = false;
  void lazyChunk('media:video:captions', () => import('./VideoCaptions.svelte')).then(
    (mod) => {
      if (cancelled) return;
      CaptionsHost = mod.default as unknown as Component<CaptionsHostProps>;
      captionsLoadError = false;
    },
    () => {
      if (cancelled) return;
      captionsLoadError = true;
    }
  );
  return () => {
    cancelled = true;
  };
});

$effect(() => {
  const win = getOwnerWindow(root);
  if (!win) return;
  const query = win.matchMedia(REDUCED_MOTION_QUERY);
  const update = () => {
    reducedMotion = query.matches;
    if (query.matches) video?.pause();
  };
  update();
  query.addEventListener('change', update);
  return () => query.removeEventListener('change', update);
});

$effect(() => {
  const element = video;
  if (!element) return;
  pictureInPictureSupported = typeof element.requestPictureInPicture === 'function';
  currentTime = Number.isFinite(element.currentTime) ? element.currentTime : 0;
  duration = Number.isFinite(element.duration) ? element.duration : 0;
  playbackRate = normalizePlaybackRate(element.playbackRate);
});

$effect(() => {
  const source = sources.src;
  if (!video || !source) return;
  failed = false;
  playing = false;
  currentTime = 0;
  duration = 0;
});

function syncTime(event: Event): void {
  const element = event.currentTarget as HTMLVideoElement;
  currentTime = Number.isFinite(element.currentTime) ? element.currentTime : 0;
  duration = Number.isFinite(element.duration) ? element.duration : 0;
}

function seek(event: Event): void {
  const element = video;
  const value = Number((event.currentTarget as HTMLInputElement).value);
  if (!element || !Number.isFinite(value) || !Number.isFinite(element.duration)) return;
  element.currentTime = Math.min(element.duration, Math.max(0, value));
  currentTime = element.currentTime;
}

function seekTo(time: number): void {
  const element = video;
  if (!element || !Number.isFinite(time)) return;
  const max = Number.isFinite(element.duration) && element.duration > 0 ? element.duration : time;
  element.currentTime = Math.min(max, Math.max(0, time));
  currentTime = element.currentTime;
}

async function togglePlayback(): Promise<void> {
  const element = video;
  if (!element) return;
  if (!element.paused) {
    element.pause();
    return;
  }
  try {
    await element.play();
    failed = false;
  } catch {
    failed = true;
  }
}

function setRate(event: Event): void {
  const rate = normalizePlaybackRate(Number((event.currentTarget as HTMLSelectElement).value));
  if (video) video.playbackRate = rate;
  playbackRate = rate;
}

async function openPictureInPicture(): Promise<void> {
  const element = video;
  if (!element || !pictureInPictureSupported) return;
  try {
    await element.requestPictureInPicture();
    pictureInPictureError = false;
  } catch {
    pictureInPictureError = true;
  }
}

$effect(() => {
  return listen(root, 'keydown', (event) => {
    onPlayerKeydown(event as KeyboardEvent);
  });
});

function toggleCaptions(): void {
  if (captionTracks.length === 0) return;
  if (captionTracks.every((t) => t.blocked)) return;
  captionsOn = !captionsOn;
  if (captionsOn && !activeTrackId) {
    const pick =
      pickDefaultTextTrack(resolvedTracks, 'captions') ??
      pickDefaultTextTrack(resolvedTracks, 'subtitles');
    if (pick) activeTrackId = pick.id;
  }
  if (!captionsOn) activeCueText = '';
}

function onTrackChange(event: Event): void {
  const value = (event.currentTarget as HTMLSelectElement).value;
  if (value === '') {
    captionsOn = false;
    activeCueText = '';
    return;
  }
  activeTrackId = value;
  captionsOn = true;
}

function onPlayerKeydown(event: KeyboardEvent): void {
  if (event.defaultPrevented) return;
  const target = event.target as HTMLElement | null;
  if (
    target &&
    (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA')
  ) {
    return;
  }
  if (event.key === 'c' || event.key === 'C') {
    if (captionTracks.length === 0) return;
    event.preventDefault();
    toggleCaptions();
  }
}
</script>

<section
  bind:this={root}
  class={cx('tx-video-player', className)}
  data-tx-video-player=""
  data-reduced-motion={reducedMotion ? 'true' : 'false'}
  data-captions={captionsOn ? 'on' : 'off'}
  aria-label={title}
>
  {#if sources.src}
    <div class="tx-video-player__stage">
      <video
        bind:this={video}
        class="tx-video-player__video"
        src={sources.src}
        poster={sources.poster}
        aria-label={title}
        loop={loop && !reducedMotion}
        {muted}
        playsinline={playsInline}
        preload="none"
        ontimeupdate={syncTime}
        onloadedmetadata={syncTime}
        ondurationchange={syncTime}
        onplay={() => (playing = true)}
        onpause={() => (playing = false)}
        onended={() => (playing = false)}
        onerror={() => (failed = true)}
      ></video>
      {#if captionsOn && activeCueText}
        <div class="tx-video-player__caption-overlay" data-tx-video-caption-overlay="">
          <p class="tx-video-player__caption-text" data-tx-video-caption-text="">{activeCueText}</p>
        </div>
      {/if}
    </div>
    <div
      class="tx-video-player__controls"
      role="group"
      aria-label={`${title} controls`}
      data-tx-video-controls=""
    >
      <button
        type="button"
        class="tx-video-player__button"
        aria-label={playing ? labels.pause : labels.play}
        aria-pressed={playing}
        onclick={togglePlayback}
      >{playing ? labels.pause : labels.play}</button>
      <input
        class="tx-video-player__seek"
        type="range"
        min="0"
        max={duration || 0}
        step="0.1"
        value={Math.min(currentTime, duration || 0)}
        aria-label={labels.seek}
        aria-valuetext={`${formatVideoTime(currentTime)} ${labels.durationSeparator} ${formatVideoTime(duration)}`}
        disabled={!duration}
        oninput={seek}
      />
      <span class="tx-video-player__time" aria-hidden="true">
        {formatVideoTime(currentTime)}
        <span>{labels.durationSeparator}</span>
        {formatVideoTime(duration)}
      </span>
      <label class="tx-video-player__rate">
        <span>{labels.playbackRate}</span>
        <select aria-label={labels.playbackRate} value={playbackRate} onchange={setRate}>
          {#each VIDEO_PLAYBACK_RATES as rate (rate)}
            <option value={rate}>{rate}×</option>
          {/each}
        </select>
      </label>
      {#if captionTracks.length > 0}
        <button
          type="button"
          class="tx-video-player__button"
          data-tx-video-captions-toggle=""
          aria-label={labels.captions}
          aria-pressed={captionsOn}
          disabled={captionTracks.every((t) => t.blocked)}
          onclick={toggleCaptions}
        >{captionsOn ? labels.captions : labels.captionsOff}</button>
        <label class="tx-video-player__rate">
          <span>{labels.captionTrack}</span>
          <select
            data-tx-video-caption-track=""
            aria-label={labels.captionTrack}
            value={captionsOn ? (activeTrackId ?? '') : ''}
            onchange={onTrackChange}
          >
            <option value="">{labels.captionsOff}</option>
            {#each captionTracks as track (track.id)}
              <option value={track.id} disabled={track.blocked}>
                {track.label}{track.blocked ? ' (blocked)' : ''}
              </option>
            {/each}
          </select>
        </label>
      {/if}
      <button
        type="button"
        class="tx-video-player__button"
        aria-label={labels.pictureInPicture}
        disabled={!pictureInPictureSupported}
        onclick={openPictureInPicture}
      >{labels.pictureInPicture}</button>
    </div>
    {#if CaptionsHost && hasTextTracks}
      <CaptionsHost
        tracks={resolvedTracks}
        {currentTime}
        {captionsOn}
        {activeTrackId}
        {trust}
        {allowedOrigins}
        {showTranscript}
        showChapters={true}
        chapterLabel={labels.chapters}
        transcriptLabel={labels.transcript}
        chapterAnnouncement={labels.chapterAnnouncement}
        onSeek={seekTo}
        onActiveCueText={(text) => (activeCueText = text)}
      />
    {/if}
    {#if reducedMotion}
      <p class="tx-video-player__note" role="status">{labels.reducedMotion}</p>
    {/if}
    {#if failed}
      <p class="tx-video-player__error" role="alert">{labels.failed}</p>
    {/if}
    {#if pictureInPictureError}
      <p class="tx-video-player__error" role="status">{labels.pictureInPictureFailed}</p>
    {/if}
    {#if captionsLoadError}
      <p class="tx-video-player__error" role="status">Captions unavailable.</p>
    {/if}
  {:else}
    <p class="tx-video-player__error" role="alert">{labels.blocked}</p>
  {/if}
</section>

<style>
  @layer tx.components {
    .tx-video-player {
      display: grid;
      gap: 0.5rem;
      max-inline-size: 100%;
      color: var(--tx-foreground, CanvasText);
      background: var(--tx-background, Canvas);
    }
    .tx-video-player__stage {
      position: relative;
      display: grid;
    }
    .tx-video-player__video {
      display: block;
      inline-size: 100%;
      max-block-size: 75vh;
      background: var(--tx-surface, Canvas);
      border-radius: var(--tx-radius, 0.5rem);
    }
    .tx-video-player__caption-overlay {
      position: absolute;
      inset-inline: 0.75rem;
      inset-block-end: 0.75rem;
      display: flex;
      justify-content: center;
      pointer-events: none;
    }
    .tx-video-player__caption-text {
      margin: 0;
      max-inline-size: 90%;
      padding: 0.35rem 0.75rem;
      border-radius: var(--tx-radius-md, 0.375rem);
      background-color: color-mix(in oklab, Canvas 15%, #000 85%);
      color: #fff;
      font-size: var(--tx-text-sm, 0.875rem);
      line-height: 1.35;
      text-align: center;
    }
    .tx-video-player__controls {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem;
      padding: 0.35rem 0;
      color: var(--tx-foreground, CanvasText);
      background: var(--tx-background, Canvas);
    }
    .tx-video-player__button,
    .tx-video-player__rate select {
      min-block-size: 2.5rem;
      padding-inline: 0.75rem;
      border: 1px solid var(--tx-input, var(--tx-border, ButtonBorder));
      border-radius: var(--tx-radius, 0.5rem);
      /* Canvas pair stays AA even when theme surface/foreground are soft greys. */
      background: var(--tx-background, Canvas);
      color: CanvasText;
      font: inherit;
    }
    .tx-video-player__button {
      cursor: pointer;
    }
    .tx-video-player__button:disabled {
      cursor: not-allowed;
      opacity: 0.55;
    }
    .tx-video-player__button:focus-visible,
    .tx-video-player__rate select:focus-visible,
    .tx-video-player__seek:focus-visible {
      outline: var(--tx-focus-ring-width, 2px) solid var(--tx-ring, Highlight);
      outline-offset: var(--tx-focus-ring-offset, 2px);
    }
    .tx-video-player__seek {
      flex: 1 1 10rem;
      min-inline-size: 8rem;
      accent-color: var(--tx-primary, Highlight);
    }
    .tx-video-player__time,
    .tx-video-player__rate {
      color: CanvasText;      font-size: 0.8125rem;
      font-variant-numeric: tabular-nums;
    }
    .tx-video-player__rate {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
    }
    .tx-video-player__note,
    .tx-video-player__error {
      margin: 0;
      color: var(--tx-foreground, CanvasText);
    }
    .tx-video-player__error {
      color: var(--tx-destructive, Mark);
    }
    @media (forced-colors: active) {
      .tx-video-player {
        forced-color-adjust: none;
        color: CanvasText;
        background: Canvas;
      }

      .tx-video-player__video {
        background: Canvas;
        border: 1px solid ButtonText;
        outline: 1px solid CanvasText;
      }

      .tx-video-player__controls {
        border: 1px solid ButtonText;
        padding: 0.35rem;
        background: Canvas;
        color: CanvasText;
      }

      .tx-video-player__button,
      .tx-video-player__rate select {
        border-color: ButtonText;
        color: ButtonText;
        background: ButtonFace;
      }
      .tx-video-player__time,
      .tx-video-player__rate,
      .tx-video-player__note {
        color: CanvasText;      }

      .tx-video-player__button[aria-pressed='true'] {
        border-color: Highlight;
        outline: 2px solid Highlight;
        outline-offset: 1px;
        background: SelectedItem;
        color: SelectedItemText;
      }

      .tx-video-player__button:disabled,
      .tx-video-player__rate select:disabled,
      .tx-video-player__seek:disabled {
        opacity: 1;
        color: GrayText;
        border-color: GrayText;
      }

      .tx-video-player__button:focus-visible,
      .tx-video-player__rate select:focus-visible,
      .tx-video-player__seek:focus-visible {
        outline: 3px solid Highlight;
        outline-offset: 2px;
      }

      .tx-video-player__seek {
        accent-color: Highlight;
        border: 1px solid ButtonText;
        background: Canvas;
        color: CanvasText;
        forced-color-adjust: none;
      }

      .tx-video-player__time,
      .tx-video-player__rate,
      .tx-video-player__note {
        color: CanvasText;
      }

      .tx-video-player__error {
        /* Mark is often yellow on white under Windows HCM; use CanvasText + border. */
        color: CanvasText;
        background: Canvas;
        border: 2px solid CanvasText;
        padding: 0.35rem 0.5rem;
        font-weight: 600;
      }

      .tx-video-player__caption-text {
        background: Canvas;
        color: CanvasText;
        border: 2px solid CanvasText;
        forced-color-adjust: none;
      }

      .tx-video-player__caption-overlay {
        forced-color-adjust: none;
      }
    }
  }
</style>
