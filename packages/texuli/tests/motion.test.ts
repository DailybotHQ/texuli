import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { FakeAnimation } from '../../core/tests/motion-fakes.ts';
import {
  SPEC_MOTION_DURATIONS,
  SPEC_MOTION_PRESETS,
  SPEC_MOTION_STAGGERS,
} from '../../spec/src/motion.ts';
import { createToastStore } from '../src/components/toast/toast-store.ts';
import {
  MOTION_DURATION_NAMES,
  MOTION_PRESETS,
  resolveComponentMotion,
} from '../src/motion/contract.ts';
import { MOTION_LOOP_STAGGERS, resolveMotionLoop } from '../src/motion/loop/index.ts';
import { loadMotionRuntime } from '../src/motion/seam.ts';
import LoopHarness from './fixtures/LoopHarness.svelte';
import MotionHarness, { type MotionHarnessKind } from './fixtures/MotionHarness.svelte';

// texuli/motion (ADR-013): every adopted component plays through
// @texuli/core/motion (a controllable Web Animations stand-in here), keeps a
// closed part mounted only while its exit runs, and is instant under reduced
// motion and at level `none`.

type Started = { target: Element; keyframes: Keyframe[]; animation: FakeAnimation };
let started: Started[] = [];
const original = HTMLElement.prototype.animate;

function installFake(): void {
  started = [];
  HTMLElement.prototype.animate = function animate(
    this: HTMLElement,
    keyframes: Keyframe[] | PropertyIndexedKeyframes | null,
    options?: number | KeyframeAnimationOptions
  ) {
    const animation = new FakeAnimation(
      this,
      (keyframes ?? []) as Keyframe[],
      (typeof options === 'number'
        ? { duration: options }
        : (options ?? {})) as KeyframeAnimationOptions
    );
    started.push({ target: this, keyframes: (keyframes ?? []) as Keyframe[], animation });
    return animation as unknown as Animation;
  };
}

async function settle(): Promise<void> {
  for (let i = 0; i < 6; i += 1) {
    await tick();
    await Promise.resolve();
  }
}

/** Past one animation frame (the engine and presence commit a closed state on the next frame). */
const frame = () => new Promise((resolve) => setTimeout(resolve, 32));

const doc = () => document;
const panel = () => doc().querySelector<HTMLElement>('[data-probe="panel"]');
const on = (element: Element | null) => started.filter((entry) => entry.target === element);
const finishAll = async () => {
  for (const entry of started) entry.animation.finish();
  await settle();
};

beforeAll(async () => {
  // The runtime is a lazy chunk; components preload it on mount. Load it once
  // so every test starts with it in memory.
  expect(await loadMotionRuntime()).not.toBeNull();
});
beforeEach(installFake);
afterEach(() => {
  cleanup();
  HTMLElement.prototype.animate = original;
});

describe('the motion prop contract', () => {
  it('names exactly the spec 0.6.0 presets and duration steps', () => {
    expect([...MOTION_PRESETS]).toEqual([...SPEC_MOTION_PRESETS]);
    expect([...MOTION_DURATION_NAMES]).toEqual([...SPEC_MOTION_DURATIONS]);
  });

  it('applies defaults, turns parts off and refuses unknown names', () => {
    const defaults = { enter: 'scale', exit: 'fade', layout: true, duration: 'fast' } as const;
    expect(resolveComponentMotion(undefined, defaults)).toEqual(defaults);
    expect(resolveComponentMotion(false, defaults)).toEqual({
      enter: false,
      exit: false,
      layout: false,
      duration: 'base',
    });
    expect(resolveComponentMotion({ exit: false, layout: false }, defaults)).toMatchObject({
      enter: 'scale',
      exit: false,
      layout: false,
    });
    // Data passed through a host is checked: no CSS or unknown names reach a keyframe.
    const hostile = { enter: 'translate(9999px)', duration: '5s' } as unknown as Parameters<
      typeof resolveComponentMotion
    >[0];
    expect(resolveComponentMotion(hostile, defaults)).toMatchObject({
      enter: 'scale',
      duration: 'fast',
    });
  });
});

