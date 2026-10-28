import { distance, isFinitePoint, ORIGIN, type Point } from './geometry.ts';

/** The four phases of one drag. */
export type DragPhase = 'idle' | 'pressed' | 'dragging' | 'dropping';

/** How the drag is driven: pointer (mouse, pen, touch) or keyboard. */
export type DragInput = 'pointer' | 'keyboard';

/**
 * Keyboard intents, resolved by the caller from keys (and text direction).
 * The engine never reads keys itself.
 */
export type DragIntent =
  | 'pickUp'
  | 'movePrev'
  | 'moveNext'
  | 'moveInto'
  | 'moveOut'
  | 'drop'
  | 'cancel';

export const DRAG_INTENTS: readonly DragIntent[] = /* @__PURE__ */ Object.freeze([
  'pickUp',
  'movePrev',
  'moveNext',
  'moveInto',
  'moveOut',
  'drop',
  'cancel',
]);

/** Why a pick-up, move or drop was refused. Hosts may add their own strings. */
export type BuiltInRefusal =
  | 'cancelled'
  | 'no-target'
  | 'locked'
  | 'filtered'
  | 'handle'
  | 'disabled'
  | 'pull'
  | 'put'
  | 'full'
  | 'sort'
  | 'cycle'
  | 'depth'
  | 'edge'
  | 'swap-multi'
  | 'unknown-item';
export type RefusalReason = BuiltInRefusal | (string & {});

export const REFUSAL_REASONS: readonly BuiltInRefusal[] = /* @__PURE__ */ Object.freeze([
  'cancelled',
  'no-target',
  'locked',
  'filtered',
  'handle',
  'disabled',
  'pull',
  'put',
  'full',
  'sort',
  'cycle',
  'depth',
  'edge',
  'swap-multi',
  'unknown-item',
]);

/** `canDrop` answer: allowed, or refused with a reason the messages can voice. */
export type DropVerdict =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: RefusalReason };

export const ALLOW: DropVerdict = /* @__PURE__ */ Object.freeze({ ok: true });
export function refuse(reason: RefusalReason): DropVerdict {
  return { ok: false, reason };
}

/** Every lifecycle event name. `add`, `remove` and `update` come from list engines. */
export type DragEventType =
  | 'start'
  | 'move'
  | 'over'
  | 'drop'
  | 'cancel'
  | 'add'
  | 'remove'
  | 'update';

/** A lifecycle event from the session: start, move, over, drop or cancel. */
export interface DragLifecycleEvent<S, T> {
  readonly type: 'start' | 'move' | 'over' | 'drop' | 'cancel';
  readonly input: DragInput;
  readonly source: S;
  readonly target: T | null;
  readonly verdict: DropVerdict | null;
  readonly point: Point;
  /** Pointer travel since the press, after `transform`. */
  readonly delta: Point;
  /** Set on `cancel`. */
  readonly reason?: RefusalReason;
}

/** A read-only snapshot of the session. */
export interface DragSessionState<S, T> {
  readonly phase: DragPhase;
  readonly input: DragInput | null;
  readonly source: S | null;
  readonly origin: Point | null;
  readonly point: Point | null;
  readonly delta: Point;
  readonly target: T | null;
  readonly verdict: DropVerdict | null;
}

export interface DragSessionOptions<S, T> {
  /** Pointer travel (px) before a press becomes a drag. Default 4. */
  readonly threshold?: number;
  /** Decides whether `source` may drop on `target`. Default: always allowed. */
  readonly canDrop?: (source: S, target: T) => DropVerdict;
  /** Target equality for `over` events. Default: shallow equality. */
  readonly sameTarget?: (a: T, b: T) => boolean;
  /** Rewrites the raw delta (compose modifiers here). */
  readonly transform?: (delta: Point, source: S) => Point;
  readonly onEvent?: (event: DragLifecycleEvent<S, T>) => void;
}

/** Result of `drop()`: a click (released before the threshold), a drop, or a cancel. */
export type DropOutcome<T> =
  | { readonly kind: 'click' }
  | { readonly kind: 'drop'; readonly target: T }
  | { readonly kind: 'cancel'; readonly reason: RefusalReason }
  | { readonly kind: 'none' };

