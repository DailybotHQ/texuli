/**
 * Connector routing: where each end attaches and the path between them,
 * straight, elbow (orthogonal) or curved. The curve is the side-aware cubic
 * the workflow editor draws (`sideCurveControls` from `@texuli/drag/graph`),
 * so canvases and workflows share one edge geometry.
 */
import { type EdgeSide, sideCurveControls } from '@texuli/drag/graph';
import { rotatePoint, shapeBounds } from './document.ts';
import type {
  CanvasAnchor,
  CanvasConnector,
  CanvasEndpoint,
  CanvasRect,
  CanvasRouting,
  CanvasShape,
  CanvasXY,
} from './types.ts';

export type { EdgeSide };

/** A routed connector: a polyline (hit testing, export), SVG path data and its label point. */
export interface ConnectorRoute {
  id: string;
  routing: CanvasRouting;
  from: CanvasXY;
  to: CanvasXY;
  fromSide: EdgeSide;
  toSide: EdgeSide;
  /** The route as points (a curve is sampled). */
  points: CanvasXY[];
  /** SVG path data, coordinates rounded to tenths. */
  path: string;
  /** Where the label sits: the middle of the route. */
  mid: CanvasXY;
}

const tenth = (value: number) => Math.round(value * 10) / 10;

const center = (box: CanvasRect): CanvasXY => ({
  x: box.x + box.width / 2,
  y: box.y + box.height / 2,
});

/** The side of `box` that faces `toward`. */
export function facingSide(box: CanvasRect, toward: CanvasXY): EdgeSide {
  const c = center(box);
  const dx = toward.x - c.x;
  const dy = toward.y - c.y;
  // Compare against the box's aspect, so a wide box prefers its long sides less.
  const nx = box.width > 0 ? dx / box.width : dx;
  const ny = box.height > 0 ? dy / box.height : dy;
  if (Math.abs(nx) >= Math.abs(ny)) return dx >= 0 ? 'right' : 'left';
  return dy >= 0 ? 'bottom' : 'top';
}

const SIDES: readonly EdgeSide[] = ['top', 'right', 'bottom', 'left'];

function rotateSide(side: EdgeSide, degrees: number): EdgeSide {
  const steps = Math.round((((degrees % 360) + 360) % 360) / 90) % 4;
  return SIDES[(SIDES.indexOf(side) + steps) % 4] as EdgeSide;
}

function sidePoint(box: CanvasRect, side: EdgeSide): CanvasXY {
  if (side === 'top') return { x: box.x + box.width / 2, y: box.y };
  if (side === 'bottom') return { x: box.x + box.width / 2, y: box.y + box.height };
  if (side === 'left') return { x: box.x, y: box.y + box.height / 2 };
  return { x: box.x + box.width, y: box.y + box.height / 2 };
}

interface Resolved {
  point: CanvasXY;
  side: EdgeSide;
}

/**
 * Where an endpoint sits, given the point the other end aims at. Shape
 * anchors sit on the unrotated box and turn with the shape; `auto` takes
 * the side facing `toward`.
 */
export function resolveEndpoint(
  end: CanvasEndpoint,
  shapes: ReadonlyMap<string, CanvasShape>,
  toward: CanvasXY
): Resolved | null {
  if (!('shape' in end)) {
    const dx = toward.x - end.x;
    const dy = toward.y - end.y;
    const side: EdgeSide =
      Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 'right' : 'left') : dy >= 0 ? 'bottom' : 'top';
    return { point: { x: end.x, y: end.y }, side };
  }
  const shape = shapes.get(end.shape);
  if (!shape || shape.type === 'group') return null;
  const anchor: CanvasAnchor = end.anchor ?? 'auto';
  const rotation = shape.rotation ?? 0;
  const box = { x: shape.x, y: shape.y, width: shape.width, height: shape.height };
  const c = center(box);
  if (anchor === 'center') return { point: c, side: facingSide(shapeBounds(shape), toward) };
  if (anchor === 'auto') {
    // Pick the side in the shape's own frame, then turn it with the shape.
    const local = rotatePoint(toward, c, -rotation);
    const side = facingSide(box, local);
    return {
      point: rotatePoint(sidePoint(box, side), c, rotation),
      side: rotateSide(side, rotation),
    };
  }
  return {
    point: rotatePoint(sidePoint(box, anchor), c, rotation),
    side: rotateSide(anchor, rotation),
  };
}

/** The point an end aims at before it is resolved: a shape's center or the free point. */
function aim(end: CanvasEndpoint, shapes: ReadonlyMap<string, CanvasShape>): CanvasXY | null {
  if (!('shape' in end)) return { x: end.x, y: end.y };
  const shape = shapes.get(end.shape);
  return shape ? center(shapeBounds(shape)) : null;
}

const STUB = 16;

function step(p: CanvasXY, side: EdgeSide, length: number): CanvasXY {
  if (side === 'left') return { x: p.x - length, y: p.y };
  if (side === 'right') return { x: p.x + length, y: p.y };
  if (side === 'top') return { x: p.x, y: p.y - length };
  return { x: p.x, y: p.y + length };
}