/** Overlays opened and closed through their bindable `open`. */
const OVERLAYS: readonly MotionHarnessKind[] = [
  'dialog',
  'alert-dialog',
  'sheet',
  'popover',
  'hover-card',
  'menu',
  'tooltip',
];

describe('overlays enter and exit through the runtime', () => {
  for (const kind of OVERLAYS) {
    it(`${kind}: enters after open, stays mounted and inert until its exit ends`, async () => {
      const view = render(MotionHarness, { props: { kind } });
      await settle();
      expect(started).toHaveLength(0);

      await view.rerender({ kind, open: true });
      await settle();
      const node = panel();
      expect(node, 'open panel').toBeTruthy();
      const enter = on(node);
      expect(enter.length, 'enter animation').toBeGreaterThan(0);
      // Sheets slide from their edge; the others fade in.
      expect(enter[0]?.keyframes[0]).toMatchObject(
        kind === 'sheet' ? { transform: 'translateX(-100%)' } : { opacity: 0 }
      );
      expect(enter[0]?.animation.options.fill).toBe('none');
      await finishAll();

      started = [];
      await view.rerender({ kind, open: false });
      await settle();
      const held = panel();
      expect(held, 'held during its exit').toBe(node);
      expect(held?.getAttribute('data-state')).toBe('closed');
      expect(held?.hasAttribute('inert') || held?.hidden === false).toBe(true);
      const exit = on(held);
      expect(exit.length, 'exit animation').toBeGreaterThan(0);
      expect(exit[0]?.keyframes.at(-1)).toMatchObject(
        kind === 'sheet' ? { transform: 'translateX(-100%)' } : { opacity: 0 }
      );

      await finishAll();
      const after = panel();
      // Gone, or (hover card, kept mounted) hidden again.
      expect(after === null || after.hidden).toBe(true);
    });

    it(`${kind}: instant under reduced motion and at level none`, async () => {
      for (const props of [{ reducedMotion: true }, { level: 'none' as const }]) {
        started = [];
        const view = render(MotionHarness, { props: { kind, ...props } });
        await settle();
        await view.rerender({ kind, ...props, open: true });
        await settle();
        expect(panel(), 'open panel').toBeTruthy();
        await view.rerender({ kind, ...props, open: false });
        await settle();
        const after = panel();
        expect(after === null || after.hidden, `${JSON.stringify(props)} closes at once`).toBe(
          true
        );
        expect(started, `${JSON.stringify(props)} starts no animation`).toHaveLength(0);
        view.unmount();
      }
    });
  }

  it('plays nothing for an overlay open on the first render (hydration)', async () => {
    render(MotionHarness, { props: { kind: 'dialog', open: true } });
    await settle();
    expect(panel()).toBeTruthy();
    expect(started).toHaveLength(0);
  });

  it('releases focus at close, before the exit ends', async () => {
    render(MotionHarness, { props: { kind: 'dialog' } });
    await settle();
    const trigger = screen.getByRole('button', { name: 'Open' });
    await fireEvent.click(trigger);
    await settle();
    expect(panel()?.contains(document.activeElement)).toBe(true);
    await fireEvent.keyDown(document, { key: 'Escape' });
    await settle();
    expect(panel(), 'still mounted for its exit').toBeTruthy();
    expect(document.activeElement).toBe(trigger);
    await finishAll();
    expect(panel()).toBeNull();
  });

  it('motion={false} turns one component off', async () => {
    const view = render(MotionHarness, { props: { kind: 'popover', motion: false } });
    await settle();
    await view.rerender({ kind: 'popover', motion: false, open: true });
    await settle();
    await view.rerender({ kind: 'popover', motion: false, open: false });
    await settle();
    expect(panel()).toBeNull();
    expect(started).toHaveLength(0);
  });
});

