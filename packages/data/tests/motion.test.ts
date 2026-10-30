import { cleanup, render } from '@testing-library/svelte';
import { tick } from 'svelte';
import { loadMotionRuntime } from 'texuli/motion';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeAnimation } from '../../core/tests/motion-fakes.ts';
import { createLazyListMotion } from '../src/motion/lazy-list-motion.ts';
import MotionDataHarness from './fixtures/MotionDataHarness.svelte';

// The real createListMotion, wrapped so a test can see whether a view ever
// reached it: the views load texuli/motion lazily (G86) and only call it once
// a layout change could animate.
const listMotion = vi.hoisted(() => ({ calls: 0 }));
vi.mock('texuli/motion', async (importOriginal) => {
  const original = await importOriginal<typeof import('texuli/motion')>();
  return {
    ...original,
    createListMotion: (...args: Parameters<typeof original.createListMotion>) => {
      listMotion.calls += 1;
      return original.createListMotion(...args);
    },
  };
});

// Layout motion in @texuli/data (ADR-013): DataGrid rows and Board cards play
// FLIP through @texuli/core/motion (a Web Animations stand-in here) when their
// order or place changes, and commit at once under reduced motion and at
// level `none`.

type Started = { target: Element; keyframes: Keyframe[] };
let started: Started[] = [];
const originalAnimate = HTMLElement.prototype.animate;
const originalRect = HTMLElement.prototype.getBoundingClientRect;

/** happy-dom has no layout: a box from the element's place among its siblings (and its cell). */
function layoutBox(this: HTMLElement): DOMRect {
  const index = this.parentElement ? [...this.parentElement.children].indexOf(this) : 0;
  const cell = this.closest('[data-board-cell]');
  const column = cell
    ? [...(this.closest('.tx-board')?.querySelectorAll('[data-board-cell]') ?? [])].indexOf(cell)
    : 0;
  const left = column * 300;
  const top = index * 40;
  return {
    left,
    top,
    width: 200,
    height: 36,
    right: left + 200,
    bottom: top + 36,
    x: left,
    y: top,
  } as DOMRect;
}

const rows = [
  { id: 'a', title: 'Alpha', column: 'todo', rank: 'a0' },
  { id: 'b', title: 'Bravo', column: 'todo', rank: 'a1' },
  { id: 'c', title: 'Charlie', column: 'todo', rank: 'a2' },
];

async function settle(): Promise<void> {
  for (let i = 0; i < 6; i += 1) {
    await tick();
    await Promise.resolve();
  }
}

beforeAll(async () => {
  expect(await loadMotionRuntime()).not.toBeNull();
});
beforeEach(() => {
  started = [];
  HTMLElement.prototype.animate = function animate(
    this: HTMLElement,
    keyframes: Keyframe[] | PropertyIndexedKeyframes | null,
    options?: number | KeyframeAnimationOptions
  ) {
    const frames = (keyframes ?? []) as Keyframe[];
    started.push({ target: this, keyframes: frames });
    return new FakeAnimation(
      this,
      frames,
      (typeof options === 'number'
        ? { duration: options }
        : (options ?? {})) as KeyframeAnimationOptions
    ) as unknown as Animation;
  };
  HTMLElement.prototype.getBoundingClientRect = layoutBox;
});
afterEach(() => {
  cleanup();
  HTMLElement.prototype.animate = originalAnimate;
  HTMLElement.prototype.getBoundingClientRect = originalRect;
});

const moved = () =>
  started.filter((entry) => String(entry.keyframes[0]?.transform ?? '').startsWith('translate'));

describe('DataGrid rows', () => {
  it('glide to their new place when the sort flips, and nothing plays on mount', async () => {
    const view = render(MotionDataHarness, { props: { kind: 'grid', tasks: rows } });
    await settle();
    expect(started).toHaveLength(0);
    await view.rerender({ kind: 'grid', tasks: rows, sortDir: 'desc' });
    await settle();
    const targets = moved().map((entry) => entry.target.getAttribute('data-tx-row-id'));
    // Alpha and Charlie swap ends (Bravo stays in the middle).
    expect(targets.sort()).toEqual(['a', 'c']);
  });

  it('is instant under reduced motion and at level none', async () => {
    for (const props of [{ reducedMotion: true }, { level: 'none' as const }]) {
      started = [];
      const view = render(MotionDataHarness, { props: { kind: 'grid', tasks: rows, ...props } });
      await settle();
      await view.rerender({ kind: 'grid', tasks: rows, sortDir: 'desc', ...props });
      await settle();
      expect(started, JSON.stringify(props)).toHaveLength(0);
      view.unmount();
    }
  });
});

