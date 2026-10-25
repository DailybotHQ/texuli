/**
 * Guard against the pointer/click that opened a layer also dismissing it.
 *
 * Call {@link OpenGestureGuard.noteOpen} with the opening event (or with no
 * argument when the open was not pointer-driven). While the guard is active,
 * matching outside pointer events are ignored.
 */

export interface OpenGestureGuard {
  /** Record the opening gesture. */
  noteOpen: (event?: Event) => void;
  /** True when this event belongs to the opening gesture. */
  shouldIgnore: (event: Event) => boolean;
  /** Clear the guard (tests, forced reset). */
  reset: () => void;
}

type GuardState = {
  pointerId: number | null;
  /** Ignore the completing click of the opening pointer. */
  expectClick: boolean;
  /** Ignore the next outside pointerdown (programmatic / non-pointer open). */
  skipNextPointerDown: boolean;
};

function pointerIdOf(event: Event): number | null {
  if (typeof PointerEvent !== 'undefined' && event instanceof PointerEvent) {
    return event.pointerId;
  }
  if ('pointerId' in event && typeof (event as { pointerId: unknown }).pointerId === 'number') {
    return (event as { pointerId: number }).pointerId;
  }
  return null;
}

export function createOpenGestureGuard(): OpenGestureGuard {
  const state: GuardState = {
    pointerId: null,
    expectClick: false,
    skipNextPointerDown: false,
  };

  return {
    noteOpen(event) {
      if (!event) {
        state.pointerId = null;
        state.expectClick = true;
        state.skipNextPointerDown = true;
        return;
      }
      // A click completes its pointer sequence: nothing of it is left to
      // ignore, and holding its pointer id would swallow the user's next
      // outside press (Chromium clicks are PointerEvents with an id).
      if (event.type === 'click') {
        state.pointerId = null;
        state.expectClick = false;
        state.skipNextPointerDown = false;
        return;
      }
      const id = pointerIdOf(event);
      if (id !== null) {
        state.pointerId = id;
        state.expectClick = true;
        state.skipNextPointerDown = false;
        return;
      }
      // Keyboard or click-without-pointerId open.
      state.pointerId = null;
      state.expectClick = true;
      state.skipNextPointerDown = true;
    },

    shouldIgnore(event) {
      const id = pointerIdOf(event);

      if (state.skipNextPointerDown && event.type === 'pointerdown') {
        state.skipNextPointerDown = false;
        // Still expect the trailing click of that sequence.
        state.expectClick = true;
        if (id !== null) state.pointerId = id;
        return true;
      }

      if (state.pointerId !== null && id === state.pointerId) {
        if (event.type === 'click') {
          state.expectClick = false;
          state.pointerId = null;
          return true;
        }
        // pointerdown / pointerup / pointercancel of the opening pointer
        return true;
      }

      if (state.expectClick && event.type === 'click') {
        state.expectClick = false;
        state.pointerId = null;
        state.skipNextPointerDown = false;
        return true;
      }

      return false;
    },

    reset() {
      state.pointerId = null;
      state.expectClick = false;
      state.skipNextPointerDown = false;
    },
  };
}
