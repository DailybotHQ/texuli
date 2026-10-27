import type { VideoTextTrackInput, VideoTrust } from './model.ts';

/** Labels shown by the video edit panel; supply translations as a partial record. */
export interface VideoEditPanelLabels {
  editor: string;
  trim: string;
  trimStart: string;
  trimEnd: string;
  captions: string;
  addCue: string;
  captionStart: string;
  captionEnd: string;
  captionText: string;
  removeCue: string;
  invalid: string;
}

/** Labels rendered by VideoPlayer; supply translations as a partial record. */
export interface VideoPlayerLabels {
  blocked: string;
  failed: string;
  play: string;
  pause: string;
  seek: string;
  playbackRate: string;
  pictureInPicture: string;
  durationSeparator: string;
  reducedMotion: string;
  pictureInPictureFailed: string;
  captions: string;
  captionsOff: string;
  captionTrack: string;
  captionsUnavailable: string;
  chapters: string;
  transcript: string;
  chapterAnnouncement: string;
}

/** Public properties for the custom-controls video player. */
export interface VideoPlayerProps {
  src: unknown;
  poster?: unknown;
  title: string;
  trust?: VideoTrust;
  /** Exact HTTPS origins permitted for untrusted remote media and tracks. */
  allowedOrigins?: readonly string[];
  loop?: boolean;
  muted?: boolean;
  playsInline?: boolean;
  /**
   * Caption, subtitle and chapter tracks (WebVTT). Captions UI loads lazily
   * so the video entry stays within its bundle budget when tracks are omitted.
   */
  tracks?: readonly VideoTextTrackInput[];
  /** Start with captions visible when a captions/subtitles track exists. */
  captionsDefault?: boolean;
  /** Show the optional transcript panel under the player. */
  showTranscript?: boolean;
  labels?: Partial<VideoPlayerLabels>;
}
