/** Shared geometry for every drag subpath: plain numbers, no DOM. */

/** A point in client (screen) or world coordinates; the caller decides which. */
export interface Point {
  readonly x: number;
  readonly y: number;
}

/** An axis-aligned box. `x`/`y` are the top-left corner (physical, not logical). */
export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Text direction, supplied by the caller (the engine never reads the DOM). */
export type TextDirection = 'ltr' | 'rtl';

/** List flow. `grid` wraps along the inline axis, then the block axis. */
export type Orientation = 'vertical' | 'horizontal' | 'grid';

export const ORIGIN: Point = /* @__PURE__ */ Object.freeze({ x: 0, y: 0 });

export function point(x: number, y: number): Point {
  return { x, y };
}

export function rect(x: number, y: number, width: number, height: number): Rect {
  return { x, y, width, height };
}

export function rectCenter(box: Rect): Point {
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** True when `p` lies inside `box`, edges included. */
export function rectContains(box: Rect, p: Point): boolean {
  return p.x >= box.x && p.x <= box.x + box.width && p.y >= box.y && p.y <= box.y + box.height;
}

export function rectArea(box: Rect): number {
  return Math.max(0, box.width) * Math.max(0, box.height);
}

/** Overlap area of two boxes (0 when apart). */
export function intersectionArea(a: Rect, b: Rect): number {
  const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

export function translateRect(box: Rect, delta: Point): Rect {
  return { x: box.x + delta.x, y: box.y + delta.y, width: box.width, height: box.height };
}

/** The normalized box spanning two corners (marquee from any drag direction). */
export function rectFromPoints(a: Point, b: Point): Rect {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(b.x - a.x),
    height: Math.abs(b.y - a.y),
  };
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function clamp(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), high);
}

/** True when every coordinate is a finite number (hostile input guard). */
export function isFinitePoint(p: Point): boolean {
  return Number.isFinite(p.x) && Number.isFinite(p.y);
}
