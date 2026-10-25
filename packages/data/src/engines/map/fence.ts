import {
  boundedNumber,
  boundedString,
  createSchema,
  enumValue,
  recordOf,
  strictKeys,
  ValidationError,
} from '../validation.ts';
import { haversine, type LngLat } from './geo.ts';

/** A polygon ring as `[lng, lat]` pairs (closing pair optional). */
export type Ring = [number, number][];

function parsePosition(input: unknown): [number, number] {
  if (!Array.isArray(input) || input.length !== 2)
    throw new ValidationError('position must be a longitude/latitude pair');
  return [
    boundedNumber(input[0], 'longitude', -180, 180),
    boundedNumber(input[1], 'latitude', -85.06, 85.06),
  ];
}

export const RingSchema = createSchema<Ring>((input) => {
  if (!Array.isArray(input) || input.length < 3 || input.length > 2000) {
    throw new ValidationError('ring must contain between 3 and 2,000 positions');
  }
  return input.map(parsePosition);
});

export type Geofence =
  | { id: string; name: string; shape: 'polygon'; ring: Ring }
  | { id: string; name: string; shape: 'circle'; center: [number, number]; radiusMeters: number };

export const GeofenceSchema = createSchema<Geofence>((input) => {
  const value = recordOf(input, 'geofence');
  const shape = enumValue(value.shape, ['polygon', 'circle'], 'shape');
  if (shape === 'polygon') {
    strictKeys(value, ['id', 'name', 'shape', 'ring'], 'polygon geofence');
    return {
      id: boundedString(value.id, 'id', 1, 64),
      name: boundedString(value.name, 'name', 1, 80),
      shape,
      ring: RingSchema.parse(value.ring),
    };
  }
  strictKeys(value, ['id', 'name', 'shape', 'center', 'radiusMeters'], 'circle geofence');
  return {
    id: boundedString(value.id, 'id', 1, 64),
    name: boundedString(value.name, 'name', 1, 80),
    shape,
    center: parsePosition(value.center),
    radiusMeters: boundedNumber(value.radiusMeters, 'radiusMeters', Number.MIN_VALUE, 1_000_000),
  };
});

/**
 * Even-odd ray casting on `[lng, lat]` pairs (planar; fine for city-sized
 * fences away from the antimeridian). Points on an edge count as inside.
 */
export function pointInRing(point: LngLat, ring: readonly (readonly [number, number])[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i] as readonly [number, number];
    const [xj, yj] = ring[j] as readonly [number, number];
    if (onSegment(point, xi, yi, xj, yj)) return true;
    if (
      yi > point.lat !== yj > point.lat &&
      point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi) + xi
    ) {
      inside = !inside;
    }
  }
  return inside;
}

function onSegment(p: LngLat, x1: number, y1: number, x2: number, y2: number): boolean {
  const cross = (x2 - x1) * (p.lat - y1) - (y2 - y1) * (p.lng - x1);
  if (Math.abs(cross) > 1e-12) return false;
  return (
    p.lng >= Math.min(x1, x2) &&
    p.lng <= Math.max(x1, x2) &&
    p.lat >= Math.min(y1, y2) &&
    p.lat <= Math.max(y1, y2)
  );
}

function segmentsCross(
  a: readonly number[],
  b: readonly number[],
  c: readonly number[],
  d: readonly number[]
): boolean {
  const orient = (p: readonly number[], q: readonly number[], r: readonly number[]) =>
    Math.sign(
      ((q[0] as number) - (p[0] as number)) * ((r[1] as number) - (p[1] as number)) -
        ((q[1] as number) - (p[1] as number)) * ((r[0] as number) - (p[0] as number))
    );
  return orient(a, b, c) * orient(a, b, d) < 0 && orient(c, d, a) * orient(c, d, b) < 0;
}

/** Whether `inner` lies wholly inside `outer` (every vertex inside, no edges crossing). */
export function ringContains(outer: Ring, inner: Ring): boolean {
  if (!inner.every(([x, y]) => pointInRing({ lng: x, lat: y }, outer))) return false;
  for (let i = 0; i < inner.length; i++) {
    const a = inner[i] as [number, number];
    const b = inner[(i + 1) % inner.length] as [number, number];
    for (let j = 0; j < outer.length; j++) {
      if (
        segmentsCross(
          a,
          b,
          outer[j] as [number, number],
          outer[(j + 1) % outer.length] as [number, number]
        )
      )
        return false;
    }
  }
  return true;
}

/** Whether a ring crosses itself (such a fence has no sensible inside). */
export function ringSelfIntersects(ring: Ring): boolean {
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue; // neighbors through the closing edge
      if (
        segmentsCross(
          ring[i] as [number, number],
          ring[(i + 1) % n] as [number, number],
          ring[j] as [number, number],
          ring[(j + 1) % n] as [number, number]
        )
      )
        return true;
    }
  }
  return false;
}

export function insideFence(point: LngLat, fence: Geofence): boolean {
  if (fence.shape === 'circle') {
    return haversine(point, { lng: fence.center[0], lat: fence.center[1] }) <= fence.radiusMeters;
  }
  return pointInRing(point, fence.ring);
}

/** Ids of the fences containing `point`, in fence order. */
export function fencesAt(point: LngLat, fences: readonly Geofence[]): string[] {
  return fences.filter((fence) => insideFence(point, fence)).map((fence) => fence.id);
}

export interface TrackPoint extends LngLat {
  /** When the position was recorded (ISO instant or any sortable value). */
  at: string;
}

export interface FenceEvent {
  fenceId: string;
  type: 'enter' | 'exit';
  at: string;
  /** Index of the track point where the change was seen. */
  index: number;
}

/**
 * Enter and exit events for a moving point, in track order (then fence
 * order). The first point only sets the starting state: a track that starts
 * inside a fence does not "enter" it. Pass `initiallyInside` to carry state
 * over from an earlier track.
 */
export function fenceTransitions(
  track: readonly TrackPoint[],
  fences: readonly Geofence[],
  initiallyInside?: readonly string[]
): FenceEvent[] {
  const events: FenceEvent[] = [];
  let inside = new Set(initiallyInside ?? (track[0] ? fencesAt(track[0], fences) : []));
  track.forEach((point, index) => {
    if (index === 0 && initiallyInside === undefined) return;
    const now = new Set(fencesAt(point, fences));
    for (const fence of fences) {
      const was = inside.has(fence.id);
      const is = now.has(fence.id);
      if (was !== is)
        events.push({ fenceId: fence.id, type: is ? 'enter' : 'exit', at: point.at, index });
    }
    inside = now;
  });
  return events;
}
