// @vitest-environment node
import { sideCurvePath } from '@texuli/drag/graph';
import { describe, expect, it } from 'vitest';
import {
  alignOps,
  applyCanvasOps,
  type CanvasDocument,
  type CanvasOperation,
  type CanvasShape,
  canvasBounds,
  canvasJsonSchema,
  copyShapes,
  createCanvas,
  createCanvasHistory,
  createIdFactory,
  deleteOps,
  distributeOps,
  duplicateOps,
  frameAt,
  groupOps,
  indexShapes,
  loadUntrustedCanvas,
  moveOps,
  parseClipboard,
  pasteOps,
  pathFromPoints,
  readingOrder,
  reorderOps,
  reparentOps,
  resizeOps,
  rotateOps,
  routeConnector,
  serializeClipboard,
  shapeAt,
  shapeBounds,
  shapesInRect,
  simplifyPath,
  snapMove,
  textOps,
  ungroupOps,
  validateCanvas,
  walkShapes,
} from '../src/model/index.ts';
import { everyShape } from './fixtures.ts';

const ok = (doc: CanvasDocument, ops: CanvasOperation[]) => {
  const result = applyCanvasOps(doc, ops);
  if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`);
  return result;
};
const shape = (doc: CanvasDocument, id: string) =>
  indexShapes(doc).get(id)?.shape as CanvasShape & Record<string, unknown>;
const codes = (input: unknown) => {
  const result = validateCanvas(input);
  return result.ok ? [] : result.issues.map((issue) => issue.code);
};

describe('the canvas format', () => {
  it('accepts every shape type, routing and cap, and exports its JSON Schema', () => {
    const result = validateCanvas(everyShape());
    expect(result.issues).toEqual([]);
    expect(result.ok).toBe(true);
    const schema = canvasJsonSchema() as Record<string, unknown>;
    expect(schema.$id).toBe('https://texuli.com/schemas/canvas.schema.json');
    expect(JSON.stringify(schema)).toContain('"sticky"');
    expect(validateCanvas(createCanvas({ title: 'Blank' })).ok).toBe(true);
  });

  it('refuses hostile canvases with a precise code each', () => {
    const cases: [string, (doc: CanvasDocument) => unknown, string][] = [
      ['a wrong format', (d) => ({ ...d, format: 'texuli-document' }), 'unsupported-format'],
      [
        'an unknown shape',
        (d) => ({ ...d, shapes: [{ id: 'x', type: 'script' }] }),
        'unknown-shape',
      ],
      [
        'a bidi override in text',
        (d) => ({ ...d, shapes: [{ ...d.shapes[1], text: 'evil\u202Etxt.exe' }] }),
        'unsafe-text',
      ],
      [
        'a javascript: image',
        (d) => ({ ...d, shapes: [{ ...(d.shapes[8] as object), ref: 'javascript:void' }] }),
        'unsafe-url',
      ],
      [
        'a vbscript: image',
        (d) => ({ ...d, shapes: [{ ...(d.shapes[8] as object), ref: 'vbscript:msgbox' }] }),
        'unsafe-url',
      ],
      ['a duplicate id', (d) => ({ ...d, shapes: [d.shapes[1], d.shapes[1]] }), 'duplicate-id'],
      [
        'a connector to nowhere',
        (d) => ({ ...d, connectors: [{ id: 'z', from: { shape: 'ghost' }, to: { x: 0, y: 0 } }] }),
        'unknown-endpoint',
      ],
      [
        'a connector to a group',
        (d) => ({ ...d, connectors: [{ id: 'z', from: { shape: 'pair' }, to: { x: 0, y: 0 } }] }),
        'unknown-endpoint',
      ],
      [
        'an event handler key',
        (d) => ({ ...d, shapes: [{ ...(d.shapes[1] as object), onclick: 'x' }] }),
        'unknown-key',
      ],
      [
        'a raw CSS color',
        (d) => ({ ...d, shapes: [{ ...(d.shapes[1] as object), paint: { fill: 'url(#x)' } }] }),
        'enum',
      ],
      [
        'an empty group',
        (d) => ({ ...d, shapes: [{ id: 'g', type: 'group', children: [] }] }),
        'too-few',
      ],
      [
        'a huge coordinate',
        (d) => ({ ...d, shapes: [{ ...(d.shapes[1] as object), x: 1e12 }] }),
        'out-of-range',
      ],
    ];
    for (const [name, make, code] of cases) expect(codes(make(everyShape())), name).toContain(code);
  });

  it('refuses frames nested past the depth cap and keeps the cap', () => {
    const nest = (depth: number): CanvasShape => {
      let inner: CanvasShape = { id: 'leaf', type: 'rect', x: 0, y: 0, width: 1, height: 1 };
      for (let i = 0; i < depth; i += 1)
        inner = {
          id: `f${i}`,
          type: 'frame',
          x: 0,
          y: 0,
          width: 10,
          height: 10,
          children: [inner],
        };
      return inner;
    };
    expect(validateCanvas({ ...createCanvas(), shapes: [nest(8)] }).ok).toBe(true);
    expect(codes({ ...createCanvas(), shapes: [nest(9)] })).toContain('too-deep');
  });

  it('loads untrusted JSON text with a byte cap before parsing', () => {
    expect(loadUntrustedCanvas(JSON.stringify(everyShape())).ok).toBe(true);
    expect(loadUntrustedCanvas('{').issues[0]?.code).toBe('invalid-input');
    expect(loadUntrustedCanvas('x'.repeat(100), { maxBytes: 10 }).issues[0]?.message).toMatch(
      /larger/
    );
  });
});

describe('reading a canvas', () => {
  it('computes bounds with rotation, hit tests shapes and lists reading order', () => {
    const doc = everyShape();
    expect(shapeBounds(shape(doc, 'start'))).toEqual({ x: 720, y: 40, width: 120, height: 80 });
    const turned = shapeBounds({
      id: 'r',
      type: 'rect',
      x: 0,
      y: 0,
      width: 100,
      height: 0,
      rotation: 90,
    });
    expect(turned.width).toBeCloseTo(0);
    expect(turned.height).toBeCloseTo(100);
    expect(shapeBounds(shape(doc, 'pair')).x).toBe(40);
    // Ellipse corners miss; frames resolve to the child inside them; groups to the group.
    expect(shapeAt(doc, { x: 722, y: 42 })).toBeNull();
    expect(shapeAt(doc, { x: 780, y: 80 })).toBe('start');
    expect(shapeAt(doc, { x: 100, y: 100 })).toBe('idea');
    expect(shapeAt(doc, { x: 500, y: 300 })).toBe('frame');
    expect(shapeAt(doc, { x: 60, y: 500 })).toBe('pair');
    expect(shapeAt(doc, { x: 350, y: 525 }, 3)).toBe('pointer');
    expect(shapesInRect(doc, { x: 700, y: 0, width: 200, height: 400 }, 'contain')).toEqual([
      'choice',
      'start',
    ]);
    expect(readingOrder(doc)).toEqual([
      'frame',
      'idea',
      'review',
      'start',
      'note',
      'underline',
      'choice',
      'logo',
      'pair',
      'a1',
      'a2',
      // The scribble's middle is above the arrow's top: the arrow starts a new row.
      'scribble',
      'pointer',
    ]);
    expect(readingOrder(doc, 'rtl').slice(0, 4)).toEqual(['note', 'start', 'frame', 'review']);
    expect(canvasBounds(doc).width).toBeGreaterThan(1000);
  });

  it('routes connectors straight, elbow and curved, curves on the shared workflow math', () => {
    const doc = everyShape();
    const shapes = new Map(walkShapes(doc).map((entry) => [entry.shape.id, entry.shape]));
    const [c1, c2, c3] = doc.connectors.map((c) => routeConnector(c, shapes));
    // Elbow: every segment is horizontal or vertical.
    expect(c1?.routing).toBe('elbow');
    for (let i = 1; i < (c1?.points.length ?? 0); i += 1) {
      const a = c1?.points[i - 1] as { x: number; y: number };
      const b = c1?.points[i] as { x: number; y: number };
      expect(a.x === b.x || a.y === b.y).toBe(true);
    }
    expect(c1?.from).toEqual({ x: 780, y: 120 });
    expect(c1?.to).toEqual({ x: 780, y: 200 });
    expect(c2?.path).toBe(sideCurvePath(c2?.from as never, 'left', c2?.to as never, 'right'));
    expect(c3?.to).toEqual({ x: 400, y: 300 });
    expect(routeConnector({ id: 'x', from: { shape: 'ghost' }, to: { x: 0, y: 0 } }, shapes)).toBe(
      null
    );
  });
});

describe('operations and the op log', () => {
  it('removes a shape with its children and attached connectors, and the inverse restores it exactly', () => {
    const doc = everyShape();
    const removed = ok(doc, [{ op: 'remove', id: 'frame' }]);
    expect(indexShapes(removed.doc).has('idea')).toBe(false);
    expect(removed.doc.connectors.map((c) => c.id)).toEqual(['c1']);
    const back = ok(removed.doc, removed.inverse);
    expect(back.doc).toEqual(doc);
  });

  it('removes a group its last member leaves, and undoes that too', () => {
    const doc = everyShape();
    const step = ok(doc, [
      { op: 'remove', id: 'a1' },
      { op: 'remove', id: 'a2' },
    ]);
    expect(indexShapes(step.doc).has('pair')).toBe(false);
    expect(ok(step.doc, step.inverse).doc).toEqual(doc);
    const moved = ok(doc, [
      { op: 'move', id: 'a1', parent: null, index: 0 },
      { op: 'move', id: 'a2', parent: null, index: 0 },
    ]);
    expect(indexShapes(moved.doc).has('pair')).toBe(false);
    expect(ok(moved.doc, moved.inverse).doc).toEqual(doc);
  });

  it('applies all or none: a bad op, a cycle or an invalid result changes nothing', () => {
    const doc = everyShape();
    const before = JSON.stringify(doc);
    const failures: [CanvasOperation[], string][] = [
      [[{ op: 'remove', id: 'ghost' }], 'unknown-id'],
      [[{ op: 'move', id: 'frame', parent: 'frame', index: 0 }], 'cycle'],
      [[{ op: 'update', id: 'start', set: { text: 'x'.repeat(6000) } }], 'invalid-result'],
      [[{ op: 'update', id: 'start', set: JSON.parse('{"__proto__":1}') }], 'invalid-op'],
      [[{ op: 'update', id: 'start', set: { type: 'frame' } }], 'invalid-op'],
      [[{ op: 'add', shape: { ...(shape(doc, 'start') as CanvasShape) } }], 'duplicate-id'],
      [[{ op: 'bogus' } as never], 'invalid-op'],
    ];
    for (const [ops, code] of failures) {
      const result = applyCanvasOps(doc, ops);
      expect(result.ok, code).toBe(false);
      if (!result.ok) expect(result.error.code).toBe(code);
    }
    expect(JSON.stringify(doc)).toBe(before);
    const locked = { ...doc, shapes: [{ ...(doc.shapes[1] as CanvasShape), locked: true }] };
    const refused = applyCanvasOps(locked, [{ op: 'remove', id: 'start' }], { respectLocks: true });
    expect(!refused.ok && refused.error.code).toBe('locked');
  });

  it('undoes and redoes steps, merging nudges into one step', () => {
    const history = createCanvasHistory(everyShape());
    history.apply(moveOps(history.doc, ['start'], { x: 8, y: 0 }), { merge: 'nudge' });
    history.apply(moveOps(history.doc, ['start'], { x: 8, y: 0 }), { merge: 'nudge' });
    history.apply(textOps(history.doc, 'start', 'Begin'), { label: 'Edited text' });
    expect(history.steps).toHaveLength(2);
    expect(shape(history.doc, 'start').x).toBe(736);
    expect(history.undo()?.label).toBe('Edited text');
    expect(shape(history.doc, 'start').text).toBe('Start');
    history.undo();
    expect(shape(history.doc, 'start').x).toBe(720);
    expect(history.canUndo).toBe(false);
    history.redo();
    expect(shape(history.doc, 'start').x).toBe(736);
    expect(history.canRedo).toBe(true);
    history.apply(rotateOps(history.doc, 'start', 30));
    expect(history.canRedo).toBe(false);
  });
});

describe('editing helpers', () => {
  it('moves frames with their children, skips locked shapes and snaps to objects or the grid', () => {
    const doc = everyShape();
    const moved = ok(doc, moveOps(doc, ['frame', 'idea'], { x: 10, y: 5 })).doc;
    expect(shape(moved, 'frame').x).toBe(10);
    expect(shape(moved, 'idea').x).toBe(34);
    expect(
      moveOps(
        { ...doc, shapes: [{ ...(doc.shapes[1] as CanvasShape), locked: true }] },
        ['start'],
        { x: 1, y: 1 }
      )
    ).toEqual([]);
    const snapped = snapMove(doc, ['note'], { x: -178, y: 3 }, { threshold: 6 });
    expect(snapped.guides.some((g) => g.with === 'start' && g.axis === 'x')).toBe(true);
    const grid = snapMove(doc, ['start'], { x: 3, y: 3 }, { grid: 8, objects: false });
    expect(grid.delta).toEqual({ x: 0, y: 0 });
  });

  it('resizes from handles (paths scale, rotated shapes keep their anchor) and rotates with snapping', () => {
    const doc = everyShape();
    const wide = ok(doc, resizeOps(doc, 'scribble', 'se', { x: 60, y: 30 })).doc;
    expect(shape(wide, 'scribble').points).toEqual([
      [0, 0],
      [60, 60],
      [120, 0],
    ]);
    const kept = ok(doc, resizeOps(doc, 'start', 'e', { x: 40, y: 0 }, { keepAspect: false })).doc;
    expect(shape(kept, 'start').width).toBe(160);
    expect(shape(kept, 'start').x).toBe(720);
    const group = ok(doc, resizeOps(doc, 'pair', 'e', { x: 200, y: 0 })).doc;
    expect(shape(group, 'a2').x).toBeGreaterThan(160);
    expect(ok(doc, rotateOps(doc, 'start', 44, { snap: 15 })).doc.shapes[1]).toMatchObject({
      rotation: 45,
    });
    expect(ok(doc, rotateOps(doc, 'start', 360)).doc.shapes[1]).not.toHaveProperty('rotation');
    expect(rotateOps(doc, 'pair', 10)).toEqual([]);
  });

  it('aligns, distributes and reorders', () => {
    const doc = everyShape();
    const left = ok(doc, alignOps(doc, ['start', 'note', 'logo'], 'left')).doc;
    expect([shape(left, 'start').x, shape(left, 'note').x, shape(left, 'logo').x]).toEqual([
      720, 720, 720,
    ]);
    const spaced = ok(doc, distributeOps(doc, ['start', 'choice', 'logo'], 'vertical')).doc;
    const y = (id: string) => shape(spaced, id).y as number;
    const gap1 = y('choice') - (y('start') + 80);
    const gap2 = y('logo') - (y('choice') + 120);
    expect(gap1).toBeCloseTo(gap2);
    const front = ok(doc, reorderOps(doc, ['start'], 'front')).doc;
    expect(front.shapes.at(-1)?.id).toBe('start');
    const back = ok(doc, reorderOps(doc, ['logo', 'note'], 'back')).doc;
    expect(back.shapes.slice(0, 2).map((s) => s.id)).toEqual(['note', 'logo']);
    const forward = ok(doc, reorderOps(doc, ['frame'], 'forward')).doc;
    expect(forward.shapes.slice(0, 2).map((s) => s.id)).toEqual(['start', 'frame']);
    const backward = ok(doc, reorderOps(doc, ['frame'], 'backward')).doc;
    expect(backward).toEqual(doc);
  });

  it('groups, ungroups, reparents into frames and deletes', () => {
    const doc = everyShape();
    const grouped = ok(doc, groupOps(doc, ['start', 'choice'], 'g1')).doc;
    expect(shape(grouped, 'g1').children).toHaveLength(2);
    expect(groupOps(doc, ['start', 'idea'], 'g2')).toEqual([]);
    const ungrouped = ok(grouped, ungroupOps(grouped, 'g1')).doc;
    expect(indexShapes(ungrouped).has('g1')).toBe(false);
    expect(ungrouped.shapes.map((s) => s.id)).toContain('choice');
    const inside = ok(doc, reparentOps(doc, ['start'], 'frame')).doc;
    expect(indexShapes(inside).get('start')?.parent?.id).toBe('frame');
    expect(frameAt(doc, { x: 10, y: 10, width: 5, height: 5 })).toBe('frame');
    const deleted = ok(doc, deleteOps(doc, ['frame', 'idea', 'c1'])).doc;
    expect(deleted.connectors).toEqual([]);
  });

  it('copies and pastes through validated JSON with fresh ids, and refuses hostile clipboards', () => {
    const doc = everyShape();
    const text = serializeClipboard(copyShapes(doc, ['start', 'choice']));
    const parsed = parseClipboard(text);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.clip.connectors.map((c) => c.id)).toEqual(['c1']);
    const pasted = pasteOps(doc, parsed.clip, { offset: { x: 20, y: 20 } });
    const after = ok(doc, pasted.ops).doc;
    expect(pasted.ids).toHaveLength(2);
    expect(after.connectors).toHaveLength(4);
    expect(shape(after, pasted.ids[0] as string).x).toBe(740);
    expect(
      parseClipboard(
        '{"format":"texuli-canvas-clipboard","version":1,"shapes":[{"id":"x","type":"script"}],"connectors":[]}'
      ).ok
    ).toBe(false);
    expect(parseClipboard('not json').ok).toBe(false);
    expect(parseClipboard(JSON.stringify({ format: 'other', version: 1 })).ok).toBe(false);
    const twice = duplicateOps(doc, ['frame']);
    const dup = ok(doc, twice.ops).doc;
    expect(walkShapes(dup)).toHaveLength(walkShapes(doc).length + 3);
    const ids = createIdFactory(doc);
    expect(new Set([ids(), ids(), ids()]).size).toBe(3);
  });

  it('simplifies freehand input into a bounded path', () => {
    const line = Array.from({ length: 500 }, (_, i) => ({ x: i, y: 0 }));
    expect(simplifyPath(line)).toEqual([
      [0, 0],
      [499, 0],
    ]);
    const noisy = Array.from(
      { length: 50_000 },
      (_, i) => [i % 2 ? 0 : 100, i] as [number, number]
    );
    const bounded = simplifyPath(noisy);
    expect(bounded.length).toBeLessThanOrEqual(1000);
    expect(simplifyPath([{ x: Number.NaN, y: 1 }])).toEqual([]);
    const path = pathFromPoints('p', [
      { x: 10, y: 10 },
      { x: 30, y: 50 },
      { x: 50, y: 10 },
    ]);
    expect(path).toMatchObject({ x: 10, y: 10, width: 40, height: 40 });
    expect(path?.points[0]).toEqual([0, 0]);
  });
});
