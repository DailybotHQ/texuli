import { cleanup, fireEvent, render } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  applyEasing,
  createTimeline,
  sampleComposition,
  validateAnimation,
} from '../src/animation/index.ts';
import { CompositionAnimationPlayer } from '../src/animation/player.ts';
import { validateComposition } from '../src/composition-model/index.ts';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const compositionInput = {
  version: 1,
  width: 200,
  height: 120,
  layers: [
    {
      id: 'box',
      type: 'shape',
      shape: 'rectangle',
      frame: { x: 20, y: 20, width: 40, height: 40 },
      fill: { kind: 'solid', color: '#336699' },
      opacity: 1,
    },
    {
      id: 'label',
      type: 'text',
      frame: { x: 10, y: 80, width: 180, height: 30 },
      text: 'Move',
      paint: { kind: 'solid', color: '#111111' },
      fontSize: 16,
    },
  ],
};

const animationInput = {
  version: 1,
  durationMs: 1000,
  loop: false,
  tracks: [
    {
      layerId: 'box',
      keyframes: [
        { timeMs: 0, translateX: 0, opacity: 1, easing: 'linear' },
        { timeMs: 1000, translateX: 100, opacity: 0.2, easing: 'ease-in' },
      ],
    },
  ],
};

describe('applyEasing', () => {
  it('keeps endpoints and differs mid-curve', () => {
    expect(applyEasing(0, 'ease-in')).toBe(0);
    expect(applyEasing(1, 'ease-out')).toBe(1);
    expect(applyEasing(0.5, 'ease-in')).toBeLessThan(0.5);
    expect(applyEasing(0.5, 'ease-out')).toBeGreaterThan(0.5);
  });
});

describe('validateAnimation', () => {
  it('accepts a valid animation bound to composition layers', () => {
    const composition = validateComposition(compositionInput);
    expect(composition.ok).toBe(true);
    if (!composition.ok) return;
    const result = validateAnimation(animationInput, { composition: composition.composition });
    expect(result.ok).toBe(true);
  });

  it('rejects unknown layer ids, bad easing and hostile fields', () => {
    const composition = validateComposition(compositionInput);
    expect(composition.ok).toBe(true);
    if (!composition.ok) return;

    const missing = validateAnimation(
      {
        version: 1,
        durationMs: 500,
        tracks: [{ layerId: 'nope', keyframes: [{ timeMs: 0 }] }],
      },
      { composition: composition.composition }
    );
    expect(missing.ok).toBe(false);

    const easing = validateAnimation({
      version: 1,
      durationMs: 500,
      tracks: [
        {
          layerId: 'box',
          keyframes: [{ timeMs: 0, easing: 'cubic-bezier(1,2,3,4)' }],
        },
      ],
    });
    expect(easing.ok).toBe(false);

    const hostile = validateAnimation({
      version: 1,
      durationMs: 500,
      tracks: [
        {
          layerId: 'box',
          keyframes: [{ timeMs: 0, style: 'background:url(javascript:1)' }],
        },
      ],
    });
    expect(hostile.ok).toBe(false);
  });
});

describe('sampleComposition', () => {
  it('interpolates transforms and freezes under reduced motion', () => {
    const composition = validateComposition(compositionInput);
    const animation = validateAnimation(animationInput);
    expect(composition.ok && animation.ok).toBe(true);
    if (!composition.ok || !animation.ok) return;

    const mid = sampleComposition(composition.composition, animation.animation, 500);
    const box = mid.layers.find((l) => l.id === 'box');
    expect(box?.transform?.translateX).toBeGreaterThan(0);
    expect(box?.transform?.translateX).toBeLessThan(100);
    expect(box?.opacity).toBeGreaterThan(0.2);
    expect(box?.opacity).toBeLessThan(1);

    const still = sampleComposition(composition.composition, animation.animation, 900, {
      reducedMotion: true,
      stillTimeMs: 0,
    });
    const stillBox = still.layers.find((l) => l.id === 'box');
    expect(stillBox?.transform?.translateX).toBe(0);
    expect(stillBox?.opacity).toBe(1);
  });
});

describe('createTimeline', () => {
  it('plays, seeks and respects reduced motion', () => {
    let now = 0;
    const callbacks: FrameRequestCallback[] = [];
    const timeline = createTimeline({
      durationMs: 1000,
      now: () => now,
      requestFrame: (cb) => {
        callbacks.push(cb);
        return callbacks.length;
      },
      cancelFrame: () => {
        callbacks.length = 0;
      },
    });

    const states: number[] = [];
    timeline.subscribe((s) => states.push(s.timeMs));
    timeline.play();
    now = 250;
    callbacks[0]?.(now);
    expect(timeline.getState().timeMs).toBe(250);

    timeline.seek(800);
    expect(timeline.getState().timeMs).toBe(800);

    timeline.setReducedMotion(true);
    expect(timeline.getState().playing).toBe(false);
    expect(timeline.getState().timeMs).toBe(0);
    timeline.play();
    expect(timeline.getState().playing).toBe(false);
    timeline.dispose();
  });
});

describe('CompositionAnimationPlayer', () => {
  it('renders a still under forced reduced motion with scrubber controls', async () => {
    const { container, getByRole } = render(CompositionAnimationPlayer, {
      props: {
        composition: compositionInput,
        animation: animationInput,
        reducedMotion: true,
        title: 'Anim demo',
        initialTimeMs: 0,
      },
    });

    await vi.waitFor(() => {
      expect(container.querySelector('[data-tx-animation-still]')).toBeTruthy();
    });
    const root = container.querySelector('[data-tx-composition-animation="true"]');
    expect(root?.getAttribute('data-reduced-motion')).toBe('true');
    await vi.waitFor(() => {
      expect(container.querySelector('[data-tx-composition-svg="true"]')).toBeTruthy();
    });

    const play = getByRole('button', { name: 'Play' });
    expect((play as HTMLButtonElement).disabled).toBe(true);

    const scrubber = container.querySelector('[data-tx-animation-scrubber]') as HTMLInputElement;
    expect(scrubber).toBeTruthy();
    expect(scrubber.disabled).toBe(true);
  });

  it('allows play and scrub when motion is enabled', async () => {
    const { getByRole, container } = render(CompositionAnimationPlayer, {
      props: {
        composition: compositionInput,
        animation: animationInput,
        reducedMotion: false,
        autoplay: false,
      },
    });
    await vi.waitFor(() => {
      expect(getByRole('button', { name: 'Play' })).toBeTruthy();
    });
    const play = getByRole('button', { name: 'Play' });
    await fireEvent.click(play);
    expect((play as HTMLButtonElement).disabled).toBe(false);

    const scrubber = container.querySelector('[data-tx-animation-scrubber]') as HTMLInputElement;
    scrubber.value = '500';
    await fireEvent.input(scrubber);
    const time = container.querySelector('[data-tx-animation-time]');
    expect(time?.textContent).toMatch(/0\.5s|1\.0s|0\.0s/);
  });

  it('shows an alert for invalid animation documents', async () => {
    const { container } = render(CompositionAnimationPlayer, {
      props: {
        composition: compositionInput,
        animation: { version: 1, durationMs: 100, tracks: [] },
      },
    });
    await vi.waitFor(() => {
      expect(container.querySelector('[role="alert"]')).toBeTruthy();
    });
  });
});
