import type { CaptionCue } from '../captions/model.ts';

/** A half-open source interval, in milliseconds, retained in an edited clip. */
export interface VideoTrimRange {
  startMs: number;
  endMs: number;
}

/** Serializable, non-destructive video edit recipe. Caption times stay on the source timeline. */
export interface VideoEdit {
  version: 1;
  trim: VideoTrimRange;
  captions: readonly CaptionCue[];
}

export interface VideoEditIssue {
  path: string;
  message: string;
}

export type VideoEditValidation =
  | { ok: true; edit: VideoEdit }
  | { ok: false; errors: readonly VideoEditIssue[] };

export const VIDEO_EDIT_LIMITS = Object.freeze({
  maxDurationMs: 86_400_000,
  maxCaptions: 2_000,
  maxCaptionText: 500,
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
// biome-ignore lint/suspicious/noControlCharactersInRegex: caption text rejects C0 controls and DEL.
const CAPTION_CONTROL_CHARS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

/** Start with the full source duration and no captions. */
export function createVideoEdit(durationMs: number): VideoEdit {
  const duration = Number.isFinite(durationMs)
    ? Math.max(0, Math.min(VIDEO_EDIT_LIMITS.maxDurationMs, Math.round(durationMs)))
    : 0;
  return { version: 1, trim: { startMs: 0, endMs: duration }, captions: [] };
}

/** Validate and copy an edit recipe against the measured source duration. */
export function validateVideoEdit(value: unknown, durationMs: number): VideoEditValidation {
  const errors: VideoEditIssue[] = [];
  if (!isRecord(value))
    return { ok: false, errors: [{ path: '$', message: 'Expected an edit object.' }] };
  if (Object.keys(value).some((key) => !['version', 'trim', 'captions'].includes(key))) {
    errors.push({ path: '$', message: 'Unknown edit field.' });
  }
  if (value.version !== 1) errors.push({ path: '$.version', message: 'Expected version 1.' });
  if (!isRecord(value.trim)) {
    errors.push({ path: '$.trim', message: 'Expected a trim range.' });
  } else if (Object.keys(value.trim).some((key) => !['startMs', 'endMs'].includes(key))) {
    errors.push({ path: '$.trim', message: 'Unknown trim field.' });
  }
  const duration = Number.isFinite(durationMs) ? durationMs : 0;
  const startMs = isRecord(value.trim) ? value.trim.startMs : undefined;
  const endMs = isRecord(value.trim) ? value.trim.endMs : undefined;
  if (typeof startMs !== 'number' || !Number.isFinite(startMs) || startMs < 0) {
    errors.push({ path: '$.trim.startMs', message: 'Expected a non-negative finite time.' });
  }
  if (
    typeof endMs !== 'number' ||
    !Number.isFinite(endMs) ||
    endMs > duration ||
    endMs > VIDEO_EDIT_LIMITS.maxDurationMs
  ) {
    errors.push({
      path: '$.trim.endMs',
      message: 'Expected an end time within the source duration.',
    });
  }
  if (
    typeof startMs === 'number' &&
    typeof endMs === 'number' &&
    Number.isFinite(startMs) &&
    Number.isFinite(endMs) &&
    startMs >= endMs
  ) {
    errors.push({ path: '$.trim', message: 'The trim end must be after its start.' });
  }
  if (!Array.isArray(value.captions) || value.captions.length > VIDEO_EDIT_LIMITS.maxCaptions) {
    errors.push({ path: '$.captions', message: 'Expected a bounded list of caption cues.' });
  }

  const captions: CaptionCue[] = [];
  if (Array.isArray(value.captions)) {
    const ids = new Set<string>();
    value.captions.forEach((cue, index) => {
      const path = `$.captions[${index}]`;
      if (
        !isRecord(cue) ||
        Object.keys(cue).some((key) => !['id', 'start', 'end', 'text'].includes(key)) ||
        typeof cue.id !== 'string' ||
        !/^[A-Za-z0-9_-]{1,64}$/.test(cue.id) ||
        ids.has(cue.id) ||
        typeof cue.start !== 'number' ||
        !Number.isFinite(cue.start) ||
        cue.start < 0 ||
        typeof cue.end !== 'number' ||
        !Number.isFinite(cue.end) ||
        cue.end <= cue.start ||
        cue.end * 1000 > duration ||
        typeof cue.text !== 'string' ||
        cue.text.length > VIDEO_EDIT_LIMITS.maxCaptionText ||
        CAPTION_CONTROL_CHARS.test(cue.text)
      ) {
        errors.push({ path, message: 'Expected a valid caption cue within the source duration.' });
        return;
      }
      ids.add(cue.id);
      captions.push({ id: cue.id, start: cue.start, end: cue.end, text: cue.text });
    });
  }
  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    edit: {
      version: 1,
      trim: { startMs: startMs as number, endMs: endMs as number },
      captions,
    },
  };
}

function formatVttTime(seconds: number): string {
  const totalMs = Math.max(0, Math.round(seconds * 1000));
  const hours = Math.floor(totalMs / 3_600_000);
  const minutes = Math.floor((totalMs % 3_600_000) / 60_000);
  const wholeSeconds = Math.floor((totalMs % 60_000) / 1000);
  const millis = totalMs % 1000;
  const pad = (value: number, width: number) => value.toString().padStart(width, '0');
  return `${pad(hours, 2)}:${pad(minutes, 2)}:${pad(wholeSeconds, 2)}.${pad(millis, 3)}`;
}

/** Serialize validated cues, clipping to an optional trim range and rebasing to zero. */
export function serializeWebVtt(cues: readonly CaptionCue[], trim?: VideoTrimRange): string {
  const start = (trim?.startMs ?? 0) / 1000;
  const end = (trim?.endMs ?? Number.POSITIVE_INFINITY) / 1000;
  const body = cues
    .filter((cue) => cue.end > start && cue.start < end && cue.text.trim() !== '')
    .map((cue) => {
      const cueStart = Math.max(start, cue.start) - start;
      const cueEnd = Math.min(end, cue.end) - start;
      const text = cue.text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return `${cue.id}\n${formatVttTime(cueStart)} --> ${formatVttTime(cueEnd)}\n${text}`;
    });
  return `WEBVTT\n\n${body.length > 0 ? `${body.join('\n\n')}\n` : ''}`;
}
