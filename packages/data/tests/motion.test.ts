import { cleanup, render } from '@testing-library/svelte';
import { tick } from 'svelte';
import { loadMotionRuntime } from 'texuli/motion';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { FakeAnimation } from '../../core/tests/motion-fakes.ts';
import MotionDataHarness from './fixtures/MotionDataHarness.svelte';

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
