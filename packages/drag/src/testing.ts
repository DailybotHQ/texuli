import type { FrameScheduler } from './auto-scroll.ts';
import type { Rect, TextDirection } from './geometry.ts';
import type { GestureTimer, PointerLike } from './gesture.ts';
import type { MeasuredContainer, SortableContainer } from './sortable.ts';

/**
 * Test helpers for hosts and bindings: a fake frame loop, a fake timer,
 * measured list layouts and pointer events. Deterministic, no DOM.
 */

export interface FakeFrames extends FrameScheduler {
  /** Runs the queued frame callbacks once (frames requested during the run wait). */
  step(time?: number): number;
  /** Steps until no frame is queued, at most `limit` times. */
  flush(limit?: number): number;
  readonly pending: number;
}

export function createFakeFrames(): FakeFrames {
  let queue = new Map<number, (time: number) => void>();
  let next = 1;
  let clock = 0;
  const frames: FakeFrames = {
    request(callback) {
      const handle = next++;
      queue.set(handle, callback);
      return handle;
    },
    cancel(handle) {
      queue.delete(handle);
    },
    step(time) {
      clock = time ?? clock + 16;
      const run = queue;
      queue = new Map();
      for (const callback of run.values()) callback(clock);
      return run.size;
    },
    flush(limit = 1000) {
      let steps = 0;
      while (queue.size > 0 && steps < limit) {
        frames.step();
        steps += 1;
      }
      return steps;
    },
    get pending() {
      return queue.size;
    },
  };
  return frames;
}

export interface FakeTimer extends GestureTimer {
  advance(ms: number): void;
}

export function createFakeTimer(): FakeTimer {
  let now = 0;
  let next = 1;
  const timers = new Map<number, { at: number; callback: () => void }>();
  return {
    set(callback, ms) {
      const handle = next++;
      timers.set(handle, { at: now + ms, callback });
      return handle;
    },
    clear(handle) {
      timers.delete(handle);
    },
    advance(ms) {
      now += ms;
      for (const [handle, timer] of [...timers].sort((a, b) => a[1].at - b[1].at)) {
        if (timer.at > now) continue;
        timers.delete(handle);
        timer.callback();
      }
    },
  };
}

export interface ListLayout {
  readonly orientation?: 'vertical' | 'horizontal' | 'grid';
  readonly direction?: TextDirection;
  /** Top-left of the list. Default 0,0. */
  readonly x?: number;
  readonly y?: number;
  /** Item size along each axis. Default 200 × 40. */
  readonly itemWidth?: number;
  readonly itemHeight?: number;
  readonly gap?: number;
  /** Items per row in a grid. Default 4. */
  readonly columns?: number;
  /** Child list per item id (trees). */
  readonly children?: Readonly<Record<string, string>>;
}

/** Measured rects for a list laid out on a regular grid, as a browser would report them. */
export function measureList(
  container: SortableContainer,
  layout: ListLayout = {}
): MeasuredContainer {
  const orientation = layout.orientation ?? container.orientation ?? 'vertical';
  const w = layout.itemWidth ?? 200;
  const h = layout.itemHeight ?? 40;
  const gap = layout.gap ?? 0;
  const columns =
    orientation === 'grid'
      ? Math.max(1, layout.columns ?? 4)
      : orientation === 'horizontal'
        ? container.items.length
        : 1;
  const rows = Math.max(1, Math.ceil(container.items.length / columns));
  const ox = layout.x ?? 0;
  const oy = layout.y ?? 0;
  const width = columns * w + Math.max(0, columns - 1) * gap;
  const rtl = layout.direction === 'rtl';
  const items = container.items.map((id, index) => {
    const column = orientation === 'vertical' ? 0 : index % columns;
    const row = orientation === 'vertical' ? index : Math.floor(index / columns);
    const left = column * (w + gap);
    const rect: Rect = {
      x: ox + (rtl ? width - left - w : left),
      y: oy + row * (h + gap),
      width: w,
      height: h,
    };
    const child = layout.children?.[id];
    return child === undefined ? { id, rect } : { id, rect, childContainerId: child };
  });
  return {
    id: container.id,
    rect: {
      x: ox,
      y: oy,
      width: Math.max(width, w),
      height: Math.max(rows * h + (rows - 1) * gap, h),
    },
    orientation,
    ...(layout.direction ? { direction: layout.direction } : {}),
    items,
  };
}

/** A primary mouse PointerEvent-like value. */
export function pointer(x: number, y: number, overrides: Partial<PointerLike> = {}): PointerLike {
  return {
    pointerId: 1,
    clientX: x,
    clientY: y,
    button: 0,
    pointerType: 'mouse',
    isPrimary: true,
    ...overrides,
  };
}

/** Records events and announcements for assertions. */
export function createRecorder<E extends { readonly type: string }>() {
  const events: E[] = [];
  const announcements: string[] = [];
  return {
    events,
    announcements,
    onEvent: (event: E) => {
      events.push(event);
    },
    announce: (message: string) => {
      announcements.push(message);
    },
    types: () => events.map((event) => event.type),
    clear: () => {
      events.length = 0;
      announcements.length = 0;
    },
  };
}
