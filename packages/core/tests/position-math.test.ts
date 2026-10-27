// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  arrowPosition,
  availableSpace,
  computePosition,
  flipFallbacks,
  listPlacements,
  overflowOf,
  place,
  rect,
  resolveLogicalPlacement,
  resolvePlacementForDirection,
  shiftIntoBoundary,
  sizeToAvailable,
  totalOverflow,
} from '../src/position-math/index.ts';

const ref = rect(100, 100, 40, 20);
const floating = { width: 80, height: 40 };
const viewport = rect(0, 0, 400, 300);

describe('listPlacements', () => {
  it('exposes exactly twelve physical placements', () => {
    expect(listPlacements()).toHaveLength(12);
    expect(listPlacements()).toContain('top-start');
    expect(listPlacements()).toContain('right-end');
  });
});

describe('resolveLogicalPlacement / RTL', () => {
  it('maps block and inline logical sides for LTR and RTL; mirrors physical start/end under RTL by default', () => {
    // maps block and inline logical sides for LTR and RTL
    expect(resolveLogicalPlacement('block-start', 'ltr')).toBe('top');
    expect(resolveLogicalPlacement('block-end', 'ltr')).toBe('bottom');
    expect(resolveLogicalPlacement('inline-start', 'ltr')).toBe('left');
    expect(resolveLogicalPlacement('inline-end', 'ltr')).toBe('right');
    expect(resolveLogicalPlacement('inline-start', 'rtl')).toBe('right');
    expect(resolveLogicalPlacement('inline-end', 'rtl')).toBe('left');
    expect(resolveLogicalPlacement('block-start-start', 'rtl')).toBe('top-end');
    expect(resolveLogicalPlacement('inline-end-end', 'rtl')).toBe('left-start');
    // mirrors physical start/end under RTL by default
    expect(resolvePlacementForDirection('top-start', 'rtl')).toBe('top-end');
    expect(resolvePlacementForDirection('left-end', 'rtl')).toBe('left-start');
    expect(resolvePlacementForDirection('top-start', 'rtl', false)).toBe('top-start');
  });
});

describe('place', () => {
  it('centers on each main side with offset; aligns start and end on the cross axis; applies crossAxis offset', () => {
    // centers on each main side with offset
    expect(place(ref, floating, 'top', 8)).toEqual({
      x: 100 + (40 - 80) / 2,
      y: 100 - 40 - 8,
    });
    expect(place(ref, floating, 'bottom', 4)).toEqual({
      x: 100 + (40 - 80) / 2,
      y: 120 + 4,
    });
    expect(place(ref, floating, 'left', 0)).toEqual({
      x: 100 - 80,
      y: 100 + (20 - 40) / 2,
    });
    expect(place(ref, floating, 'right', 0)).toEqual({
      x: 140,
      y: 100 + (20 - 40) / 2,
    });
    // aligns start and end on the cross axis
    expect(place(ref, floating, 'top-start', 0).x).toBe(100);
    expect(place(ref, floating, 'top-end', 0).x).toBe(100 + 40 - 80);
    expect(place(ref, floating, 'left-start', 0).y).toBe(100);
    expect(place(ref, floating, 'left-end', 0).y).toBe(100 + 20 - 40);
    // applies crossAxis offset
    expect(place(ref, floating, 'bottom', { mainAxis: 0, crossAxis: 10 }).x).toBe(
      100 + (40 - 80) / 2 + 10
    );
  });
});

