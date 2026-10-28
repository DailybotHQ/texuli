/**
 * DOM adapters from browser events to the engine's plain input events. The
 * decision (which key does what, which targets are guarded, what counts as a
 * swipe) is `decideDeckInput`'s; this module only describes the event.
 */
import type { DeckInputEvent } from '@texuli/deck/engine';
import { inputPathFrom } from '@texuli/deck/engine';

interface PathEvent {
  composedPath?(): EventTarget[];
  target: EventTarget | null;
}

function eventPath(event: PathEvent, stopAt: Element | null | undefined) {
  const nodes =
    typeof event.composedPath === 'function'
      ? event.composedPath()
      : event.target
        ? [event.target]
        : [];
  return inputPathFrom(nodes, stopAt ?? undefined);
}

/** A `keydown` as the engine reads it; the path stops at the stage root. */
export function keyInput(event: KeyboardEvent, root: Element | null | undefined): DeckInputEvent {
  return {
    kind: 'key',
    key: event.key,
    repeat: event.repeat,
    isComposing: event.isComposing,
    shiftKey: event.shiftKey,
    ctrlKey: event.ctrlKey,
    metaKey: event.metaKey,
    altKey: event.altKey,
    path: eventPath(event, root),
  };
}

/** A primary click on the canvas, with the selection length (selecting text never advances). */
export function clickInput(
  event: MouseEvent,
  root: Element | null | undefined,
  selectionLength = 0
): DeckInputEvent {
  return {
    kind: 'click',
    button: event.button,
    shiftKey: event.shiftKey,
    ctrlKey: event.ctrlKey,
    metaKey: event.metaKey,
    altKey: event.altKey,
    selectionLength,
    path: eventPath(event, root),
  };
}

interface PointerStart {
  id: number;
  x: number;
  y: number;
  at: number;
  type: 'touch' | 'pen' | 'mouse';
  path: ReturnType<typeof inputPathFrom>;
}

function pointerKind(type: string): 'touch' | 'pen' | 'mouse' {
  return type === 'touch' || type === 'pen' ? type : 'mouse';
}

/**
 * Track one pointer from `down` to `up` and describe it as a swipe. Only the
 * first active pointer counts (a second finger cancels the gesture, so pinch
 * zoom is never read as a swipe).
 */
export function createSwipeTracker(now: () => number = () => Date.now()) {
  let start: PointerStart | null = null;
  let cancelled = false;
  return {
    down(event: PointerEvent, root: Element | null | undefined): void {
      if (start) {
        cancelled = true;
        return;
      }
      cancelled = false;
      start = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        at: now(),
        type: pointerKind(event.pointerType),
        path: eventPath(event, root),
      };
    },
    up(event: PointerEvent): DeckInputEvent | null {
      const began = start;
      if (!began || began.id !== event.pointerId) return null;
      start = null;
      if (cancelled) {
        cancelled = false;
        return null;
      }
      return {
        kind: 'swipe',
        dx: event.clientX - began.x,
        dy: event.clientY - began.y,
        durationMs: Math.max(0, now() - began.at),
        pointerType: began.type,
        path: began.path,
      };
    },
    cancel(): void {
      start = null;
      cancelled = false;
    },
  };
}

/** Length of the current text selection, 0 when there is none (or no `getSelection`). */
export function selectionLength(
  win: { getSelection?: () => Selection | null } | undefined
): number {
  try {
    return win?.getSelection?.()?.toString().length ?? 0;
  } catch {
    return 0;
  }
}
