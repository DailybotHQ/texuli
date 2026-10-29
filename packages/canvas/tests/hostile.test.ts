// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  applyCanvasOps,
  CANVAS_LIMITS,
  type CanvasDocument,
  type CanvasOperation,
  type CanvasShape,
  createCanvas,
  loadUntrustedCanvas,
  parseClipboard,
  readingOrder,
  simplifyPath,
  validateCanvas,
} from '../src/model/index.ts';
import { timed } from './fixtures.ts';

/*
 * Untrusted canvases (agent output, a pasted clipboard, a shared file) do
 * bounded, linear work: oversized inputs are refused before the expensive
 * part, nesting never recurses past the cap, and the work grows with the
 * input, not its square. Time bounds are generous for a loaded host; the
 * ratio checks are what catch a quadratic regression.
 */

const rects = (count: number): CanvasShape[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `r${i}`,
    type: 'rect' as const,
    x: (i % 100) * 20,
    y: Math.floor(i / 100) * 20,
    width: 16,
    height: 16,
    text: `Item ${i}`,
  }));

const canvasOf = (shapes: CanvasShape[]): CanvasDocument => ({ ...createCanvas(), shapes });

describe('hostile canvases', () => {
  it('validates the shape cap in linear time and refuses one past it', () => {
    const small = canvasOf(rects(500));
    const full = canvasOf(rects(CANVAS_LIMITS.shapes));
    expect(validateCanvas(full).ok).toBe(true);
    const t1 = timed(() => validateCanvas(small));
    const t2 = timed(() => validateCanvas(full));
    expect(t2).toBeLessThan(4_000);
    expect(t2).toBeLessThan(t1 * 40 + 200);
    const over = validateCanvas(canvasOf(rects(CANVAS_LIMITS.shapes + 1)));
    expect(over.ok).toBe(false);
    expect(over.issues.map((issue) => issue.code)).toContain('too-many');
    // Split across frames, the total still counts.
    const split = canvasOf([
      { id: 'fa', type: 'frame', x: 0, y: 0, width: 1, height: 1, children: rects(2_600) },
      {
        id: 'fb',
        type: 'frame',
        x: 0,
        y: 0,
        width: 1,
        height: 1,
        children: rects(2_600).map((shape) => ({ ...shape, id: `b${shape.id}` })),
      },
    ]);
    expect(validateCanvas(split).issues.map((issue) => issue.code)).toEqual(['too-many-shapes']);
  });

  it('refuses deep nesting, huge strings and huge paths without stack overflow or a scan', () => {
    let deep: unknown = { id: 'leaf', type: 'rect', x: 0, y: 0, width: 1, height: 1 };
    for (let i = 0; i < 50_000; i += 1)
      deep = { id: `f${i}`, type: 'frame', x: 0, y: 0, width: 1, height: 1, children: [deep] };
    let result = validateCanvas(createCanvas());
    expect(
      timed(() => (result = validateCanvas({ ...createCanvas(), shapes: [deep] })))
    ).toBeLessThan(2_000);
    expect(result.ok).toBe(false);
    const huge = { ...rects(1)[0], text: '\u202E'.repeat(5_000_000) };
    expect(timed(() => (result = validateCanvas(canvasOf([huge as CanvasShape]))))).toBeLessThan(
      2_000
    );
    expect(result.issues[0]?.code).toBe('too-long');
    const points = Array.from({ length: 300_000 }, (_, i) => [i % 7, i % 11]);
    const path = { id: 'p', type: 'path', x: 0, y: 0, width: 10, height: 10, points };
    expect(timed(() => (result = validateCanvas(canvasOf([path as CanvasShape]))))).toBeLessThan(
      2_000
    );
    expect(result.ok).toBe(false);
  });

  it('refuses oversized JSON text and clipboards before parsing', () => {
    const text = `{"shapes":[${'1,'.repeat(5_000_000)}1]}`;
    expect(timed(() => loadUntrustedCanvas(text))).toBeLessThan(50);
    expect(loadUntrustedCanvas(text).issues[0]?.message).toMatch(/larger/);
    expect(timed(() => parseClipboard(text))).toBeLessThan(50);
  });

  it('applies the operation cap in linear time and refuses one past it', () => {
    const doc = canvasOf(rects(2_000));
    const ops = (count: number): CanvasOperation[] =>
      Array.from({ length: count }, (_, i) => ({
        op: 'update' as const,
        id: `r${i % 2_000}`,
        set: { x: i % 500, text: `Moved ${i}` },
      }));
    const t1 = timed(() => applyCanvasOps(doc, ops(1_000)));
    let ok = false;
    const t2 = timed(() => {
      ok = applyCanvasOps(doc, ops(CANVAS_LIMITS.ops)).ok;
    });
    expect(ok).toBe(true);
    expect(t2).toBeLessThan(6_000);
    expect(t2).toBeLessThan(t1 * 30 + 300);
    const over = applyCanvasOps(doc, ops(CANVAS_LIMITS.ops + 1));
    expect(!over.ok && over.error.code).toBe('limit');
  });

  it('simplifies and orders in near-linear time', () => {
    const zigzag = (count: number) =>
      Array.from({ length: count }, (_, i) => [i % 2 ? 0 : 1000, i * 3] as [number, number]);
    const t1 = timed(() => simplifyPath(zigzag(10_000)));
    const t2 = timed(() => simplifyPath(zigzag(100_000)));
    expect(t2).toBeLessThan(3_000);
    expect(t2).toBeLessThan(t1 * 30 + 200);
    // Past the raw cap, the rest is dropped (bounded work on unbounded input).
    expect(timed(() => simplifyPath(zigzag(1_000_000)))).toBeLessThan(3_000);
    const doc = canvasOf(rects(CANVAS_LIMITS.shapes));
    expect(timed(() => readingOrder(doc))).toBeLessThan(1_000);
  });
});
