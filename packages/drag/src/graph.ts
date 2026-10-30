import { distance, type Point, type Rect } from './geometry.ts';
import type { DropVerdict } from './session.ts';

/** A connection point on a node, in world coordinates. */
export interface Port {
  readonly id: string;
  readonly nodeId: string;
  readonly kind: 'in' | 'out';
  readonly point: Point;
  /** Optional type tag; ports connect only when tags match (unless a rule says otherwise). */
  readonly type?: string;
}

export interface GraphEdge {
  readonly id: string;
  readonly from: string;
  readonly to: string;
}

/** The nearest port within `radius` of a point, or null. */
export function hitPort(ports: readonly Port[], p: Point, radius = 12): Port | null {
  let best: Port | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const port of ports) {
    const d = distance(port.point, p);
    // Strictly nearer wins, so ties keep the first port (stable).
    if (d <= radius && d < bestDistance) {
      best = port;
      bestDistance = d;
    }
  }
  return best;
}

export interface ConnectRules {
  readonly allowSelf?: boolean;
  readonly allowDuplicate?: boolean;
  readonly allowCycles?: boolean;
  /** Most edges per input port. Default unlimited. */
  readonly maxIn?: number;
  readonly canConnect?: (from: Port, to: Port) => DropVerdict;
}

/** Refusal reasons for a connection: `direction`, `self`, `type`, `duplicate`, `cycle`, `full`. */
export function canConnect(
  from: Port,
  to: Port,
  ports: ReadonlyMap<string, Port>,
  edges: readonly GraphEdge[],
  rules: ConnectRules = {}
): DropVerdict {
  if (from.kind !== 'out' || to.kind !== 'in') return { ok: false, reason: 'direction' };
  if (!rules.allowSelf && from.nodeId === to.nodeId) return { ok: false, reason: 'self' };
  if (from.type !== undefined && to.type !== undefined && from.type !== to.type) {
    return { ok: false, reason: 'type' };
  }
  if (!rules.allowDuplicate && edges.some((e) => e.from === from.id && e.to === to.id)) {
    return { ok: false, reason: 'duplicate' };
  }
  if (rules.maxIn !== undefined && edges.filter((e) => e.to === to.id).length >= rules.maxIn) {
    return { ok: false, reason: 'full' };
  }
  if (!rules.allowCycles && reaches(to.nodeId, from.nodeId, ports, edges)) {
    return { ok: false, reason: 'cycle' };
  }
  return rules.canConnect ? rules.canConnect(from, to) : { ok: true };
}

/** True when a node path leads from `start` to `goal` (iterative, cycle-safe). */
export function reaches(
  start: string,
  goal: string,
  ports: ReadonlyMap<string, Port>,
  edges: readonly GraphEdge[]
): boolean {
  if (start === goal) return true;
  const next = new Map<string, string[]>();
  for (const edge of edges) {
    const a = ports.get(edge.from)?.nodeId;
    const b = ports.get(edge.to)?.nodeId;
    if (a === undefined || b === undefined) continue;
    const list = next.get(a) ?? [];
    list.push(b);
    next.set(a, list);
  }
  const seen = new Set([start]);
  const stack = [start];
  while (stack.length > 0) {
    for (const node of next.get(stack.pop() as string) ?? []) {
      if (node === goal) return true;
      if (!seen.has(node)) {
        seen.add(node);
        stack.push(node);
      }
    }
  }
  return false;
}

/** Ports a dragged connection may end on, in a stable order (keyboard connect mode cycles these). */
export function compatiblePorts(
  from: Port,
  ports: readonly Port[],
  edges: readonly GraphEdge[],
  rules: ConnectRules = {}
): Port[] {
  const byId = new Map(ports.map((port) => [port.id, port]));
  // One reverse walk instead of one forward walk per candidate: every node
  // that already reaches `from` would close a cycle.
  const upstream = rules.allowCycles ? null : nodesReaching(from.nodeId, byId, edges);
  const relaxed = { ...rules, allowCycles: true };
  return ports.filter((port) => {
    if (upstream?.has(port.nodeId)) return false;
    return canConnect(from, port, byId, edges, relaxed).ok;
  });
}

/** Every node with a path to `goal`, `goal` included. */
export function nodesReaching(
  goal: string,
  ports: ReadonlyMap<string, Port>,
  edges: readonly GraphEdge[]
): Set<string> {
  const previous = new Map<string, string[]>();
  for (const edge of edges) {
    const a = ports.get(edge.from)?.nodeId;
    const b = ports.get(edge.to)?.nodeId;
    if (a === undefined || b === undefined) continue;
    const list = previous.get(b) ?? [];
    list.push(a);
    previous.set(b, list);
  }
  const seen = new Set([goal]);
  const stack = [goal];
  while (stack.length > 0) {
    for (const node of previous.get(stack.pop() as string) ?? []) {
      if (!seen.has(node)) {
        seen.add(node);
        stack.push(node);
      }
    }
  }
  return seen;
}