const horizontal = (side: EdgeSide) => side === 'left' || side === 'right';

/** Drop repeated and collinear middle points. */
function tidy(points: CanvasXY[]): CanvasXY[] {
  const out: CanvasXY[] = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (last && Math.abs(last.x - p.x) < 1e-9 && Math.abs(last.y - p.y) < 1e-9) continue;
    const before = out[out.length - 2];
    if (
      before &&
      last &&
      ((Math.abs(before.x - last.x) < 1e-9 && Math.abs(last.x - p.x) < 1e-9) ||
        (Math.abs(before.y - last.y) < 1e-9 && Math.abs(last.y - p.y) < 1e-9))
    )
      out.pop();
    out.push(p);
  }
  return out;
}

/** An orthogonal route: a stub out of each side, joined with at most two bends. */
export function elbowPoints(
  a: CanvasXY,
  fromSide: EdgeSide,
  b: CanvasXY,
  toSide: EdgeSide
): CanvasXY[] {
  const a1 = step(a, fromSide, STUB);
  const b1 = step(b, toSide, STUB);
  let middle: CanvasXY[];
  if (horizontal(fromSide) && horizontal(toSide)) {
    const mx = (a1.x + b1.x) / 2;
    middle = [
      { x: mx, y: a1.y },
      { x: mx, y: b1.y },
    ];
  } else if (!horizontal(fromSide) && !horizontal(toSide)) {
    const my = (a1.y + b1.y) / 2;
    middle = [
      { x: a1.x, y: my },
      { x: b1.x, y: my },
    ];
  } else if (horizontal(fromSide)) middle = [{ x: b1.x, y: a1.y }];
  else middle = [{ x: a1.x, y: b1.y }];
  return tidy([a, a1, ...middle, b1, b]);
}

function cubicAt(p0: CanvasXY, c1: CanvasXY, c2: CanvasXY, p1: CanvasXY, t: number): CanvasXY {
  const u = 1 - t;
  return {
    x: u * u * u * p0.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * p1.x,
    y: u * u * u * p0.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * p1.y,
  };
}

function polylineMid(points: readonly CanvasXY[]): CanvasXY {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1] as CanvasXY;
    const b = points[i] as CanvasXY;
    total += Math.hypot(b.x - a.x, b.y - a.y);
  }
  let left = total / 2;
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1] as CanvasXY;
    const b = points[i] as CanvasXY;
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    if (length >= left && length > 0) {
      const t = left / length;
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
    left -= length;
  }
  return points[0] ? { ...(points[0] as CanvasXY) } : { x: 0, y: 0 };
}

/**
 * Route one connector, or `null` when an end names no shape it can attach
 * to (`shapes` is an id → shape map, `indexShapes` gives one).
 */
export function routeConnector(
  connector: CanvasConnector,
  shapes: ReadonlyMap<string, CanvasShape>
): ConnectorRoute | null {
  const aimFrom = aim(connector.from, shapes);
  const aimTo = aim(connector.to, shapes);
  if (!aimFrom || !aimTo) return null;
  const from = resolveEndpoint(connector.from, shapes, aimTo);
  const to = resolveEndpoint(connector.to, shapes, aimFrom);
  if (!from || !to) return null;
  const routing = connector.routing ?? 'straight';
  let points: CanvasXY[];
  let path: string;
  if (routing === 'curved') {
    const [c1, c2] = sideCurveControls(from.point, from.side, to.point, to.side);
    points = [];
    for (let i = 0; i <= 16; i += 1) points.push(cubicAt(from.point, c1, c2, to.point, i / 16));
    path = `M${tenth(from.point.x)} ${tenth(from.point.y)}C${tenth(c1.x)} ${tenth(c1.y)} ${tenth(c2.x)} ${tenth(c2.y)} ${tenth(to.point.x)} ${tenth(to.point.y)}`;
  } else {
    points =
      routing === 'elbow'
        ? elbowPoints(from.point, from.side, to.point, to.side)
        : [from.point, to.point];
    path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${tenth(p.x)} ${tenth(p.y)}`).join('');
  }
  return {
    id: connector.id,
    routing,
    from: from.point,
    to: to.point,
    fromSide: from.side,
    toSide: to.side,
    points,
    path,
    mid: polylineMid(points),
  };
}

/** Shortest distance from a point to a route. */
export function distanceToRoute(route: ConnectorRoute, p: CanvasXY): number {
  let best = Number.POSITIVE_INFINITY;
  const pts = route.points;
  for (let i = 1; i < pts.length; i += 1) {
    const a = pts[i - 1] as CanvasXY;
    const b = pts[i] as CanvasXY;
    const vx = b.x - a.x;
    const vy = b.y - a.y;
    const length = vx * vx + vy * vy;
    const t =
      length === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / length));
    best = Math.min(best, Math.hypot(p.x - (a.x + t * vx), p.y - (a.y + t * vy)));
  }
  return best;
}
