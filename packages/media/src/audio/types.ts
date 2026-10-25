import { type ClassValue } from 'texuli/cx';
import type { AudioTrust } from './model.ts';

export type AudioPlayerLabels = {
  play: string;
  pause: string;
  seek: string;
  waveform: string;
  unavailable: string;
};

export type AudioPlayerProps = {
  /** Media URL (validated with `safeMediaSrc`). */
  src: string;
  trust?: AudioTrust;
  /** Exact HTTPS origins allowed when `trust` is `untrusted`. */
  allowedOrigins?: readonly string[];
  /** Accessible name for the player. */
  label?: string;
  /** Precomputed waveform peaks in `[0, 1]`; when omitted the player decodes. */
  peaks?: readonly number[];
  /** Bar count used when decoding peaks. */
  barCount?: number;
  /** Start muted. */
  muted?: boolean;
  /** Playback rate (clamped 0.5–2). */
  playbackRate?: number;
  labels?: Partial<AudioPlayerLabels>;
  class?: ClassValue;
  onPlay?: () => void;
  onPause?: () => void;
  onTimeUpdate?: (time: number) => void;
  onEnded?: () => void;
  onError?: () => void;
};

export type WaveformProps = {
  peaks: readonly number[];
  /** Progress 0–1. */
  progress?: number;
  /** Accessible name. */
  label?: string;
  disabled?: boolean;
  class?: ClassValue;
  onSeek?: (ratio: number) => void;
};
