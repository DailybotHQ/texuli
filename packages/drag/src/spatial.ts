import { clamp, type Point, type Rect, rectFromPoints } from './geometry.ts';

// ---------------------------------------------------------------------------
// Pan and zoom

/** Canvas viewport: world point `w` paints at screen `w * zoom + {x, y}`. */
export interface ViewTransform {
  readonly x: number;
  readonly y: number;
  readonly zoom: number;
}

export interface ZoomLimits {
  readonly min?: number;
  readonly max?: number;
}

export const IDENTITY_VIEW: ViewTransform = /* @__PURE__ */ Object.freeze({ x: 0, y: 0, zoom: 1 });

export function screenToWorld(p: Point, view: ViewTransform): Point {
  return { x: (p.x - view.x) / view.zoom, y: (p.y - view.y) / view.zoom };
}

export function worldToScreen(p: Point, view: ViewTransform): Point {
  return { x: p.x * view.zoom + view.x, y: p.y * view.zoom + view.y };
}

/** A screen-space delta (pointer travel) in world units. */
export function screenDeltaToWorld(delta: Point, view: ViewTransform): Point {
  return { x: delta.x / view.zoom, y: delta.y / view.zoom };
}

export function worldRectToScreen(box: Rect, view: ViewTransform): Rect {
  return {
    x: box.x * view.zoom + view.x,
    y: box.y * view.zoom + view.y,
    width: box.width * view.zoom,
    height: box.height * view.zoom,
  };
}

export function panBy(view: ViewTransform, delta: Point): ViewTransform {
  return { x: view.x + delta.x, y: view.y + delta.y, zoom: view.zoom };
}

const limitZoom = (zoom: number, limits: ZoomLimits) =>
  clamp(Number.isFinite(zoom) ? zoom : 1, limits.min ?? 0.1, limits.max ?? 8);

/** Zooms by `factor` keeping the world point under `anchor` (screen) fixed. */
export function zoomAt(
  view: ViewTransform,
  anchor: Point,
  factor: number,
  limits: ZoomLimits = {}
): ViewTransform {
  const zoom = limitZoom(view.zoom * factor, limits);
  const world = screenToWorld(anchor, view);
  return { x: anchor.x - world.x * zoom, y: anchor.y - world.y * zoom, zoom };
}

/** The view that fits `content` (world) inside a `width × height` viewport. */
export function fitView(
  content: Rect,
  viewport: { readonly width: number; readonly height: number },
  padding = 24,
  limits: ZoomLimits = {}
): ViewTransform {
  const w = Math.max(1, viewport.width - padding * 2);
  const h = Math.max(1, viewport.height - padding * 2);
  const zoom = limitZoom(
    Math.min(w / Math.max(1, content.width), h / Math.max(1, content.height)),
    limits
  );
  return {
    x: viewport.width / 2 - (content.x + content.width / 2) * zoom,
    y: viewport.height / 2 - (content.y + content.height / 2) * zoom,
    zoom,
  };
}

// ---------------------------------------------------------------------------
// Free placement

export interface Placed {
  readonly id: string;
  readonly rect: Rect;
}

/**
 * Moves placed rects by a screen delta under the current zoom, keeping each
 * inside `bounds` when given (the group keeps its shape).
 */
export function moveFree(
  items: readonly Placed[],
  screenDelta: Point,
  view: ViewTransform = IDENTITY_VIEW,
  bounds?: Rect
): Placed[] {
  let { x: dx, y: dy } = screenDeltaToWorld(screenDelta, view);
  if (bounds && items.length > 0) {
    const group = boundsOf(items.map((item) => item.rect));
    dx = clamp(
      dx,
      bounds.x - group.x,
      Math.max(bounds.x - group.x, bounds.x + bounds.width - group.x - group.width)
    );
    dy = clamp(
      dy,
      bounds.y - group.y,
      Math.max(bounds.y - group.y, bounds.y + bounds.height - group.y - group.height)
    );
  }
  return items.map(({ id, rect }) => ({
    id,
    rect: { x: rect.x + dx, y: rect.y + dy, width: rect.width, height: rect.height },
  }));
}

