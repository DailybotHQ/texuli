import { sampleComposition } from '../animation/sample.ts';
import type { CompositionAnimation } from '../animation/types.ts';
import { validateAnimation } from '../animation/validate.ts';
import { canvasBackingSize } from '../composition-canvas/geometry.ts';
import type { CompositionImageLoader } from '../composition-canvas/images.ts';
import {
  defaultScratchFactory,
  drawComposition,
  loadCompositionImages,
} from '../composition-canvas/pipeline.ts';
import { asContext } from '../composition-canvas/scratch.ts';
import {
  type Composition,
  type CompositionIssue,
  validateComposition,
} from '../composition-model/index.ts';
import { sampleCompositionV2, validateAnimationV2 } from '../composition-v2/animation.ts';
import { compositionLeaves } from '../composition-v2/resolve.ts';
import { validateCompositionV2 } from '../composition-v2/validate.ts';
import { type CompositionProvenanceEntry, collectCompositionProvenance } from '../provenance.ts';
import type { VideoTrimRange } from '../video/edit.ts';
import { createExportCanvas, type ExportCanvas } from './canvas.ts';
import { exportFilename } from './filename.ts';
import {
  browserWebmFrameClock,
  pickWebmMimeType,
  type RecorderConstructor,
  type RecorderLike,
  WEBM_LIMITS,
  type WebmFrameClock,
  webmFrameTimes,
} from './webm-support.ts';

export interface ExportWebmOptions {
  /** URL policy tier for validation and image loading. Default `untrusted`. */
  trust?: 'developer' | 'untrusted';
  /** Frames per second, 1–60. Default 30. */
  fps?: number;
  /** Optional source interval to export, in milliseconds. Defaults to the full animation. */
  trim?: VideoTrimRange;
  /** Device pixel ratio for the video size; capped like the canvas renderer. Default 1. */
  pixelRatio?: number;
  background?: string;
  direction?: 'ltr' | 'rtl';
  fontFamily?: string;
  /** Download name; sanitized, and `.webm` is added. */
  filename?: string;
  document?: Document;
  loadImage?: CompositionImageLoader;
  signal?: AbortSignal;
  /** Called after each submitted frame with a monotonic fraction complete (0–1). */
  onProgress?: (done: number) => void;
  /** Canvas factory (tests). Default: a detached `<canvas>`. */
  createCanvas?: () => ExportCanvas | null;
  /** `MediaRecorder` (tests). Default: the global one. */
  Recorder?: RecorderConstructor;
  /** Monotonic frame clock (tests). Default: cancellable browser deadlines. */
  frameClock?: WebmFrameClock;
}

export type ExportWebmResult =
  | {
      ok: true;
      blob: Blob;
      filename: string;
      mimeType: string;
      width: number;
      height: number;
      frames: number;
      refusedSources: string[];
      failedSources: string[];
      provenance: CompositionProvenanceEntry[];
      sourceRange: VideoTrimRange;
    }
  | { ok: false; reason: 'invalid'; errors: readonly CompositionIssue[] }
  | { ok: false; reason: 'unsupported' | 'aborted' | 'recorder-failed' | 'tainted' };

/**
 * Records a composition animation as WebM in the browser. A composition v2
 * (groups, layer timing) is accepted too: each frame is its flat v1 snapshot
 * from `sampleCompositionV2`. Both documents are
 * validated (the animation against the composition); images load once
 * through the media URL policy. Each frame is sampled with
 * `sampleComposition` (reduced motion does not apply: the export is the
 * full animation), drawn with the canvas renderer, and captured from the
 * canvas by `MediaRecorder` on a drift-free, monotonic frame clock. Encoder
 * MIME type, bitrate and chunk interval are fixed; nothing leaves the page.
 */
