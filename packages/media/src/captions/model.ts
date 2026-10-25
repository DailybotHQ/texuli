import { type HrefTrust, type SafeMediaSrcOptions, safeMediaSrc } from '@texuli/core/url-policy';

/** Hard limits for WebVTT parsing and display. */
export const CAPTION_LIMITS = Object.freeze({
  /** Maximum cues kept after parse. */
  maxCues: 2_000,
  /** Maximum characters kept per cue text. */
  maxCueChars: 500,
  /** Maximum source characters accepted when parsing inline VTT. */
  maxSourceChars: 512_000,
  /** Maximum chapters derived from a chapter track. */
  maxChapters: 256,
  /** Maximum allowed origins for untrusted remote tracks. */
  maxAllowedOrigins: 32,
});

export type CaptionTrust = HrefTrust;

export type CaptionKind = 'captions' | 'subtitles' | 'chapters' | 'descriptions' | 'metadata';

/** One timed cue after a safe plain-text parse. */
export type CaptionCue = {
  id: string;
  start: number;
  end: number;
  text: string;
};

/** A chapter marker derived from a chapters track or long caption segments. */
export type CaptionChapter = {
  id: string;
  start: number;
  end: number;
  title: string;
};

export type ParseWebVttOptions = {
  /** When true, empty text cues are kept (chapter markers sometimes have only an id). */
  keepEmpty?: boolean;
  /** Override the max cue count. */
  maxCues?: number;
};

export type ResolveCaptionSourceInput = {
  src: unknown;
  trust?: CaptionTrust;
  allowedOrigins?: readonly string[];
};

export type ResolvedCaptionSource = {
  src: string | undefined;
  dropped: boolean;
};

export type LoadCaptionTrackOptions = {
  trust?: CaptionTrust;
  allowedOrigins?: readonly string[];
  kind?: CaptionKind;
  fetchImpl?: typeof fetch;
  parseOptions?: ParseWebVttOptions;
};

export type CaptionTrackResult = {
  cues: CaptionCue[];
  chapters: CaptionChapter[];
  src: string;
  kind: CaptionKind;
};

/** Validate a caption/chapter track URL through the media URL policy. */
export function resolveCaptionSource(input: ResolveCaptionSourceInput): ResolvedCaptionSource {
  const trust = input.trust ?? 'untrusted';
  const origins = Array.isArray(input.allowedOrigins)
    ? input.allowedOrigins.slice(0, CAPTION_LIMITS.maxAllowedOrigins)
    : undefined;
  const options: SafeMediaSrcOptions = { allowedOrigins: origins };
  const src = safeMediaSrc(input.src, trust, options);
  return { src, dropped: src === undefined };
}

/**
 * Parse a WebVTT timestamp (`00:00:01.000` or `00:01.000`) into seconds.
 * Returns `undefined` when the stamp is not a finite non-negative time.
 */
export function parseVttTimestamp(value: string): number | undefined {
  const raw = value.trim();
  if (!raw) return undefined;
  const parts = raw.split(':');
  if (parts.length < 2 || parts.length > 3) return undefined;
  const nums = parts.map((p) => Number(p));
  if (nums.some((n) => !Number.isFinite(n) || n < 0)) return undefined;
  let hours = 0;
  let minutes = 0;
  let seconds = 0;
  if (nums.length === 3) {
    hours = nums[0] ?? 0;
    minutes = nums[1] ?? 0;
    seconds = nums[2] ?? 0;
  } else {
    minutes = nums[0] ?? 0;
    seconds = nums[1] ?? 0;
  }
  if (minutes >= 60 && nums.length === 3) return undefined;
  const total = hours * 3600 + minutes * 60 + seconds;
  return Number.isFinite(total) && total >= 0 ? total : undefined;
}

