// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import {
  bindPointerGesture,
  capturePointer,
  createPointerTracker,
  type GestureElement,
} from '../src/gesture.ts';
import { createFakeTimer, pointer } from '../src/testing.ts';

function tracked(options: Parameters<typeof createPointerTracker>[0] = {}) {
  const log: string[] = [];
  const tracker = createPointerTracker({
    ...options,
    onStart: (e) => log.push(`start ${e.delta.x},${e.delta.y}`),
    onMove: (e) => log.push(`move ${e.delta.x},${e.delta.y}`),
    onEnd: () => log.push('end'),
    onCancel: () => log.push('cancel'),
    onClick: () => log.push('click'),
  });
  return { tracker, log };
}

describe('pointer tracker', () => {
  it('starts after the 4 px threshold and ends on pointerup', () => {
    const { tracker, log } = tracked();
    expect(tracker.down(pointer(10, 10))).toBe(true);
    tracker.move(pointer(12, 12));
    expect(tracker.phase).toBe('pressed');
    tracker.move(pointer(14, 10));
    tracker.move(pointer(20, 10));
    tracker.up(pointer(20, 10));
    expect(log).toEqual(['start 4,0', 'move 4,0', 'move 10,0', 'end']);
    expect(tracker.phase).toBe('idle');
  });

  it('measures the threshold along one axis when asked', () => {
    const { tracker, log } = tracked({ axis: 'x', threshold: 6 });
    tracker.down(pointer(0, 0));
    tracker.move(pointer(2, 40));
    expect(tracker.phase).toBe('pressed');
    tracker.move(pointer(6, 40));
    expect(log[0]).toBe('start 6,40');
  });

  it('reports a click below the threshold', () => {
    const { tracker, log } = tracked();
    tracker.down(pointer(0, 0));
    tracker.up(pointer(1, 1));
    expect(log).toEqual(['click']);
  });

  it('treats pointercancel as cancel, never as a drop', () => {
    const { tracker, log } = tracked();
    tracker.down(pointer(0, 0));
    tracker.move(pointer(10, 0));
    tracker.cancel(pointer(10, 0));
    expect(log.at(-1)).toBe('cancel');
    expect(log).not.toContain('end');
  });

  it('follows one pointer only and the primary button only', () => {
    expect(createPointerTracker().down(pointer(0, 0, { isPrimary: false }))).toBe(true);
    const { tracker, log } = tracked();
    expect(tracker.down(pointer(0, 0, { button: 2 }))).toBe(false);
    expect(tracker.down(pointer(Number.NaN, 0))).toBe(false);
    tracker.down(pointer(0, 0));
    expect(tracker.down(pointer(0, 0, { pointerId: 2 }))).toBe(false);
    tracker.move(pointer(50, 0, { pointerId: 2 }));
    tracker.cancel(pointer(0, 0, { pointerId: 2 }));
    expect(tracker.phase).toBe('pressed');
    expect(log).toEqual([]);
    expect(createPointerTracker({ anyButton: true }).down(pointer(0, 0, { button: 1 }))).toBe(true);
  });

  it('supports an optional long-press for touch', () => {
    const timer = createFakeTimer();
    const { tracker, log } = tracked({ longPress: { delay: 300 }, timer });
    tracker.down(pointer(0, 0, { pointerType: 'touch' }));
    expect(tracker.phase).toBe('holding');
    timer.advance(299);
    expect(log).toEqual([]);
    timer.advance(1);
    expect(log).toEqual(['start 0,0']);
    tracker.move(pointer(0, 30, { pointerType: 'touch' }));
    tracker.up(pointer(0, 30, { pointerType: 'touch' }));
    expect(log).toEqual(['start 0,0', 'move 0,30', 'end']);
  });

  it('lets a touch scroll win when it moves before the long-press', () => {
    const timer = createFakeTimer();
    const { tracker, log } = tracked({ longPress: { delay: 300, tolerance: 5 }, timer });
    tracker.down(pointer(0, 0, { pointerType: 'touch' }));
    tracker.move(pointer(0, 20, { pointerType: 'touch' }));
    timer.advance(400);
    expect(tracker.phase).toBe('idle');
    expect(log).toEqual([]);
    tracker.down(pointer(0, 0, { pointerType: 'mouse' }));
    expect(tracker.phase).toBe('pressed');
  });
});

class FakeElement implements GestureElement {
  listeners = new Map<string, Set<(event: never) => void>>();
  captured = new Set<number>();
  ownerDocument: FakeElement | null = null;
  canCapture = true;
  addEventListener(type: string, listener: (event: never) => void) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)?.add(listener);
  }
  removeEventListener(type: string, listener: (event: never) => void) {
    this.listeners.get(type)?.delete(listener);
  }
  dispatch(type: string, event: object) {
    // Real DOM events carry their type; the adapter routes on it.
    for (const listener of this.listeners.get(type) ?? []) {
      (listener as (e: unknown) => void)({ ...event, type });
    }
  }
  count() {
    return [...this.listeners.values()].reduce((n, set) => n + set.size, 0);
  }
  setPointerCapture(id: number) {
    if (!this.canCapture) throw new Error('NotFoundError');
    this.captured.add(id);
  }
  releasePointerCapture(id: number) {
    this.captured.delete(id);
  }
  hasPointerCapture(id: number) {
    return this.captured.has(id);
  }
}

