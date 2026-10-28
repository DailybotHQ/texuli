// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  boundsOf,
  fitView,
  IDENTITY_VIEW,
  marqueeSelect,
  moveFree,
  panBy,
  resizeRect,
  screenDeltaToWorld,
  screenToWorld,
  snapPoint,
  snapToGuides,
  worldRectToScreen,
  worldToScreen,
  zoomAt,
} from '../src/spatial.ts';

const nodes = [
  { id: 'a', rect: { x: 0, y: 0, width: 100, height: 50 } },
  { id: 'b', rect: { x: 200, y: 100, width: 100, height: 50 } },
  { id: 'c', rect: { x: 400, y: 400, width: 40, height: 40 } },
];

describe('coordinate transforms under pan and zoom', () => {
  const view = { x: 40, y: -20, zoom: 2 };

  it('round-trips screen and world points', () => {
    const world = screenToWorld({ x: 140, y: 80 }, view);
    expect(world).toEqual({ x: 50, y: 50 });
    expect(worldToScreen(world, view)).toEqual({ x: 140, y: 80 });
    expect(screenDeltaToWorld({ x: 10, y: -10 }, view)).toEqual({ x: 5, y: -5 });
    expect(worldRectToScreen({ x: 10, y: 10, width: 5, height: 5 }, view)).toEqual({
      x: 60,
      y: 0,
      width: 10,
      height: 10,
    });
    expect(panBy(view, { x: 5, y: 5 })).toEqual({ x: 45, y: -15, zoom: 2 });
  });

  it('zooms around an anchor that stays fixed, within limits', () => {
    const anchor = { x: 300, y: 200 };
    const before = screenToWorld(anchor, view);
    const zoomed = zoomAt(view, anchor, 1.5);
    expect(zoomed.zoom).toBe(3);
    const after = screenToWorld(anchor, zoomed);
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
    expect(zoomAt(view, anchor, 100, { max: 4 }).zoom).toBe(4);
    expect(zoomAt(view, anchor, 0.001, { min: 0.25 }).zoom).toBe(0.25);
    expect(zoomAt(view, anchor, Number.NaN).zoom).toBe(1);
  });

  it('fits content in a viewport', () => {
    const fit = fitView({ x: 0, y: 0, width: 1000, height: 500 }, { width: 548, height: 548 }, 24);
    expect(fit.zoom).toBeCloseTo(0.5);
    const center = worldToScreen({ x: 500, y: 250 }, fit);
    expect(center.x).toBeCloseTo(274);
    expect(center.y).toBeCloseTo(274);
  });
});

describe('free placement', () => {
  it('moves by the pointer delta in world units under zoom', () => {
    const moved = moveFree(
      [nodes[0] as (typeof nodes)[number]],
      { x: 100, y: 40 },
      { x: 0, y: 0, zoom: 2 }
    );
    expect(moved[0]?.rect).toEqual({ x: 50, y: 20, width: 100, height: 50 });
    expect(moveFree(nodes, { x: 0, y: 0 })).toEqual(nodes);
  });

  it('keeps a group inside bounds with its shape', () => {
    const group = nodes.slice(0, 2);
    const moved = moveFree(group, { x: -500, y: 900 }, IDENTITY_VIEW, {
      x: 0,
      y: 0,
      width: 600,
      height: 300,
    });
    expect(moved.map((n) => n.rect.x)).toEqual([0, 200]);
    expect(moved.map((n) => n.rect.y)).toEqual([150, 250]);
    expect(boundsOf([])).toEqual({ x: 0, y: 0, width: 0, height: 0 });
  });
});

describe('snapping and guides', () => {
  it('snaps points to a grid', () => {
    expect(snapPoint({ x: 13, y: 26 }, 10)).toEqual({ x: 10, y: 30 });
    expect(snapPoint({ x: 13, y: 26 }, { x: 0, y: 25 })).toEqual({ x: 13, y: 25 });
  });

  it('aligns edges and centers within the threshold and reports guides', () => {
    const moving = { x: 203, y: 222, width: 100, height: 50 };
    const snap = snapToGuides(moving, nodes, 5);
    expect(snap.offset).toEqual({ x: -3, y: 0 });
    expect(snap.guides).toEqual([{ axis: 'x', position: 200, with: 'b' }]);
    const centered = snapToGuides({ x: 0, y: 98, width: 10, height: 50 }, nodes, 4);
    expect(centered.offset.y).toBe(2);
    expect(snapToGuides(moving, nodes, 1).guides).toEqual([]);
  });
});

describe('marquee selection', () => {
  it('selects intersecting or contained rects from any drag direction', () => {
    expect(marqueeSelect({ x: 250, y: 120 }, { x: 50, y: 20 }, nodes)).toEqual(['a', 'b']);
    expect(marqueeSelect({ x: -10, y: -10 }, { x: 310, y: 160 }, nodes, 'contain')).toEqual([
      'a',
      'b',
    ]);
    expect(marqueeSelect({ x: 250, y: 120 }, { x: 50, y: 20 }, nodes, 'contain')).toEqual([]);
  });
});

describe('resize bounds', () => {
  const box = { x: 100, y: 100, width: 100, height: 50 };

  it('moves only the dragged edges', () => {
    expect(resizeRect(box, 'se', { x: 20, y: 10 })).toEqual({
      x: 100,
      y: 100,
      width: 120,
      height: 60,
    });
    expect(resizeRect(box, 'nw', { x: 20, y: 10 })).toEqual({
      x: 120,
      y: 110,
      width: 80,
      height: 40,
    });
    expect(resizeRect(box, 'e', { x: 20, y: 99 })).toEqual({
      x: 100,
      y: 100,
      width: 120,
      height: 50,
    });
  });

  it('honours min/max, bounds, grid and aspect ratio', () => {
    expect(resizeRect(box, 'w', { x: 500, y: 0 }, { minWidth: 40 })).toEqual({
      x: 160,
      y: 100,
      width: 40,
      height: 50,
    });
    expect(resizeRect(box, 'e', { x: 500, y: 0 }, { maxWidth: 150 }).width).toBe(150);
    expect(
      resizeRect(box, 'se', { x: 500, y: 500 }, { bounds: { x: 0, y: 0, width: 250, height: 180 } })
    ).toEqual({
      x: 100,
      y: 100,
      width: 150,
      height: 80,
    });
    expect(resizeRect(box, 'e', { x: 13, y: 0 }, { grid: 10 }).width).toBe(110);
    const aspect = resizeRect(box, 'se', { x: 100, y: 0 }, { keepAspect: true });
    expect(aspect.width / aspect.height).toBeCloseTo(2);
    expect(aspect.width).toBe(200);
    const boxed = resizeRect(
      box,
      'se',
      { x: 300, y: 0 },
      { keepAspect: true, bounds: { x: 0, y: 0, width: 1000, height: 200 } }
    );
    expect(boxed.y + boxed.height).toBeLessThanOrEqual(200);
  });
});
