import { safeImageSrc } from '@texuli/core/url-policy';
import type { Composition } from '../composition-model/index.ts';
import type { CompositionImage } from './draw.ts';

/** Loads one already-vetted image URL. Rejects (or resolves `null`) on failure. */
export type CompositionImageLoader = (
  src: string,
  signal: AbortSignal | undefined
) => Promise<CompositionImage | null>;

export interface LoadCompositionImagesOptions {
  /**
   * URL policy tier for every `src`, checked again here even though
   * `validateComposition` already checked it. Default `untrusted`.
   */
  trust?: 'developer' | 'untrusted';
  /** Custom loader (tests, workers). Default: an `<img>` from `document`. */
  load?: CompositionImageLoader;
  /** Document whose window creates the default `<img>` loader. */
  document?: Document;
  signal?: AbortSignal;
  /** Per-image timeout in milliseconds. Default 10 000. */
  timeoutMs?: number;
  /** Images already decoded, by `src` (reused, not reloaded). */
  cache?: ReadonlyMap<string, CompositionImage>;
}

export interface LoadedCompositionImages {
  images: Map<string, CompositionImage>;
  /** Sources the URL policy refused; their layers draw nothing. */
  refused: string[];
  /** Sources that failed to load, decode or finish in time. */
  failed: string[];
}

/**
 * The default loader: an `<img>` that sends no referrer and requests CORS
 * (`anonymous`), so a server that allows it keeps the canvas readable for
 * luminance masks and export. `decode()` settles once the image can be drawn,
 * and rejects on a network or format error.
 */
export function imageElementLoader(documentRef: Document): CompositionImageLoader {
  return async (src, signal) => {
    const view = documentRef.defaultView;
    if (!view || signal?.aborted) return null;
    const image = new view.Image();
    image.referrerPolicy = 'no-referrer';
    image.crossOrigin = 'anonymous';
    const stop = () => image.removeAttribute('src');
    signal?.addEventListener('abort', stop, { once: true });
    image.src = src;
    try {
      await image.decode();
    } finally {
      signal?.removeEventListener('abort', stop);
    }
    return { source: image, width: image.naturalWidth, height: image.naturalHeight };
  };
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('Image timed out.')), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Loads every distinct image `src` of a composition. Each source passes the
 * media URL policy again before any request is made; refused ones are listed,
 * never fetched. Never rejects: failures are reported per source.
 */
export async function loadCompositionImages(
  composition: Composition,
  options: LoadCompositionImagesOptions = {}
): Promise<LoadedCompositionImages> {
  const trust = options.trust === 'developer' ? 'developer' : 'untrusted';
  const timeoutMs =
    options.timeoutMs !== undefined && options.timeoutMs > 0 ? options.timeoutMs : 10_000;
  const result: LoadedCompositionImages = { images: new Map(), refused: [], failed: [] };
  const sources = new Set<string>();
  for (const layer of composition.layers) if (layer.type === 'image') sources.add(layer.src);

  const load =
    options.load ??
    (options.document
      ? imageElementLoader(options.document)
      : typeof document !== 'undefined'
        ? imageElementLoader(document)
        : undefined);

  await Promise.all(
    [...sources].map(async (src) => {
      if (safeImageSrc(src, trust) !== src) {
        result.refused.push(src);
        return;
      }
      const cached = options.cache?.get(src);
      if (cached) {
        result.images.set(src, cached);
        return;
      }
      if (!load || options.signal?.aborted) {
        result.failed.push(src);
        return;
      }
      try {
        const image = await withTimeout(load(src, options.signal), timeoutMs);
        if (image && image.width > 0 && image.height > 0) result.images.set(src, image);
        else result.failed.push(src);
      } catch {
        result.failed.push(src);
      }
    })
  );
  result.refused.sort();
  result.failed.sort();
  return result;
}
