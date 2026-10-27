// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  autoScrollVelocity,
  createAutoScroller,
  linearCurve,
  type ScrollMetrics,
} from '../src/auto-scroll.ts';
import { createFakeFrames } from '../src/testing.ts';

const metrics = (scrollTop: number, scrollLeft = 0): ScrollMetrics => ({
  rect: { x: 0, y: 0, width: 400, height: 400 },
  scrollTop,
  scrollLeft,
  scrollWidth: 800,
  scrollHeight: 1000,
  clientWidth: 400,
  clientHeight: 400,
});

describe('auto-scroll velocity', () => {
  it('is zero away from the edges and outside the box', () => {
    expect(autoScrollVelocity({ x: 200, y: 200 }, metrics(100))).toEqual({ x: 0, y: 0 });
    expect(autoScrollVelocity({ x: 200, y: 900 }, metrics(100))).toEqual({ x: 0, y: 0 });
  });

  it('scrolls toward the near edge, faster deeper in the zone (speed curve)', () => {
    const shallow = autoScrollVelocity({ x: 200, y: 370 }, metrics(100));
    const deep = autoScrollVelocity({ x: 200, y: 399 }, metrics(100));
    expect(shallow.y).toBeGreaterThan(0);
    expect(deep.y).toBeGreaterThan(shallow.y);
    expect(deep.y).toBeLessThanOrEqual(20);
    expect(autoScrollVelocity({ x: 200, y: 10 }, metrics(100)).y).toBeLessThan(0);
    expect(autoScrollVelocity({ x: 390, y: 200 }, metrics(0)).x).toBeGreaterThan(0);
    const linear = autoScrollVelocity({ x: 200, y: 376 }, metrics(100), {
      edge: 48,
      maxSpeed: 10,
      curve: linearCurve,
    });
    expect(linear.y).toBeCloseTo(5);
  });

  it('stops at the scroll limits', () => {
    expect(autoScrollVelocity({ x: 200, y: 5 }, metrics(0))).toEqual({ x: 0, y: 0 });
    expect(autoScrollVelocity({ x: 200, y: 395 }, metrics(600))).toEqual({ x: 0, y: 0 });
    expect(autoScrollVelocity({ x: 5, y: 200 }, metrics(0, 0)).x).toBe(0);
  });
});

describe('auto-scroller on the caller’s frame loop', () => {
  function scrollable(start = 0) {
    let top = start;
    const calls: number[] = [];
    return {
      calls,
      get top() {
        return top;
      },
      target: {
        metrics: () => metrics(top),
        scrollBy: (_dx: number, dy: number) => {
          top = Math.min(600, Math.max(0, top + dy));
          calls.push(dy);
        },
      },
    };
  }

  it('runs while the pointer sits in an edge zone and re-measures each step', () => {
    const frames = createFakeFrames();
    const box = scrollable();
    const scrolled: number[] = [];
    const scroller = createAutoScroller({
      frame: frames,
      targets: () => [box.target],
      onScroll: (_t, d) => scrolled.push(d.y),
    });
    scroller.update({ x: 200, y: 398 });
    expect(scroller.running).toBe(true);
    frames.step();
    frames.step();
    expect(box.calls).toHaveLength(2);
    expect(scrolled).toHaveLength(2);
    scroller.update({ x: 200, y: 200 });
    frames.step();
    expect(scroller.running).toBe(false);
    expect(box.calls).toHaveLength(2);
  });

  it('stops by itself at the end of the content, and on stop()', () => {
    const frames = createFakeFrames();
    const box = scrollable(560);
    const scroller = createAutoScroller({ frame: frames, targets: () => [box.target] });
    scroller.update({ x: 200, y: 399 });
    frames.flush();
    expect(box.top).toBe(600);
    expect(scroller.running).toBe(false);
    const other = scrollable(100);
    const again = createAutoScroller({ frame: frames, targets: () => [other.target] });
    again.update({ x: 200, y: 399 });
    again.stop();
    expect(frames.pending).toBe(0);
    expect(again.running).toBe(false);
  });

  it('scrolls the nearest ancestor that can still move', () => {
    const frames = createFakeFrames();
    const stuck = scrollable(600);
    const outer = scrollable(0);
    createAutoScroller({ frame: frames, targets: () => [stuck.target, outer.target] }).update({
      x: 200,
      y: 399,
    });
    frames.step();
    expect(stuck.calls).toHaveLength(0);
    expect(outer.calls).toHaveLength(1);
  });
});