describe('layout motion', () => {
  it('tabs: the indicator glides from the old tab to the new one, and leaves', async () => {
    const view = render(MotionHarness, { props: { kind: 'tabs', value: 'overview' } });
    await settle();
    expect(started).toHaveLength(0);
    const tabs = screen.getAllByRole('tab');
    // happy-dom has no layout: give the tabs boxes.
    tabs.forEach((tab, index) => {
      tab.getBoundingClientRect = () =>
        ({
          left: index * 100,
          top: 0,
          width: 80,
          height: 40,
          right: index * 100 + 80,
          bottom: 40,
        }) as DOMRect;
    });
    await view.rerender({ kind: 'tabs', value: 'settings' });
    await settle();
    const ghost = doc().querySelector<HTMLElement>('.tx-tabs__indicator');
    expect(ghost, 'the gliding indicator').toBeTruthy();
    const glide = on(ghost);
    expect(glide).toHaveLength(1);
    expect(String(glide[0]?.keyframes[0]?.transform)).toContain('translate(-200px');
    expect(ghost?.parentElement?.hasAttribute('data-tx-tabs-gliding')).toBe(true);
    await finishAll();
    expect(doc().querySelector('.tx-tabs__indicator')).toBeNull();
    expect(doc().querySelector('[data-tx-tabs-gliding]')).toBeNull();
  });

  it('accordion: the panel height animates open, and closed before it unmounts', async () => {
    const view = render(MotionHarness, { props: { kind: 'accordion', value: '' } });
    await settle();
    await view.rerender({ kind: 'accordion', value: 'returns' });
    await settle();
    const region = screen.getByRole('region');
    const open = on(region);
    expect(open.length).toBe(1);
    expect(open[0]?.keyframes[0]).toMatchObject({ blockSize: '0px' });
    await finishAll();
    started = [];
    await view.rerender({ kind: 'accordion', value: '' });
    await settle();
    expect(screen.getByRole('region'), 'held while it closes').toBe(region);
    expect(on(region)[0]?.keyframes.at(-1)).toMatchObject({ blockSize: '0px' });
    await finishAll();
    expect(screen.queryByRole('region')).toBeNull();
  });

  it('toaster: a new toast enters, a dismissed one exits before it leaves', async () => {
    const store = createToastStore({ duration: 0 });
    store.info('Synced');
    render(MotionHarness, { props: { kind: 'toaster', store } });
    await settle();
    expect(started, 'nothing plays for the first render').toHaveLength(0);
    store.success('Copied');
    await settle();
    const copied = screen.getByText('Copied').closest('[data-toast-id]');
    expect(on(copied).length, 'enter').toBe(1);
    await finishAll();
    started = [];
    store.dismiss(store.items().find((item) => item.title === 'Copied')?.id);
    await settle();
    const leaving = doc().querySelector('[data-leaving="true"]');
    expect(leaving).toBe(copied);
    expect(on(leaving).at(-1)?.keyframes.at(-1)).toMatchObject({ opacity: 0 });
    await finishAll();
    expect(screen.queryByText('Copied')).toBeNull();
  });

  it('toaster: instant under reduced motion and at level none', async () => {
    for (const props of [{ reducedMotion: true }, { level: 'none' as const }]) {
      started = [];
      const store = createToastStore({ duration: 0 });
      store.info('Synced');
      const view = render(MotionHarness, { props: { kind: 'toaster', store, ...props } });
      await settle();
      store.success('Copied');
      await settle();
      store.dismiss();
      await settle();
      expect(doc().querySelector('[data-leaving]')).toBeNull();
      expect(started).toHaveLength(0);
      view.unmount();
    }
  });

  it('tabs and accordion: instant under reduced motion and at level none', async () => {
    for (const props of [{ reducedMotion: true }, { level: 'none' as const }]) {
      started = [];
      const tabs = render(MotionHarness, { props: { kind: 'tabs', value: 'overview', ...props } });
      await settle();
      await tabs.rerender({ kind: 'tabs', value: 'settings', ...props });
      await settle();
      tabs.unmount();
      const accordion = render(MotionHarness, { props: { kind: 'accordion', ...props } });
      await settle();
      await accordion.rerender({ kind: 'accordion', value: 'returns', ...props });
      await settle();
      await accordion.rerender({ kind: 'accordion', value: '', ...props });
      await settle();
      await frame();
      expect(screen.queryByRole('region')).toBeNull();
      accordion.unmount();
      expect(started).toHaveLength(0);
    }
  });
});

