import { createExportCanvas } from './canvas.ts';

/*
 * The light half of WebM export: capability checks and frame times. It
 * imports no renderer, so the export barrel and the UI can ask whether WebM
 * is possible without loading the recorder.
 */

/** The stable encoder profile used by WebM exports. */
export const WEBM_EXPORT_MIME_TYPE = 'video/webm;codecs=vp8';

/** The parts of `MediaRecorder` the exporter uses (injectable for tests). */
export interface RecorderLike {
  readonly mimeType: string;
  ondataavailable: ((event: { data: Blob }) => void) | null;
  onstop: (() => void) | null;
  onerror: ((event: unknown) => void) | null;
  start(timeslice?: number): void;
  stop(): void;
}

export interface RecorderConstructor {
  new (
    stream: MediaStream,
    options: { mimeType: string; videoBitsPerSecond: number }
  ): RecorderLike;
  isTypeSupported?(type: string): boolean;
}

export const WEBM_LIMITS = Object.freeze({
  minFps: 1,
  maxFps: 60,
  defaultFps: 30,
  videoBitsPerSecond: 4_000_000,
  dataChunkMs: 1_000,
});

/** Whether the recorder supports the fixed VP8 WebM profile, or `null`. */
export function pickWebmMimeType(Recorder: RecorderConstructor | undefined): string | null {
  if (!Recorder) return null;
  if (typeof Recorder.isTypeSupported !== 'function') return WEBM_EXPORT_MIME_TYPE;
  return Recorder.isTypeSupported(WEBM_EXPORT_MIME_TYPE) ? WEBM_EXPORT_MIME_TYPE : null;
}

/** Whether this browser can capture a canvas with the fixed VP8 WebM profile. */
export function canExportWebm(documentRef?: Document): boolean {
  const Recorder = (globalThis as { MediaRecorder?: RecorderConstructor }).MediaRecorder;
  const canvas = createExportCanvas(documentRef);
  return pickWebmMimeType(Recorder) !== null && typeof canvas?.captureStream === 'function';
}

/** The sample times of every frame: 0, 1/fps, … and the last frame at the end. */
export function webmFrameTimes(durationMs: number, fps: number): number[] {
  const step = 1000 / fps;
  const count = Math.max(1, Math.ceil(durationMs / step));
  const times: number[] = [];
  for (let i = 0; i < count; i += 1) times.push(Math.min(durationMs, i * step));
  if ((times[times.length - 1] ?? 0) < durationMs) times.push(durationMs);
  return times;
}

/** An injectable monotonic frame clock used to keep capture deadlines drift-free. */
export interface WebmFrameClock {
  now(): number;
  /** Must resolve at the deadline or promptly when `signal` aborts. */
  waitUntil(deadlineMs: number, signal?: AbortSignal): Promise<void>;
}

/** The browser clock uses cancellable deadlines rather than cumulative sleeps. */
export const browserWebmFrameClock: WebmFrameClock = Object.freeze({
  now: () => (typeof performance === 'undefined' ? Date.now() : performance.now()),
  waitUntil: (deadlineMs: number, signal?: AbortSignal) =>
    new Promise<void>((resolve) => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const finish = () => {
        if (timer !== undefined) clearTimeout(timer);
        signal?.removeEventListener('abort', finish);
        resolve();
      };
      const schedule = () => {
        const now = typeof performance === 'undefined' ? Date.now() : performance.now();
        const remaining = deadlineMs - now;
        if (remaining <= 0 || signal?.aborted) {
          finish();
          return;
        }
        timer = setTimeout(schedule, remaining);
      };
      signal?.addEventListener('abort', finish, { once: true });
      schedule();
    }),
});
