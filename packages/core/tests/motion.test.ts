/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as root from '../src/index.ts';
import {
  animate,
  createMotionPresence,
  createReducedMotionSource,
  type InstantReason,
  lowerMotionLevel,
  type MotionTiming,
  motionDuration,
  REDUCED_FADE_MS,
  resolveMotionLevel,
} from '../src/motion/index.ts';
import { attached, flush, removeAnimate, stubAnimate } from './motion-fakes.ts';

afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

describe('motion levels and durations', () => {
  it('resolves host, then document, then component, lowered by the viewer and reduced motion', () => {
    const rows: [Parameters<typeof resolveMotionLevel>[0], string][] = [
      [{}, 'full'],
      [{ component: 'subtle' }, 'subtle'],
      [{ document: 'none', component: 'full' }, 'none'],
      [{ host: 'full', document: 'none' }, 'full'],
      [{ host: 'bogus', document: 'subtle' }, 'subtle'],
      [{ host: 'full', viewer: 'subtle' }, 'subtle'],
      [{ host: 'subtle', viewer: 'full' }, 'subtle'],
      [{ host: 'full', reducedMotion: true }, 'none'],
      [{ host: 42, viewer: null }, 'full'],
    ];
    for (const [input, expected] of rows) {
      expect(resolveMotionLevel(input), JSON.stringify(input)).toBe(expected);
    }
    expect(lowerMotionLevel('none', 'full')).toBe('none');
  });

  it('clamps hostile durations and scales them for the level', () => {
    const rows: [unknown, Parameters<typeof motionDuration>[1], number][] = [
      [Number.NaN, 'full', 0],
      [-50, 'full', 0],
      [0, 'full', 0],
      ['200', 'full', 0],
      [Number.POSITIVE_INFINITY, 'full', 1000],
      [1e12, 'full', 1000],
      [500, 'subtle', 300],
      [500, 'none', 0],
      [120.4, 'full', 120],
    ];
    for (const [ms, level, expected] of rows) {
      expect(motionDuration(ms, level), `${String(ms)} ${level}`).toBe(expected);
    }
  });
});

describe('reduced-motion source', () => {
  function fakeWindow(initial: boolean, legacy = false) {
    const listeners = new Set<() => void>();
    const query = {
      matches: initial,
      ...(legacy
        ? {
            addListener: (fn: () => void) => listeners.add(fn),
            removeListener: (fn: () => void) => listeners.delete(fn),
          }
        : {
            addEventListener: (_: string, fn: () => void) => listeners.add(fn),
            removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
          }),
    };
    const win = { matchMedia: vi.fn(() => query) } as unknown as Window;
    const change = (matches: boolean) => {
      query.matches = matches;
      for (const fn of listeners) fn();
    };
    return { win, change, listeners };
  }

  it('follows the media query, lets the host override it and disposes its listener', () => {
    for (const legacy of [false, true]) {
      const { win, change, listeners } = fakeWindow(false, legacy);
      const source = createReducedMotionSource({ window: win });
      const seen: boolean[] = [];
      source.subscribe((value) => seen.push(value));
      expect(source.get()).toBe(false);
      change(true);
      expect(source.get()).toBe(true);
      source.setOverride(false);
      change(false);
      change(true);
      expect(source.get()).toBe(false);
      source.setOverride(null);
      expect(seen).toEqual([true, false, true]);
      source.dispose();
      expect(listeners.size).toBe(0);
    }
  });

  it('is SSR-safe without a window', () => {
    expect(createReducedMotionSource().get()).toBe(false);
    expect(createReducedMotionSource({ ssrDefault: true }).get()).toBe(true);
    expect(createReducedMotionSource({ window: null, override: true }).get()).toBe(true);
    const throwing = {
      matchMedia: () => {
        throw new Error('no');
      },
    } as unknown as Window;
    expect(createReducedMotionSource({ window: throwing }).get()).toBe(false);
  });
});

