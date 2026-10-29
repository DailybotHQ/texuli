/**
 * Paint geometry shared by the Svelte view and the SVG export, so both draw
 * the same thing: each shape's outline as an SVG primitive, its text lines
 * and where they sit, and the palette as `--tx-*` token references (the
 * view) or fixed colors (standalone exports).
 */
import { FONT_SIZE_UNITS } from './limits.ts';
import type { BoxedShape, CanvasColor, CanvasDash, CanvasPaint, CanvasShape } from './types.ts';

const tenth = (value: number) => Math.round(value * 10) / 10;

export type ShapeOutline =
  | { kind: 'rect'; x: number; y: number; width: number; height: number; rx: number }
  | { kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number }
  | { kind: 'path'; d: string; closed: boolean }
  | { kind: 'none' };

/** The outline of a boxed shape in world units (rotation is applied by the caller). */
export function shapeOutline(shape: BoxedShape): ShapeOutline {
  const { x, y, width, height } = shape;
  switch (shape.type) {
    case 'rect':
      return {
        kind: 'rect',
        x,
        y,
        width,
        height,
        rx: Math.min(shape.radius ?? 0, width / 2, height / 2),
      };
    case 'sticky':
    case 'frame':
      return { kind: 'rect', x, y, width, height, rx: shape.type === 'sticky' ? 4 : 8 };
    case 'ellipse':
      return {
        kind: 'ellipse',
        cx: x + width / 2,
        cy: y + height / 2,
        rx: width / 2,
        ry: height / 2,
      };
    case 'diamond':
      return {
        kind: 'path',
        d: `M${tenth(x + width / 2)} ${tenth(y)}L${tenth(x + width)} ${tenth(y + height / 2)}L${tenth(x + width / 2)} ${tenth(y + height)}L${tenth(x)} ${tenth(y + height / 2)}Z`,
        closed: true,
      };
    case 'line':
    case 'arrow':
    case 'path': {
      const closed = shape.type === 'path' && shape.closed === true;
      const d = shape.points
        .map(([px, py], i) => `${i === 0 ? 'M' : 'L'}${tenth(x + px)} ${tenth(y + py)}`)
        .join('');
      return {
        kind: 'path',
        d: shape.points.length === 1 ? `${d}l0.1 0` : `${d}${closed ? 'Z' : ''}`,
        closed,
      };
    }
    default:
      return { kind: 'none' };
  }
}

/** SVG `transform` for a rotated shape (around its box center), or `undefined`. */
export function shapeTransform(shape: CanvasShape): string | undefined {
  if (shape.type === 'group' || !shape.rotation) return undefined;
  const cx = tenth(shape.x + shape.width / 2);
  const cy = tenth(shape.y + shape.height / 2);
  return `rotate(${tenth(shape.rotation)} ${cx} ${cy})`;
}

export interface TextLayout {
  lines: string[];
  /** Font size in world units. */
  size: number;
  /** The first baseline and the line step. */
  x: number;
  y: number;
  step: number;
  anchor: 'start' | 'middle' | 'end';
}

/** Lines of a shape's text and where they sit (centered in shapes, from the top in text and stickies). */
export function textLayout(
  shape: BoxedShape,
  text: string,
  dir: 'ltr' | 'rtl' = 'ltr'
): TextLayout {
  const size =
    shape.type === 'text'
      ? FONT_SIZE_UNITS[shape.fontSize ?? 'm']
      : shape.type === 'frame'
        ? 14
        : 16;
  const lines = text.split(/\r\n|\r|\n/).slice(0, 200);
  const step = Math.round(size * 1.3);
  const align = shape.type === 'text' ? (shape.align ?? 'start') : 'center';
  const start = dir === 'rtl' ? shape.x + shape.width - 8 : shape.x + 8;
  const end = dir === 'rtl' ? shape.x + 8 : shape.x + shape.width - 8;
  const x = align === 'center' ? shape.x + shape.width / 2 : align === 'start' ? start : end;
  const anchor: TextLayout['anchor'] =
    align === 'center' ? 'middle' : (align === 'start') === (dir === 'ltr') ? 'start' : 'end';
  let y: number;
  if (shape.type === 'frame') y = shape.y - 8;
  else if (shape.type === 'text' || shape.type === 'sticky') y = shape.y + 8 + size;
  else y = shape.y + shape.height / 2 - ((lines.length - 1) * step) / 2 + size * 0.35;
  return { lines, size, x: tenth(x), y: tenth(y), step, anchor };
}

/** The token each palette name paints with (the view: themes, dark mode and forced colors follow). */
export const PALETTE_TOKENS: Readonly<Record<CanvasColor, string>> = Object.freeze({
  default: 'var(--tx-foreground, CanvasText)',
  gray: 'var(--tx-muted-foreground, GrayText)',
  red: 'var(--tx-destructive, CanvasText)',
  orange: 'var(--tx-warning, CanvasText)',
  yellow: 'var(--tx-chart-4, CanvasText)',
  green: 'var(--tx-success, CanvasText)',
  teal: 'var(--tx-chart-2, CanvasText)',
  blue: 'var(--tx-info, CanvasText)',
  purple: 'var(--tx-chart-5, CanvasText)',
  pink: 'var(--tx-chart-6, CanvasText)',
});

/** Fixed colors for standalone exports (SVG and PNG files carry no theme). */
export const EXPORT_PALETTE: Readonly<Record<CanvasColor, string>> = Object.freeze({
  default: '#1f2328',
  gray: '#6e7781',
  red: '#cf222e',
  orange: '#bc4c00',
  yellow: '#9a6700',
  green: '#1a7f37',
  teal: '#0f766e',
  blue: '#0969da',
  purple: '#8250df',
  pink: '#bf3989',
});

export interface ResolvedPaint {
  fill: CanvasColor | 'none';
  stroke: CanvasColor | 'none';
  strokeWidth: number;
  dash: CanvasDash;
  opacity: number;
}

/** A shape's paint with defaults: outlines in `default`, no fill, 2 units wide, solid. */
export function resolvePaint(
  shape: CanvasShape | { paint?: CanvasPaint },
  type?: string
): ResolvedPaint {
  const style = ('paint' in shape ? shape.paint : undefined) ?? {};
  const kind = type ?? ('type' in shape ? shape.type : 'connector');
  return {
    fill:
      style.fill ??
      (kind === 'sticky' ? ((shape as { color?: CanvasColor }).color ?? 'yellow') : 'none'),
    stroke:
      style.stroke ??
      (kind === 'text' || kind === 'image' || kind === 'sticky' ? 'none' : 'default'),
    strokeWidth: style.strokeWidth ?? 2,
    dash: style.dash ?? 'solid',
    opacity: style.opacity ?? 1,
  };
}

/** The SVG dash array for a dash style at a stroke width. */
export function dashArray(dash: CanvasDash, width: number): string | undefined {
  if (dash === 'dashed') return `${tenth(width * 4)} ${tenth(width * 3)}`;
  if (dash === 'dotted') return `${tenth(width)} ${tenth(width * 2)}`;
  return undefined;
}

/** The text a shape paints (a frame's title, a shape's text); images paint none. */
export function paintedText(shape: CanvasShape): string {
  if (shape.type === 'frame') return shape.title ?? '';
  if ('text' in shape && typeof shape.text === 'string') return shape.text;
  return '';
}
