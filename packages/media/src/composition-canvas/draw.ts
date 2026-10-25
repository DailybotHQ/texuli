import type {
  Composition,
  CompositionLayer,
  CompositionPaint,
  ImageLayer,
  ShapeLayer,
  TextLayer,
} from '../composition-model/index.ts';
import {
  fitImage,
  IDENTITY,
  intersects,
  layerBounds,
  layerMatrix,
  linearGradientLine,
  type Matrix,
  multiply,
  type Rect,
  radialGradientCircle,
  wrapText,
} from './geometry.ts';

/**
 * The part of `CanvasRenderingContext2D` (and its `OffscreenCanvas` twin) the
 * renderer uses. Declaring it keeps the engine testable with a recording fake
 * and documents exactly which canvas features a composition relies on.
 */
export interface CompositionContext2D {
  globalAlpha: number;
  globalCompositeOperation: GlobalCompositeOperation;
  fillStyle: string | CanvasGradient | CanvasPattern;
  strokeStyle: string | CanvasGradient | CanvasPattern;
  lineWidth: number;
  font: string;
  textAlign: CanvasTextAlign;
  textBaseline: CanvasTextBaseline;
  direction: CanvasDirection;
  save(): void;
  restore(): void;
  setTransform(a: number, b: number, c: number, d: number, e: number, f: number): void;
  clearRect(x: number, y: number, width: number, height: number): void;
  fillRect(x: number, y: number, width: number, height: number): void;
  beginPath(): void;
  rect(x: number, y: number, width: number, height: number): void;
  ellipse(
    x: number,
    y: number,
    radiusX: number,
    radiusY: number,
    rotation: number,
    startAngle: number,
    endAngle: number
  ): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  fill(): void;
  stroke(): void;
  clip(): void;
  fillText(text: string, x: number, y: number): void;
  measureText(text: string): { width: number };
  drawImage(
    image: CanvasImageSource,
    dx: number,
    dy: number,
    dWidth?: number,
    dHeight?: number
  ): void;
  createLinearGradient(x0: number, y0: number, x1: number, y1: number): CanvasGradient;
  createRadialGradient(
    x0: number,
    y0: number,
    r0: number,
    x1: number,
    y1: number,
    r1: number
  ): CanvasGradient;
  getImageData(sx: number, sy: number, sw: number, sh: number): ImageData;
  putImageData(data: ImageData, dx: number, dy: number): void;
}

/** An offscreen surface the renderer composites masked layers on. */
export interface ScratchSurface {
  context: CompositionContext2D;
  /** Drawn onto the main context with `drawImage`. */
  image: CanvasImageSource;
}

/** A decoded image ready to draw, with its natural size. */
export interface CompositionImage {
  source: CanvasImageSource;
  width: number;
  height: number;
}

/** The part of the composition (in composition units) currently in view. */
export interface CompositionViewport {
  x: number;
  y: number;
  /** 1 shows the whole composition; 2 shows half of it, twice as large. */
  zoom: number;
}

export interface DrawCompositionOptions {
  /** Device pixels per composition unit (from {@link canvasBackingSize}). Default 1. */
  scale?: number;
  /** Backing-store size in device pixels. Default: composition size × `scale`. */
  pixelWidth?: number;
  pixelHeight?: number;
  /** Decoded images by `src`. A missing entry skips that layer with `image-unavailable`. */
  images?: ReadonlyMap<string, CompositionImage>;
  /**
   * Offscreen surfaces of the backing-store size, needed for masks. Without
   * it, masked layers are skipped with `mask-unsupported`.
   */
  createScratch?: (width: number, height: number) => ScratchSurface | null;
  /** Pan and zoom. Layers entirely outside the view are culled. */
  viewport?: CompositionViewport;
  /** Resolves `align: start | end` and shapes bidirectional text. Default `ltr`. */
  direction?: 'ltr' | 'rtl';
  /** CSS font family list for text layers. Default `system-ui, sans-serif`. */
  fontFamily?: string;
  /** Painted under every layer; transparent when omitted. */
  background?: string;
}