describe('bindPointerGesture (DOM adapter)', () => {
  it('captures the pointer and releases it on pointerup', () => {
    const element = new FakeElement();
    const onEnd = vi.fn();
    const dispose = bindPointerGesture(element, createPointerTracker({ onEnd }));
    element.dispatch('pointerdown', pointer(0, 0));
    expect(element.captured.has(1)).toBe(true);
    element.dispatch('pointermove', pointer(10, 0));
    element.dispatch('pointerup', pointer(10, 0));
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(element.captured.size).toBe(0);
    dispose();
    expect(element.count()).toBe(0);
  });

  it('falls back to document listeners when capture fails, without double handling', () => {
    const doc = new FakeElement();
    const element = new FakeElement();
    element.ownerDocument = doc;
    element.canCapture = false;
    const onMove = vi.fn();
    const onCancel = vi.fn();
    bindPointerGesture(element, createPointerTracker({ onMove, onCancel }));
    element.dispatch('pointerdown', pointer(0, 0));
    expect(doc.count()).toBe(3);
    const move = pointer(10, 0);
    element.dispatch('pointermove', move);
    doc.dispatch('pointermove', move);
    expect(onMove).toHaveBeenCalledTimes(1);
    doc.dispatch('pointercancel', move);
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(doc.count()).toBe(0);
  });

  it('cancels a running drag on dispose and when capture is lost', () => {
    const element = new FakeElement();
    const onCancel = vi.fn();
    const tracker = createPointerTracker({ onCancel });
    const dispose = bindPointerGesture(element, tracker);
    element.dispatch('pointerdown', pointer(0, 0));
    element.dispatch('pointermove', pointer(10, 0));
    element.dispatch('lostpointercapture', pointer(10, 0));
    expect(onCancel).toHaveBeenCalledTimes(1);
    element.dispatch('pointerdown', pointer(0, 0));
    element.dispatch('pointermove', pointer(10, 0));
    dispose();
    expect(onCancel).toHaveBeenCalledTimes(2);
  });

  it('hears captured moves on an ancestor with listenOn', () => {
    const root = new FakeElement();
    const element = new FakeElement();
    const onEnd = vi.fn();
    const dispose = bindPointerGesture(element, createPointerTracker({ onEnd }), {
      listenOn: root,
    });
    element.dispatch('pointerdown', pointer(0, 0));
    root.dispatch('pointermove', pointer(10, 0));
    root.dispatch('pointerup', pointer(10, 0));
    expect(onEnd).toHaveBeenCalledTimes(1);
    dispose();
    expect(root.count() + element.count()).toBe(0);
  });

  it('lets accept() refuse a press without capturing it', () => {
    const element = new FakeElement();
    const onStart = vi.fn();
    bindPointerGesture(element, createPointerTracker({ onStart }), { accept: () => false });
    element.dispatch('pointerdown', pointer(0, 0));
    element.dispatch('pointermove', pointer(20, 0));
    expect(element.captured.size).toBe(0);
    expect(onStart).not.toHaveBeenCalled();
  });

  it('skips capture when asked, listening on listenOn', () => {
    const scope = new FakeElement();
    const element = new FakeElement();
    const onEnd = vi.fn();
    bindPointerGesture(element, createPointerTracker({ onEnd }), {
      listenOn: scope,
      capture: false,
    });
    element.dispatch('pointerdown', pointer(0, 0));
    expect(element.captured.size).toBe(0);
    scope.dispatch('pointermove', pointer(10, 0));
    scope.dispatch('pointerup', pointer(10, 0));
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('falls back to listenOn when capture fails', () => {
    const scope = new FakeElement();
    const element = new FakeElement();
    element.canCapture = false;
    const onEnd = vi.fn();
    bindPointerGesture(element, createPointerTracker({ onEnd }), { listenOn: scope });
    element.dispatch('pointerdown', pointer(0, 0));
    scope.dispatch('pointermove', pointer(10, 0));
    scope.dispatch('pointerup', pointer(10, 0));
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('accepts a DOM HTMLElement without a cast (checked by typecheck)', () => {
    const asGestureElement = (element: HTMLElement): GestureElement => element;
    expect(typeof asGestureElement).toBe('function');
  });

  it('reports capture support honestly', () => {
    expect(capturePointer({ addEventListener() {}, removeEventListener() {} }, 1)).toBe(false);
    const element = new FakeElement();
    expect(capturePointer(element, 3)).toBe(true);
    element.canCapture = false;
    expect(capturePointer(element, 4)).toBe(false);
  });
});
