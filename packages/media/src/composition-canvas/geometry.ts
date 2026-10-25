import type {
  CompositionFrame,
  CompositionLayer,
  CompositionTransform,
  LinearGradientPaint,
  RadialGradientPaint,
} from '../composition-model/index.ts';

/**
 * Pure geometry for the canvas renderer. Every function takes numbers in and
 * returns numbers out, so the SVG renderer, hit testing and tests can share
 * the same rules:
 *
 * - a layer's transform applies around the **center of its frame**;
 * - a linear gradient angle follows CSS (`0` points up, clockwise), with the
 *   gradient line long enough to reach the frame's corners;
 * - a radial gradient's `center` is normalized to the frame and its `radius`
 *   to the frame's normalized diagonal, `sqrt((w² + h²) / 2)`, as SVG does for
 *   `objectBoundingBox` lengths.
 */

/** A 2D affine matrix in canvas `setTransform(a, b, c, d, e, f)` order. */
export interface Matrix {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const IDENTITY: Matrix = Object.freeze({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });

/** `left · right`: apply `right` first, then `left`. */
export function multiply(left: Matrix, right: Matrix): Matrix {
  return {
    a: left.a * right.a + left.c * right.b,
    b: left.b * right.a + left.d * right.b,
    c: left.a * right.c + left.c * right.d,
    d: left.b * right.c + left.d * right.d,
    e: left.a * right.e + left.c * right.f + left.e,
    f: left.b * right.e + left.d * right.f + left.f,
  };
}

/** The layer's own transform, applied around its frame center. Identity when absent. */
export function layerMatrix(frame: CompositionFrame, transform?: CompositionTransform): Matrix {
  if (!transform) return IDENTITY;
  const cx = frame.x + frame.width / 2;
  const cy = frame.y + frame.height / 2;
  const radians = ((transform.rotateDeg ?? 0) * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const sx = transform.scaleX ?? 1;
  const sy = transform.scaleY ?? 1;
  const tx = transform.translateX ?? 0;
  const ty = transform.translateY ?? 0;
  // translate(cx + tx, cy + ty) · rotate · scale · translate(-cx, -cy)
  const a = cos * sx;
  const b = sin * sx;
  const c = -sin * sy;
  const d = cos * sy;
  return { a, b, c, d, e: cx + tx - (a * cx + c * cy), f: cy + ty - (b * cx + d * cy) };
}

export function applyMatrix(matrix: Matrix, x: number, y: number): { x: number; y: number } {
  return { x: matrix.a * x + matrix.c * y + matrix.e, y: matrix.b * x + matrix.d * y + matrix.f };
}

/** Axis-aligned bounds of a layer after its transform, grown by half its stroke. */
export function layerBounds(layer: CompositionLayer): Rect {
  const { frame } = layer;
  const stroked = layer.type === 'shape' && (layer.stroke !== undefined || layer.shape === 'line');
  const pad = stroked ? (layer.strokeWidth ?? 1) / 2 : 0;
  const matrix = layerMatrix(frame, layer.transform);
  const corners = [
    applyMatrix(matrix, frame.x - pad, frame.y - pad),
    applyMatrix(matrix, frame.x + frame.width + pad, frame.y - pad),
    applyMatrix(matrix, frame.x - pad, frame.y + frame.height + pad),
    applyMatrix(matrix, frame.x + frame.width + pad, frame.y + frame.height + pad),
  ];
  const xs = corners.map((point) => point.x);
  const ys = corners.map((point) => point.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

/** Whether two rectangles overlap (touching edges do not count). */
export function intersects(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

/** Start and end points of a CSS-style linear gradient over `frame`. */
export function linearGradientLine(
  frame: CompositionFrame,
  paint: Pick<LinearGradientPaint, 'angle'>
): { x0: number; y0: number; x1: number; y1: number } {
  const radians = (paint.angle * Math.PI) / 180;
  const dx = Math.sin(radians);
  const dy = -Math.cos(radians);
  const half = (Math.abs(frame.width * dx) + Math.abs(frame.height * dy)) / 2;
  const cx = frame.x + frame.width / 2;
  const cy = frame.y + frame.height / 2;
  return { x0: cx - dx * half, y0: cy - dy * half, x1: cx + dx * half, y1: cy + dy * half };
}

/** Center and radius in composition units for a radial gradient over `frame`. */
export function radialGradientCircle(
  frame: CompositionFrame,
  paint: Pick<RadialGradientPaint, 'center' | 'radius'>
): { x: number; y: number; r: number } {
  return {
    x: frame.x + paint.center.x * frame.width,
    y: frame.y + paint.center.y * frame.height,
    r: paint.radius * Math.sqrt((frame.width ** 2 + frame.height ** 2) / 2),
  };
}

/**
 * Where an image of `natural` size is drawn inside `frame`.
 * `fill` stretches, `contain` letterboxes, `cover` crops (the caller clips to
 * the frame). The default is `cover`, as for CSS `object-fit` in media cards.
 */
export function fitImage(
  frame: CompositionFrame,
  natural: { width: number; height: number },
  fit: 'contain' | 'cover' | 'fill' = 'cover'
): Rect {
  if (fit === 'fill' || natural.width <= 0 || natural.height <= 0) {
    return { x: frame.x, y: frame.y, width: frame.width, height: frame.height };
  }
  const scaleX = frame.width / natural.width;
  const scaleY = frame.height / natural.height;
  const scale = fit === 'contain' ? Math.min(scaleX, scaleY) : Math.max(scaleX, scaleY);
  const width = natural.width * scale;
  const height = natural.height * scale;
  return {
    x: frame.x + (frame.width - width) / 2,
    y: frame.y + (frame.height - height) / 2,
    width,
    height,
  };
}

/**
 * Browsers refuse or silently blank very large canvases (Safari caps the
 * area near 16.7 megapixels). The backing store is scaled down until it fits
 * both caps, so a large scene still renders, only less sharply.
 */
export const CANVAS_LIMITS = Object.freeze({ maxArea: 16_777_216, maxSide: 16_384 });

/** Backing-store size and the scale from composition units to device pixels. */
export function canvasBackingSize(
  width: number,
  height: number,
  pixelRatio = 1,
  limits: { maxArea: number; maxSide: number } = CANVAS_LIMITS
): { width: number; height: number; scale: number } {
  const ratio = Number.isFinite(pixelRatio) && pixelRatio > 0 ? Math.min(pixelRatio, 4) : 1;
  let scale = ratio;
  scale = Math.min(scale, limits.maxSide / width, limits.maxSide / height);
  scale = Math.min(scale, Math.sqrt(limits.maxArea / (width * height)));
  return {
    width: Math.max(1, Math.floor(width * scale)),
    height: Math.max(1, Math.floor(height * scale)),
    scale,
  };
}

/** User-perceived characters, so a break never splits an emoji or a combining mark. */
function graphemes(value: string): string[] {
  const Segmenter = (Intl as { Segmenter?: typeof Intl.Segmenter }).Segmenter;
  if (!Segmenter) return Array.from(value);
  return Array.from(
    new Segmenter(undefined, { granularity: 'grapheme' }).segment(value),
    (part) => part.segment
  );
}

/**
 * Breaks `text` into lines no wider than `maxWidth`, using `measure` for the
 * advance of a string. Spaces break first; a single word wider than the line
 * is broken between characters. Explicit newlines are kept. At most
 * `maxLines` lines are returned (the rest would be clipped by the frame).
 */
export function wrapText(
  text: string,
  maxWidth: number,
  measure: (value: string) => number,
  maxLines = Number.POSITIVE_INFINITY
): string[] {
  const lines: string[] = [];
  const push = (line: string) => {
    if (lines.length < maxLines) lines.push(line);
  };
  for (const paragraph of text.split(/\r\n|\r|\n/)) {
    if (lines.length >= maxLines) break;
    const words = paragraph.split(/ +/).filter((word, index) => word !== '' || index === 0);
    let line = '';
    for (const word of words) {
      const candidate = line === '' ? word : `${line} ${word}`;
      if (measure(candidate) <= maxWidth || candidate === '') {
        line = candidate;
        continue;
      }
      if (line !== '') push(line);
      line = '';
      if (measure(word) <= maxWidth) {
        line = word;
        continue;
      }
      for (const char of graphemes(word)) {
        if (line !== '' && measure(line + char) > maxWidth) {
          push(line);
          line = '';
        }
        line += char;
      }
    }
    push(line);
  }
  return lines;
}
