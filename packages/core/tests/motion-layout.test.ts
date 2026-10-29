import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createFlip,
  createSharedElements,
  flipTransform,
  MAX_STAGGER_SPAN,
  MAX_TIMELINE_STEPS,
  parallel,
  sequence,
  stagger,
  startScopedViewTransition,
  timeline,
} from '../src/motion/index.ts';
import { attached, type Box, FakeAnimation, flush, stubAnimate, stubBox } from './motion-fakes.ts';

afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

const at = (left: number, top: number, width = 100, height = 20): Box => ({
  left,
  top,
  width,
  height,
});

function list(count: number, log?: string[]) {
  return Array.from({ length: count }, (_, i) => {
    const element = attached();
    const box = stubBox(element, at(0, i * 20), log);
    const started = stubAnimate(element, log);
    return { key: `item-${i}`, element, box, started };
  });
}
const entries = (items: ReturnType<typeof list>) => items.map((i) => [i.key, i.element] as const);

describe('flip', () => {
  it('computes the inverted transform, with scale only when sizes change', () => {
    expect(flipTransform(at(0, 0), at(0, 0))).toBeNull();
    expect(flipTransform(at(10, 40), at(0, 0))).toBe('translate(10px, 40px)');
    expect(flipTransform(at(0, 0, 50, 10), at(0, 0, 100, 20))).toBe(
      'translate(0px, 0px) scale(0.5, 0.5)'
    );
    expect(flipTransform(at(0, 0, 50, 10), at(0, 0, 100, 20), false)).toBeNull();
    // Hostile layout values are clamped.
    expect(flipTransform(at(1e12, -1e12), at(0, 0))).toBe('translate(100000px, -100000px)');
  });

  it('reads every box before writing any animation, and animates only moved items', async () => {
    const log: string[] = [];
    const items = list(4, log);
    const flip = createFlip({ reducedMotion: false, duration: 200 });
    flip.measure(entries(items));
    expect(log.every((entry) => entry === 'read')).toBe(true);
    // Reverse the list: item i moves to slot 3 − i (the two middle ones swap too).
    items.forEach((item, i) => {
      item.box.set({ top: (3 - i) * 20 });
    });
    log.length = 0;
    const run = flip.play(entries(items));
    const firstWrite = log.indexOf('write');
    expect(firstWrite).toBe(4);
    expect(log.slice(firstWrite).every((entry) => entry === 'write')).toBe(true);
    expect(items[0]?.started[0]?.keyframes).toEqual([
      { transform: 'translate(0px, -60px)', transformOrigin: '0 0' },
      { transform: 'none', transformOrigin: '0 0' },
    ]);
    expect(run.animations).toHaveLength(4);
    for (const item of items) item.started[0]?.finish();
    await expect(run.finished).resolves.toBe('finished');

    // Nothing moved: nothing animates.
    flip.measure(entries(items));
    const still = flip.play(entries(items));
    expect(still.animations).toHaveLength(0);
    await expect(still.finished).resolves.toBe('instant');
  });

  it('fades or slides inserts from a logical side, mirrored in right-to-left', () => {
    for (const dir of ['ltr', 'rtl'] as const) {
      const items = list(1);
      const flip = createFlip({ reducedMotion: false, enter: 'inline-start', enterDistance: 12 });
      flip.measure([]);
      const item = items[0];
      if (!item) throw new Error('no item');
      item.element.setAttribute('dir', dir);
      item.element.style.direction = dir;
      flip.play(entries(items));
      expect(item.started[0]?.keyframes, dir).toEqual([
        { opacity: 0, transform: `translate(${dir === 'rtl' ? 12 : -12}px, 0px)` },
        { opacity: 1, transform: 'none' },
      ]);
    }
    const [plain] = list(1);
    if (!plain) throw new Error('no item');
    createFlip({ reducedMotion: false, enter: false }).play([[plain.key, plain.element]]);
    expect(plain.started).toHaveLength(0);
  });

  it('interrupts a running play when measured again', async () => {
    const items = list(2);
    const flip = createFlip({ reducedMotion: false });
    flip.measure(entries(items));
    items[0]?.box.set({ top: 20 });
    items[1]?.box.set({ top: 0 });
    const first = flip.play(entries(items));
    flip.measure(entries(items));
    await expect(first.finished).resolves.toBe('interrupted');
    expect(items[0]?.started[0]?.playState).toBe('idle');
    flip.cancel();
  });

  it('commits instantly under reduced motion, past the item limit, and skips detached or NaN boxes', async () => {
    const reduced = list(3);
    const flipReduced = createFlip({ reducedMotion: true });
    flipReduced.measure(entries(reduced));
    for (const item of reduced) item.box.set({ left: 50 });
    const run = flipReduced.play(entries(reduced));
    expect(run.instantReason).toBe('reduced-motion');
    expect(reduced.flatMap((i) => i.started)).toHaveLength(0);

    const many = list(5);
    const limited = createFlip({ reducedMotion: false, maxItems: 2 });
    limited.measure(entries(many));
    for (const item of many) item.box.set({ left: 50 });
    expect(limited.play(entries(many)).instantReason).toBe('limit');
    expect(many.flatMap((i) => i.started)).toHaveLength(0);

    const odd = list(2);
    const flip = createFlip({ reducedMotion: false });
    flip.measure(entries(odd));
    odd[0]?.box.set({ left: Number.NaN });
    odd[1]?.element.remove();
    const skipped = flip.play(entries(odd));
    expect(odd.flatMap((i) => i.started)).toHaveLength(0);
    await expect(skipped.finished).resolves.toBe('instant');
  });

  it('snaps moved items and only fades inserts at subtle', () => {
    const items = list(2);
    const flip = createFlip({ reducedMotion: false, level: 'subtle', enter: 'block-end' });
    flip.measure([[items[0]?.key ?? '', items[0]?.element as Element]]);
    items[0]?.box.set({ top: 100 });
    const run = flip.play(entries(items));
    expect(items[0]?.started).toHaveLength(0);
    expect(items[1]?.started[0]?.keyframes).toEqual([{ opacity: 0 }, { opacity: 1 }]);
    expect(run.animations).toHaveLength(1);
  });

  it('stays linear on a large list', () => {
    const items = list(2000);
    const flip = createFlip({ reducedMotion: false, maxItems: 5000 });
    const started = performance.now();
    flip.measure(entries(items));
    items.forEach((item, i) => {
      item.box.set({ top: (1999 - i) * 20 });
    });
    const run = flip.play(entries(items));
    expect(run.animations.length).toBeGreaterThan(1990);
    expect(performance.now() - started).toBeLessThan(3000);
  });
});

