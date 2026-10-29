import { cleanup, screen } from '@testing-library/svelte';
import {
  MAX_STAGGER_SPAN,
  MOTION_LEVELS,
  resolveMotionLevel,
  SUBTLE_DURATION_SCALE,
  stagger,
} from '@texuli/core/motion';
import { SPEC_MOTION_PRESETS, SPEC_MOTION_STAGGERS } from '@texuli/spec/motion';
import { MOTION_DURATIONS, MOTION_EASINGS } from '@texuli/tokens/motion';
import { flushSync } from 'svelte';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createPlayerMotion, EXIT_FALLBACK_MS, playerMotionLevel } from '../src/motion/context.ts';
import {
  exitKeyframes,
  PLAYER_MOTION_DURATIONS,
  PLAYER_MOTION_EASINGS,
  parseCssTime,
  presetKeyframes,
} from '../src/motion/keyframes.ts';
import {
  PLAYER_MAX_STAGGER_SPAN,
  PLAYER_STAGGER_STEPS,
  retainLeaving,
  staggerDelays,
  withStagger,
} from '../src/motion/plan.ts';
import { createLayoutMotion, playEnter } from '../src/motion/runtime.ts';
import { mountPlayer, type PlayerProps } from '../src/mount.ts';
import type { PlayerPaintNode } from '../src/types.ts';

// ── A controllable Web Animations stand-in ───────────────────
class FakeAnimation {
  playState: 'running' | 'finished' | 'idle' = 'running';
  onfinish: (() => void) | null = null;
  oncancel: (() => void) | null = null;
  readonly target: Element;
  readonly keyframes: Keyframe[];
  readonly options: KeyframeAnimationOptions;
  readonly finished: Promise<FakeAnimation>;
  #resolve: (value: FakeAnimation) => void = () => {};
  #reject: (reason: unknown) => void = () => {};
  constructor(target: Element, keyframes: Keyframe[], options: KeyframeAnimationOptions) {
    this.target = target;
    this.keyframes = keyframes;
    this.options = options;
    this.finished = new Promise((resolve, reject) => {
      this.#resolve = resolve;
      this.#reject = reject;
    });
  }
  finish(): void {
    if (this.playState !== 'running') return;
    this.playState = 'finished';
    this.onfinish?.();
    this.#resolve(this);
  }
  cancel(): void {
    if (this.playState !== 'running') return;
    this.playState = 'idle';
    this.oncancel?.();
    this.#reject(new Error('AbortError'));
  }
  reverse(): void {}
  pause(): void {}
  play(): void {}
}

let started: FakeAnimation[] = [];
const proto = HTMLElement.prototype as unknown as { animate?: unknown };
const original = proto.animate;

beforeEach(() => {
  started = [];
  proto.animate = function (
    this: Element,
    keyframes: Keyframe[],
    options: KeyframeAnimationOptions
  ) {
    const animation = new FakeAnimation(this, keyframes, options);
    started.push(animation);
    return animation;
  };
});

afterEach(() => {
  proto.animate = original;
  cleanup();
  document.body.innerHTML = '';
});

