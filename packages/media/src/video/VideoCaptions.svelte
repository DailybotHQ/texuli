<script lang="ts">
import { getAnnouncer } from '@texuli/core/announcer';
import { getOwnerDocument } from '@texuli/core/env';
import { type ClassValue, cx } from 'texuli/cx';
import {
  type CaptionChapter,
  type CaptionCue,
  ChapterMenu,
  chapterAtTime,
  chaptersFromCues,
  cuesAtTime,
  loadCaptionTrack,
  parseWebVtt,
  TranscriptView,
} from '../captions/index.ts';
import type { ResolvedVideoTextTrack, VideoTrust } from './model.ts';

/**
 * Lazily loaded captions host for VideoPlayer. Parses WebVTT tracks, drives
 * the chapter menu and transcript, reports active cue text to the player for
 * on-video rendering, and announces chapter changes.
 */

type Props = {
  tracks: readonly ResolvedVideoTextTrack[];
  currentTime: number;
  captionsOn: boolean;
  activeTrackId: string | undefined;
  trust?: VideoTrust;
  allowedOrigins?: readonly string[];
  showTranscript?: boolean;
  showChapters?: boolean;
  chapterLabel: string;
  transcriptLabel: string;
  chapterAnnouncement: string;
  class?: ClassValue;
  onSeek: (time: number) => void;
  onActiveCueText?: (text: string) => void;
};

let {
  tracks,
  currentTime,
  captionsOn,
  activeTrackId,
  trust = 'untrusted',
  allowedOrigins,
  showTranscript = false,
  showChapters = true,
  chapterLabel,
  transcriptLabel,
  chapterAnnouncement,
  class: className,
  onSeek,
  onActiveCueText,
}: Props = $props();

let root = $state<HTMLElement | null>(null);
let cuesByTrack = $state<Record<string, CaptionCue[]>>({});
let chapters = $state<CaptionChapter[]>([]);
let lastChapterId = $state<string | undefined>(undefined);

const activeTrack = $derived(
  tracks.find((t) => t.id === activeTrackId && !t.blocked) ??
    tracks.find((t) => (t.kind === 'captions' || t.kind === 'subtitles') && !t.blocked)
);

const activeText = $derived.by(() => {
  if (!captionsOn || !activeTrack) return '';
  return cuesAtTime(cuesByTrack[activeTrack.id] ?? [], currentTime)
    .map((c) => c.text)
    .filter(Boolean)
    .join(' ');
});

const transcriptCues = $derived(activeTrack ? (cuesByTrack[activeTrack.id] ?? []) : []);

$effect(() => {
  onActiveCueText?.(activeText);
});

$effect(() => {
  const list = tracks;
  const trackTrust = trust;
  const origins = allowedOrigins;
  let cancelled = false;

  async function loadAll(): Promise<void> {
    const next: Record<string, CaptionCue[]> = {};
    let nextChapters: CaptionChapter[] = [];

    for (const track of list) {
      if (track.blocked) continue;
      let cues: CaptionCue[] = [];
      if (track.vtt) {
        cues = parseWebVtt(track.vtt, { keepEmpty: track.kind === 'chapters' });
      } else if (track.src) {
        const result = await loadCaptionTrack(track.src, {
          kind: track.kind,
          trust: trackTrust,
          allowedOrigins: origins,
        });
        if (result) cues = result.cues;
      }
      next[track.id] = cues;
      if (track.kind === 'chapters') {
        nextChapters = chaptersFromCues(cues);
      }
    }

    if (cancelled) return;
    cuesByTrack = next;
    chapters = nextChapters;
  }

  void loadAll();
  return () => {
    cancelled = true;
  };
});

$effect(() => {
  if (chapters.length === 0) return;
  const current = chapterAtTime(chapters, currentTime);
  if (!current || current.id === lastChapterId) return;
  lastChapterId = current.id;
  const doc = getOwnerDocument(root);
  if (!doc) return;
  try {
    // Shared page announcer (default inert exemptions). immediate bypasses
    // polite debounce so chapter titles re-announce without poisoning options.
    getAnnouncer(doc).announce(`${chapterAnnouncement} ${current.title}`.trim(), {
      politeness: 'polite',
      immediate: true,
    });
  } catch {
    // Announcer is optional when the document is incomplete.
  }
});

function onChapter(chapter: CaptionChapter): void {
  onSeek(chapter.start);
}
</script>

<div
  bind:this={root}
  class={cx('tx-video-captions', className)}
  data-tx-video-captions=""
  data-captions={captionsOn ? 'on' : 'off'}
>
  {#if showChapters && chapters.length > 0}
    <ChapterMenu {chapters} {currentTime} label={chapterLabel} onSelect={onChapter} />
  {/if}

  {#if showTranscript && transcriptCues.length > 0}
    <TranscriptView
      cues={transcriptCues}
      {currentTime}
      label={transcriptLabel}
      onSeek={onSeek}
    />
  {/if}
</div>
