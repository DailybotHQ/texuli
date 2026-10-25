import { type ClassValue } from 'texuli/cx';
import type { CaptionChapter, CaptionCue, CaptionKind, CaptionTrust } from './model.ts';

export type CaptionsLabels = {
  chapters: string;
  transcript: string;
  activeCaption: string;
  unavailable: string;
  noCues: string;
};

export type ChapterMenuProps = {
  chapters: readonly CaptionChapter[];
  /** Current media time in seconds. */
  currentTime?: number;
  /** Accessible name for the menu. */
  label?: string;
  disabled?: boolean;
  class?: ClassValue;
  onSelect?: (chapter: CaptionChapter) => void;
};

export type TranscriptViewProps = {
  cues: readonly CaptionCue[];
  currentTime?: number;
  label?: string;
  disabled?: boolean;
  class?: ClassValue;
  onSeek?: (time: number) => void;
};

export type CaptionsPanelProps = {
  /**
   * Inline WebVTT source. Preferred for deterministic demos and tests.
   * Parsed as plain text; never injected as HTML.
   */
  vtt?: string;
  /** Remote or blob track URL (validated with `safeMediaSrc`). */
  src?: unknown;
  trust?: CaptionTrust;
  allowedOrigins?: readonly string[];
  kind?: CaptionKind;
  /** When set, skips fetch/parse and uses these cues. */
  cues?: readonly CaptionCue[];
  /** When set with kind chapters (or derived), used for the chapter menu. */
  chapters?: readonly CaptionChapter[];
  currentTime?: number;
  /** Show the chapter menu when chapters exist. */
  showChapters?: boolean;
  /** Show the scrollable transcript. */
  showTranscript?: boolean;
  /** Show the active caption line. */
  showActive?: boolean;
  label?: string;
  labels?: Partial<CaptionsLabels>;
  class?: ClassValue;
  onSeek?: (time: number) => void;
  onLoad?: (info: { cues: CaptionCue[]; chapters: CaptionChapter[] }) => void;
  onError?: () => void;
};