describe('shared elements', () => {
  it('plays a captured box onto the new element and cross-fades when the old one stays', async () => {
    const from = attached();
    const to = attached();
    stubBox(from, at(0, 0, 50, 50));
    stubBox(to, at(100, 200, 100, 100));
    const fromAnimations = stubAnimate(from);
    const toAnimations = stubAnimate(to);
    const shared = createSharedElements({ reducedMotion: false });
    expect(shared.capture('photo', from)).toBe(true);
    const run = shared.play('photo', to);
    expect(toAnimations[0]?.keyframes).toEqual([
      {
        transform: 'translate(-100px, -200px) scale(0.5, 0.5)',
        transformOrigin: '0 0',
        opacity: 0,
      },
      { transform: 'none', transformOrigin: '0 0', opacity: 1 },
    ]);
    expect(fromAnimations[0]?.keyframes).toEqual([
      { transform: 'none', transformOrigin: '0 0', opacity: 1 },
      { transform: 'translate(100px, 200px) scale(2, 2)', transformOrigin: '0 0', opacity: 0 },
    ]);
    expect(shared.has('photo')).toBe(false);
    fromAnimations[0]?.finish();
    toAnimations[0]?.finish();
    await expect(run.finished).resolves.toBe('finished');

    // The old element is gone: only the new one moves, without a fade.
    shared.capture('photo', from);
    from.remove();
    shared.play('photo', to);
    expect(toAnimations[1]?.keyframes).toEqual([
      { transform: 'translate(-100px, -200px) scale(0.5, 0.5)', transformOrigin: '0 0' },
      { transform: 'none', transformOrigin: '0 0' },
    ]);
  });

  it('bounds its snapshots and fails closed on missing keys and detached elements', async () => {
    const shared = createSharedElements({ reducedMotion: false, maxEntries: 3 });
    const els = Array.from({ length: 5 }, (_, i) => {
      const el = attached();
      stubBox(el, at(i, i));
      return el;
    });
    els.forEach((el, i) => {
      shared.capture(`k${i}`, el);
    });
    expect(shared.size).toBe(3);
    expect(shared.has('k0')).toBe(false);
    expect(shared.has('k4')).toBe(true);
    shared.release('k4');
    expect(shared.has('k4')).toBe(false);
    expect(shared.capture('loose', document.createElement('div'))).toBe(false);
    await expect(shared.play('missing', els[0] as Element).finished).resolves.toBe('instant');
    shared.clear();
    expect(shared.size).toBe(0);
  });

  it('uses an element-scoped view transition when there is one, and applies the update otherwise', async () => {
    const scope = attached();
    const update = vi.fn();
    expect(await startScopedViewTransition(scope, update, { reducedMotion: false })).toBe(
      'instant'
    );
    expect(update).toHaveBeenCalledTimes(1);

    const start = vi.fn((fn: () => void) => {
      fn();
      return { finished: Promise.resolve() };
    });
    Object.assign(scope, { startViewTransition: start });
    expect(await startScopedViewTransition(scope, update, { reducedMotion: false })).toBe(
      'finished'
    );
    expect(start).toHaveBeenCalledTimes(1);

    // Reduced motion and level none skip the transition but still apply the update.
    expect(await startScopedViewTransition(scope, update, { reducedMotion: true })).toBe('instant');
    expect(
      await startScopedViewTransition(scope, update, { level: 'none', reducedMotion: false })
    ).toBe('instant');
    expect(start).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledTimes(4);

    Object.assign(scope, {
      startViewTransition: () => {
        throw new Error('busy');
      },
    });
    expect(await startScopedViewTransition(scope, update, { reducedMotion: false })).toBe(
      'instant'
    );
    expect(update).toHaveBeenCalledTimes(5);
    expect(await startScopedViewTransition(null, update)).toBe('instant');
  });
});

