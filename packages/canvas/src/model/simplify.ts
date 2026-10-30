/**
 * Freehand input to a bounded stroke. Work is linear in the raw input: a
 * radial-distance pass, an even thinning to at most `RDP_INPUT` points, then
 * Ramer–Douglas–Peucker on that bounded set (iterative, no recursion), and
 * an even thinning to `CANVAS_LIMITS.pathPoints` if the stroke still holds
 * more. Non-finite points are dropped.
 */
import { CANVAS_LIMITS } from './limits.ts';
import type { CanvasPoint, CanvasXY, PathShape } from './types.ts';

/** Points Douglas–Peucker runs on at most (its worst case is quadratic). */
export const RDP_INPUT = 4_000;

type XY = { x: number; y: number };

function read(points: readonly (CanvasXY | CanvasPoint)[]): XY[] {
  const out: XY[] = [];
  const end = Math.min(points.length, CANVAS_LIMITS.rawPoints);
  for (let i = 0; i < end; i += 1) {
    const p = points[i];
    const x = Array.isArray(p) ? p[0] : (p as CanvasXY | undefined)?.x;
    const y = Array.isArray(p) ? p[1] : (p as CanvasXY | undefined)?.y;
    if (typeof x === 'number' && typeof y === 'number' && Number.isFinite(x) && Number.isFinite(y))
      out.push({ x, y });
  }
  return out;
}

/** Keep `max` points spread evenly, first and last included. */
function thin(points: XY[], max: number): XY[] {
  if (points.length <= max) return points;
  const out: XY[] = [];
  const stride = (points.length - 1) / (max - 1);
  for (let i = 0; i < max; i += 1) out.push(points[Math.round(i * stride)] as XY);
  return out;
}

function segmentDistance(p: XY, a: XY, b: XY): number {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const length = vx * vx + vy * vy;
  if (length === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / length));
  return Math.hypot(p.x - (a.x + t * vx), p.y - (a.y + t * vy));
}

function douglasPeucker(points: XY[], tolerance: number): XY[] {
  if (points.length <= 2) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [first, last] = stack.pop() as [number, number];
    let worst = -1;
    let index = -1;
    for (let i = first + 1; i < last; i += 1) {
      const d = segmentDistance(points[i] as XY, points[first] as XY, points[last] as XY);
      if (d > worst) {
        worst = d;
        index = i;
      }
    }
    if (index !== -1 && worst > tolerance) {
      keep[index] = 1;
      stack.push([first, index], [index, last]);
    }
  }
  return points.filter((_, i) => keep[i] === 1);
}

/**
 * Simplify a freehand stroke to at most `CANVAS_LIMITS.pathPoints` points
 * within `tolerance` world units (default 1.5). Accepts `{x, y}` or `[x, y]`
 * points; returns absolute `[x, y]` points.
 */
export function simplifyPath(
  points: readonly (CanvasXY | CanvasPoint)[],
  tolerance = 1.5
): CanvasPoint[] {
  const raw = read(points);
  if (raw.length === 0) return [];
  const tol = Number.isFinite(tolerance) && tolerance > 0 ? tolerance : 1.5;
  const radial: XY[] = [raw[0] as XY];
  for (let i = 1; i < raw.length; i += 1) {
    const p = raw[i] as XY;
    const last = radial[radial.length - 1] as XY;
    if (Math.hypot(p.x - last.x, p.y - last.y) >= tol || i === raw.length - 1) radial.push(p);
  }
  const simplified = thin(douglasPeucker(thin(radial, RDP_INPUT), tol), CANVAS_LIMITS.pathPoints);
  return simplified.map((p) => [p.x, p.y]);
}

/**
 * A `path` shape from absolute points: its box is the points' bounds and
 * its points are stored relative to the box.
 */
export function pathFromPoints(
  id: string,
  points: readonly (CanvasXY | CanvasPoint)[],
  options: { tolerance?: number; closed?: boolean; paint?: PathShape['paint'] } = {}
): PathShape | null {
  const absolute = simplifyPath(points, options.tolerance);
  if (absolute.length === 0) return null;
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const [x, y] of absolute) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return {
    id,
    type: 'path',
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
    points: absolute.map(([x, y]) => [x - minX, y - minY]),
    ...(options.closed ? { closed: true } : {}),
    ...(options.paint ? { paint: options.paint } : {}),
  };
}
