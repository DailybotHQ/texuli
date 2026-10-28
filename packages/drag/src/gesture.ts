import { distance, isFinitePoint, type Point } from './geometry.ts';

/** The fields the tracker reads from a PointerEvent. */
export interface PointerLike {
  readonly pointerId: number;
  readonly clientX: number;
  readonly clientY: number;
  readonly button?: number;
  readonly pointerType?: string;
  readonly isPrimary?: boolean;
}

/** Timer supplied by the caller (setTimeout in a browser, a fake in tests). */
export interface GestureTimer {
  set(callback: () => void, ms: number): number;
  clear(handle: number): void;
}

export interface LongPressOptions {
  /** Hold time in ms before a drag starts. */
  readonly delay: number;
  /** Travel (px) allowed while holding; more cancels the press (it was a scroll). Default 8. */
  readonly tolerance?: number;
  /** Pointer types that need the hold. Default `['touch']`. */
  readonly pointerTypes?: readonly string[];
}

export interface GestureEvent {
  readonly pointerId: number;
  readonly pointerType: string;
  readonly origin: Point;
  readonly point: Point;
  readonly delta: Point;
}

export interface PointerTrackerOptions {
  /** Travel (px) before a press becomes a drag. Default 4. */
  readonly threshold?: number;
  /** Measure the threshold along one axis only (a header that reorders sideways). */
  readonly axis?: 'x' | 'y';
  readonly longPress?: LongPressOptions;
  /** Required with `longPress`. */
  readonly timer?: GestureTimer;
  /** Accept non-primary buttons (default: primary only). */
  readonly anyButton?: boolean;
  readonly onStart?: (event: GestureEvent) => void;
  readonly onMove?: (event: GestureEvent) => void;
  readonly onEnd?: (event: GestureEvent) => void;
  /** pointercancel, Escape from the host, or a long-press aborted mid-drag. */
  readonly onCancel?: (event: GestureEvent) => void;
  /** Released before the threshold: an ordinary click. */
  readonly onClick?: (event: GestureEvent) => void;
}

export type GesturePhase = 'idle' | 'pressed' | 'holding' | 'dragging';

export interface PointerTracker {
  readonly phase: GesturePhase;
  /** Returns true when the press was accepted (the caller should then capture). */
  down(event: PointerLike): boolean;
  move(event: PointerLike): void;
  up(event: PointerLike): void;
  /** pointercancel: always a cancel, never a drop. */
  cancel(event?: PointerLike): void;
}

/**
 * Pointer tracker for every continuous gesture: one pointer at a time,
 * a travel threshold, `pointercancel` as cancel and an optional long-press.
 */
export function createPointerTracker(options: PointerTrackerOptions = {}): PointerTracker {
  const threshold = Math.max(0, options.threshold ?? 4);
  const travel = (from: Point, to: Point) =>
    options.axis === 'x'
      ? Math.abs(to.x - from.x)
      : options.axis === 'y'
        ? Math.abs(to.y - from.y)
        : distance(from, to);
  let phase: GesturePhase = 'idle';
  let pointerId = -1;
  let pointerType = 'mouse';
  let origin: Point = { x: 0, y: 0 };
  let last: Point = origin;
  let hold: number | null = null;

  const event = (): GestureEvent => ({
    pointerId,
    pointerType,
    origin,
    point: last,
    delta: { x: last.x - origin.x, y: last.y - origin.y },
  });
  const clearHold = () => {
    if (hold !== null) options.timer?.clear(hold);
    hold = null;
  };
  const reset = () => {
    clearHold();
    phase = 'idle';
    pointerId = -1;
  };
  const owns = (e: PointerLike) => phase !== 'idle' && e.pointerId === pointerId;

  return {
    get phase() {
      return phase;
    },
    down(e) {
      if (phase !== 'idle') return false;
      // One pointer at a time (a second finger is refused while one is down),
      // so `isPrimary` needs no check: synthetic events often leave it false.
      if (!options.anyButton && (e.button ?? 0) !== 0) return false;
      const at = { x: e.clientX, y: e.clientY };
      if (!isFinitePoint(at)) return false;
      pointerId = e.pointerId;
      pointerType = e.pointerType ?? 'mouse';
      origin = at;
      last = at;
      const long = options.longPress;
      if (long && options.timer && (long.pointerTypes ?? ['touch']).includes(pointerType)) {
        phase = 'holding';
        hold = options.timer.set(
          () => {
            hold = null;
            if (phase !== 'holding') return;
            phase = 'dragging';
            options.onStart?.(event());
          },
          Math.max(0, long.delay)
        );
      } else {
        phase = 'pressed';
      }
      return true;
    },
    move(e) {
      if (!owns(e)) return;
      const at = { x: e.clientX, y: e.clientY };
      if (!isFinitePoint(at)) return;
      last = at;
      if (phase === 'holding') {
        if (distance(origin, at) > (options.longPress?.tolerance ?? 8)) reset();
        return;
      }
      if (phase === 'pressed') {
        if (travel(origin, at) < threshold) return;
        phase = 'dragging';
        options.onStart?.(event());
      }
      options.onMove?.(event());
    },
    up(e) {
      if (!owns(e)) return;
      const at = { x: e.clientX, y: e.clientY };
      if (isFinitePoint(at)) last = at;
      const was = phase;
      const snapshot = event();
      reset();
      if (was === 'dragging') options.onEnd?.(snapshot);
      else options.onClick?.(snapshot);
    },
    cancel(e) {
      if (phase === 'idle' || (e && e.pointerId !== pointerId)) return;
      const was = phase;
      const snapshot = event();
      reset();
      if (was === 'dragging') options.onCancel?.(snapshot);
    },
  };
}

