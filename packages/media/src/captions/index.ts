/**
 * `@texuli/media/captions` — WebVTT captions, chapters and transcript.
 */

export { default as CaptionsPanel } from './CaptionsPanel.svelte';
export { default as ChapterMenu } from './ChapterMenu.svelte';
export {
  CAPTION_LIMITS,
  type CaptionChapter,
  type CaptionCue,
  type CaptionKind,
  type CaptionTrackResult,
  type CaptionTrust,
  chapterAtTime,
  chaptersFromCues,
  cuesAtTime,
  formatCaptionTime,
  type LoadCaptionTrackOptions,
  loadCaptionTrack,
  type ParseWebVttOptions,
  parseVttTimestamp,
  parseWebVtt,
  plainCueText,
  type ResolveCaptionSourceInput,
  type ResolvedCaptionSource,
  resolveCaptionSource,
} from './model.ts';
export { default as TranscriptView } from './TranscriptView.svelte';
export type {
  CaptionsLabels,
  CaptionsPanelProps,
  ChapterMenuProps,
  TranscriptViewProps,
} from './types.ts';
