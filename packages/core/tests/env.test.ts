// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getOwnerDocument,
  getOwnerWindow,
  isBrowser,
  listen,
  matchesMedia,
  requestFrame,
} from '../src/index.ts';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('environment texels', () => {
  it('can be imported in a server environment and checks globals only when called', () => {
    expect(isBrowser()).toBe(false);

    vi.stubGlobal('window', {});
    vi.stubGlobal('document', {});
    expect(isBrowser()).toBe(true);
  });

  it('gets the owning document and window without ambient document globals', () => {
    const view = { name: 'view' } as unknown as Window;
    const doc = { nodeType: 9, defaultView: view } as unknown as Document;
    const element = { nodeType: 1, ownerDocument: doc } as unknown as Node;

    expect(getOwnerDocument(element)).toBe(doc);
    expect(getOwnerDocument(doc)).toBe(doc);
    expect(getOwnerDocument(null)).toBeUndefined();
    expect(getOwnerWindow(element)).toBe(view);
    expect(getOwnerWindow(null)).toBeUndefined();
  });

  it('attaches listeners when available and cleans them up exactly once', () => {
    const target = new EventTarget();
    const listener = vi.fn();
    const dispose = listen(target, 'change', listener);

    target.dispatchEvent(new Event('change'));
    expect(listener).toHaveBeenCalledTimes(1);
    dispose();
    dispose();
    target.dispatchEvent(new Event('change'));
    expect(listener).toHaveBeenCalledTimes(1);

    expect(() => listen(undefined, 'change', listener)()).not.toThrow();
  });

  it('uses the supplied matchMedia implementation or an SSR default', () => {
    expect(matchesMedia('(prefers-reduced-motion: reduce)')).toBe(false);
    expect(matchesMedia('(prefers-reduced-motion: reduce)', null, true)).toBe(true);

    const ownerWindow = {
      matchMedia: vi.fn(() => ({ matches: true })),
    } as unknown as Pick<Window, 'matchMedia'>;
    expect(matchesMedia('(prefers-reduced-motion: reduce)', ownerWindow)).toBe(true);
    expect(ownerWindow.matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');
  });

  it('uses requestAnimationFrame when available and cancels its handle', () => {
    const requestAnimationFrame = vi.fn((_callback: FrameRequestCallback) => 41);
    const cancelAnimationFrame = vi.fn();
    const ownerWindow = { requestAnimationFrame, cancelAnimationFrame } as unknown as Window;
    const callback = vi.fn();

    const cancel = requestFrame(callback, ownerWindow);
    expect(requestAnimationFrame).toHaveBeenCalledWith(callback);
    cancel();
    expect(cancelAnimationFrame).toHaveBeenCalledWith(41);
    expect(callback).not.toHaveBeenCalled();
  });

  it('falls back to a cancellable timeout when requestAnimationFrame is unavailable', () => {
    vi.useFakeTimers();
    const callback = vi.fn();

    requestFrame(callback);
    vi.advanceTimersByTime(16);
    expect(callback).toHaveBeenCalledOnce();
    expect(callback).toHaveBeenCalledWith(expect.any(Number));

    const canceledCallback = vi.fn();
    const cancel = requestFrame(canceledCallback);
    cancel();
    vi.advanceTimersByTime(16);
    expect(canceledCallback).not.toHaveBeenCalled();
  });
});
