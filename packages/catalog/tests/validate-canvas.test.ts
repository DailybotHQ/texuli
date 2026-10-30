// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { canvasJsonSchema } from '../../canvas/src/model/index.ts';
import { buildCatalog } from '../src/build/build.ts';
import { discoverManifestGroups } from '../src/build/node.ts';
import { renderCatalogFromBuild } from '../src/render/renderer/index.ts';
import {
  DRAFT_FRAME_IDS,
  type DraftValidation,
  MAX_CANVAS_FINDINGS,
  validateDraft,
} from '../src/validate/index.ts';
import { checkCanvas } from './canvas-check.ts';

/**
 * Canvases in blueprints (spec 0.8.0, ADR-012): a `canvas` node is checked
 * by the host's canvas validator at the draft's tier. Nothing is weakened:
 * no validator, no canvas.
 */

const build = await buildCatalog(await discoverManifestGroups());
const catalog = renderCatalogFromBuild(build.catalog);
const options = { catalog, checkCanvas };

const golden = JSON.parse(
  readFileSync(new URL('../../spec/fixtures/golden/canvas-retro.json', import.meta.url), 'utf8')
) as { tree: { props: { canvas: { shapes: unknown[] } & Record<string, unknown> } } };
const base = golden.tree.props.canvas;

const withShapes = (...shapes: unknown[]) => ({
  key: 'board',
  id: 'canvas',
  props: { canvas: { ...base, shapes: [...base.shapes, ...shapes] } },
});
const rect = (extra: Record<string, unknown>) => ({
  id: 'x',
  type: 'rect',
  x: 0,
  y: 0,
  width: 10,
  height: 10,
  ...extra,
});
const codes = (result: DraftValidation) =>
  result.diagnostics.filter((d) => d.severity === 'error').map((d) => `${d.check}:${d.code}`);

describe('canvases in validateDraft', () => {
  it('accepts the golden canvas as a frame root at the untrusted tier', () => {
    expect(DRAFT_FRAME_IDS).toContain('canvas');
    const result = validateDraft(golden, options);
    expect(codes(result)).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.checks.canvases).toBe('pass');
    expect(result.roots[0]).toMatchObject({ kind: 'component', id: 'canvas', key: 'retro' });
  });

  it('refuses every canvas without the host validator (canvas-unchecked), nested too', () => {
    const result = validateDraft(golden, { catalog });
    expect(codes(result)).toEqual(['canvases:canvas-unchecked']);
    expect(result.checks.canvases).toBe('fail');
    const nested = validateDraft(
      { id: 'layout-page', props: { title: 'Board' }, children: [golden.tree] },
      { catalog }
    );
    expect(codes(nested)).toContain('canvases:canvas-unchecked');
  });

  it('refuses hostile canvases with the canvas, sink or spec check that owns the rule', () => {
    const cases: [string, unknown, string][] = [
      [
        'a javascript: image ref',
        withShapes(rect({ type: 'image', ref: 'javascript:void', alt: 'x' })),
        'canvases:canvas-schema',
      ],
      ['an unknown shape', withShapes({ id: 'x', type: 'script' }), 'canvases:canvas-schema'],
      [
        'a bidi override',
        withShapes(rect({ text: 'evil\u202Etxt.exe' })),
        'canvases:canvas-schema',
      ],
      [
        'a raw CSS color',
        withShapes(rect({ paint: { fill: 'url(#steal)' } })),
        'canvases:canvas-schema',
      ],
      ['a duplicate id', withShapes(rect({ id: 'start' })), 'canvases:canvas-schema'],
      ['an HTML string', withShapes(rect({ text: '<img src=x onerror=alert(1)>' })), 'sinks:sink'],
      ['an event handler key', withShapes(rect({ onclick: 'alert(1)' })), 'sinks:sink'],
    ];
    for (const [name, tree, code] of cases) {
      const result = validateDraft(tree, options);
      expect(result.ok, name).toBe(false);
      expect(codes(result), name).toContain(code);
    }
  });

  it('caps the findings one canvas reports', () => {
    const shapes = Array.from({ length: 200 }, (_, i) => rect({ id: `r${i}`, type: 'script' }));
    const result = validateDraft(withShapes(...shapes), options);
    const findings = result.diagnostics.filter((d) => d.check === 'canvases');
    expect(findings.length).toBe(MAX_CANVAS_FINDINGS);
  });

  it('packages/spec/schemas/canvas.schema.json equals @texuli/canvas canvasJsonSchema()', () => {
    const pinned = JSON.parse(
      readFileSync(new URL('../../spec/schemas/canvas.schema.json', import.meta.url), 'utf8')
    ) as unknown;
    expect(pinned).toEqual(JSON.parse(JSON.stringify(canvasJsonSchema())));
  });
});
