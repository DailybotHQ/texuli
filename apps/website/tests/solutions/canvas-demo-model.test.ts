import { validateCanvas, walkShapes } from '@texuli/canvas/model';
import { describe, expect, it } from 'vitest';
import { launchPlanFixture } from '../../src/components/solutions/canvas/demo/fixtures/launch-plan.ts';
import { createCanvasDemoModel } from '../../src/components/solutions/canvas/demo/model.ts';

describe('canvas demo model', () => {
  it('starts from deterministic, valid package fixtures', () => {
    const first = launchPlanFixture();
    const second = launchPlanFixture();
    expect(first).toEqual(second);
    expect(validateCanvas(first).ok).toBe(true);
    expect(walkShapes(first).filter(({ shape }) => shape.type === 'sticky')).toHaveLength(6);
    const model = createCanvasDemoModel();
    expect(model.doc).toEqual(first);
    expect(model.doc.shapes).toHaveLength(3);
    expect(model.doc.connectors).toHaveLength(2);
  });

  it('selects and moves shapes through the package model helpers', () => {
    const model = createCanvasDemoModel();
    expect(model.selectAt({ x: 40, y: 72 })).toBe('interviews');
    expect(model.selection).toEqual(['interviews']);
    expect(model.moveSelection({ x: 16, y: 8 })).toBe(true);
    const moved = model.doc.shapes[0];
    expect(moved?.type).toBe('frame');
    if (moved?.type !== 'frame') return;
    expect(moved.children[0]).toMatchObject({ id: 'interviews', x: 40, y: 56 });
    expect(model.canUndo).toBe(true);
    expect(model.undo()).toBe(true);
    expect(model.doc).toEqual(launchPlanFixture());
  });

  it('adds a note and connects two selected notes with package operations', () => {
    const model = createCanvasDemoModel();
    const id = model.addPriorityNote();
    expect(id).toBe('priority-note-1');
    expect(model.doc.shapes.at(-1)).toMatchObject({ id, type: 'sticky' });
    expect(model.connectSelection()).toBeNull();
    model.selectAt({ x: 40, y: 72 });
    model.selectAt({ x: 232, y: 72 }, true);
    expect(model.selection).toEqual(['interviews', 'prototype']);
    expect(model.connectSelection()).toBe('demo-connector-3');
    expect(model.doc.connectors).toHaveLength(3);
  });

  it('pans and zooms the viewport, clamps zoom, and reset restores the fixture', () => {
    const model = createCanvasDemoModel();
    model.panBy({ x: 24, y: -12 });
    model.zoomBy(1.5);
    expect(model.view).toEqual({ x: 24, y: -12, zoom: 1.5 });
    model.zoomBy(20);
    expect(model.view.zoom).toBe(2);
    model.selectAt({ x: 40, y: 72 });
    model.addPriorityNote();
    model.reset();
    expect(model.doc).toEqual(launchPlanFixture());
    expect(model.selection).toEqual([]);
    expect(model.view).toEqual({ x: 0, y: 0, zoom: 1 });
    expect(model.canUndo).toBe(false);
  });
});