/** The element surface `bindPointerGesture` uses (an HTMLElement satisfies it). */
/** A DOM event listener; pointer events reach it as `Event`s and are read as `PointerLike`. */
export type GestureListener = (event: Event) => void;

export interface GestureElement {
  addEventListener(type: string, listener: GestureListener): void;
  removeEventListener(type: string, listener: GestureListener): void;
  setPointerCapture?(pointerId: number): void;
  releasePointerCapture?(pointerId: number): void;
  hasPointerCapture?(pointerId: number): boolean;
  readonly ownerDocument?: GestureElement | null;
}

/** Captures the pointer; false when capture is unavailable or refused. */
export function capturePointer(element: GestureElement, pointerId: number): boolean {
  try {
    if (!element.setPointerCapture) return false;
    element.setPointerCapture(pointerId);
    return element.hasPointerCapture?.(pointerId) ?? true;
  } catch {
    return false;
  }
}

export interface BindPointerGestureOptions {
  /**
   * Where captured moves are heard: the element (default) or an ancestor of
   * it, such as a widget root. Captured events target the element and bubble
   * through its ancestors.
   */
  readonly listenOn?: GestureElement;
  /**
   * Decides at pointerdown whether this press may start a gesture (filters
   * such as menus or resize grips inside a draggable header). A refused press
   * is never captured, so its own click still works.
   */
  readonly accept?: (event: Event) => boolean;
  /**
   * False skips pointer capture and listens on `listenOn` (or the document)
   * instead. Use it when the pressed element holds controls of its own:
   * capture retargets pointerup, so their clicks would land on the element.
   */
  readonly capture?: boolean;
}

/**
 * DOM adapter: wires a tracker to an element with pointer capture, falling
 * back to listeners on `listenOn` (or the owner document) when capture fails. Pass the
 * element in (SSR-safe: nothing runs at module load). Returns a disposer.
 */
export function bindPointerGesture(
  element: GestureElement,
  tracker: PointerTracker,
  options: BindPointerGestureOptions = {}
): () => void {
  const scope = options.listenOn ?? element;
  const moves = ['pointermove', 'pointerup', 'pointercancel'];
  let fallback: GestureElement | null = null;
  let captured = -1;
  // Pointer listeners only ever receive PointerEvents, which satisfy PointerLike.
  const route: GestureListener = (event) => {
    const e = event as unknown as PointerLike;
    if (event.type === 'pointermove') {
      tracker.move(e);
    } else if (event.type === 'pointerup') {
      tracker.up(e);
      if (tracker.phase === 'idle') detach();
    } else {
      // pointercancel and lostpointercapture
      tracker.cancel(e);
      detach();
    }
  };
  // Scope listeners stand down while the fallback listens, so a bubbling
  // event is never handled twice.
  const onScope: GestureListener = (event) => {
    if (fallback === null) route(event);
  };
  const detach = () => {
    for (const type of moves) fallback?.removeEventListener(type, route);
    fallback = null;
    if (captured >= 0) {
      try {
        element.releasePointerCapture?.(captured);
      } catch {
        // Already released by the browser.
      }
      captured = -1;
    }
  };
  const onDown: GestureListener = (event) => {
    const e = event as unknown as PointerLike;
    if ((options.accept && !options.accept(event)) || !tracker.down(e)) return;
    if (options.capture !== false && capturePointer(element, e.pointerId)) {
      captured = e.pointerId;
    } else {
      // Without capture, moves are heard where the caller listens (or on the document).
      fallback = options.listenOn ?? element.ownerDocument ?? null;
      for (const type of moves) fallback?.addEventListener(type, route);
    }
  };
  element.addEventListener('pointerdown', onDown);
  element.addEventListener('lostpointercapture', onScope);
  for (const type of moves) scope.addEventListener(type, onScope);
  return () => {
    detach();
    tracker.cancel();
    element.removeEventListener('pointerdown', onDown);
    element.removeEventListener('lostpointercapture', onScope);
    for (const type of moves) scope.removeEventListener(type, onScope);
  };
}