export type DrawSkipReason =
  | 'image-unavailable'
  | 'mask-unsupported'
  | 'mask-unavailable'
  | 'empty-paint';

export interface DrawReport {
  /** Layers painted, in paint order. */
  drawn: string[];
  /** Layers outside the viewport, not painted. */
  culled: string[];
  /** Layers used only as masks (a mask source is not painted on its own). */
  maskSources: string[];
  skipped: { layerId: string; reason: DrawSkipReason }[];
  /** Non-fatal downgrades, such as a luminance mask read as alpha. */
  warnings: { layerId: string; code: 'luminance-as-alpha' }[];
}

const DEFAULT_FONT_FAMILY = 'system-ui, sans-serif';
/** Line height of wrapped text, as a multiple of the font size. */
export const TEXT_LINE_HEIGHT = 1.25;

interface Env {
  composition: Composition;
  byId: ReadonlyMap<string, CompositionLayer>;
  base: Matrix;
  pixelWidth: number;
  pixelHeight: number;
  images: ReadonlyMap<string, CompositionImage>;
  createScratch: DrawCompositionOptions['createScratch'];
  direction: 'ltr' | 'rtl';
  fontFamily: string;
  report: DrawReport;
}

function setMatrix(context: CompositionContext2D, matrix: Matrix): void {
  context.setTransform(matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f);
}

function paintStyle(
  context: CompositionContext2D,
  paint: CompositionPaint,
  layer: CompositionLayer
): string | CanvasGradient {
  if (paint.kind === 'solid') return paint.color;
  const gradient =
    paint.kind === 'linear-gradient'
      ? (() => {
          const line = linearGradientLine(layer.frame, paint);
          return context.createLinearGradient(line.x0, line.y0, line.x1, line.y1);
        })()
      : (() => {
          const circle = radialGradientCircle(layer.frame, paint);
          return context.createRadialGradient(circle.x, circle.y, 0, circle.x, circle.y, circle.r);
        })();
  for (const stop of paint.stops) gradient.addColorStop(stop.offset, stop.color);
  return gradient;
}

function paintShape(context: CompositionContext2D, layer: ShapeLayer): boolean {
  const { x, y, width, height } = layer.frame;
  if (layer.shape === 'line') {
    // A line runs from the frame's top-start corner to its bottom-end corner
    // and is stroked with `stroke`, or with `fill` when it has no stroke.
    const paint = layer.stroke ?? layer.fill;
    const lineWidth = layer.strokeWidth ?? 1;
    if (!paint || lineWidth <= 0) return false;
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x + width, y + height);
    context.strokeStyle = paintStyle(context, paint, layer);
    context.lineWidth = lineWidth;
    context.stroke();
    return true;
  }
  context.beginPath();
  if (layer.shape === 'rectangle') context.rect(x, y, width, height);
  else context.ellipse(x + width / 2, y + height / 2, width / 2, height / 2, 0, 0, Math.PI * 2);
  let painted = false;
  if (layer.fill) {
    context.fillStyle = paintStyle(context, layer.fill, layer);
    context.fill();
    painted = true;
  }
  const lineWidth = layer.strokeWidth ?? 1;
  if (layer.stroke && lineWidth > 0) {
    context.strokeStyle = paintStyle(context, layer.stroke, layer);
    context.lineWidth = lineWidth;
    context.stroke();
    painted = true;
  }
  return painted;
}

function clipToFrame(context: CompositionContext2D, layer: CompositionLayer): void {
  const { x, y, width, height } = layer.frame;
  context.beginPath();
  context.rect(x, y, width, height);
  context.clip();
}

