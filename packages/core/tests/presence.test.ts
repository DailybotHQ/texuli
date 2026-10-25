import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createPresence,
  hasPendingMotion,
  PRESENCE_STATE_ATTR,
  parseCssTimeList,
  prefersReducedMotion,
  REDUCED_MOTION_QUERY,
} from '../src/index.ts';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

function panel(styles?: Partial<CSSStyleDeclaration>): HTMLElement {
  const el = document.createElement('div');
  if (styles) Object.assign(el.style, styles);
  document.body.append(el);
  return el;
}

describe('parseCssTimeList', () => {
  it('parses seconds and milliseconds lists', () => {
    expect(parseCssTimeList('0.2s, 100ms')).toEqual([200, 100]);
    expect(parseCssTimeList('0s')).toEqual([0]);
    expect(parseCssTimeList('')).toEqual([0]);
    expect(parseCssTimeList('nope')).toEqual([0]);
  });
});

describe('prefersReducedMotion', () => {
  it('uses the supplied window matchMedia and SSR default', () => {
    expect(prefersReducedMotion(null, false)).toBe(false);
    expect(prefersReducedMotion(null, true)).toBe(true);

    const matchMedia = vi.fn(() => ({ matches: true }));
    const ownerWindow = { matchMedia } as unknown as Window;
    expect(prefersReducedMotion(ownerWindow)).toBe(true);
    expect(matchMedia).toHaveBeenCalledWith(REDUCED_MOTION_QUERY);
  });
});

describe('hasPendingMotion', () => {
  it('returns a boolean for a live element without throwing', () => {
    const el = panel({ transitionDuration: '0s' });
    expect(typeof hasPendingMotion(el)).toBe('boolean');
  });
});

