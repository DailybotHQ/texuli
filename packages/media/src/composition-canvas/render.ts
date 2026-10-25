import {
  type Composition,
  type CompositionIssue,
  validateComposition,
} from '../composition-model/index.ts';
import type { CompositionImage, CompositionViewport, DrawReport, ScratchSurface } from './draw.ts';
import { canvasBackingSize } from './geometry.ts';
import type { CompositionImageLoader } from './images.ts';
import { asContext } from './scratch.ts';

// The canvas component loads this module lazily and validates through it, so
// the validator stays out of the component's first-load chunk.
export { validateComposition };

/** A canvas the renderer can size and draw on. */
export type CompositionCanvasTarget = Pick<HTMLCanvasElement, 'width' | 'height'> & {
  getContext(contextId: '2d'): unknown;
  ownerDocument?: Document;
};

export interface RenderCompositionOptions {
  /** URL policy tier for validation and image loading. Default `untrusted`. */
  trust?: 'developer' | 'untrusted';
  /** Device pixel ratio; capped so the backing store fits browser limits. Default 1. */
  pixelRatio?: number;
  viewport?: CompositionViewport;
  direction?: 'ltr' | 'rtl';
  fontFamily?: string;
  background?: string;
  loadImage?: CompositionImageLoader;
  /** Decoded images to reuse across renders, by `src`; new ones are added to it. */
  imageCache?: Map<string, CompositionImage>;
  timeoutMs?: number;
  signal?: AbortSignal;
  /** Offscreen surfaces for masks. Default: `OffscreenCanvas`, else a detached `<canvas>`. */
  createScratch?: (width: number, height: number) => ScratchSurface | null;
}

export type RenderCompositionResult =
  | {
      ok: true;
      composition: Composition;
      report: DrawReport;
      /** Device pixels per composition unit actually used. */
      scale: number;
      refusedSources: string[];
      failedSources: string[];
    }
  | { ok: false; reason: 'invalid'; errors: readonly CompositionIssue[] }
  | { ok: false; reason: 'unsupported' }
  | { ok: false; reason: 'aborted' };

/**
 * Validates `input`, sizes `canvas`, loads the images through the media URL
 * policy and paints the composition. Untrusted by default: nothing in `input`
 * is drawn, fetched or measured before `validateComposition` accepts it.
 * Never throws for content; the result says what happened.
 */
export async function renderComposition(
  canvas: CompositionCanvasTarget,
  input: unknown,
  options: RenderCompositionOptions = {}
): Promise<RenderCompositionResult> {
  const trust = options.trust === 'developer' ? 'developer' : 'untrusted';
  const validation = validateComposition(input, { trust });
  if (!validation.ok) return { ok: false, reason: 'invalid', errors: validation.errors };
  const composition = validation.composition;

  // The drawing half loads only once the data is accepted (and is shared with
  // `@texuli/media/composition-canvas/draw`).
  const { defaultScratchFactory, drawComposition, loadCompositionImages } = await import(
    './pipeline.ts'
  );
  if (options.signal?.aborted) return { ok: false, reason: 'aborted' };
  const loaded = await loadCompositionImages(composition, {
    trust,
    ...(options.loadImage ? { load: options.loadImage } : {}),
    ...(canvas.ownerDocument ? { document: canvas.ownerDocument } : {}),
    ...(options.signal ? { signal: options.signal } : {}),
    ...(options.timeoutMs !== undefined ? { timeoutMs: options.timeoutMs } : {}),
    ...(options.imageCache ? { cache: options.imageCache } : {}),
  });
  if (options.signal?.aborted) return { ok: false, reason: 'aborted' };
  for (const [src, image] of loaded.images) options.imageCache?.set(src, image);

  const size = canvasBackingSize(composition.width, composition.height, options.pixelRatio);
  if (canvas.width !== size.width) canvas.width = size.width;
  if (canvas.height !== size.height) canvas.height = size.height;
  const context = asContext(canvas.getContext('2d'));
  if (!context) return { ok: false, reason: 'unsupported' };

  const report = drawComposition(context, composition, {
    scale: size.scale,
    pixelWidth: size.width,
    pixelHeight: size.height,
    images: loaded.images,
    createScratch: options.createScratch ?? defaultScratchFactory(canvas.ownerDocument),
    ...(options.viewport ? { viewport: options.viewport } : {}),
    ...(options.direction ? { direction: options.direction } : {}),
    ...(options.fontFamily ? { fontFamily: options.fontFamily } : {}),
    ...(options.background ? { background: options.background } : {}),
  });
  return {
    ok: true,
    composition,
    report,
    scale: size.scale,
    refusedSources: loaded.refused,
    failedSources: loaded.failed,
  };
}