/** Format seconds as `m:ss` or `h:mm:ss` for menus and transcripts. */
export function formatCaptionTime(seconds: number): string {
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
 * Strip WebVTT cue payload tags and unescape entities so cue text is plain.
 * Never treated as HTML.
 */
export function plainCueText(raw: string): string {
  let text = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  // Drop NOTE-style residual and voice/class tags: <c>, <b>, <i>, <u>, <v Name>, <lang en>, timestamps.
  text = text.replace(/<\/?[^>]+>/g, '');
  text = text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
  text = text
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (text.length > CAPTION_LIMITS.maxCueChars) {
    return text.slice(0, CAPTION_LIMITS.maxCueChars);
  }
  return text;
}

const TIMING_LINE =
  /^(\d{1,2}:)?\d{1,2}:\d{1,2}(?:\.\d{1,3})?\s+-->\s+(\d{1,2}:)?\d{1,2}:\d{1,2}(?:\.\d{1,3})?/;

/**
 * Parse WebVTT source text into plain-text cues.
 * Ignores STYLE/REGION/NOTE blocks. Rejects oversized sources.
 */
export function parseWebVtt(source: unknown, options: ParseWebVttOptions = {}): CaptionCue[] {
  if (typeof source !== 'string') return [];
  if (source.length > CAPTION_LIMITS.maxSourceChars) return [];

  const normalized = source
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
  const lines = normalized.split('\n');
  // Require a WEBVTT header somewhere in the first non-empty lines.
  let headerOk = false;
  for (let i = 0; i < Math.min(lines.length, 5); i += 1) {
    const line = (lines[i] ?? '').trim();
    if (!line) continue;
    if (line.startsWith('WEBVTT')) {
      headerOk = true;
      break;
    }
    return [];
  }
  if (!headerOk) return [];

  const maxCues = Math.min(
    CAPTION_LIMITS.maxCues,
    Math.max(1, options.maxCues ?? CAPTION_LIMITS.maxCues)
  );
  const keepEmpty = options.keepEmpty === true;
  const cues: CaptionCue[] = [];
  let i = 0;
  // Skip header line and optional header metadata until a blank line.
  while (i < lines.length) {
    const line = lines[i] ?? '';
    i += 1;
    if (line.trim() === '') break;
  }

  while (i < lines.length && cues.length < maxCues) {
    // Skip blank lines and NOTE / STYLE / REGION blocks.
    while (i < lines.length && (lines[i] ?? '').trim() === '') i += 1;
    if (i >= lines.length) break;

    const first = (lines[i] ?? '').trim();
    if (/^(NOTE|STYLE|REGION)(\s|$)/.test(first)) {
      i += 1;
      while (i < lines.length && (lines[i] ?? '').trim() !== '') i += 1;
      continue;
    }

    let id = '';
    let timingLine = first;
    // Optional identifier line before the arrow timing line.
    if (!TIMING_LINE.test(first)) {
      id = first.slice(0, 128);
      i += 1;
      timingLine = (lines[i] ?? '').trim();
    }

    const timingMatch = /^(.+?)\s+-->\s+(\S+)/.exec(timingLine);
    if (!timingMatch) {
      i += 1;
      continue;
    }
    const start = parseVttTimestamp(timingMatch[1] ?? '');
    const end = parseVttTimestamp(timingMatch[2] ?? '');
    i += 1;
    if (start === undefined || end === undefined || end < start) {
      while (i < lines.length && (lines[i] ?? '').trim() !== '') i += 1;
      continue;
    }

    const payload: string[] = [];
    while (i < lines.length && (lines[i] ?? '').trim() !== '') {
      payload.push(lines[i] ?? '');
      i += 1;
    }
    const text = plainCueText(payload.join('\n'));
    if (!text && !keepEmpty) continue;

    const cueId =
      id || `cue-${cues.length + 1}-${Math.floor(start * 1000)}-${Math.floor(end * 1000)}`;
    cues.push({ id: cueId, start, end, text: text || id || `Chapter ${cues.length + 1}` });
  }

  return cues;
}

/** Build chapter markers from cues (typically a `kind: chapters` track). */
export function chaptersFromCues(
  cues: readonly CaptionCue[],
  options: { maxChapters?: number } = {}
): CaptionChapter[] {
  const max = Math.min(
    CAPTION_LIMITS.maxChapters,
    Math.max(1, options.maxChapters ?? CAPTION_LIMITS.maxChapters)
  );
  const out: CaptionChapter[] = [];
  for (let i = 0; i < cues.length && out.length < max; i += 1) {
    const cue = cues[i];
    if (!cue) continue;
    const next = cues[i + 1];
    const end = cue.end > cue.start ? cue.end : next ? next.start : cue.start;
    out.push({
      id: cue.id,
      start: cue.start,
      end: Math.max(cue.start, end),
      title: cue.text || cue.id,
    });
  }
  return out;
}

/** Active cues at `time` seconds (inclusive start, exclusive end when end > start). */
export function cuesAtTime(cues: readonly CaptionCue[], time: number): CaptionCue[] {
  if (!Number.isFinite(time) || time < 0) return [];
  return cues.filter((cue) => {
    if (cue.end > cue.start) return time >= cue.start && time < cue.end;
    return time >= cue.start && time <= cue.start;
  });
}

/** The chapter that contains `time`, or the last chapter that has started. */
export function chapterAtTime(
  chapters: readonly CaptionChapter[],
  time: number
): CaptionChapter | undefined {
  if (!Number.isFinite(time) || time < 0 || chapters.length === 0) return undefined;
  let current: CaptionChapter | undefined;
  for (const chapter of chapters) {
    if (time >= chapter.start) current = chapter;
    if (time >= chapter.start && time < chapter.end) return chapter;
  }
  return current;
}

/**
 * Fetch and parse a caption track URL. Returns `undefined` when the URL is
 * blocked, the fetch fails, or the body is not valid WebVTT.
 */
export async function loadCaptionTrack(
  src: unknown,
  options: LoadCaptionTrackOptions = {}
): Promise<CaptionTrackResult | undefined> {
  const resolved = resolveCaptionSource({
    src,
    trust: options.trust,
    allowedOrigins: options.allowedOrigins,
  });
  if (!resolved.src) return undefined;

  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== 'function') return undefined;

  let response: Response;
  try {
    response = await fetchImpl(resolved.src);
  } catch {
    return undefined;
  }
  if (!response.ok) return undefined;

  let text: string;
  try {
    text = await response.text();
  } catch {
    return undefined;
  }

  const kind = options.kind ?? 'captions';
  const keepEmpty = kind === 'chapters' || options.parseOptions?.keepEmpty === true;
  const cues = parseWebVtt(text, { ...options.parseOptions, keepEmpty });
  if (cues.length === 0) return undefined;

  return {
    src: resolved.src,
    kind,
    cues,
    chapters: kind === 'chapters' ? chaptersFromCues(cues) : [],
  };
}