describe('Board cards', () => {
  const after = rows.map((task) => (task.id === 'a' ? { ...task, column: 'doing' } : task));

  it('glide to their new column when items change, and nothing plays on mount', async () => {
    const view = render(MotionDataHarness, { props: { kind: 'board', tasks: rows } });
    await settle();
    expect(started).toHaveLength(0);
    await view.rerender({ kind: 'board', tasks: after });
    await settle();
    const targets = moved().map((entry) => entry.target.getAttribute('data-item-id'));
    // Alpha moves a column over; Bravo and Charlie move up in To do.
    expect(targets.sort()).toEqual(['a', 'b', 'c']);
    const alpha = moved().find((entry) => entry.target.getAttribute('data-item-id') === 'a');
    expect(String(alpha?.keyframes[0]?.transform)).toContain('translate(-300px');
  });

  it('is instant under reduced motion and at level none', async () => {
    for (const props of [{ reducedMotion: true }, { level: 'none' as const }]) {
      started = [];
      const view = render(MotionDataHarness, { props: { kind: 'board', tasks: rows, ...props } });
      await settle();
      await view.rerender({ kind: 'board', tasks: after, ...props });
      await settle();
      expect(started, JSON.stringify(props)).toHaveLength(0);
      view.unmount();
    }
  });
});

describe('list motion loads lazily (G86)', () => {
  const sorted = { kind: 'grid' as const, tasks: rows };
  const moved = rows.map((task) => (task.id === 'a' ? { ...task, column: 'doing' } : task));
  const views = [
    { first: sorted, next: { ...sorted, sortDir: 'desc' as const } },
    {
      first: { kind: 'board' as const, tasks: rows },
      next: { kind: 'board' as const, tasks: moved },
    },
  ];

  async function mountAndChange(extra: Record<string, unknown>): Promise<void> {
    for (const { first, next } of views) {
      const view = render(MotionDataHarness, { props: { ...first, ...extra } });
      await settle();
      await view.rerender({ ...next, ...extra });
      await settle();
      view.unmount();
    }
  }

  it('never reaches texuli/motion when a change cannot animate', async () => {
    const reader = window.matchMedia;
    for (const [name, extra, readerReduces] of [
      ['motion={false}', { motion: false }, false],
      ['layout: false', { motion: { layout: false } }, false],
      ['level none', { level: 'none' }, false],
      ['forced reduced motion', { reducedMotion: true }, false],
      ["the reader's reduced motion", {}, true],
    ] as const) {
      listMotion.calls = 0;
      started = [];
      window.matchMedia = ((query: string) =>
        ({
          matches: readerReduces && query.includes('reduce'),
          media: query,
        }) as MediaQueryList) as typeof window.matchMedia;
      try {
        await mountAndChange(extra);
      } finally {
        window.matchMedia = reader;
      }
      expect(listMotion.calls, name).toBe(0);
      expect(started, name).toHaveLength(0);
    }
  });

  it('loads it once the mounted list can animate, also when the provider ignores the reader', async () => {
    listMotion.calls = 0;
    await mountAndChange({});
    expect(listMotion.calls).toBe(views.length);
    const reader = window.matchMedia;
    window.matchMedia = ((query: string) =>
      ({ matches: true, media: query }) as MediaQueryList) as typeof window.matchMedia;
    try {
      listMotion.calls = 0;
      await mountAndChange({ reducedMotion: false });
      expect(listMotion.calls).toBe(views.length);
    } finally {
      window.matchMedia = reader;
    }
  });

  it('the shim: mount first, a change before the load commits at once, a failed load retries', async () => {
    type Inner = { measure: number; play: number; cancel: number };
    const inner: Inner = { measure: 0, play: 0, cancel: 0 };
    let fail = 1;
    let loads = 0;
    const settings = { level: 'full', reducedMotion: false } as const;
    let created: unknown;
    const motion = createLazyListMotion({
      motion: () => undefined,
      defaults: { layout: true },
      items: () => [],
      settings,
      load: async () => {
        loads += 1;
        if (fail > 0) {
          fail -= 1;
          throw new Error('chunk failed');
        }
        return {
          createListMotion: (options) => {
            created = options.settings;
            return {
              measure: () => {
                inner.measure += 1;
              },
              play: () => {
                inner.play += 1;
              },
              cancel: () => {
                inner.cancel += 1;
              },
            };
          },
        };
      },
    });
    motion.measure();
    expect(loads).toBe(0);
    motion.play();
    expect(loads).toBe(1);
    await settle();
    // The failed load: changes commit at once and never throw.
    expect(() => {
      motion.measure();
      motion.play();
    }).not.toThrow();
    expect(loads).toBe(2);
    await settle();
    expect(created).toBe(settings);
    // The list seam's first play() records the mount (nothing plays on it).
    expect(inner).toEqual({ measure: 0, play: 1, cancel: 0 });
    motion.measure();
    motion.play();
    motion.cancel();
    expect(inner).toEqual({ measure: 1, play: 2, cancel: 1 });
    expect(loads).toBe(2);
  });
});