export interface DragSession<S, T> {
  readonly state: DragSessionState<S, T>;
  /** idle → pressed (pointer). Returns false when a drag is already running. */
  press(source: S, at: Point, input?: DragInput): boolean;
  /** idle or pressed → dragging at once (keyboard pick-up, long-press). */
  start(source: S, at?: Point, input?: DragInput): boolean;
  /** Pointer travel: pressed → dragging past the threshold; emits `move` while dragging. */
  move(at: Point): void;
  /** Sets the current target (null = none); emits `over` when it changes. */
  over(target: T | null): DropVerdict | null;
  /** dragging → dropping (or a cancel when there is no allowed target). */
  drop(): DropOutcome<T>;
  /** dropping → idle, after the host committed (and animated) the drop. */
  settle(): void;
  /** Any phase → idle; emits `cancel` when a drag was running. */
  cancel(reason?: RefusalReason): boolean;
}

function shallowEqual<T>(a: T, b: T): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  const ak = Object.keys(a);
  if (ak.length !== Object.keys(b).length) return false;
  for (const key of ak) {
    if (!Object.is((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])) {
      return false;
    }
  }
  return true;
}

/**
 * The drag session state machine: idle → pressed → dragging → dropping → idle.
 * Pure and deterministic: no timers, no DOM, no globals. Hit-testing, lists
 * and announcements compose on top (see `sortable`).
 */
export function createDragSession<S, T>(options: DragSessionOptions<S, T> = {}): DragSession<S, T> {
  const threshold = Math.max(0, options.threshold ?? 4);
  const sameTarget = options.sameTarget ?? shallowEqual;
  let phase: DragPhase = 'idle';
  let input: DragInput | null = null;
  let source: S | null = null;
  let origin: Point | null = null;
  let current: Point | null = null;
  let delta: Point = ORIGIN;
  let target: T | null = null;
  let verdict: DropVerdict | null = null;

  const judge = (t: T | null): DropVerdict | null => {
    if (t === null || source === null) return null;
    return options.canDrop ? options.canDrop(source, t) : ALLOW;
  };

  const emit = (type: DragLifecycleEvent<S, T>['type'], reason?: RefusalReason) => {
    if (!options.onEvent || source === null) return;
    options.onEvent({
      type,
      input: input ?? 'pointer',
      source,
      target,
      verdict,
      point: current ?? ORIGIN,
      delta,
      ...(reason === undefined ? {} : { reason }),
    });
  };

  const reset = () => {
    phase = 'idle';
    input = null;
    source = null;
    origin = null;
    current = null;
    delta = ORIGIN;
    target = null;
    verdict = null;
  };

  const travel = (at: Point): Point => {
    const raw = { x: at.x - (origin?.x ?? at.x), y: at.y - (origin?.y ?? at.y) };
    return options.transform && source !== null ? options.transform(raw, source) : raw;
  };

  return {
    get state() {
      return { phase, input, source, origin, point: current, delta, target, verdict };
    },
    press(next, at, how = 'pointer') {
      if (phase !== 'idle' || !isFinitePoint(at)) return false;
      phase = 'pressed';
      input = how;
      source = next;
      origin = at;
      current = at;
      delta = ORIGIN;
      return true;
    },
    start(next, at = ORIGIN, how = 'keyboard') {
      if (phase === 'dragging' || phase === 'dropping' || !isFinitePoint(at)) return false;
      if (phase === 'idle') {
        source = next;
        origin = at;
        current = at;
        delta = ORIGIN;
      }
      input = how;
      phase = 'dragging';
      emit('start');
      return true;
    },
    move(at) {
      if (!isFinitePoint(at)) return;
      if (phase === 'pressed') {
        if (origin && distance(origin, at) < threshold) return;
        phase = 'dragging';
        current = at;
        delta = travel(at);
        emit('start');
        emit('move');
        return;
      }
      if (phase !== 'dragging') return;
      current = at;
      delta = travel(at);
      emit('move');
    },
    over(next) {
      if (phase !== 'dragging') return null;
      if (next === null ? target === null : target !== null && sameTarget(target, next)) {
        return verdict;
      }
      target = next;
      verdict = judge(next);
      emit('over');
      return verdict;
    },
    drop() {
      if (phase === 'pressed') {
        reset();
        return { kind: 'click' };
      }
      if (phase !== 'dragging') return { kind: 'none' };
      // Re-judge: the host may have changed what is allowed since `over`.
      verdict = judge(target);
      if (target === null || verdict === null) {
        this.cancel('no-target');
        return { kind: 'cancel', reason: 'no-target' };
      }
      if (!verdict.ok) {
        const reason = verdict.reason;
        this.cancel(reason);
        return { kind: 'cancel', reason };
      }
      phase = 'dropping';
      const dropped = target;
      emit('drop');
      return { kind: 'drop', target: dropped };
    },
    settle() {
      if (phase === 'dropping') reset();
    },
    cancel(reason = 'cancelled') {
      if (phase === 'idle') return false;
      if (phase === 'dragging') emit('cancel', reason);
      reset();
      return true;
    },
  };
}