/** The smallest rect holding every rect (an empty rect at 0,0 for none). */
export function boundsOf(rects: readonly Rect[]): Rect {
  if (rects.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const r of rects) {
    minX = Math.min(minX, r.x);
    minY = Math.min(minY, r.y);
    maxX = Math.max(maxX, r.x + r.width);
    maxY = Math.max(maxY, r.y + r.height);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

// ---------------------------------------------------------------------------
// Snapping and guides

export function snapValue(value: number, step: number): number {
  return step > 0 ? Math.round(value / step) * step : value;
}

export function snapPoint(p: Point, step: number | Point): Point {
  const sx = typeof step === 'number' ? step : step.x;
  const sy = typeof step === 'number' ? step : step.y;
  return { x: snapValue(p.x, sx), y: snapValue(p.y, sy) };
}

/** An alignment line: vertical guides have an `x`, horizontal guides a `y`. */
export interface Guide {
  readonly axis: 'x' | 'y';
  readonly position: number;
  /** The rect the moving rect aligned with. */
  readonly with: string;
}

export interface GuideSnap {
  /** Correction to add to the moving rect's position. */
  readonly offset: Point;
  readonly guides: readonly Guide[];
}

const edges = (r: Rect, axis: 'x' | 'y') =>
  axis === 'x'
    ? [r.x, r.x + r.width / 2, r.x + r.width]
    : [r.y, r.y + r.height / 2, r.y + r.height];

/**
 * Snaps a moving rect to the edges and centers of the others within
 * `threshold` (world units: divide screen px by zoom) and returns the guides.
 */
export function snapToGuides(
  moving: Rect,
  others: readonly Placed[],
  threshold: number
): GuideSnap {
  const result = { x: 0, y: 0 };
  const guides: Guide[] = [];
  for (const axis of ['x', 'y'] as const) {
    let best = threshold + Number.EPSILON;
    let found: { delta: number; position: number; with: string } | null = null;
    const mine = edges(moving, axis);
    for (const other of others) {
      for (const line of edges(other.rect, axis)) {
        for (const edge of mine) {
          const delta = line - edge;
          if (Math.abs(delta) < best) {
            best = Math.abs(delta);
            found = { delta, position: line, with: other.id };
          }
        }
      }
    }
    if (found) {
      result[axis] = found.delta;
      guides.push({ axis, position: found.position, with: found.with });
    }
  }
  return { offset: result, guides };
}

// ---------------------------------------------------------------------------
// Marquee

export type MarqueeMode = 'intersect' | 'contain';

/** Ids whose rect the marquee (two corners, same space as the rects) touches or contains. */
export function marqueeSelect(
  from: Point,
  to: Point,
  items: readonly Placed[],
  mode: MarqueeMode = 'intersect'
): string[] {
  const box = rectFromPoints(from, to);
  return items
    .filter(({ rect }) =>
      mode === 'contain'
        ? rect.x >= box.x &&
          rect.y >= box.y &&
          rect.x + rect.width <= box.x + box.width &&
          rect.y + rect.height <= box.y + box.height
        : rect.x <= box.x + box.width &&
          rect.x + rect.width >= box.x &&
          rect.y <= box.y + box.height &&
          rect.y + rect.height >= box.y
    )
    .map(({ id }) => id);
}

// ---------------------------------------------------------------------------
// Resize

/** The edge or corner being dragged. */
export type ResizeHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

export interface ResizeLimits {
  readonly minWidth?: number;
  readonly minHeight?: number;
  readonly maxWidth?: number;
  readonly maxHeight?: number;
  /** The rect never leaves these bounds. */
  readonly bounds?: Rect;
  /** Keep width / height (corner handles). */
  readonly keepAspect?: boolean;
  /** Snap the moving edges to this grid. */
  readonly grid?: number;
}

/** Resizes `start` by a world delta from one handle; the opposite edges stay put. */
export function resizeRect(
  start: Rect,
  handle: ResizeHandle,
  delta: Point,
  limits: ResizeLimits = {}
): Rect {
  const minW = Math.max(0, limits.minWidth ?? 1);
  const minH = Math.max(0, limits.minHeight ?? 1);
  const maxW = limits.maxWidth ?? Number.POSITIVE_INFINITY;
  const maxH = limits.maxHeight ?? Number.POSITIVE_INFINITY;
  let left = start.x;
  let top = start.y;
  let right = start.x + start.width;
  let bottom = start.y + start.height;
  const step = limits.grid ?? 0;
  if (handle.includes('w')) left = snapValue(left + delta.x, step);
  if (handle.includes('e')) right = snapValue(right + delta.x, step);
  if (handle.includes('n')) top = snapValue(top + delta.y, step);
  if (handle.includes('s')) bottom = snapValue(bottom + delta.y, step);
  const b = limits.bounds;
  if (b) {
    left = Math.max(left, b.x);
    top = Math.max(top, b.y);
    right = Math.min(right, b.x + b.width);
    bottom = Math.min(bottom, b.y + b.height);
  }
  let width = clamp(right - left, minW, maxW);
  let height = clamp(bottom - top, minH, maxH);
  if (limits.keepAspect && handle.length === 2 && start.height > 0) {
    const ratio = start.width / start.height;
    if (width / ratio > height) height = clamp(width / ratio, minH, maxH);
    else width = clamp(height * ratio, minW, maxW);
  }
  const x = handle.includes('w') ? start.x + start.width - width : start.x;
  const y = handle.includes('n') ? start.y + start.height - height : start.y;
  if (b) {
    // Keep-aspect growth may push past the bounds again: shrink back in.
    width = Math.min(width, handle.includes('w') ? start.x + start.width - b.x : b.x + b.width - x);
    height = Math.min(
      height,
      handle.includes('n') ? start.y + start.height - b.y : b.y + b.height - y
    );
    return {
      x: handle.includes('w') ? start.x + start.width - width : x,
      y: handle.includes('n') ? start.y + start.height - height : y,
      width,
      height,
    };
  }
  return { x, y, width, height };
}