function paintText(context: CompositionContext2D, layer: TextLayer, env: Env): boolean {
  const { x, y, width, height } = layer.frame;
  clipToFrame(context, layer);
  context.font = `${layer.fontWeight ?? 400} ${layer.fontSize}px ${env.fontFamily}`;
  context.direction = env.direction;
  context.textBaseline = 'top';
  const align = layer.align ?? 'start';
  const physical =
    align === 'center'
      ? 'center'
      : (align === 'start') === (env.direction === 'ltr')
        ? 'left'
        : 'right';
  context.textAlign = physical;
  const anchorX = physical === 'left' ? x : physical === 'right' ? x + width : x + width / 2;
  const lineHeight = layer.fontSize * TEXT_LINE_HEIGHT;
  const maxLines = Math.max(1, Math.ceil(height / lineHeight));
  const lines = wrapText(layer.text, width, (value) => context.measureText(value).width, maxLines);
  context.fillStyle = paintStyle(context, layer.paint, layer);
  lines.forEach((line, index) => {
    if (line !== '') context.fillText(line, anchorX, y + index * lineHeight);
  });
  return true;
}

function paintImage(context: CompositionContext2D, layer: ImageLayer, env: Env): boolean {
  const image = env.images.get(layer.src);
  if (!image) return false;
  clipToFrame(context, layer);
  const target = fitImage(layer.frame, image, layer.fit);
  context.drawImage(image.source, target.x, target.y, target.width, target.height);
  return true;
}

/** Paints one layer's own content in composition units (no opacity, blend or mask). */
function paintContent(
  context: CompositionContext2D,
  layer: CompositionLayer,
  env: Env
): DrawSkipReason | null {
  context.save();
  setMatrix(context, multiply(env.base, layerMatrix(layer.frame, layer.transform)));
  try {
    if (layer.type === 'shape') return paintShape(context, layer) ? null : 'empty-paint';
    if (layer.type === 'text') return paintText(context, layer, env) ? null : 'empty-paint';
    return paintImage(context, layer, env) ? null : 'image-unavailable';
  } finally {
    context.restore();
  }
}

/** Rec. 709 luma of sRGB values becomes alpha, so white shows and black hides. */
function luminanceToAlpha(context: CompositionContext2D, width: number, height: number): void {
  const pixels = context.getImageData(0, 0, width, height);
  const data = pixels.data;
  for (let i = 0; i < data.length; i += 4) {
    const luma =
      (0.2126 * (data[i] as number) +
        0.7152 * (data[i + 1] as number) +
        0.0722 * (data[i + 2] as number)) /
      255;
    data[i] = 255;
    data[i + 1] = 255;
    data[i + 2] = 255;
    data[i + 3] = Math.round(luma * (data[i + 3] as number));
  }
  context.putImageData(pixels, 0, 0);
}

/**
 * Paints `layer` onto a fresh scratch surface and cuts it with its mask. The
 * mask source is painted (with its own mask, if any) on a second surface.
 * Returns the masked surface, or the reason it could not be made.
 */
function maskedSurface(
  layer: CompositionLayer,
  env: Env,
  depth: number
): ScratchSurface | DrawSkipReason {
  const mask = layer.mask;
  if (!mask) return 'mask-unsupported';
  const source = env.byId.get(mask.layerId);
  const content = env.createScratch?.(env.pixelWidth, env.pixelHeight) ?? null;
  const cutter = env.createScratch?.(env.pixelWidth, env.pixelHeight) ?? null;
  if (!content || !cutter || !source) return 'mask-unsupported';

  const contentResult = paintContent(content.context, layer, env);
  if (contentResult) return contentResult;
  const maskPainted = paintWithEffects(cutter.context, source, env, depth + 1, true);
  if (!maskPainted) return 'mask-unavailable';

  if (mask.mode === 'luminance') {
    try {
      luminanceToAlpha(cutter.context, env.pixelWidth, env.pixelHeight);
    } catch {
      // A cross-origin image without CORS taints the surface: reading its pixels
      // throws. The mask still works on its alpha channel.
      env.report.warnings.push({ layerId: layer.id, code: 'luminance-as-alpha' });
    }
  }
  content.context.save();
  setMatrix(content.context, IDENTITY);
  content.context.globalCompositeOperation = mask.invert ? 'destination-out' : 'destination-in';
  content.context.drawImage(cutter.image, 0, 0);
  content.context.restore();
  return content;
}

