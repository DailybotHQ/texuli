import {
  intersectionArea,
  type Point,
  type Rect,
  rectArea,
  rectCenter,
  rectContains,
} from './geometry.ts';

/** Something that can receive a drop, with the rect snapshotted at drag start. */
export interface Droppable {
  readonly id: string;
  readonly rect: Rect;
  readonly disabled?: boolean;
}

export interface CollisionInput {
  readonly pointer: Point;
  /** The dragged rect at its current position, when the host renders one. */
  readonly active?: Rect | null;
  readonly droppables: readonly Droppable[];
}

/** The best hit and its score (lower is better for distances, higher for overlap). */
export interface Collision {
  readonly id: string;
  readonly score: number;
  /** Which side of the hit the drop lands on, for strategies that decide it (header reorder). */
  readonly side?: 'before' | 'after';
}

/** A pluggable collision strategy. Return null when nothing qualifies. */
export type CollisionStrategy = (input: CollisionInput) => Collision | null;

/** Nearest droppable center to the dragged rect's center (or the pointer). */
export const closestCenter: CollisionStrategy = ({ pointer, active, droppables }) => {
  const from = active ? rectCenter(active) : pointer;
  let best: Collision | null = null;
  for (const droppable of droppables) {
    if (droppable.disabled) continue;
    const c = rectCenter(droppable.rect);
    const score = Math.hypot(c.x - from.x, c.y - from.y);
    if (best === null || score < best.score) best = { id: droppable.id, score };
  }
  return best;
};

/**
 * Droppables under the pointer; when several nest, the smallest (most
 * specific) wins, so an inner list beats its outer list.
 */
export const pointerWithin: CollisionStrategy = ({ pointer, droppables }) => {
  let best: Collision | null = null;
  for (const droppable of droppables) {
    if (droppable.disabled || !rectContains(droppable.rect, pointer)) continue;
    const score = rectArea(droppable.rect);
    if (best === null || score < best.score) best = { id: droppable.id, score };
  }
  return best;
};

/** Largest overlap ratio between the dragged rect and each droppable. */
export const rectIntersection: CollisionStrategy = ({ active, droppables }) => {
  if (!active) return null;
  let best: Collision | null = null;
  const activeArea = rectArea(active);
  for (const droppable of droppables) {
    if (droppable.disabled) continue;
    const overlap = intersectionArea(active, droppable.rect);
    if (overlap === 0) continue;
    const union = activeArea + rectArea(droppable.rect) - overlap;
    const score = union > 0 ? overlap / union : 0;
    if (best === null || score > best.score) best = { id: droppable.id, score };
  }
  return best;
};

/** First strategy that finds a hit wins: `firstHit(pointerWithin, closestCenter)`. */
export function firstHit(...strategies: readonly CollisionStrategy[]): CollisionStrategy {
  return (input) => {
    for (const strategy of strategies) {
      const hit = strategy(input);
      if (hit) return hit;
    }
    return null;
  };
}

/**
 * Insertion slot for `coordinate` among ascending midpoints: the index of the
 * first midpoint past the coordinate (binary search, O(log n)).
 */
export function midpointIndex(midpoints: ArrayLike<number>, coordinate: number): number {
  let low = 0;
  let high = midpoints.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (coordinate < (midpoints[mid] as number)) high = mid;
    else low = mid + 1;
  }
  return low;
}
