import { fireEvent, render } from '@testing-library/svelte';
import { resolveDeckTransition } from '@texuli/deck/engine';
import { tick } from 'svelte';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeAnimation } from '../../core/tests/motion-fakes.ts';
import DeckStage from '../src/stage/DeckStage.svelte';
import { loadDefaultDeckRenderers } from '../src/stage/defaults.ts';
import {
  DECK_FRAGMENT_MS,
  playFragments,
  playSlideEnter,
  snapshotPlan,
} from '../src/stage/motion.ts';
import { captureFragments, loadStageMotion } from '../src/stage/motion-capture.ts';
import { transitionKeyframes } from '../src/stage/transition.ts';
import { clearDeckHash } from './scenario.ts';

// The stage plays the deck's resolved transitions and fragments through
// @texuli/core/motion (ADR-013): a Web Animations stand-in records them here.
// Reduced motion keeps the deck's 150 ms opacity-only slide fade and makes
// fragments instant; level `none` is a cut.

beforeAll(() => loadDefaultDeckRenderers());

type Started = { target: Element; keyframes: Keyframe[]; options: KeyframeAnimationOptions };
let started: Started[] = [];
const originalAnimate = HTMLElement.prototype.animate;

beforeEach(() => {
  started = [];
  HTMLElement.prototype.animate = function animate(
    this: HTMLElement,
    keyframes: Keyframe[] | PropertyIndexedKeyframes | null,
    options?: number | KeyframeAnimationOptions
  ) {
    const frames = (keyframes ?? []) as Keyframe[];
    const timing = (
      typeof options === 'number' ? { duration: options } : (options ?? {})
    ) as KeyframeAnimationOptions;
    started.push({ target: this, keyframes: frames, options: timing });
    return new FakeAnimation(this, frames, timing) as unknown as Animation;
  };
});
afterEach(() => {
  HTMLElement.prototype.animate = originalAnimate;
  document.body.replaceChildren();
  for (const style of document.head.querySelectorAll('style[data-test]')) style.remove();
  vi.restoreAllMocks();
  clearDeckHash();
});

function attached(): HTMLElement {
  const element = document.createElement('div');
  document.body.append(element);
  return element;
}

function preferences(reduced: boolean): void {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query: string) =>
      ({
        matches: query.includes('reduced-motion') ? reduced : false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(() => false),
      }) as unknown as MediaQueryList
  );
}

describe('slide changes on the runtime', () => {
  it('plans view-transition snapshots: the resolved timing, or the 150 ms fade when reduced', () => {
    const slide = attached();
    const fade = resolveDeckTransition({ style: { transition: 'slide' } });
    const frames = transitionKeyframes('slide', 'forward');
    expect(snapshotPlan(slide, frames.new, fade, false)).toMatchObject({
      duration: 400,
      keyframes: frames.new,
    });
    // Reduced motion keeps the deck's fade: opacity only, no travel.
    const reduced = snapshotPlan(
      slide,
      transitionKeyframes('fade-up', 'forward').new,
      { durationMs: 150 },
      true
    );
    expect(reduced?.duration).toBe(150);
    expect(reduced?.keyframes).toEqual([{ opacity: 0 }, { opacity: 1 }]);
    // Hostile durations are clamped by the runtime.
    expect(snapshotPlan(slide, frames.new, { durationMs: 1e9 }, false)?.duration).toBe(1000);
    // Nothing plans on a detached element (the server, an unmounted slide).
    expect(snapshotPlan(document.createElement('div'), frames.new, fade, false)).toBeNull();
  });

  it('the CSS fallback plays the incoming slide through animate', () => {
    const slide = attached();
    const resolved = resolveDeckTransition({ style: { transition: 'zoom' } });
    const run = playSlideEnter(slide, transitionKeyframes('zoom', 'forward'), resolved, false);
    expect(run?.instantReason).toBeNull();
    expect(started).toHaveLength(1);
    expect(started[0]?.keyframes[0]).toEqual({ opacity: 0, transform: 'scale(0.92)' });
    expect(started[0]?.options).toMatchObject({ duration: 350, fill: 'none' });
    // A cut plays nothing.
    const cut = resolveDeckTransition({ style: { transition: 'none' } });
    expect(playSlideEnter(slide, transitionKeyframes('none', 'forward'), cut, false)).toBeNull();
    expect(started).toHaveLength(1);
  });

  it('a stage without View Transitions enters each new slide on the runtime', async () => {
    preferences(false);
    const deck = {
      formatVersion: 2,
      meta: { title: 'Motion' },
      style: { transition: 'fade-up' },
      slides: [
        { id: 'one', title: 'One', layout: 'free', blocks: [{ type: 'text', markdown: 'One.' }] },
        { id: 'two', title: 'Two', layout: 'free', blocks: [{ type: 'text', markdown: 'Two.' }] },
      ],
    };
    const { container } = render(DeckStage, { props: { deck, loadTheme: null } });
    // The runtime half is its own chunk; the stage warms it on mount.
    expect(await loadStageMotion()).not.toBeNull();
    await tick();
    expect(started).toHaveLength(0);
    const first = container.querySelector<HTMLElement>('[data-tx-deck-active="true"]');
    first?.focus();
    await fireEvent.keyDown(first as HTMLElement, { key: 'ArrowRight' });
    await tick();
    await tick();
    const incoming = container.querySelector<HTMLElement>('[data-slide-id="two"]');
    const enter = started.filter((entry) => entry.target === incoming);
    expect(enter).toHaveLength(1);
    expect(enter[0]?.keyframes[0]).toMatchObject({ opacity: 0 });
    expect(incoming?.getAttribute('data-tx-deck-enter')).toBe('fade-up');
  });
});