describe('looping motion (texuli/motion/loop, D-G-046)', () => {
  const loop = () => document.querySelector<HTMLElement>('[data-probe="loop"]');

  it('speaks the spec duration and stagger names and rests unless it may move', () => {
    expect([...MOTION_LOOP_STAGGERS]).toEqual([...SPEC_MOTION_STAGGERS]);
    const base = {
      preset: 'wave',
      playing: true,
      level: 'full',
      reducedMotion: undefined,
    } as const;
    expect(resolveMotionLoop(base)).toEqual({ preset: 'wave', level: 'full' });
    expect(resolveMotionLoop({ ...base, preset: '@keyframes x' })).toEqual({
      preset: 'pulse',
      level: 'full',
    });
    expect(resolveMotionLoop({ ...base, level: 'subtle' })?.level).toBe('subtle');
    for (const rest of [{ playing: false }, { level: 'none' as const }, { reducedMotion: true }]) {
      expect(resolveMotionLoop({ ...base, ...rest }), JSON.stringify(rest)).toBeNull();
    }
  });

  it('marks the loop while playing, and drops it at rest (not playing, level none, reduced motion)', async () => {
    const view = render(LoopHarness, { props: { preset: 'wave' } });
    await settle();
    expect(loop()?.getAttribute('data-tx-loop')).toBe('wave');
    expect(loop()?.getAttribute('data-tx-loop-duration')).toBe('slow');
    expect(loop()?.getAttribute('data-tx-loop-stagger')).toBe('fast');
    expect(loop()?.children).toHaveLength(5);
    await view.rerender({ preset: 'wave', playing: false });
    await settle();
    expect(loop()?.hasAttribute('data-tx-loop')).toBe(false);
    await view.rerender({ preset: 'wave', playing: true });
    await settle();
    expect(loop()?.getAttribute('data-tx-loop')).toBe('wave');
    view.unmount();

    for (const props of [{ reducedMotion: true }, { level: 'none' as const }]) {
      const rested = render(LoopHarness, { props });
      await settle();
      expect(loop()?.hasAttribute('data-tx-loop'), JSON.stringify(props)).toBe(false);
      rested.unmount();
    }
    const subtle = render(LoopHarness, { props: { level: 'subtle', stagger: 'none' } });
    await settle();
    expect(loop()?.getAttribute('data-tx-loop')).toBe('pulse');
    expect(loop()?.getAttribute('data-tx-loop-level')).toBe('subtle');
    expect(loop()?.getAttribute('data-tx-loop-stagger')).toBe('none');
    subtle.unmount();
  });

  it("animates only for prefers-reduced-motion: no-preference, on tokens, resting in the children's own style", () => {
    const css = readFileSync(
      join(process.cwd(), 'packages/texuli/src/motion/loop/loop.css'),
      'utf8'
    ).replace(/\/\*[\s\S]*?\*\//g, '');
    const media = '@media (prefers-reduced-motion: no-preference) {';
    const start = css.indexOf(media);
    expect(start).toBeGreaterThan(0);
    // Every animation declaration sits inside the no-preference block.
    let depth = 0;
    let end = start + media.length;
    for (depth = 1; depth > 0; end += 1) {
      if (css[end] === '{') depth += 1;
      if (css[end] === '}') depth -= 1;
    }
    const inside = css.slice(start, end);
    const outside = css.slice(0, start) + css.slice(end);
    expect(outside).not.toMatch(/animation(-name)?\s*:/);
    expect(inside).toMatch(
      /animation:\s*tx-loop-pulse calc\(var\(--tx-loop-step, var\(--tx-motion-slow\)\) \* 4\)\s+var\(--tx-motion-ease-standard\) infinite;/
    );
    // No literal period or delay: every time is a token (0ms: no stagger).
    expect(inside.replaceAll('0ms', '')).not.toMatch(/\d(ms|s)\b/);
    // Only the middle frame: rest (0% and 100%) is the element's own style.
    const frames = [...css.matchAll(/@keyframes (tx-loop-[a-z]+)\s*{\s*([^{]+){/g)];
    expect(frames.map((match) => match[1])).toEqual([
      'tx-loop-pulse',
      'tx-loop-wave',
      'tx-loop-fade',
    ]);
    for (const match of frames) expect(match[2]?.trim(), match[1]).toBe('50%');
  });
});
