import { type HrefTrust, type SafeMediaSrcOptions, safeMediaSrc } from '@texuli/core/url-policy';

/** Hard limits for waveform decoding and display. */
export const AUDIO_LIMITS = Object.freeze({
  /** Maximum bars drawn on the waveform. */
  maxBars: 256,
  /** Minimum bars. */
  minBars: 8,
  /** Default bar count when the host does not set one. */
  defaultBars: 64,
  /** Reject decoded buffers longer than this (seconds). */
  maxDurationSec: 60 * 60,
  /** Sample rate ceiling when synthesizing peaks in tests. */
  maxSampleRate: 192_000,
});

export type AudioTrust = HrefTrust;

export type ResolveAudioSourceInput = {
  src: unknown;
  trust?: AudioTrust;
  allowedOrigins?: readonly string[];
};

export type ResolvedAudioSource = {
  src: string | undefined;
  dropped: boolean;
};

/** Validate an audio URL through the media URL policy. */
export function resolveAudioSource(input: ResolveAudioSourceInput): ResolvedAudioSource {
  const trust = input.trust ?? 'untrusted';
  const options: SafeMediaSrcOptions = {
    allowedOrigins: input.allowedOrigins,
  };
  const src = safeMediaSrc(input.src, trust, options);
  return { src, dropped: src === undefined };
}

/** Format seconds as `m:ss` or `h:mm:ss`. */
export function formatAudioTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
  return `${m}:${pad(s)}`;
}

/**
 * Downsample mono channel samples into peak bars in `[0, 1]`.
 * Used by the waveform and by tests without a real decoder.
 */
export function buildWaveformPeaks(
  samples: ArrayLike<number>,
  barCount: number = AUDIO_LIMITS.defaultBars
): number[] {
  const bars = Math.min(
    AUDIO_LIMITS.maxBars,
    Math.max(AUDIO_LIMITS.minBars, Math.floor(barCount) || AUDIO_LIMITS.defaultBars)
  );
  const length = samples.length;
  if (length === 0) return Array.from({ length: bars }, () => 0);

  const peaks: number[] = [];
  const block = Math.max(1, Math.floor(length / bars));
  for (let i = 0; i < bars; i += 1) {
    const start = i * block;
    const end = i === bars - 1 ? length : Math.min(length, start + block);
    let peak = 0;
    for (let j = start; j < end; j += 1) {
      const v = Math.abs(Number(samples[j]) || 0);
      if (v > peak) peak = v;
    }
    peaks.push(Math.min(1, peak));
  }
  // Normalize so a quiet clip still shows structure.
  const max = peaks.reduce((a, b) => (b > a ? b : a), 0);
  if (max > 0 && max < 1) {
    return peaks.map((p) => p / max);
  }
  return peaks;
}

/** Mix multi-channel AudioBuffer data into mono samples. */
export function monoFromAudioBuffer(buffer: {
  numberOfChannels: number;
  length: number;
  getChannelData: (channel: number) => Float32Array;
}): Float32Array {
  const { numberOfChannels, length } = buffer;
  if (numberOfChannels <= 0 || length <= 0) return new Float32Array(0);
  if (numberOfChannels === 1) return buffer.getChannelData(0).slice();
  const out = new Float32Array(length);
  for (let c = 0; c < numberOfChannels; c += 1) {
    const channel = buffer.getChannelData(c);
    for (let i = 0; i < length; i += 1) {
      out[i] = (out[i] ?? 0) + (channel[i] ?? 0);
    }
  }
  const inv = 1 / numberOfChannels;
  for (let i = 0; i < length; i += 1) {
    out[i] = (out[i] ?? 0) * inv;
  }
  return out;
}

export type DecodeWaveformOptions = {
  barCount?: number;
  /** Injected for tests. */
  fetchImpl?: typeof fetch;
  /** Injected for tests. */
  audioContext?: {
    decodeAudioData: (data: ArrayBuffer) => Promise<{
      numberOfChannels: number;
      length: number;
      duration: number;
      getChannelData: (channel: number) => Float32Array;
    }>;
    close?: () => Promise<void> | void;
  };
};

/**
 * Fetch + decode an audio source into waveform peaks.
 * Does **not** apply the URL policy itself — callers must pass a src already
 * accepted by `resolveAudioSource` (or an equivalent host check). Returns
 * `undefined` when `fetch` is missing, the network response fails, or decoding fails.
 */
export async function decodeWaveformPeaks(
  src: string,
  options: DecodeWaveformOptions = {}
): Promise<{ peaks: number[]; duration: number } | undefined> {
  const barCount = options.barCount ?? AUDIO_LIMITS.defaultBars;
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== 'function') return undefined;

  let response: Response;
  try {
    response = await fetchImpl(src);
  } catch {
    return undefined;
  }
  if (!response.ok) return undefined;

  let data: ArrayBuffer;
  try {
    data = await response.arrayBuffer();
  } catch {
    return undefined;
  }

  type DecodeCtx = NonNullable<DecodeWaveformOptions['audioContext']>;
  let owned: AudioContext | undefined;
  let ctx: DecodeCtx | undefined = options.audioContext;
  if (!ctx) {
    const GlobalCtx =
      typeof globalThis !== 'undefined'
        ? ((globalThis as unknown as { AudioContext?: typeof AudioContext }).AudioContext ??
          (globalThis as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext)
        : undefined;
    if (!GlobalCtx) return undefined;
    owned = new GlobalCtx();
    ctx = owned;
  }

  try {
    const buffer = await ctx.decodeAudioData(data.slice(0));
    if (buffer.duration > AUDIO_LIMITS.maxDurationSec) return undefined;
    const mono = monoFromAudioBuffer(buffer);
    return {
      peaks: buildWaveformPeaks(mono, barCount),
      duration: buffer.duration,
    };
  } catch {
    return undefined;
  } finally {
    try {
      if (options.audioContext) {
        await options.audioContext.close?.();
      } else if (owned) {
        await owned.close();
      }
    } catch {
      // ignore close failures
    }
  }
}

/** Clamp a seek ratio into `[0, 1]`. */
export function clampSeekRatio(ratio: number): number {
  if (!Number.isFinite(ratio)) return 0;
  return Math.min(1, Math.max(0, ratio));
}
