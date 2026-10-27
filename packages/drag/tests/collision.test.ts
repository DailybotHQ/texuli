// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  closestCenter,
  firstHit,
  midpointIndex,
  pointerWithin,
  rectIntersection,
} from '../src/collision.ts';
import {
  applyModifiers,
  composeModifiers,
  restrictToAxis,
  restrictToBounds,
  snapToGrid,
} from '../src/modifiers.ts';

const droppables = [
  { id: 'outer', rect: { x: 0, y: 0, width: 400, height: 400 } },
  { id: 'inner', rect: { x: 100, y: 100, width: 100, height: 100 } },
  { id: 'far', rect: { x: 600, y: 0, width: 100, height: 100 } },
  { id: 'off', rect: { x: 120, y: 120, width: 10, height: 10 }, disabled: true },
];

describe('collision strategies', () => {
  it('closestCenter uses the active rect center, else the pointer', () => {
    expect(closestCenter({ pointer: { x: 640, y: 40 }, droppables })?.id).toBe('far');
    expect(
      closestCenter({
        pointer: { x: 640, y: 40 },
        active: { x: 140, y: 140, width: 20, height: 20 },
        droppables,
      })?.id
    ).toBe('inner');
  });

  it('pointerWithin prefers the smallest containing droppable and skips disabled ones', () => {
    expect(pointerWithin({ pointer: { x: 125, y: 125 }, droppables })?.id).toBe('inner');
    expect(pointerWithin({ pointer: { x: 10, y: 10 }, droppables })?.id).toBe('outer');
    expect(pointerWithin({ pointer: { x: 500, y: 500 }, droppables })).toBeNull();
  });

  it('rectIntersection picks the largest overlap ratio', () => {
    const active = { x: 110, y: 110, width: 80, height: 80 };
    expect(rectIntersection({ pointer: { x: 0, y: 0 }, active, droppables })?.id).toBe('inner');
    expect(rectIntersection({ pointer: { x: 0, y: 0 }, droppables })).toBeNull();
  });

  it('firstHit composes strategies', () => {
    const strategy = firstHit(pointerWithin, closestCenter);
    expect(strategy({ pointer: { x: 900, y: 50 }, droppables })?.id).toBe('far');
    expect(firstHit()({ pointer: { x: 0, y: 0 }, droppables })).toBeNull();
  });

  it('midpointIndex binary-searches ascending midpoints', () => {
    const mids = [20, 60, 100, 140];
    expect(midpointIndex(mids, 0)).toBe(0);
    expect(midpointIndex(mids, 59)).toBe(1);
    expect(midpointIndex(mids, 60)).toBe(2);
    expect(midpointIndex(mids, 500)).toBe(4);
    expect(midpointIndex([], 5)).toBe(0);
  });
});

describe('modifiers', () => {
  const activeRect = { x: 50, y: 50, width: 100, height: 40 };

  it('locks an axis', () => {
    expect(restrictToAxis('x')({ x: 5, y: 9 }, {})).toEqual({ x: 5, y: 0 });
    expect(restrictToAxis('y')({ x: 5, y: 9 }, {})).toEqual({ x: 0, y: 9 });
  });

  it('keeps the dragged rect inside bounds', () => {
    const bounds = restrictToBounds({ x: 0, y: 0, width: 300, height: 200 });
    expect(bounds({ x: 500, y: -500 }, { activeRect })).toEqual({ x: 150, y: -50 });
    expect(bounds({ x: 10, y: 10 }, { activeRect })).toEqual({ x: 10, y: 10 });
    expect(
      restrictToBounds(() => ({ x: -5, y: -5, width: 10, height: 10 }))({ x: 50, y: -50 }, {})
    ).toEqual({
      x: 5,
      y: -5,
    });
  });

  it('snaps to a grid', () => {
    expect(snapToGrid(20)({ x: 13, y: 7 }, { activeRect })).toEqual({ x: 10, y: 10 });
    expect(snapToGrid({ x: 25, y: 0 })({ x: 13, y: 7 }, {})).toEqual({ x: 25, y: 7 });
  });

  it('composes left to right', () => {
    const chain = [restrictToAxis('x'), snapToGrid(10)];
    expect(applyModifiers(chain, { x: 14, y: 99 })).toEqual({ x: 10, y: 0 });
    expect(composeModifiers(...chain)({ x: 16, y: 99 }, {})).toEqual({ x: 20, y: 0 });
  });
});
