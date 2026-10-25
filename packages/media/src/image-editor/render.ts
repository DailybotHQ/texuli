import type { HrefTrust } from '@texuli/core/url-policy';
import { safeImageSrc } from '@texuli/core/url-policy';
import { imageElementLoader } from '../composition-canvas/images.ts';
import {
  applyColorMatrix,
  boxBlur,
  cropPixels,
  cssFilter,
  filterColorMatrix,
  orientedSize,
  outputSize,
} from './model.ts';
import type { Annotation, ImageEdit, SourceSize } from './types.ts';

/** A decoded image the editor can draw. */
export interface EditableImage {
  source: CanvasImageSource;
  width: number;
  height: number;
}

/** Loads one already-vetted URL. Return `null` (or throw) when it cannot be decoded. */
export type EditImageLoader = (src: string, signal?: AbortSignal) => Promise<EditableImage | null>;

export interface LoadEditableImageOptions {
  /** `untrusted` (default) allows HTTPS and relative paths; `developer` adds HTTP, blob and bounded data images. */
  trust?: HrefTrust;
  /** The document whose `Image` loads the source (default loader). */
  document?: Document;
  loader?: EditImageLoader;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export type LoadEditableImageResult =
  | { ok: true; image: EditableImage; src: string }
  | { ok: false; reason: 'blocked' | 'error' | 'aborted' };

/**
 * Vets `src` with the media URL policy, then loads it. A refused source is
 * never requested. The default loader sends no referrer and asks for CORS
 * (`anonymous`), so an export can read the pixels when the server allows it.
 * Never rejects.
 */
export async function loadEditableImage(
  src: unknown,
  options: LoadEditableImageOptions = {}
): Promise<LoadEditableImageResult> {
  const safe = safeImageSrc(src, options.trust ?? 'untrusted');
  if (!safe) return { ok: false, reason: 'blocked' };
  const loader =
    options.loader ?? (options.document ? imageElementLoader(options.document) : undefined);
  if (!loader) return { ok: false, reason: 'error' };
  if (options.signal?.aborted) return { ok: false, reason: 'aborted' };
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const image = await Promise.race([
      loader(safe, options.signal),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), options.timeoutMs ?? 10_000);
      }),
    ]);
    if (options.signal?.aborted) return { ok: false, reason: 'aborted' };
    if (!image || !(image.width > 0) || !(image.height > 0)) return { ok: false, reason: 'error' };
    return { ok: true, image, src: safe };
  } catch {
    return { ok: false, reason: options.signal?.aborted ? 'aborted' : 'error' };
  } finally {
    clearTimeout(timer);
  }
}

/** The 2D context surface the editor draws with (a real context, or a test double). */
export type EditDrawContext = Pick<
  CanvasRenderingContext2D,
  | 'save'
  | 'restore'
  | 'setTransform'
  | 'translate'
  | 'scale'
  | 'rotate'
  | 'drawImage'
  | 'clearRect'
  | 'beginPath'
  | 'moveTo'
  | 'lineTo'
  | 'ellipse'
  | 'rect'
  | 'stroke'
  | 'fillText'
  | 'strokeText'
  | 'getImageData'
  | 'putImageData'
> & {
  filter?: string;
  lineWidth: number;
  lineJoin: CanvasLineJoin;
  lineCap: CanvasLineCap;
  strokeStyle: CanvasRenderingContext2D['strokeStyle'];
  fillStyle: CanvasRenderingContext2D['fillStyle'];
  font: string;
  textBaseline: CanvasTextBaseline;
  textAlign: CanvasTextAlign;
  direction?: CanvasDirection;
};

/** Whether the context honors `ctx.filter` (some engines ignore it). */
export function supportsCanvasFilter(context: EditDrawContext): boolean {
  if (!('filter' in context)) return false;
  const previous = context.filter;
  context.filter = 'blur(1px)';
  const supported = context.filter === 'blur(1px)';
  context.filter = previous ?? 'none';
  return supported;
}

export interface DrawImageEditOptions {
  /** Target size in pixels; defaults to the edit's output size. */
  width?: number;
  height?: number;
  /** `apply` (default) draws the crop; `ignore` draws the whole oriented image (crop preview). */
  crop?: 'apply' | 'ignore';
  /** Draw the annotations (default `true`). */
  annotations?: boolean;
  /** `auto` (default) uses `ctx.filter` when the engine supports it, else pixel math. */
  filterMode?: 'auto' | 'canvas' | 'pixels';
  /** Annotation text font family (default `system-ui, sans-serif`). */
  fontFamily?: string;
  /** Text direction for annotation text (default `ltr`). */
  dir?: 'ltr' | 'rtl';
}