export async function exportWebm(
  compositionInput: unknown,
  animationInput: unknown,
  options: ExportWebmOptions = {}
): Promise<ExportWebmResult> {
  const trust = options.trust === 'developer' ? 'developer' : 'untrusted';
  // Composition v2 (groups, layer timing) samples a flat v1 frame per instant;
  // its leaves, across every group and time, are what loads and is reported.
  const isV2 =
    typeof compositionInput === 'object' &&
    compositionInput !== null &&
    (compositionInput as { version?: unknown }).version === 2;
  let composition: Composition;
  let sampleFrame: (animation: CompositionAnimation, timeMs: number) => Composition;
  let animationCheck: ReturnType<typeof validateAnimation>;
  if (isV2) {
    const v2Check = validateCompositionV2(compositionInput, { trust });
    if (!v2Check.ok) return { ok: false, reason: 'invalid', errors: v2Check.errors };
    const v2 = v2Check.composition;
    composition = compositionLeaves(v2);
    animationCheck = validateAnimationV2(animationInput, v2);
    sampleFrame = (animation, timeMs) => sampleCompositionV2(v2, animation, timeMs);
  } else {
    const compositionCheck = validateComposition(compositionInput, { trust });
    if (!compositionCheck.ok)
      return { ok: false, reason: 'invalid', errors: compositionCheck.errors };
    const v1 = compositionCheck.composition;
    composition = v1;
    animationCheck = validateAnimation(animationInput, { composition: v1 });
    sampleFrame = (animation, timeMs) => sampleComposition(v1, animation, timeMs);
  }
  if (!animationCheck.ok) {
    return {
      ok: false,
      reason: 'invalid',
      errors: animationCheck.errors.map((error) => ({ ...error, path: `animation.${error.path}` })),
    };
  }
  const animation: CompositionAnimation = animationCheck.animation;
  const sourceRange = options.trim ?? { startMs: 0, endMs: animation.durationMs };
  if (
    !Number.isFinite(sourceRange.startMs) ||
    !Number.isFinite(sourceRange.endMs) ||
    sourceRange.startMs < 0 ||
    sourceRange.endMs > animation.durationMs ||
    sourceRange.startMs >= sourceRange.endMs
  ) {
    return {
      ok: false,
      reason: 'invalid',
      errors: [
        {
          path: 'trim',
          code: 'invalid-value',
          message: 'Expected a non-empty trim interval within the animation duration.',
        },
      ],
    };
  }

  const Recorder =
    options.Recorder ?? (globalThis as { MediaRecorder?: RecorderConstructor }).MediaRecorder;
  const mimeType = pickWebmMimeType(Recorder);
  const canvas = options.createCanvas
    ? options.createCanvas()
    : createExportCanvas(options.document);
  if (!Recorder || !mimeType || !canvas || typeof canvas.captureStream !== 'function') {
    return { ok: false, reason: 'unsupported' };
  }

  const loaded = await loadCompositionImages(composition, {
    trust,
    ...(options.loadImage ? { load: options.loadImage } : {}),
    ...(options.document ? { document: options.document } : {}),
    ...(options.signal ? { signal: options.signal } : {}),
  });
  if (options.signal?.aborted) return { ok: false, reason: 'aborted' };

  const size = canvasBackingSize(composition.width, composition.height, options.pixelRatio);
  canvas.width = size.width;
  canvas.height = size.height;
  const context = asContext(canvas.getContext('2d'));
  if (!context) return { ok: false, reason: 'unsupported' };

  const rawFps = options.fps ?? WEBM_LIMITS.defaultFps;
  const fps = Math.round(
    Math.min(
      WEBM_LIMITS.maxFps,
      Math.max(WEBM_LIMITS.minFps, Number.isFinite(rawFps) ? rawFps : 30)
    )
  );
  const times = webmFrameTimes(sourceRange.endMs - sourceRange.startMs, fps);
  const createScratch = defaultScratchFactory(options.document ?? canvas.ownerDocument);
  const draw = (timeMs: number) =>
    drawComposition(context, sampleFrame(animation, sourceRange.startMs + timeMs), {
      scale: size.scale,
      pixelWidth: size.width,
      pixelHeight: size.height,
      images: loaded.images,
      createScratch,
      ...(options.direction ? { direction: options.direction } : {}),
      ...(options.fontFamily ? { fontFamily: options.fontFamily } : {}),
      ...(options.background ? { background: options.background } : {}),
    });

  // Draw the first frame before capture starts, so the video never opens blank.
  draw(times[0] ?? 0);
  let stream: MediaStream;
  try {
    // `0`: frames are pushed with `requestFrame`, one per sampled time.
    stream = canvas.captureStream(0);
  } catch (error) {
    const name = (error as { name?: unknown } | null)?.name;
    return { ok: false, reason: name === 'SecurityError' ? 'tainted' : 'unsupported' };
  }
  const track = stream.getVideoTracks()[0] as
    | (MediaStreamTrack & { requestFrame?: () => void })
    | undefined;
  if (!track || typeof track.requestFrame !== 'function') {
    for (const item of stream.getTracks()) item.stop();
    return { ok: false, reason: 'unsupported' };
  }

  let recorder: RecorderLike;
  try {
    recorder = new Recorder(stream, {
      mimeType,
      videoBitsPerSecond: WEBM_LIMITS.videoBitsPerSecond,
    });
  } catch {
    for (const item of stream.getTracks()) item.stop();
    return { ok: false, reason: 'recorder-failed' };
  }

  const chunks: Blob[] = [];
  let failed = false;
  const frameAbort = new AbortController();
  const cancelFrameWait = () => frameAbort.abort();
  options.signal?.addEventListener('abort', cancelFrameWait, { once: true });
  if (options.signal?.aborted) cancelFrameWait();
  const stopped = new Promise<void>((resolve) => {
    recorder.onstop = () => resolve();
  });
  recorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) chunks.push(event.data);
  };
  recorder.onerror = () => {
    failed = true;
    cancelFrameWait();
  };
  const frameClock = options.frameClock ?? browserWebmFrameClock;
  let aborted = false;
  let started = false;

  try {
    recorder.start(WEBM_LIMITS.dataChunkMs);
    started = true;
    const startTime = frameClock.now();
    for (let i = 0; i < times.length; i += 1) {
      if (i > 0) {
        await frameClock.waitUntil(startTime + (times[i] as number), frameAbort.signal);
      }
      if (options.signal?.aborted || failed) {
        aborted = !failed;
        break;
      }
      if (i > 0) draw(times[i] as number);
      track.requestFrame();
      options.onProgress?.((i + 1) / times.length);
    }
  } catch {
    failed = true;
  } finally {
    options.signal?.removeEventListener('abort', cancelFrameWait);
    if (started) {
      try {
        recorder.stop();
        await stopped;
      } catch {
        failed = true;
      }
    }
    for (const item of stream.getTracks()) item.stop();
  }

  if (aborted) return { ok: false, reason: 'aborted' };
  if (failed || chunks.length === 0) return { ok: false, reason: 'recorder-failed' };
  const type = recorder.mimeType || mimeType;
  return {
    ok: true,
    blob: new Blob(chunks, { type: type.split(';')[0] ?? 'video/webm' }),
    filename: exportFilename(options.filename, 'webm'),
    mimeType: type,
    width: size.width,
    height: size.height,
    frames: times.length,
    refusedSources: loaded.refused,
    failedSources: loaded.failed,
    provenance: collectCompositionProvenance(composition.layers),
    sourceRange,
  };
}
