import { describe, expect, it } from 'vitest';
import type { SpecCatalog } from '../src/catalog.ts';
import { SPEC_LIMITS, SPEC_PROP_REFS } from '../src/contract.ts';
import type { Schema } from '../src/dialect.ts';
import { validateBlueprint } from '../src/validate.ts';
import { json } from './helpers.ts';

/**
 * Spec 0.8.0 (ADR-012): the `canvas` catalog id with its `$defs.canvas`
 * shape. The contract checks the envelope of the canvas (format, version,
 * members, the caps); the shape vocabulary is `@texuli/canvas/model`'s,
 * pinned as `schemas/canvas.schema.json`.
 */
const documents = {
  blueprintSchema: json<Schema>('schemas/blueprint.schema.json'),
  catalog: json<SpecCatalog>('catalog/components.json'),
};
const golden = json<{ tree: { props: { canvas: Record<string, unknown> } } }>(
  'fixtures/golden/canvas-retro.json'
);
const codes = (canvas: unknown) =>
  validateBlueprint(
    { ...golden, tree: { ...golden.tree, props: { ...golden.tree.props, canvas } } },
    documents
  ).diagnostics.map((d) => d.code);
const canvas = golden.tree.props.canvas;

describe('spec 0.8.0: canvases', () => {
  it('accepts the golden canvas and refuses another format, an extra member and missing lists', () => {
    expect(SPEC_PROP_REFS).toContain('canvas');
    expect(codes(canvas)).toEqual([]);
    expect(codes({ ...canvas, format: 'texuli-html' })).toEqual(['prop-type']);
    expect(codes({ ...canvas, formatVersion: 2 })).toEqual(['prop-type']);
    expect(codes({ ...canvas, script: 'alert(1)' })).toEqual(['prop-type']);
    expect(codes({ format: 'texuli-canvas', formatVersion: 1, shapes: [] })).toEqual(['prop-type']);
    expect(codes('a canvas')).toEqual(['prop-type']);
  });

  it('caps the shapes and connectors a canvas node carries', () => {
    const many = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `s${i}` }));
    expect(codes({ ...canvas, shapes: many(SPEC_LIMITS.canvasShapes) })).toEqual([]);
    expect(codes({ ...canvas, shapes: many(SPEC_LIMITS.canvasShapes + 1) })).toEqual(['prop-type']);
    expect(codes({ ...canvas, connectors: many(SPEC_LIMITS.canvasConnectors + 1) })).toEqual([
      'prop-type',
    ]);
  });
});