const flush = async (rounds = 10) => {
  for (let i = 0; i < rounds; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
};

// ── Fixtures ─────────────────────────────────────────────────
const layoutLoader = async () =>
  import('../src/layouts/ContentLayout.svelte').then((m) => m.default);
const loaders = { 'layout-page': layoutLoader, 'layout-card': layoutLoader };
const details = { op: 'eq', left: { op: 'var', name: 'details' }, right: { op: 'num', value: 1 } };
const card = (title: string, extra: object = {}) => ({
  id: 'layout-card',
  props: { title },
  ...extra,
});

function envelope(children: unknown[], extra: Record<string, unknown> = {}) {
  return {
    format: 'texuli-blueprint',
    version: 1,
    id: 'motion-player',
    catalog: 'a'.repeat(64),
    status: 'draft',
    createdAt: '2026-10-28T09:00:00Z',
    updatedAt: '2026-10-28T09:00:00Z',
    generator: { kind: 'agent', name: 'Fictional agent' },
    spec: '0.6.0',
    state: { details: { type: 'boolean' } },
    ...extra,
    tree: { id: 'layout-page', props: { title: 'Motion report' }, children },
  };
}

function mount(props: PlayerProps) {
  const target = document.createElement('div');
  document.body.append(target);
  return { target, mounted: mountPlayer(target, { loaders, ...props }) };
}

const animatedTitles = () =>
  started.map((animation) => animation.target.querySelector('h2, h3, h4')?.textContent?.trim());

// ── The plan, as data ────────────────────────────────────────
describe('the motion plan maps names to tokens', () => {
  it('uses the token durations, easings and the core stagger and level rules', () => {
    for (const step of ['fast', 'base', 'slow'] as const) {
      expect(PLAYER_MOTION_DURATIONS[step]).toBe(MOTION_DURATIONS[step]);
    }
    expect(PLAYER_MOTION_EASINGS.standard).toBe(MOTION_EASINGS.standard);
    expect(PLAYER_MOTION_EASINGS.enter).toBe(MOTION_EASINGS.enter);
    expect(PLAYER_MOTION_EASINGS.exit).toBe(MOTION_EASINGS.exit);
    expect(PLAYER_MAX_STAGGER_SPAN).toBe(MAX_STAGGER_SPAN);
    expect(Object.keys(PLAYER_STAGGER_STEPS)).toEqual([...SPEC_MOTION_STAGGERS]);
    expect(PLAYER_STAGGER_STEPS.fast).toBe(MOTION_DURATIONS.fast / 5);
    expect(PLAYER_STAGGER_STEPS.base).toBe(MOTION_DURATIONS.base / 5);
    for (const count of [0, 1, 2, 5, 40, 500]) {
      for (const step of SPEC_MOTION_STAGGERS) {
        expect(staggerDelays(count, step), `${count} ${step}`).toEqual(
          stagger(count, PLAYER_STAGGER_STEPS[step])
        );
      }
    }
    // A huge list never spreads past the cap.
    expect(Math.max(...staggerDelays(10_000, 'base'))).toBeLessThanOrEqual(MAX_STAGGER_SPAN);
    const levels = [undefined, ...MOTION_LEVELS, 'turbo'];
    for (const host of levels) {
      for (const document of levels) {
        for (const reducedMotion of [false, true]) {
          expect(playerMotionLevel({ host, document, reducedMotion })).toBe(
            resolveMotionLevel({
              host: host as never,
              document: document as never,
              reducedMotion,
            })
          );
        }
      }
    }
  });

  it('builds closed keyframes for every preset, mirrored right to left, and reverses exits', () => {
    for (const preset of SPEC_MOTION_PRESETS) {
      const frames = presetKeyframes(preset);
      expect(frames[0]?.opacity).toBe(0);
      expect(frames.at(-1)?.opacity).toBe(1);
      expect(exitKeyframes(preset)).toEqual([...frames].reverse());
    }
    expect(presetKeyframes('slide-start', 'ltr')[0]?.transform).toBe('translateX(-16px)');
    expect(presetKeyframes('slide-start', 'rtl')[0]?.transform).toBe('translateX(16px)');
    expect(presetKeyframes('slide-end', 'rtl')[0]?.transform).toBe('translateX(-16px)');
    expect(parseCssTime('150ms')).toBe(150);
    expect(parseCssTime(' 0.2s ')).toBe(200);
    for (const bad of ['', 'calc(1s)', '-5ms', '1e9ms', 'var(--x)']) {
      expect(parseCssTime(bad), bad).toBeNull();
    }
  });

  it('staggers only entering children and keeps leaving nodes in place', () => {
    const node = (path: string, extra: object = {}): PlayerPaintNode =>
      ({
        kind: 'component',
        id: 'layout-card',
        path,
        props: {},
        component: (() => null) as never,
        children: [],
        ...extra,
      }) as PlayerPaintNode;
    const children = [
      node('0.children.0', { motion: { enter: 'rise' } }),
      node('0.children.1'),
      node('0.children.2', { motion: { enter: 'fade' } }),
    ];
    expect(withStagger(children, undefined)).toBe(children);
    expect(withStagger(children, { stagger: 'none' })).toBe(children);
    const staggered = withStagger(children, { stagger: 'base' });
    expect(staggered.map((c) => (c.kind === 'component' ? c.motionDelay : null))).toEqual([
      undefined,
      undefined,
      40,
    ]);

    const before = [
      node('0', {
        children: [
          node('0.children.0'),
          node('0.children.1', { motion: { exit: 'fade' } }),
          node('0.children.2', { motion: { enter: 'fade' } }),
        ],
      }),
    ];
    const after = [node('0', { children: [node('0.children.0')] })];
    const kept = retainLeaving(after, before, new Set());
    const root = kept[0] as Extract<PlayerPaintNode, { kind: 'component' }>;
    // Only the node with an exit stays, at its old index, marked leaving.
    expect(
      root.children.map((c) => [c.path, c.kind === 'component' && c.leaving === true])
    ).toEqual([
      ['0.children.0', false],
      ['0.children.1', true],
    ]);
    // Once its exit is done it goes; nothing changes when nothing left.
    expect(retainLeaving(after, kept, new Set(['0.children.1']))).toBe(after);
    expect(retainLeaving(before, before, new Set())).toBe(before);
    // A bounded number of nodes is kept at once.
    const many = [
      node('0', {
        children: Array.from({ length: 100 }, (_, i) =>
          node(`0.children.${i}`, { motion: { exit: 'fade' } })
        ),
      }),
    ];
    const capped = retainLeaving([node('0')], many, new Set());
    expect((capped[0] as unknown as { children: unknown[] }).children.length).toBe(64);
  });
});

// ── The runtime on @texuli/core/motion ───────────────────────
describe('the motion runtime', () => {
  it('plays nothing on a detached node, at level none or under reduced motion', () => {
    const wrapper = document.createElement('div');
    wrapper.append(document.createElement('section'));
    playEnter(wrapper, { enter: 'rise' }, { level: 'full', reducedMotion: false });
    expect(started).toHaveLength(0);
    document.body.append(wrapper);
    playEnter(wrapper, { enter: 'rise' }, { level: 'none', reducedMotion: false });
    playEnter(wrapper, { enter: 'rise' }, { level: 'full', reducedMotion: true });
    expect(started).toHaveLength(0);
    playEnter(
      wrapper,
      { enter: 'rise', duration: 'slow' },
      { level: 'full', reducedMotion: false }
    );
    expect(started).toHaveLength(1);
    expect(started[0]?.options.duration).toBe(300);
    expect(started[0]?.options.fill).toBe('none');
  });

  it('moves layout nodes from where they were (FLIP)', () => {
    const wrapper = document.createElement('div');
    const item = document.createElement('section');
    wrapper.append(item);
    document.body.append(wrapper);
    let top = 0;
    item.getBoundingClientRect = () =>
      ({
        left: 0,
        top,
        width: 100,
        height: 40,
        x: 0,
        y: top,
        right: 100,
        bottom: top + 40,
      }) as DOMRect;
    const layout = createLayoutMotion();
    const wrappers = new Map([['0.children.1', wrapper]]);
    layout.measure(wrappers, { level: 'full', reducedMotion: false });
    top = 80;
    layout.play(wrappers);
    expect(started).toHaveLength(1);
    expect(String(started[0]?.keyframes[0]?.transform)).toContain('-80px');
    // Reduced motion: measured nothing, plays nothing.
    started = [];
    layout.measure(wrappers, { level: 'full', reducedMotion: true });
    top = 0;
    layout.play(wrappers);
    expect(started).toHaveLength(0);
  });

  it('loads nothing on the server and lets a stuck exit go after the fallback', async () => {
    const exited: string[] = [];
    const motion = createPlayerMotion({
      settings: () => ({ level: 'full', reducedMotion: false }),
      onExited: (path) => exited.push(path),
      importRuntime: () => new Promise(() => {}),
    });
    expect(motion.runtime()).toBeNull();
    // Without the runtime an exit is instant (the node goes at once).
    const wrapper = document.createElement('div');
    expect(motion.playExit(wrapper, { exit: 'fade' })).toBeNull();
    expect(EXIT_FALLBACK_MS).toBeLessThanOrEqual(1_200);
    motion.dispose();
    motion.exited('0.children.1');
    expect(exited).toEqual([]);
  });
});

// ── The player ───────────────────────────────────────────────
describe('the player paints spec 0.6.0 motion', () => {
  it('enters new nodes with their preset, staggered, and never animates nodes without motion', async () => {
    const { mounted, target } = mount({
      blueprint: envelope([
        card('Static card'),
        {
          id: 'layout-grid',
          props: { columns: 2 },
          motion: { stagger: 'fast' },
          children: [
            card('First tile', { motion: { enter: 'rise' } }),
            card('Second tile', { motion: { enter: 'scale', duration: 'fast' } }),
          ],
        },
      ]),
      loaders: { ...loaders, 'layout-grid': layoutLoader },
    });
    expect(await screen.findByText('Second tile')).toBeTruthy();
    await flush();
    expect(animatedTitles()).toEqual(['First tile', 'Second tile']);
    const [first, second] = started;
    expect(first?.keyframes).toEqual(presetKeyframes('rise'));
    expect(first?.options).toMatchObject({ duration: 200, delay: 0, easing: MOTION_EASINGS.enter });
    expect(second?.keyframes).toEqual(presetKeyframes('scale'));
    expect(second?.options).toMatchObject({ duration: 150, delay: 30 });
    // The wrapper has no box and carries no inline style.
    const wrappers = target.querySelectorAll('[data-tx-player-motion]');
    expect(wrappers).toHaveLength(3);
    for (const wrapper of wrappers) {
      expect(wrapper.classList.contains('tx-player__motion')).toBe(true);
      expect(wrapper.hasAttribute('style')).toBe(false);
    }
    mounted.dispose();
  });

  it('honors reduced motion, the blueprint level and the host level', async () => {
    const children = [card('Moving card', { motion: { enter: 'rise' } })];
    const cases: [string, PlayerProps, number][] = [
      ['reduced motion', { blueprint: envelope(children), motion: 'reduce' }, 0],
      ['blueprint none', { blueprint: envelope(children, { motion: { level: 'none' } }) }, 0],
      [
        'host none over blueprint full',
        { blueprint: envelope(children, { motion: { level: 'full' } }), motionLevel: 'none' },
        0,
      ],
      ['blueprint full', { blueprint: envelope(children, { motion: { level: 'full' } }) }, 1],
    ];
    for (const [name, props, count] of cases) {
      started = [];
      const { mounted } = mount(props);
      expect(await screen.findByText('Moving card'), name).toBeTruthy();
      await flush();
      expect(started.length, name).toBe(count);
      mounted.dispose();
      cleanup();
      document.body.innerHTML = '';
    }
    // Subtle: shorter, and the travel is dropped (the fade stays).
    started = [];
    const { mounted } = mount({ blueprint: envelope(children), motionLevel: 'subtle' });
    expect(await screen.findByText('Moving card')).toBeTruthy();
    await flush();
    expect(started).toHaveLength(1);
    expect(started[0]?.options.duration).toBe(200 * SUBTLE_DURATION_SCALE);
    expect(JSON.stringify(started[0]?.keyframes)).not.toContain('transform');
    mounted.dispose();
  });

  it('keeps a leaving node inert until its exit finishes, then drops it', async () => {
    const blueprint = envelope([
      card('Always shown'),
      card('Details card', { when: details, motion: { enter: 'fade', exit: 'rise' } }),
    ]);
    const { mounted, target } = mount({ blueprint });
    expect(await screen.findByText('Always shown')).toBeTruthy();
    expect(screen.queryByText('Details card')).toBeNull();
    expect(mounted.setState('details', true)).toBe(true);
    expect(await screen.findByText('Details card')).toBeTruthy();
    await flush();
    expect(started).toHaveLength(1);
    started[0]?.finish();
    started = [];

    expect(mounted.setState('details', false)).toBe(true);
    flushSync();
    await flush();
    // Still painted, inert, playing the reversed preset.
    const leaving = target.querySelector('[data-tx-player-motion-leaving]');
    expect(leaving?.hasAttribute('inert')).toBe(true);
    expect(leaving?.textContent).toContain('Details card');
    expect(started).toHaveLength(1);
    expect(started[0]?.keyframes).toEqual(exitKeyframes('rise'));
    started[0]?.finish();
    await expect.poll(() => screen.queryByText('Details card')).toBeNull();
    expect(target.querySelector('[data-tx-player-motion-leaving]')).toBeNull();

    // It can enter and leave again.
    expect(mounted.setState('details', true)).toBe(true);
    expect(await screen.findByText('Details card')).toBeTruthy();
    mounted.dispose();
  });

  it('drops a leaving node at once under reduced motion', async () => {
    const blueprint = envelope([
      card('Always shown'),
      card('Details card', { when: details, motion: { exit: 'fade' } }),
    ]);
    const { mounted } = mount({ blueprint, motion: 'reduce', initialState: { details: true } });
    expect(await screen.findByText('Details card')).toBeTruthy();
    expect(mounted.setState('details', false)).toBe(true);
    await expect.poll(() => screen.queryByText('Details card')).toBeNull();
    expect(started).toHaveLength(0);
    mounted.dispose();
  });

  it('paints a refused motion without animating it', async () => {
    const { mounted, target } = mount({
      blueprint: envelope([card('Hostile card', { motion: { enter: 'fade', css: 'x' } })]),
      invalidPolicy: 'preview',
    });
    expect(await screen.findByText('Hostile card')).toBeTruthy();
    await flush();
    expect(started).toHaveLength(0);
    expect(target.querySelector('[data-tx-player-motion]')).toBeNull();
    mounted.dispose();
  });
});