describe('fragments on the runtime', () => {
  function fragment(phase: string): { wrapper: HTMLElement; child: HTMLElement } {
    const wrapper = attached();
    wrapper.className = 'tx-deck-stage__fragment';
    wrapper.setAttribute('data-tx-deck-fragment', phase);
    const child = document.createElement('p');
    child.textContent = 'Ship';
    wrapper.append(child);
    return { wrapper, child };
  }

  function styleSheet(): void {
    const style = document.createElement('style');
    style.setAttribute('data-test', '');
    style.textContent =
      '.tx-deck-stage__fragment[data-tx-deck-fragment="hidden"] > * { opacity: 0; }' +
      '.tx-deck-stage__fragment[data-tx-deck-fragment="visible"] > * { opacity: 1; }';
    document.head.append(style);
  }

  it('animates a changed phase from its old style to its new one, keeping it visible', () => {
    styleSheet();
    const { wrapper, child } = fragment('hidden');
    const before = captureFragments(document.body);
    wrapper.setAttribute('data-tx-deck-fragment', 'visible');
    const runs = playFragments(document.body, before, { level: 'full', reducedMotion: false });
    expect(runs).toHaveLength(1);
    expect(started[0]?.target).toBe(child);
    expect(started[0]?.keyframes).toEqual([
      { visibility: 'visible', opacity: '0' },
      { visibility: 'visible', opacity: '1' },
    ]);
    expect(started[0]?.options.duration).toBe(DECK_FRAGMENT_MS);
  });

  it('subtle shortens it; reduced motion and level none commit at once', () => {
    styleSheet();
    const { wrapper } = fragment('hidden');
    let before = captureFragments(document.body);
    wrapper.setAttribute('data-tx-deck-fragment', 'visible');
    playFragments(document.body, before, { level: 'subtle', reducedMotion: false });
    expect(started[0]?.options.duration).toBe(DECK_FRAGMENT_MS * 0.6);
    for (const options of [
      { level: 'full' as const, reducedMotion: true },
      { level: 'none' as const, reducedMotion: false },
    ]) {
      started = [];
      before = captureFragments(document.body);
      wrapper.setAttribute(
        'data-tx-deck-fragment',
        wrapper.getAttribute('data-tx-deck-fragment') === 'visible' ? 'hidden' : 'visible'
      );
      const runs = playFragments(document.body, before, options);
      expect(runs.every((run) => run.instantReason !== null)).toBe(true);
      expect(started).toHaveLength(0);
    }
  });

  it('an unchanged phase plays nothing', () => {
    styleSheet();
    fragment('visible');
    const before = captureFragments(document.body);
    expect(playFragments(document.body, before, { level: 'full', reducedMotion: false })).toEqual(
      []
    );
  });
});