describe('overflow, shift, size', () => {
  it('reports overflow outside a boundary, and 3 related cases', () => {
    {
      // reports overflow outside a boundary
      const box = rect(-10, -5, 50, 50);
      const o = overflowOf(box, viewport);
      expect(o.left).toBe(10);
      expect(o.top).toBe(5);
      expect(totalOverflow(o)).toBeGreaterThan(0);
    }
    {
      // shifts a box fully into the boundary when possible
      const shifted = shiftIntoBoundary(-20, -10, { width: 50, height: 40 }, viewport);
      expect(shifted.x).toBe(0);
      expect(shifted.y).toBe(0);
      const still = shiftIntoBoundary(380, 280, { width: 50, height: 40 }, viewport);
      expect(still.x).toBe(350);
      expect(still.y).toBe(260);
    }
    {
      // sizes to available space on the preferred side
      const nearTop = rect(100, 30, 40, 20);
      const sized = sizeToAvailable(nearTop, { width: 80, height: 100 }, 'top', viewport, 0);
      expect(sized.height).toBe(30); // 30px above reference
      expect(sized.width).toBe(80);
    }
    {
      // lists available space on all four sides
      const space = availableSpace(ref, viewport, 0);
      expect(space.top).toBe(100);
      expect(space.left).toBe(100);
      expect(space.right).toBe(400 - 140);
      expect(space.bottom).toBe(300 - 120);
    }
  });
});

describe('flipFallbacks', () => {
  it('puts the opposite side first after the preferred', () => {
    expect(flipFallbacks('top')[0]).toBe('top');
    expect(flipFallbacks('top')[1]).toBe('bottom');
    expect(flipFallbacks('left-start')[1]).toBe('right-start');
  });
});

describe('computePosition', () => {
  it('places without boundary when flip/shift are off, and 3 related cases', () => {
    {
      // places without boundary when flip/shift are off
      const result = computePosition(ref, floating, { placement: 'bottom', offset: 8 });
      expect(result.placement).toBe('bottom');
      expect(result.y).toBe(120 + 8);
      expect(result.width).toBe(80);
      expect(result.height).toBe(40);
    }
    {
      // flips when the preferred side overflows the boundary
      const nearTop = rect(100, 10, 40, 20);
      const result = computePosition(
        nearTop,
        { width: 80, height: 60 },
        {
          placement: 'top',
          boundary: viewport,
          flip: true,
          offset: 0,
        }
      );
      expect(result.placement).toBe('bottom');
      expect(totalOverflow(result.overflow)).toBe(0);
    }
    {
      // shifts along the cross axis to stay inside
      const nearLeft = rect(5, 100, 40, 20);
      const result = computePosition(
        nearLeft,
        { width: 80, height: 40 },
        {
          placement: 'bottom-end',
          boundary: viewport,
          shift: true,
          flip: false,
        }
      );
      expect(result.x).toBe(0);
      expect(result.placement).toBe('bottom-end');
    }
    {
      // sizes then places within the boundary
      const nearBottom = rect(100, 250, 40, 20);
      const result = computePosition(
        nearBottom,
        { width: 200, height: 100 },
        {
          placement: 'bottom',
          boundary: viewport,
          size: true,
          flip: true,
          shift: true,
        }
      );
      expect(result.height).toBeLessThanOrEqual(100);
      expect(result.y + result.height).toBeLessThanOrEqual(300);
    }
  });
  it('resolves logical placement with RTL; computes arrow coordinates on the opposite edge; keeps arrow within floating padding', () => {
    {
      // resolves logical placement with RTL
      const result = computePosition(ref, floating, {
        placement: 'inline-start',
        direction: 'rtl',
      });
      expect(result.placement).toBe('right');
      expect(result.x).toBe(140);
    }
    {
      // computes arrow coordinates on the opposite edge
      const result = computePosition(ref, floating, {
        placement: 'top',
        arrow: { width: 10, height: 6, padding: 4 },
      });
      expect(result.arrow).toBeDefined();
      expect(result.arrow?.side).toBe('bottom');
      expect(result.arrow?.y).toBe(40);
      // Centered on reference
      expect(result.arrow?.x).toBeCloseTo(ref.x + ref.width / 2 - result.x, 5);
    }
    {
      // keeps arrow within floating padding
      const far = rect(0, 100, 10, 20);
      const pos = place(far, floating, 'bottom-start', 0);
      const floatingRect = rect(pos.x, pos.y, floating.width, floating.height);
      const arrow = arrowPosition(far, floatingRect, 'bottom-start', {
        width: 12,
        height: 8,
        padding: 4,
      });
      expect(arrow.x).toBeGreaterThanOrEqual(4 + 6);
      expect(arrow.x).toBeLessThanOrEqual(floating.width - 4 - 6);
    }
  });
});