/** Next (or previous) id in a list, wrapping; the first when `current` is absent. */
export function cycleId(
  ids: readonly string[],
  current: string | null,
  step: 1 | -1 = 1
): string | null {
  if (ids.length === 0) return null;
  const index = current === null ? -1 : ids.indexOf(current);
  if (index === -1) return (step === 1 ? ids[0] : ids[ids.length - 1]) ?? null;
  return ids[(index + step + ids.length) % ids.length] ?? null;
}

// ---------------------------------------------------------------------------
// Edge geometry and hit areas

/** Points along a horizontal-tangent cubic Bézier from `a` to `b` (the usual node-editor curve). */
export function edgePath(a: Point, b: Point, segments = 16, curvature = 0.5): Point[] {
  const dx = Math.max(24, Math.abs(b.x - a.x) * curvature);
  const c1 = { x: a.x + dx, y: a.y };
  const c2 = { x: b.x - dx, y: b.y };
  const out: Point[] = [];
  const n = Math.max(1, Math.trunc(segments));
  for (let i = 0; i <= n; i += 1) {
    const t = i / n;
    const u = 1 - t;
    out.push({
      x: u * u * u * a.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * b.x,
      y: u * u * u * a.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * b.y,
    });
  }
  return out;
}

/** The side of a box an edge leaves or enters (physical). */
export type EdgeSide = 'left' | 'right' | 'top' | 'bottom';

/**
 * The two control points of a cubic edge that leaves `a` along `fromSide`
 * and enters `b` along `toSide`: each reaches out 40% of the distance (at
 * least 32). Shared by the workflow editor and the canvas connectors.
 */
export function sideCurveControls(
  a: Point,
  fromSide: EdgeSide,
  b: Point,
  toSide: EdgeSide
): [Point, Point] {
  const reach = Math.max(32, Math.hypot(b.x - a.x, b.y - a.y) * 0.4);
  const out = (side: EdgeSide, p: Point): Point =>
    side === 'left'
      ? { x: p.x - reach, y: p.y }
      : side === 'right'
        ? { x: p.x + reach, y: p.y }
        : side === 'top'
          ? { x: p.x, y: p.y - reach }
          : { x: p.x, y: p.y + reach };
  return [out(fromSide, a), out(toSide, b)];
}

const tenth = (value: number) => Math.round(value * 10) / 10;

/** {@link sideCurveControls} as SVG path data (`M…C…`), coordinates rounded to tenths. */
export function sideCurvePath(a: Point, fromSide: EdgeSide, b: Point, toSide: EdgeSide): string {
  const [c1, c2] = sideCurveControls(a, fromSide, b, toSide);
  return `M${tenth(a.x)} ${tenth(a.y)}C${tenth(c1.x)} ${tenth(c1.y)} ${tenth(c2.x)} ${tenth(c2.y)} ${tenth(b.x)} ${tenth(b.y)}`;
}

/** Shortest distance from `p` to a polyline. */
export function distanceToPolyline(points: readonly Point[], p: Point): number {
  if (points.length === 1) return distance(points[0] as Point, p);
  let best = Number.POSITIVE_INFINITY;
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1] as Point;
    const b = points[i] as Point;
    const vx = b.x - a.x;
    const vy = b.y - a.y;
    const length = vx * vx + vy * vy;
    const t =
      length === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / length));
    best = Math.min(best, Math.hypot(p.x - (a.x + t * vx), p.y - (a.y + t * vy)));
  }
  return best;
}

/** An edge's hit area: its polyline and bounding box (padded at hit time) for cheap rejection. */
export interface EdgeHitArea {
  readonly id: string;
  readonly points: readonly Point[];
  readonly box: Rect;
}

export function edgeHitArea(id: string, points: readonly Point[]): EdgeHitArea {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { id, points, box: { x: minX, y: minY, width: maxX - minX, height: maxY - minY } };
}

/** The nearest edge within `tolerance` of a point, or null. */
export function hitEdge(areas: readonly EdgeHitArea[], p: Point, tolerance = 6): string | null {
  let best: string | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const area of areas) {
    const { box } = area;
    if (
      p.x < box.x - tolerance ||
      p.y < box.y - tolerance ||
      p.x > box.x + box.width + tolerance ||
      p.y > box.y + box.height + tolerance
    ) {
      continue;
    }
    const d = distanceToPolyline(area.points, p);
    if (d <= tolerance && d < bestDistance) {
      best = area.id;
      bestDistance = d;
    }
  }
  return best;
}