export interface DrawImageEditReport {
  width: number;
  height: number;
  /** How the filters were applied: `none` (neutral), `canvas`, `pixels`, or `unavailable` (pixels unreadable). */
  filters: 'none' | 'canvas' | 'pixels' | 'unavailable';
}

/**
 * Paints `image` with `edit` applied on a context already sized to the target.
 * No DOM access and no network: the image is already decoded. The source is
 * never changed; every call starts from it.
 */
export function drawImageEdit(
  context: EditDrawContext,
  image: EditableImage,
  edit: ImageEdit,
  options: DrawImageEditOptions = {}
): DrawImageEditReport {
  const source: SourceSize = { width: image.width, height: image.height };
  const oriented = orientedSize(source, edit.rotate);
  const ignoreCrop = options.crop === 'ignore';
  const crop = ignoreCrop
    ? { x: 0, y: 0, width: oriented.width, height: oriented.height }
    : cropPixels(edit, source);
  const natural = ignoreCrop ? oriented : outputSize(edit, source);
  const width = Math.max(1, Math.round(options.width ?? natural.width));
  const height = Math.max(1, Math.round(options.height ?? natural.height));
  const shortSide = Math.min(width, height);
  const neutralFilters = cssFilter(edit.filters, shortSide) === 'none';
  const mode = options.filterMode ?? 'auto';
  const useCanvasFilter =
    !neutralFilters && mode !== 'pixels' && (mode === 'canvas' || supportsCanvasFilter(context));

  context.save();
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, width, height);
  if (useCanvasFilter) context.filter = cssFilter(edit.filters, shortSide);
  // Output ← crop window of the oriented image ← flips ← quarter turns ← source.
  context.scale(width / crop.width, height / crop.height);
  context.translate(-crop.x, -crop.y);
  context.translate(oriented.width / 2, oriented.height / 2);
  context.scale(edit.flipX ? -1 : 1, edit.flipY ? -1 : 1);
  context.rotate((edit.rotate * Math.PI) / 180);
  context.drawImage(
    image.source,
    -source.width / 2,
    -source.height / 2,
    source.width,
    source.height
  );
  context.restore();

  let filters: DrawImageEditReport['filters'] = neutralFilters ? 'none' : 'canvas';
  if (!neutralFilters && !useCanvasFilter) {
    try {
      const pixels = context.getImageData(0, 0, width, height);
      applyColorMatrix(pixels.data, filterColorMatrix(edit.filters));
      boxBlur(pixels.data, width, height, edit.filters.blur * shortSide);
      context.putImageData(pixels, 0, 0);
      filters = 'pixels';
    } catch {
      // A cross-origin image without CORS cannot be read; it stays unfiltered.
      filters = 'unavailable';
    }
  }

  if (options.annotations !== false) {
    for (const annotation of edit.annotations) {
      drawAnnotation(context, annotation, width, height, options);
    }
  }
  return { width, height, filters };
}

