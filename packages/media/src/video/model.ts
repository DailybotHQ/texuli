import {
  type HrefTrust,
  type SafeMediaSrcOptions,
  safeImageSrc,
  safeMediaSrc,
} from '@texuli/core/url-policy';

export type VideoTrust = HrefTrust;

export const VIDEO_SOURCE_LIMITS = Object.freeze({
  allowedOrigins: 32,
  /** Maximum text tracks accepted on one player. */
  maxTextTracks: 16,
});

export const VIDEO_PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

/** Kinds of WebVTT tracks the player can attach. */
export type VideoTextTrackKind = 'captions' | 'subtitles' | 'chapters';

/**
 * A caption, subtitle or chapter track. Prefer inline `vtt` for demos;
 * remote `src` values go through `safeMediaSrc` with the player's trust.
 */
export interface VideoTextTrackInput {
  /** Stable id used by the track picker. */
  id?: string;
  /** Accessible label shown in the track picker. */
  label: string;
  kind?: VideoTextTrackKind;
  language?: string;
  /** Inline WebVTT source (never treated as HTML). */
  vtt?: string;
  /** Remote or blob track URL. */
  src?: unknown;
  /** Select this track when the player mounts (first match wins per kind). */
  default?: boolean;
}

export interface ResolvedVideoTextTrack {
  id: string;
  label: string;
  kind: VideoTextTrackKind;
  language: string | undefined;
  /** Safe URL when the track is remote; undefined for inline VTT. */
  src: string | undefined;
  /** Inline VTT text when provided. */
  vtt: string | undefined;
  /** True when a remote src was supplied but blocked by policy. */
  blocked: boolean;
  default: boolean;
}

export interface VideoSourceInput {
  src: unknown;
  poster?: unknown;
  trust?: VideoTrust;
  allowedOrigins?: readonly string[];
}

export type VideoSourceIssue = 'src' | 'poster' | 'allowedOrigins';

export interface ResolvedVideoSources {
  src: string | undefined;
  poster: string | undefined;
  dropped: VideoSourceIssue[];
}

/** Validate media and poster URLs before either can reach a browser element. */
export function resolveVideoSources(input: VideoSourceInput): ResolvedVideoSources {
  const trust = input.trust ?? 'untrusted';
  const dropped: VideoSourceIssue[] = [];
  const safeOrigins = Array.isArray(input.allowedOrigins)
    ? input.allowedOrigins.slice(0, VIDEO_SOURCE_LIMITS.allowedOrigins)
    : undefined;
  if (input.allowedOrigins !== undefined && !safeOrigins) dropped.push('allowedOrigins');

  const options: SafeMediaSrcOptions = { allowedOrigins: safeOrigins };
  const src = safeMediaSrc(input.src, trust, options);
  if (!src) dropped.push('src');
  const poster = input.poster === undefined ? undefined : safeImageSrc(input.poster, trust);
  if (input.poster !== undefined && !poster) dropped.push('poster');
  return { src, poster, dropped };
}

/** Keep playback-rate input within the controls this player exposes. */
export function normalizePlaybackRate(value: unknown): (typeof VIDEO_PLAYBACK_RATES)[number] {
  return (VIDEO_PLAYBACK_RATES as readonly unknown[]).includes(value)
    ? (value as (typeof VIDEO_PLAYBACK_RATES)[number])
    : 1;
}

/** Human-readable media time that remains useful before metadata loads. */
export function formatVideoTime(seconds: unknown): string {
  const safe = typeof seconds === 'number' && Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const whole = Math.floor(safe);
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const remaining = whole % 60;
  const clock =
    hours > 0
      ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remaining).padStart(2, '0')}`
      : `${minutes}:${String(remaining).padStart(2, '0')}`;
  return clock;
}

const TRACK_KINDS = new Set<VideoTextTrackKind>(['captions', 'subtitles', 'chapters']);

function normalizeTrackKind(value: unknown): VideoTextTrackKind {
  return typeof value === 'string' && TRACK_KINDS.has(value as VideoTextTrackKind)
    ? (value as VideoTextTrackKind)
    : 'captions';
}

/**
 * Validate text-track sources with `safeMediaSrc`. Inline `vtt` needs no URL.
 * Blocked remote tracks stay listed so the UI can show they are unavailable.
 */
export function resolveVideoTextTracks(
  tracks: readonly VideoTextTrackInput[] | undefined,
  trust: VideoTrust = 'untrusted',
  allowedOrigins?: readonly string[]
): ResolvedVideoTextTrack[] {
  if (!Array.isArray(tracks) || tracks.length === 0) return [];
  const options: SafeMediaSrcOptions = {
    allowedOrigins: Array.isArray(allowedOrigins)
      ? allowedOrigins.slice(0, VIDEO_SOURCE_LIMITS.allowedOrigins)
      : undefined,
  };
  const out: ResolvedVideoTextTrack[] = [];
  const limit = Math.min(tracks.length, VIDEO_SOURCE_LIMITS.maxTextTracks);
  for (let i = 0; i < limit; i += 1) {
    const track = tracks[i];
    if (!track || typeof track !== 'object') continue;
    const label = typeof track.label === 'string' ? track.label.trim() : '';
    if (!label) continue;
    const kind = normalizeTrackKind(track.kind);
    const language =
      typeof track.language === 'string' && track.language.trim()
        ? track.language.trim().slice(0, 32)
        : undefined;
    const vtt = typeof track.vtt === 'string' && track.vtt.length > 0 ? track.vtt : undefined;
    let src: string | undefined;
    let blocked = false;
    if (!vtt && track.src !== undefined && track.src !== null && track.src !== '') {
      src = safeMediaSrc(track.src, trust, options);
      if (!src) blocked = true;
    }
    if (!vtt && !src && !blocked) continue;
    const id =
      typeof track.id === 'string' && track.id.trim()
        ? track.id.trim().slice(0, 64)
        : `track-${i}-${kind}`;
    out.push({
      id,
      label: label.slice(0, 120),
      kind,
      language,
      src,
      vtt,
      blocked,
      default: track.default === true,
    });
  }
  return out;
}

/** First default track of `kind`, otherwise the first non-blocked track of that kind. */
export function pickDefaultTextTrack(
  tracks: readonly ResolvedVideoTextTrack[],
  kind: VideoTextTrackKind
): ResolvedVideoTextTrack | undefined {
  const ofKind = tracks.filter((t) => t.kind === kind && !t.blocked);
  return ofKind.find((t) => t.default) ?? ofKind[0];
}