describe('timelines', () => {
  const FADE: Keyframe[] = [{ opacity: 0 }, { opacity: 1 }];

  it('staggers from any origin and compresses long lists into the span cap', () => {
    expect(stagger(4, 50)).toEqual([0, 50, 100, 150]);
    expect(stagger(4, 50, { from: 'end' })).toEqual([150, 100, 50, 0]);
    expect(stagger(5, 10, { from: 'center' })).toEqual([20, 10, 0, 10, 20]);
    expect(stagger(3, 10, { from: 1 })).toEqual([10, 0, 10]);
    const long = stagger(10_000, 50);
    expect(long).toHaveLength(10_000);
    expect(Math.max(...long)).toBeLessThanOrEqual(MAX_STAGGER_SPAN);
    for (const [count, each] of [
      [Number.NaN, 10],
      [-1, 10],
    ] as const) {
      expect(stagger(count, each)).toEqual([]);
    }
    expect(stagger(3, Number.NaN)).toEqual([0, 0, 0]);
    expect(stagger(1e12, 1)).toHaveLength(10_000);
  });

  it('lays steps out in series and in parallel on one shared clock', () => {
    const [a, b, c] = [attached(), attached(), attached()];
    const runs = [a, b, c].map((el) => stubAnimate(el));
    const tl = timeline(
      [
        { target: a, keyframes: FADE, duration: 100 },
        parallel(
          { target: b, keyframes: FADE, duration: 200 },
          { target: c, keyframes: FADE, duration: 50, at: 30 }
        ),
      ],
      { reducedMotion: false }
    );
    expect(tl.duration).toBe(300);
    const opts = runs.map((r) => r[0]?.options);
    expect(opts.map((o) => o?.delay)).toEqual([0, 100, 130]);
    expect(opts.map((o) => (o?.delay ?? 0) + (o?.duration as number) + (o?.endDelay ?? 0))).toEqual(
      [300, 300, 300]
    );
    expect(opts.map((o) => o?.fill)).toEqual(['none', 'backwards', 'backwards']);
    // Paused until played.
    const animations = runs.map((r) => r[0] as FakeAnimation);
    expect(animations.every((x) => x.playState === 'paused')).toBe(true);
    tl.play();
    tl.seek(1e9);
    expect(animations.every((x) => x.currentTime === 300)).toBe(true);
    tl.seek(Number.NaN);
    expect(animations.every((x) => x.currentTime === 0)).toBe(true);
    tl.reverse();
    tl.pause();
    expect(animations[0]?.calls).toEqual(['pause', 'play', 'reverse', 'pause']);
  });

  it('plays sequences with stagger and settles once on cancel or finish', async () => {
    const els = [attached(), attached(), attached()];
    const runs = els.map((el) => stubAnimate(el));
    const offsets = stagger(3, 40);
    const onFinish = vi.fn();
    const seq = sequence(
      [
        parallel(
          ...els.map((target, i) => ({ target, keyframes: FADE, duration: 100, at: offsets[i] }))
        ),
      ],
      { reducedMotion: false, onFinish }
    );
    expect(runs.map((r) => r[0]?.options.delay)).toEqual([0, 40, 80]);
    expect(runs.every((r) => r[0]?.playState === 'running')).toBe(true);
    seq.cancel();
    seq.finish();
    await expect(seq.finished).resolves.toBe('cancelled');
    expect(onFinish).toHaveBeenCalledTimes(1);

    const done = sequence([{ target: els[0], keyframes: FADE }], { reducedMotion: false });
    done.finish();
    await expect(done.finished).resolves.toBe('finished');
  });

  it('scales offsets at subtle and commits at once when motion must not run', async () => {
    const [a, b] = [attached(), attached()];
    const runs = [a, b].map((el) => stubAnimate(el));
    const subtle = sequence(
      [
        { target: a, keyframes: FADE, duration: 500 },
        { target: b, keyframes: FADE, duration: 500 },
      ],
      { reducedMotion: false, level: 'subtle' }
    );
    expect(subtle.duration).toBe(600);
    expect(runs[1]?.[0]?.options.delay).toBe(300);

    for (const options of [
      { reducedMotion: true },
      { level: 'none' as const, reducedMotion: false },
    ]) {
      const onFinish = vi.fn();
      const tl = sequence([{ target: a, keyframes: FADE }], { ...options, onFinish });
      tl.play();
      tl.seek(10);
      tl.reverse();
      expect(onFinish).toHaveBeenCalledTimes(1);
      expect(tl.duration).toBe(0);
      await expect(tl.finished).resolves.toBe('instant');
    }

    const huge = Array.from({ length: MAX_TIMELINE_STEPS + 1 }, () => ({
      target: a,
      keyframes: FADE,
    }));
    expect(sequence(huge, { reducedMotion: false }).instantReason).toBe('limit');
    expect(sequence([], {}).instantReason).toBe('zero-duration');
    expect(sequence([{ target: null, keyframes: FADE }], {}).instantReason).toBe('server');
    await flush();
  });
});