/**
 * Paints a layer with its opacity, blend mode and mask onto `context`.
 * Returns whether anything was painted. `quiet` paints without reporting (a
 * mask source painted into its cutter surface).
 */
function paintWithEffects(
  context: CompositionContext2D,
  layer: CompositionLayer,
  env: Env,
  depth: number,
  quiet = false
): boolean {
  context.save();
  try {
    context.globalAlpha = layer.opacity ?? 1;
    const blend = layer.blendMode ?? 'normal';
    // The other 15 blend modes are canvas operations of the same name.
    context.globalCompositeOperation = blend === 'normal' ? 'source-over' : blend;
    let failure: DrawSkipReason | null;
    if (layer.mask && depth <= env.composition.layers.length) {
      const surface = maskedSurface(layer, env, depth);
      if (typeof surface === 'string') failure = surface;
      else {
        setMatrix(context, IDENTITY);
        context.drawImage(surface.image, 0, 0);
        failure = null;
      }
    } else {
      failure = paintContent(context, layer, env);
    }
    if (failure) {
      if (!quiet) env.report.skipped.push({ layerId: layer.id, reason: failure });
      return false;
    }
    if (!quiet) env.report.drawn.push(layer.id);
    return true;
  } finally {
    context.restore();
  }
}

/** The view rectangle in composition units. */
export function viewportRect(composition: Composition, viewport?: CompositionViewport): Rect {
  const zoom = viewport && Number.isFinite(viewport.zoom) && viewport.zoom > 0 ? viewport.zoom : 1;
  return {
    x: viewport?.x ?? 0,
    y: viewport?.y ?? 0,
    width: composition.width / zoom,
    height: composition.height / zoom,
  };
}

/**
 * Paints a validated composition onto a 2D context, bottom layer first.
 *
 * The context's backing store is expected to be `composition × scale` device
 * pixels (see {@link canvasBackingSize}). The function never reads the DOM,
 * never loads anything, and never throws for content: what it cannot paint is
 * listed in the returned {@link DrawReport}.
 */
export function drawComposition(
  context: CompositionContext2D,
  composition: Composition,
  options: DrawCompositionOptions = {}
): DrawReport {
  const scale = options.scale && options.scale > 0 ? options.scale : 1;
  const pixelWidth = options.pixelWidth ?? Math.round(composition.width * scale);
  const pixelHeight = options.pixelHeight ?? Math.round(composition.height * scale);
  const view = viewportRect(composition, options.viewport);
  const zoom = composition.width / view.width;
  // device = scale · zoom · (unit − view origin)
  const base: Matrix = {
    a: scale * zoom,
    b: 0,
    c: 0,
    d: scale * zoom,
    e: -view.x * scale * zoom,
    f: -view.y * scale * zoom,
  };
  const report: DrawReport = { drawn: [], culled: [], maskSources: [], skipped: [], warnings: [] };
  const maskSourceIds = new Set(
    composition.layers.flatMap((layer) => (layer.mask ? [layer.mask.layerId] : []))
  );
  const env: Env = {
    composition,
    byId: new Map(composition.layers.map((layer) => [layer.id, layer])),
    base,
    pixelWidth,
    pixelHeight,
    images: options.images ?? new Map(),
    createScratch: options.createScratch,
    direction: options.direction === 'rtl' ? 'rtl' : 'ltr',
    fontFamily: options.fontFamily?.trim() || DEFAULT_FONT_FAMILY,
    report,
  };

  context.save();
  setMatrix(context, IDENTITY);
  context.globalAlpha = 1;
  context.globalCompositeOperation = 'source-over';
  context.clearRect(0, 0, pixelWidth, pixelHeight);
  if (options.background) {
    context.fillStyle = options.background;
    context.fillRect(0, 0, pixelWidth, pixelHeight);
  }
  context.restore();

  for (const layer of composition.layers) {
    if (maskSourceIds.has(layer.id)) {
      report.maskSources.push(layer.id);
      continue;
    }
    if (!intersects(layerBounds(layer), view)) {
      report.culled.push(layer.id);
      continue;
    }
    paintWithEffects(context, layer, env, 0);
  }
  return report;
}