describe('animate', () => {
  const FADE: Keyframe[] = [{ opacity: 0 }, { opacity: 1 }];

  it('commits instantly, with no frames, whenever motion cannot or must not run', async () => {
    const rows: [string, () => [Element | null, MotionTiming, Keyframe[]?], InstantReason][] = [
      ['server', () => [null, {}], 'server'],
      ['detached', () => [document.createElement('div'), { reducedMotion: false }], 'detached'],
      ['level none', () => [attached(), { level: 'none', reducedMotion: false }], 'level-none'],
      ['reduced', () => [attached(), { reducedMotion: true }], 'reduced-motion'],
      [
        'reduced source',
        () => [attached(), { reducedMotion: createReducedMotionSource({ override: true }) }],
        'reduced-motion',
      ],
      [
        'subtle travel only',
        () => [
          attached(),
          { level: 'subtle', reducedMotion: false },
          [{ transform: 'scale(0)' }, { transform: 'none' }],
        ],
        'no-properties',
      ],
      ['zero duration', () => [attached(), { duration: 0, reducedMotion: false }], 'zero-duration'],
      [
        'NaN duration',
        () => [attached(), { duration: Number.NaN, reducedMotion: false }],
        'zero-duration',
      ],
      [
        'negative duration',
        () => [attached(), { duration: -10, reducedMotion: false }],
        'zero-duration',
      ],
      [
        'no WAAPI',
        () => {
          const el = attached();
          removeAnimate(el);
          return [el, { reducedMotion: false }];
        },
        'no-waapi',
      ],
      [
        'animate throws',
        () => {
          const el = attached();
          (el as unknown as { animate: () => never }).animate = () => {
            throw new SyntaxError('bad easing');
          };
          return [el, { reducedMotion: false, easing: 'nope(' }];
        },
        'error',
      ],
    ];
    for (const [name, setup, reason] of rows) {
      const [el, timing, frames] = setup();
      const started =
        el?.isConnected &&
        typeof (el as Partial<Element>).animate === 'function' &&
        reason !== 'error'
          ? stubAnimate(el)
          : [];
      const onFinish = vi.fn();
      const run = animate(el, frames ?? FADE, { ...timing, onFinish });
      expect(onFinish, name).toHaveBeenCalledTimes(1);
      expect(onFinish, name).toHaveBeenCalledWith('instant');
      expect(run.instantReason, name).toBe(reason);
      expect(run.animations, name).toHaveLength(0);
      expect(started, name).toHaveLength(0);
      await expect(run.finished, name).resolves.toBe('instant');
    }
  });

  it('plays through the Web Animations API with clamped timing and no lasting fill', async () => {
    const el = attached();
    const started = stubAnimate(el);
    const run = animate(el, FADE, {
      duration: 1e9,
      delay: Number.POSITIVE_INFINITY,
      reducedMotion: false,
    });
    expect(started).toHaveLength(1);
    expect(started[0]?.options).toMatchObject({ duration: 1000, delay: 1000, fill: 'backwards' });
    animate(el, FADE, { duration: 120, reducedMotion: false });
    expect(started[1]?.options).toMatchObject({ duration: 120, delay: 0, fill: 'none' });
    started[0]?.finish();
    await expect(run.finished).resolves.toBe('finished');
  });

  it('drops travel and shortens at subtle, and keeps only opacity under the fade policy', () => {
    const el = attached();
    const started = stubAnimate(el);
    const frames: Keyframe[] = [
      { opacity: 0, transform: 'translateY(8px)' },
      { opacity: 1, transform: 'none' },
    ];
    animate(el, frames, { duration: 300, level: 'subtle', reducedMotion: false });
    expect(started[0]?.keyframes).toEqual([{ opacity: 0 }, { opacity: 1 }]);
    expect(started[0]?.options.duration).toBe(180);

    animate(
      el,
      { opacity: [0, 1], scale: [0.9, 1] },
      { reducedMotion: true, reducedMotionPolicy: 'fade' }
    );
    expect(started[1]?.keyframes).toEqual({ opacity: [0, 1] });
    expect(started[1]?.options).toMatchObject({ duration: REDUCED_FADE_MS, easing: 'linear' });
  });

  it('cancels, finishes and settles exactly once', async () => {
    const el = attached();
    const started = stubAnimate(el);
    const onFinish = vi.fn();
    const cancelled = animate(el, FADE, { reducedMotion: false, onFinish });
    cancelled.cancel();
    cancelled.finish();
    cancelled.cancel();
    await expect(cancelled.finished).resolves.toBe('cancelled');
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(started[0]?.playState).toBe('idle');

    const finished = animate(el, FADE, { reducedMotion: false });
    finished.finish();
    await expect(finished.finished).resolves.toBe('finished');

    // A browser-side cancel (another script) also settles the run.
    const external = animate(el, FADE, { reducedMotion: false });
    started[2]?.cancel();
    await expect(external.finished).resolves.toBe('cancelled');
  });

  it('plays springs as linear() when supported, with the settle time as duration', () => {
    const el = attached();
    const started = stubAnimate(el);
    const supports = vi.fn(() => true);
    vi.stubGlobal('CSS', { supports });
    try {
      animate(el, FADE, { spring: { stiffness: 400, damping: 30, mass: 1 }, reducedMotion: false });
      expect(started[0]?.options.easing).toMatch(/^linear\(/);
      expect(started[0]?.options.duration).toBeGreaterThan(100);
      supports.mockReturnValue(false);
      animate(el, FADE, { spring: { stiffness: 400, damping: 30, mass: 1 }, reducedMotion: false });
      expect(started[1]?.options.easing).toMatch(/^cubic-bezier/);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('reads prefers-reduced-motion from the element window when not told', () => {
    const el = attached();
    const started = stubAnimate(el);
    const win = el.ownerDocument.defaultView as Window;
    const spy = vi.spyOn(win, 'matchMedia').mockReturnValue({ matches: true } as MediaQueryList);
    expect(animate(el, FADE).instantReason).toBe('reduced-motion');
    spy.mockReturnValue({ matches: false } as MediaQueryList);
    expect(animate(el, FADE).instantReason).toBeNull();
    expect(started).toHaveLength(1);
  });
});

describe('motion presence', () => {
  const base = { reducedMotion: false } as const;

  it('does not animate on hydration unless appear is set', () => {
    for (const appear of [false, true]) {
      const el = attached();
      const started = stubAnimate(el);
      const presence = createMotionPresence({ ...base, present: true, appear });
      presence.setNode(el);
      expect(started, String(appear)).toHaveLength(appear ? 1 : 0);
      expect(el.getAttribute('data-state')).toBe('open');
    }
  });

  it('enters after mount and keeps the node mounted until the exit finishes', async () => {
    const el = attached();
    const started = stubAnimate(el);
    const log: string[] = [];
    const presence = createMotionPresence({
      ...base,
      enter: [
        { opacity: 0, transform: 'scale(0.9)' },
        { opacity: 1, transform: 'none' },
      ],
      onEnter: () => log.push('enter'),
      onEnterComplete: () => log.push('enter-complete'),
      onExitComplete: (s) => log.push(`exit-complete:${s.mounted}`),
    });
    const entering = presence.setPresent(true);
    expect(presence.getSnapshot()).toMatchObject({ mounted: true, state: 'open' });
    expect(started).toHaveLength(0); // the node is not attached yet
    presence.setNode(el);
    expect(started).toHaveLength(1);
    started[0]?.finish();
    await expect(entering).resolves.toBe('finished');

    const exiting = presence.setPresent(false);
    expect(el.getAttribute('data-state')).toBe('closed');
    expect(presence.getSnapshot()).toMatchObject({ mounted: true, exiting: true });
    // The exit plays the enter keyframes backwards.
    expect(started[1]?.keyframes).toEqual([
      { opacity: 1, transform: 'none' },
      { opacity: 0, transform: 'scale(0.9)' },
    ]);
    started[1]?.finish();
    await expect(exiting).resolves.toBe('finished');
    expect(presence.getSnapshot()).toMatchObject({
      mounted: false,
      exiting: false,
      state: 'closed',
    });
    expect(log).toEqual(['enter', 'enter-complete', 'exit-complete:false']);
  });

  it('reverses a running animation in place on rapid toggles', async () => {
    const el = attached();
    const started = stubAnimate(el);
    const presence = createMotionPresence({ ...base, present: true });
    presence.setNode(el);
    const outcomes: Promise<string>[] = [presence.setPresent(false)];
    for (let i = 0; i < 49; i++) outcomes.push(presence.setPresent(i % 2 === 0));
    // One animation, reversed 49 times: no restart, no jump.
    expect(started).toHaveLength(1);
    expect(started[0]?.calls.filter((c) => c === 'reverse')).toHaveLength(49);
    expect(presence.getSnapshot()).toMatchObject({ present: true, state: 'open', mounted: true });
    started[0]?.finish();
    const results = await Promise.all(outcomes);
    expect(results.slice(0, -1).every((r) => r === 'interrupted')).toBe(true);
    expect(results.at(-1)).toBe('finished');
    expect(presence.getSnapshot()).toMatchObject({ present: true, exiting: false, mounted: true });
  });

  it('commits at once under reduced motion, without WAAPI, detached or on the server', async () => {
    const setups: [string, () => [Element | null, boolean]][] = [
      ['reduced', () => [attached(), true]],
      [
        'no WAAPI',
        () => {
          const el = attached();
          removeAnimate(el);
          return [el, false];
        },
      ],
      ['detached', () => [document.createElement('div'), false]],
      ['server', () => [null, false]],
    ];
    for (const [name, setup] of setups) {
      const [el, reducedMotion] = setup();
      const onExitComplete = vi.fn();
      const presence = createMotionPresence({ present: true, reducedMotion, onExitComplete });
      presence.setNode(el);
      const result = presence.setPresent(false);
      // The exit completed synchronously: callbacks already ran.
      expect(onExitComplete, name).toHaveBeenCalledTimes(1);
      expect(presence.getSnapshot().mounted, name).toBe(false);
      await expect(result, name).resolves.toBe('instant');
    }
  });

  it('keeps forceMount nodes mounted and disposes cleanly', async () => {
    const el = attached();
    const started = stubAnimate(el);
    const presence = createMotionPresence({ ...base, present: true, forceMount: true });
    presence.setNode(el);
    const exiting = presence.setPresent(false);
    started[0]?.finish();
    await exiting;
    expect(presence.getSnapshot()).toMatchObject({ mounted: true, state: 'closed' });

    const entering = presence.setPresent(true);
    presence.dispose();
    expect(started[1]?.playState).toBe('idle');
    await expect(entering).resolves.toBe('cancelled');
    await expect(presence.setPresent(false)).resolves.toBe('cancelled');
    await flush();
  });

  it('completes an exit when its node goes away mid-animation', async () => {
    const el = attached();
    const started = stubAnimate(el);
    const presence = createMotionPresence({ ...base, present: true });
    presence.setNode(el);
    const exiting = presence.setPresent(false);
    presence.setNode(null);
    expect(started[0]?.playState).toBe('idle');
    await expect(exiting).resolves.toBe('instant');
    expect(presence.getSnapshot().mounted).toBe(false);
  });
});

describe('motion packaging', () => {
  it('stays out of the core root barrel and documents every export', async () => {
    const motion = await import('../src/motion/index.ts');
    for (const name of [
      'animate',
      'createFlip',
      'createMotionPresence',
      'timeline',
      'springEasing',
    ]) {
      expect(name in root, name).toBe(false);
      expect(name in motion, name).toBe(true);
    }
    const exportsMap = JSON.parse(readFileSync('packages/core/package.json', 'utf8')).exports;
    expect(exportsMap['./motion']).toBe('./src/motion/index.ts');
    expect(exportsMap['./motion/spring']).toBe('./src/motion/spring.ts');

    const doc = readFileSync('packages/core/docs/core-motion.md', 'utf8');
    const source =
      readFileSync('packages/core/src/motion/index.ts', 'utf8') +
      readFileSync('packages/core/src/motion/spring.ts', 'utf8');
    const names = new Set<string>();
    for (const match of source.matchAll(/export\s+\{([^}]*)\}/g)) {
      for (const raw of (match[1] ?? '').split(',')) {
        const name = raw.trim().replace(/^type\s+/, '');
        if (name) names.add(name);
      }
    }
    for (const match of source.matchAll(/export\s+(?:function|const|type)\s+(\w+)/g)) {
      if (match[1]) names.add(match[1]);
    }
    expect(names.size).toBeGreaterThan(40);
    const missing = [...names].filter((name) => !new RegExp(`\`(type )?${name}\\b`).test(doc));
    expect(missing).toEqual([]);
  });
});