/** Black or white, whichever reads better around a hex color. */
export function haloFor(hex: string): '#000000' | '#ffffff' {
  const channel = (offset: number) => {
    const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
  return luminance > 0.4 ? '#000000' : '#ffffff';
}

function drawAnnotation(
  context: EditDrawContext,
  annotation: Annotation,
  width: number,
  height: number,
  options: DrawImageEditOptions
): void {
  const shortSide = Math.min(width, height);
  const lineWidth = Math.max(1, annotation.strokeWidth * shortSide);
  context.save();
  context.setTransform(1, 0, 0, 1, 0, 0);
  if ('filter' in context) context.filter = 'none';
  context.lineWidth = lineWidth;
  context.lineJoin = 'round';
  context.lineCap = 'round';
  context.strokeStyle = annotation.color;
  context.fillStyle = annotation.color;
  switch (annotation.type) {
    case 'rect': {
      const f = annotation.frame;
      context.beginPath();
      context.rect(f.x * width, f.y * height, f.width * width, f.height * height);
      context.stroke();
      break;
    }
    case 'ellipse': {
      const f = annotation.frame;
      context.beginPath();
      context.ellipse(
        (f.x + f.width / 2) * width,
        (f.y + f.height / 2) * height,
        (f.width / 2) * width,
        (f.height / 2) * height,
        0,
        0,
        Math.PI * 2
      );
      context.stroke();
      break;
    }
    case 'arrow': {
      const x1 = annotation.from.x * width;
      const y1 = annotation.from.y * height;
      const x2 = annotation.to.x * width;
      const y2 = annotation.to.y * height;
      const angle = Math.atan2(y2 - y1, x2 - x1);
      const head = Math.max(lineWidth * 4, shortSide * 0.03);
      context.beginPath();
      context.moveTo(x1, y1);
      context.lineTo(x2, y2);
      for (const side of [-1, 1]) {
        context.moveTo(x2, y2);
        context.lineTo(
          x2 - head * Math.cos(angle + (side * Math.PI) / 7),
          y2 - head * Math.sin(angle + (side * Math.PI) / 7)
        );
      }
      context.stroke();
      break;
    }
    case 'text': {
      const size = Math.max(4, annotation.fontSize * height);
      context.font = `600 ${size}px ${options.fontFamily ?? 'system-ui, sans-serif'}`;
      context.textBaseline = 'top';
      context.textAlign = 'start';
      if ('direction' in context) context.direction = options.dir ?? 'ltr';
      const x = annotation.at.x * width;
      const y = annotation.at.y * height;
      // A thin halo in the opposite tone keeps the text legible on any photo.
      context.lineWidth = Math.max(1, size / 8);
      context.strokeStyle = haloFor(annotation.color);
      context.strokeText(annotation.text, x, y);
      context.fillText(annotation.text, x, y);
      break;
    }
  }
  context.restore();
}

/** Formats an export can produce. */
export const EXPORT_TYPES = Object.freeze(['image/png', 'image/jpeg', 'image/webp'] as const);
export type ExportType = (typeof EXPORT_TYPES)[number];

/** A canvas an export draws on (an `HTMLCanvasElement` or `OffscreenCanvas`). */
export interface ExportCanvas {
  width: number;
  height: number;
  getContext(type: '2d'): EditDrawContext | null;
}

export interface ExportImageEditOptions {
  type?: ExportType;
  /** JPEG and WebP quality, 0–1 (default 0.92). */
  quality?: number;
  /** Makes the canvas to draw on; the default uses `document` or `OffscreenCanvas`. */
  createCanvas?: (width: number, height: number) => ExportCanvas;
  /** Turns the drawn canvas into a Blob; the default uses `toBlob` or `convertToBlob`. */
  toBlob?: (canvas: ExportCanvas, type: ExportType, quality: number) => Promise<Blob | null>;
  fontFamily?: string;
  dir?: 'ltr' | 'rtl';
  filterMode?: DrawImageEditOptions['filterMode'];
}

export type ExportImageEditResult =
  | { ok: true; blob: Blob; width: number; height: number; type: ExportType; edit: ImageEdit }
  | { ok: false; reason: 'tainted' | 'unsupported' };

function defaultCanvas(width: number, height: number): ExportCanvas {
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(width, height) as unknown as ExportCanvas;
  }
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas as unknown as ExportCanvas;
  }
  throw new Error('No canvas is available.');
}

function defaultToBlob(
  canvas: ExportCanvas,
  type: ExportType,
  quality: number
): Promise<Blob | null> {
  const c = canvas as unknown as Partial<HTMLCanvasElement & OffscreenCanvas>;
  if (typeof c.convertToBlob === 'function') return c.convertToBlob({ type, quality });
  if (typeof c.toBlob === 'function') {
    return new Promise((resolve, reject) => {
      try {
        c.toBlob?.((blob) => resolve(blob), type, quality);
      } catch (error) {
        reject(error);
      }
    });
  }
  return Promise.resolve(null);
}

/**
 * Renders the edit at its output size and encodes it. The source is untouched
 * and the edit is returned with the image, so the result can be re-edited.
 * Never rejects: a cross-origin image without CORS gives `tainted`, and an
 * engine that cannot encode gives `unsupported`.
 */
export async function exportImageEdit(
  image: EditableImage,
  edit: ImageEdit,
  options: ExportImageEditOptions = {}
): Promise<ExportImageEditResult> {
  const type = EXPORT_TYPES.includes(options.type as ExportType)
    ? (options.type as ExportType)
    : 'image/png';
  const quality = Math.min(1, Math.max(0, options.quality ?? 0.92));
  const size = outputSize(edit, { width: image.width, height: image.height });
  let canvas: ExportCanvas;
  try {
    canvas = (options.createCanvas ?? defaultCanvas)(size.width, size.height);
  } catch {
    return { ok: false, reason: 'unsupported' };
  }
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext('2d');
  if (!context) return { ok: false, reason: 'unsupported' };
  drawImageEdit(context, image, edit, {
    width: size.width,
    height: size.height,
    ...(options.fontFamily ? { fontFamily: options.fontFamily } : {}),
    ...(options.dir ? { dir: options.dir } : {}),
    ...(options.filterMode ? { filterMode: options.filterMode } : {}),
  });
  try {
    const blob = await (options.toBlob ?? defaultToBlob)(canvas, type, quality);
    if (!blob) return { ok: false, reason: 'unsupported' };
    return { ok: true, blob, width: size.width, height: size.height, type, edit };
  } catch (error) {
    const name = (error as { name?: string } | null)?.name;
    return { ok: false, reason: name === 'SecurityError' ? 'tainted' : 'unsupported' };
  }
}