describe('createPresence', () => {
  it('mounts open immediately and writes data-state', () => {
    const presence = createPresence({ present: true });
    const el = panel();
    presence.setNode(el);

    expect(presence.getSnapshot()).toEqual({
      present: true,
      mounted: true,
      state: 'open',
      exiting: false,
    });
    expect(el.getAttribute(PRESENCE_STATE_ATTR)).toBe('open');
  });

  it('fires onEnter when opening from closed', () => {
    const onEnter = vi.fn();
    const presence = createPresence({ onEnter });
    presence.setNode(panel());
    presence.setPresent(true);
    expect(presence.getSnapshot().state).toBe('open');
    expect(onEnter).toHaveBeenCalledTimes(1);
  });

  it('keeps mounted while exiting until transitionend', () => {
    const onExitComplete = vi.fn();
    const presence = createPresence({
      present: true,
      onExitComplete,
      reducedMotion: false,
      skipExitAnimation: false,
      isMotionPending: () => true,
    });
    const el = panel();
    presence.setNode(el);

    presence.setPresent(false);
    expect(presence.getSnapshot()).toMatchObject({
      present: false,
      mounted: true,
      state: 'closed',
      exiting: true,
    });
    expect(el.getAttribute(PRESENCE_STATE_ATTR)).toBe('closed');
    expect(onExitComplete).not.toHaveBeenCalled();

    el.dispatchEvent(new Event('transitionend', { bubbles: true }));
    expect(presence.getSnapshot()).toMatchObject({
      mounted: false,
      state: 'closed',
      exiting: false,
    });
    expect(onExitComplete).toHaveBeenCalledTimes(1);
  });

  it('completes exit on animationend as well as transitionend', () => {
    const onExitComplete = vi.fn();
    const presence = createPresence({
      present: true,
      onExitComplete,
      reducedMotion: false,
      isMotionPending: () => true,
    });
    const el = panel();
    presence.setNode(el);
    presence.setPresent(false);
    el.dispatchEvent(new Event('animationend', { bubbles: true }));
    expect(onExitComplete).toHaveBeenCalledTimes(1);
  });

  it('skips the exit wait under reduced motion', () => {
    vi.useFakeTimers();
    const onExitComplete = vi.fn();
    const presence = createPresence({
      present: true,
      reducedMotion: true,
      onExitComplete,
      isMotionPending: () => true,
    });
    const el = panel();
    presence.setNode(el);
    presence.setPresent(false);

    expect(presence.getSnapshot().exiting).toBe(true);
    expect(presence.getSnapshot().state).toBe('closed');

    vi.advanceTimersByTime(16);
    expect(onExitComplete).toHaveBeenCalledTimes(1);
    expect(presence.getSnapshot().mounted).toBe(false);
  });

  it('skips the exit wait when skipExitAnimation is set', () => {
    vi.useFakeTimers();
    const presence = createPresence({
      present: true,
      skipExitAnimation: true,
      isMotionPending: () => true,
    });
    presence.setNode(panel());
    presence.setPresent(false);
    vi.advanceTimersByTime(16);
    expect(presence.getSnapshot().mounted).toBe(false);
  });

  it('skips the exit wait when no CSS motion is pending', () => {
    vi.useFakeTimers();
    const onExitComplete = vi.fn();
    const presence = createPresence({
      present: true,
      reducedMotion: false,
      isMotionPending: () => false,
      onExitComplete,
    });
    presence.setNode(panel());
    presence.setPresent(false);
    expect(presence.getSnapshot().exiting).toBe(true);
    vi.advanceTimersByTime(16);
    expect(onExitComplete).toHaveBeenCalledTimes(1);
  });

  it('forceMount keeps the node mounted after exit completes', () => {
    vi.useFakeTimers();
    const onExitComplete = vi.fn();
    const presence = createPresence({
      present: true,
      forceMount: true,
      skipExitAnimation: true,
      onExitComplete,
    });
    const el = panel();
    presence.setNode(el);
    presence.setPresent(false);
    vi.advanceTimersByTime(16);

    expect(onExitComplete).toHaveBeenCalled();
    expect(presence.getSnapshot()).toMatchObject({
      present: false,
      mounted: true,
      state: 'closed',
      exiting: false,
    });
    expect(el.getAttribute(PRESENCE_STATE_ATTR)).toBe('closed');
  });

  it('re-opens while exiting and cancels the exit wait', () => {
    const onEnter = vi.fn();
    const onExitComplete = vi.fn();
    const presence = createPresence({
      present: true,
      reducedMotion: false,
      isMotionPending: () => true,
      onEnter,
      onExitComplete,
    });
    const el = panel();
    presence.setNode(el);
    presence.setPresent(false);
    expect(presence.getSnapshot().exiting).toBe(true);

    onEnter.mockClear();
    presence.setPresent(true);
    expect(presence.getSnapshot()).toMatchObject({
      present: true,
      mounted: true,
      state: 'open',
      exiting: false,
    });
    expect(onEnter).toHaveBeenCalled();
    el.dispatchEvent(new Event('transitionend', { bubbles: true }));
    expect(onExitComplete).not.toHaveBeenCalled();
  });

  it('completeExit finishes without a motion event', () => {
    const onExitComplete = vi.fn();
    const presence = createPresence({
      present: true,
      reducedMotion: false,
      isMotionPending: () => true,
      onExitComplete,
    });
    const el = panel();
    presence.setNode(el);
    presence.setPresent(false);
    presence.completeExit();
    expect(onExitComplete).toHaveBeenCalledTimes(1);
    expect(presence.getSnapshot().mounted).toBe(false);
  });

  it('ignores transitionend from child targets', () => {
    const onExitComplete = vi.fn();
    const presence = createPresence({
      present: true,
      reducedMotion: false,
      isMotionPending: () => true,
      onExitComplete,
    });
    const el = panel();
    const child = document.createElement('span');
    el.append(child);
    presence.setNode(el);
    presence.setPresent(false);
    child.dispatchEvent(new Event('transitionend', { bubbles: true }));
    expect(onExitComplete).not.toHaveBeenCalled();
    el.dispatchEvent(new Event('transitionend', { bubbles: true }));
    expect(onExitComplete).toHaveBeenCalledTimes(1);
  });

  it('dispose clears pending work', () => {
    vi.useFakeTimers();
    const onExitComplete = vi.fn();
    const presence = createPresence({
      present: true,
      skipExitAnimation: true,
      onExitComplete,
    });
    presence.setNode(panel());
    presence.setPresent(false);
    presence.dispose();
    vi.advanceTimersByTime(32);
    expect(onExitComplete).not.toHaveBeenCalled();
  });

  it('starts unmounted when present is false', () => {
    const presence = createPresence();
    expect(presence.getSnapshot()).toEqual({
      present: false,
      mounted: false,
      state: 'closed',
      exiting: false,
    });
  });

  it('syncAttributes writes data-state onto an explicit node', () => {
    const presence = createPresence({ present: true });
    const el = panel();
    presence.syncAttributes(el);
    expect(el.getAttribute(PRESENCE_STATE_ATTR)).toBe('open');
  });
});
