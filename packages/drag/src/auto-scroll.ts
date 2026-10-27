import type { Point, Rect } from './geometry.ts';

/** Scroll state of one scrollable ancestor, read by the caller. */
export interface ScrollMetrics {
  /** The visible box in the same coordinates as the pointer. */
  readonly rect: Rect;
  readonly scrollLeft: number;
  readonly scrollTop: number;
  readonly scrollWidth: number;
  readonly scrollHeight: number;
  readonly clientWidth: number;
  readonly clientHeight: number;
}

/** Maps how deep the pointer sits in an edge zone (0 at its inner edge, 1 at the border) to 0–1. */
export type SpeedCurve = (depth: number) => number;

export const linearCurve: SpeedCurve = (depth) => depth;
export const easeInCurve: SpeedCurve = (depth) => depth * depth;

export interface AutoScrollOptions {
  /** Edge zone thickness in px. Default 48. */
  readonly edge?: number;
  /** Top speed in px per frame. Default 20. */
  readonly maxSpeed?: number;
  readonly curve?: SpeedCurve;
}

const axisSpeed = (
  p: number,
  start: number,
  size: number,
  edge: number,
  max: number,
  curve: SpeedCurve,
  canBack: boolean,
  canForward: boolean
): number => {
  const zone = Math.min(edge, size / 2);
  if (zone <= 0) return 0;
  if (p < start || p > start + size) return 0;
  if (p < start + zone && canBack) return -max * curve(Math.min(1, (start + zone - p) / zone));
  if (p > start + size - zone && canForward) {
    return max * curve(Math.min(1, (p - (start + size - zone)) / zone));
  }
  return 0;
};

/**
 * Scroll velocity (px per frame) for a pointer near the edges of one
 * scrollable box. Zero on an axis that cannot scroll further that way.
 */
export function autoScrollVelocity(
  pointer: Point,
  metrics: ScrollMetrics,
  options: AutoScrollOptions = {}
): Point {
  const edge = options.edge ?? 48;
  const max = options.maxSpeed ?? 20;
  const curve = options.curve ?? easeInCurve;
  const { rect: box } = metrics;
  const x = axisSpeed(
    pointer.x,
    box.x,
    box.width,
    edge,
    max,
    curve,
    metrics.scrollLeft > 0,
    metrics.scrollLeft + metrics.clientWidth < metrics.scrollWidth
  );
  const y = axisSpeed(
    pointer.y,
    box.y,
    box.height,
    edge,
    max,
    curve,
    metrics.scrollTop > 0,
    metrics.scrollTop + metrics.clientHeight < metrics.scrollHeight
  );
  return { x: x === 0 ? 0 : x, y: y === 0 ? 0 : y };
}

/** A frame loop supplied by the caller (requestAnimationFrame in a browser, a fake in tests). */
export interface FrameScheduler {
  request(callback: (time: number) => void): number;
  cancel(handle: number): void;
}

/** One scrollable ancestor, nearest first. */
export interface ScrollTarget {
  metrics(): ScrollMetrics;
  scrollBy(dx: number, dy: number): void;
}

export interface AutoScroller {
  /** Feed the latest pointer; starts or stops the loop as needed. */
  update(pointer: Point): void;
  stop(): void;
  readonly running: boolean;
}

export interface AutoScrollerOptions extends AutoScrollOptions {
  readonly frame: FrameScheduler;
  /** Scrollable ancestors, nearest first; the first that can move scrolls. */
  readonly targets: () => readonly ScrollTarget[];
  /** Called after each scroll step: re-measure rects here (the only re-measure). */
  readonly onScroll?: (target: ScrollTarget, delta: Point) => void;
}

/** Drives auto-scroll on the caller's frame loop. No timers of its own. */
export function createAutoScroller(options: AutoScrollerOptions): AutoScroller {
  let pointer: Point | null = null;
  let handle: number | null = null;

  const pick = (): { target: ScrollTarget; velocity: Point } | null => {
    if (!pointer) return null;
    for (const target of options.targets()) {
      const velocity = autoScrollVelocity(pointer, target.metrics(), options);
      if (velocity.x !== 0 || velocity.y !== 0) return { target, velocity };
    }
    return null;
  };

  const tick = () => {
    handle = null;
    const hit = pick();
    if (!hit) return;
    hit.target.scrollBy(hit.velocity.x, hit.velocity.y);
    options.onScroll?.(hit.target, hit.velocity);
    handle = options.frame.request(tick);
  };

  const stop = () => {
    if (handle !== null) options.frame.cancel(handle);
    handle = null;
  };

  return {
    update(next) {
      pointer = next;
      if (handle === null && pick()) handle = options.frame.request(tick);
    },
    stop() {
      stop();
      pointer = null;
    },
    get running() {
      return handle !== null;
    },
  };
}
