<script lang="ts">
import { type ClassValue, cx } from 'texuli/cx';
import ChapterMenu from './ChapterMenu.svelte';
import {
  type CaptionChapter,
  type CaptionCue,
  chaptersFromCues,
  cuesAtTime,
  loadCaptionTrack,
  parseWebVtt,
  resolveCaptionSource,
} from './model.ts';
import TranscriptView from './TranscriptView.svelte';
import type { CaptionsLabels, CaptionsPanelProps } from './types.ts';
import './captions.css';

const DEFAULT_LABELS: CaptionsLabels = {
  chapters: 'Chapters',
  transcript: 'Transcript',
  activeCaption: 'Captions',
  unavailable: 'Caption track unavailable',
  noCues: 'No cues in this track',
};

/**
 * Captions and chapters panel: parse inline or fetched WebVTT, show the active
 * line, a chapter menu and a transcript. Untrusted track URLs use `safeMediaSrc`.
 */
let {
  vtt,
  src,
  trust = 'untrusted',
  allowedOrigins,
  kind = 'captions',
  cues: cuesProp,
  chapters: chaptersProp,
  currentTime = 0,
  showChapters = true,
  showTranscript = true,
  showActive = true,
  label = 'Captions',
  labels: labelOverrides,
  class: className,
  onSeek,
  onLoad,
  onError,
}: CaptionsPanelProps & { class?: ClassValue } = $props();

const text = $derived({ ...DEFAULT_LABELS, ...labelOverrides });

let cues = $state<CaptionCue[]>([]);
let chapters = $state<CaptionChapter[]>([]);
let status = $state<'ready' | 'loading' | 'blocked' | 'error' | 'empty'>('loading');

const activeText = $derived(
  cuesAtTime(cues, currentTime)
    .map((c) => c.text)
    .filter(Boolean)
    .join(' ')
);

$effect(() => {
  if (cuesProp && cuesProp.length > 0) {
    cues = [...cuesProp];
    chapters =
      chaptersProp && chaptersProp.length > 0
        ? [...chaptersProp]
        : kind === 'chapters'
          ? chaptersFromCues(cuesProp)
          : chaptersProp
            ? [...chaptersProp]
            : [];
    status = 'ready';
    onLoad?.({ cues: [...cues], chapters: [...chapters] });
    return;
  }

  if (typeof vtt === 'string' && vtt.length > 0) {
    const parsed = parseWebVtt(vtt, { keepEmpty: kind === 'chapters' });
    cues = parsed;
    chapters =
      chaptersProp && chaptersProp.length > 0
        ? [...chaptersProp]
        : kind === 'chapters'
          ? chaptersFromCues(parsed)
          : [];
    status = parsed.length > 0 ? 'ready' : 'empty';
    if (parsed.length > 0) onLoad?.({ cues: [...cues], chapters: [...chapters] });
    return;
  }

  if (src !== undefined && src !== null && src !== '') {
    const resolved = resolveCaptionSource({ src, trust, allowedOrigins });
    if (!resolved.src) {
      cues = [];
      chapters = [];
      status = 'blocked';
      onError?.();
      return;
    }
    status = 'loading';
    let cancelled = false;
    void loadCaptionTrack(resolved.src, {
      trust,
      allowedOrigins,
      kind,
    }).then((result) => {
      if (cancelled) return;
      if (!result) {
        cues = [];
        chapters = [];
        status = 'error';
        onError?.();
        return;
      }
      cues = result.cues;
      chapters =
        chaptersProp && chaptersProp.length > 0
          ? [...chaptersProp]
          : result.chapters.length > 0
            ? result.chapters
            : kind === 'chapters'
              ? chaptersFromCues(result.cues)
              : [];
      status = result.cues.length > 0 ? 'ready' : 'empty';
      onLoad?.({ cues: [...cues], chapters: [...chapters] });
    });
    return () => {
      cancelled = true;
    };
  }

  cues = [];
  chapters = chaptersProp ? [...chaptersProp] : [];
  status = chapters.length > 0 ? 'ready' : 'empty';
});

function seek(time: number): void {
  onSeek?.(time);
}

function onChapter(chapter: CaptionChapter): void {
  onSeek?.(chapter.start);
}
</script>

<section
  class={cx('tx-captions', className)}
  data-tx-captions=""
  data-status={status}
  aria-label={label}
>
  {#if showActive && status === 'ready'}
    <p
      class="tx-captions__active"
      data-tx-captions-active=""
      aria-live="polite"
      aria-label={text.activeCaption}
    >
      {activeText}
    </p>
  {/if}

  {#if showChapters && chapters.length > 0}
    <ChapterMenu
      {chapters}
      {currentTime}
      label={text.chapters}
      disabled={status === 'blocked' || status === 'error'}
      onSelect={onChapter}
    />
  {/if}

  {#if showTranscript && (cues.length > 0 || status === 'empty')}
    <TranscriptView
      {cues}
      {currentTime}
      label={text.transcript}
      disabled={status === 'blocked' || status === 'error'}
      onSeek={seek}
    />
  {/if}

  {#if status === 'blocked' || status === 'error'}
    <p class="tx-captions__message" role="status" data-tx-captions-message="">
      {text.unavailable}
    </p>
  {:else if status === 'empty' && cues.length === 0 && chapters.length === 0}
    <p class="tx-captions__message" role="status" data-tx-captions-message="">
      {text.noCues}
    </p>
  {/if}
</section>
