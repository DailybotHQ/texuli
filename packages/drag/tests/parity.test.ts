// @vitest-environment node
/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { autoScrollVelocity, createAutoScroller, easeInCurve } from '../src/auto-scroll.ts';
import { closestCenter, midpointIndex, pointerWithin, rectIntersection } from '../src/collision.ts';
import { bindPointerGesture, createPointerTracker } from '../src/gesture.ts';
import { canConnect, edgeHitArea, edgePath, hitEdge, hitPort, type Port } from '../src/graph.ts';
import { createDragSession, refuse } from '../src/index.ts';
import { DEFAULT_DRAG_MESSAGES, formatDragMessage, resolveDragMessages } from '../src/messages.ts';
import { restrictToAxis, restrictToBounds, snapToGrid } from '../src/modifiers.ts';
import {
  createSortable,
  createSortableModel,
  createSortableSnapshot,
  intentFromKey,
  keyboardTarget,
  matchesSelector,
  planMove,
  pointerTarget,
  type SortableContainer,
  type SortableEvent,
} from '../src/sortable.ts';
import {
  marqueeSelect,
  moveFree,
  resizeRect,
  screenToWorld,
  snapToGuides,
  zoomAt,
} from '../src/spatial.ts';
import {
  createFakeFrames,
  createFakeTimer,
  createRecorder,
  measureList,
  pointer,
} from '../src/testing.ts';

/*
 * The SortableJS-class capability matrix. Each row is one capability with one
 * focused check; docs/parity.md lists the same rows (the last test keeps the
 * two in sync). Deeper coverage lives in the per-subpath test files.
 */

const list = (
  id: string,
  n: number,
  extra: Partial<SortableContainer> = {}
): SortableContainer => ({
  id,
  items: Array.from({ length: n }, (_, i) => `${id}${i + 1}`),
  ...extra,
});
const next = (plan: ReturnType<typeof planMove>, id: string) =>
  plan.ok ? plan.move.next[id] : plan.reason;
const tree = createSortableModel([
  { id: 'root', items: ['n1', 'n2'], group: 't' },
  { id: 'n1-kids', items: ['n1a'], group: 't', parentId: 'n1' },
]);

const CAPABILITIES: Record<string, () => void | Promise<void>> = {
  'session state machine': () => {
    const s = createDragSession<string, string>();
    const phases = [s.state.phase];
    s.press('x', { x: 0, y: 0 });
    phases.push(s.state.phase);
    s.move({ x: 9, y: 0 });
    phases.push(s.state.phase);
    s.over('t');
    s.drop();
    phases.push(s.state.phase);
    s.settle();
    phases.push(s.state.phase);
    expect(phases).toEqual(['idle', 'pressed', 'dragging', 'dropping', 'idle']);
  },
  'lifecycle events': () => {
    const r = createRecorder<SortableEvent>();
    const s = createSortable({
      containers: [list('a', 2, { group: 'g' }), list('b', 1, { group: 'g' })],
      onEvent: r.onEvent,
    });
    s.intent('pickUp', 'a1');
    s.intent('moveNext');
    s.cancel();
    s.intent('pickUp', 'a1');
    s.intent('moveNext');
    s.drop();
    s.intent('pickUp', 'a2');
    s.over({ containerId: 'b', index: 0 });
    s.drop();
    expect(new Set(r.types())).toEqual(
      new Set(['start', 'over', 'cancel', 'drop', 'update', 'remove', 'add'])
    );
    const moves = createRecorder<SortableEvent>();
    const p = createSortable({ containers: [list('a', 2)], onEvent: moves.onEvent });
    p.pickUp('a1', { point: { x: 0, y: 0 } });
    p.pointerMove({ x: 0, y: 10 });
    expect(moves.types()).toEqual(['start', 'move']);
  },
  'refusal reasons': () => {
    const s = createDragSession<string, string>({ canDrop: () => refuse('locked') });
    s.start('x');
    expect(s.over('t')).toEqual({ ok: false, reason: 'locked' });
    expect(s.drop()).toEqual({ kind: 'cancel', reason: 'locked' });
  },
  'vertical list': () => {
    const a = list('a', 4);
    const target = pointerTarget(
      createSortableSnapshot([measureList(a)]),
      { x: 10, y: 130 },
      {
        model: createSortableModel([a]),
        activeIds: ['a1'],
      }
    );
    expect(target).toEqual({ containerId: 'a', index: 2 });
  },
  'horizontal list (LTR and RTL)': () => {
    const a = list('a', 4);
    const model = createSortableModel([a]);
    const at = (direction: 'ltr' | 'rtl') =>
      pointerTarget(
        createSortableSnapshot([measureList(a, { orientation: 'horizontal', direction })]),
        { x: 150, y: 10 },
        {
          model,
          activeIds: [],
        }
      );
    expect(at('ltr')).toEqual({ containerId: 'a', index: 1 });
    // x 150 sits on a4's inline-start half in RTL (a4 spans 0–200).
    expect(at('rtl')).toEqual({ containerId: 'a', index: 3 });
  },
  'grid list': () => {
    const g = list('g', 8);
    const snap = createSortableSnapshot([measureList(g, { orientation: 'grid', columns: 4 })]);
    expect(
      pointerTarget(snap, { x: 750, y: 70 }, { model: createSortableModel([g]), activeIds: [] })
    ).toEqual({
      containerId: 'g',
      index: 8,
    });
  },
  'multi-container groups': () => {
    const model = createSortableModel([list('a', 2, { group: 'g' }), list('b', 1, { group: 'g' })]);
    expect(next(planMove(model, ['a1'], { containerId: 'b', index: 1 }), 'b')).toEqual([
      'b1',
      'a1',
    ]);
  },
  'pull and put rules': () => {
    const model = createSortableModel([
      list('a', 1, { group: { name: 'g', pull: false } }),
      list('b', 1, { group: { name: 'h', put: ['k'] } }),
      list('c', 1, { group: 'g' }),
    ]);
    expect(planMove(model, ['a1'], { containerId: 'c', index: 0 })).toMatchObject({
      reason: 'pull',
    });
    expect(planMove(model, ['c1'], { containerId: 'b', index: 0 })).toMatchObject({
      reason: 'put',
    });
  },
  'clone on pull': () => {
    const model = createSortableModel([
      { id: 'p', items: ['tpl'], group: { name: 'g', pull: 'clone' } },
      list('b', 0, { group: 'g' }),
    ]);
    const plan = planMove(model, ['tpl'], { containerId: 'b', index: 0 });
    expect(next(plan, 'b')).toEqual(['tpl-copy']);
    expect(plan.ok && plan.move.next.p).toBeUndefined();
  },
  'nested lists': () => {
    const inner = list('in', 1);
    const outer = list('out', 2);
    const snap = createSortableSnapshot([
      measureList(outer, { itemHeight: 100 }),
      measureList(inner, { x: 10, y: 110, itemWidth: 50 }),
    ]);
    expect(
      pointerTarget(
        snap,
        { x: 20, y: 120 },
        { model: createSortableModel([outer, inner]), activeIds: [] }
      )?.containerId
    ).toBe('in');
  },
  'tree reparent': () => {
    expect(keyboardTarget(tree, ['n2'], 'moveInto', { containerId: 'root', index: 1 })).toEqual({
      containerId: 'n1-kids',
      index: 1,
    });
    expect(keyboardTarget(tree, ['n1a'], 'moveOut', { containerId: 'n1-kids', index: 0 })).toEqual({
      containerId: 'root',
      index: 1,
    });
    expect(next(planMove(tree, ['n2'], { containerId: 'n1-kids', index: 1 }), 'n1-kids')).toEqual([
      'n1a',
      'n2',
    ]);
    expect(planMove(tree, ['n1'], { containerId: 'n1-kids', index: 0 })).toMatchObject({
      reason: 'cycle',
    });
  },
  'swap mode': () => {
    const model = createSortableModel([list('a', 3)]);
    expect(
      next(planMove(model, ['a1'], { containerId: 'a', index: 2 }, { mode: 'swap' }), 'a')
    ).toEqual(['a3', 'a2', 'a1']);
  },
  'multi-item drag': () => {
    const model = createSortableModel([list('a', 4)]);
    expect(next(planMove(model, ['a1', 'a2'], { containerId: 'a', index: 2 }), 'a')).toEqual([
      'a3',
      'a4',
      'a1',
      'a2',
    ]);
  },
  handles: () => {
    const s = createSortable({ containers: [list('a', 2)], requireHandle: true });
    const target = { closest: (sel: string) => (sel === '[data-handle]' ? {} : null) };
    expect(s.pickUp('a1')).toMatchObject({ reason: 'handle' });
    expect(s.pickUp('a1', { fromHandle: matchesSelector(target, '[data-handle]') })).toEqual({
      ok: true,
    });
  },
  filters: () => {
    const s = createSortable({ containers: [list('a', 2)], filter: (id) => id === 'a2' });
    expect(s.pickUp('a2')).toMatchObject({ reason: 'filtered' });
  },
  'locked items': () => {
    const model = createSortableModel([list('a', 3, { locked: ['a2'] })]);
    expect(planMove(model, ['a2'], { containerId: 'a', index: 0 })).toMatchObject({
      reason: 'locked',
    });
    expect(next(planMove(model, ['a1'], { containerId: 'a', index: 2 }), 'a')).toEqual([
      'a3',
      'a2',
      'a1',
    ]);
  },
  'sort disabled and capacity': () => {
    const model = createSortableModel([
      list('a', 2, { group: 'g', sort: false }),
      list('b', 1, { group: 'g', maxItems: 1 }),
    ]);
    expect(planMove(model, ['a1'], { containerId: 'a', index: 1 })).toMatchObject({
      reason: 'sort',
    });
    expect(planMove(model, ['a1'], { containerId: 'b', index: 0 })).toMatchObject({
      reason: 'full',
    });
  },
  'collision closestCenter': () => {
    const droppables = [
      { id: 'l', rect: { x: 0, y: 0, width: 10, height: 10 } },
      { id: 'r', rect: { x: 100, y: 0, width: 10, height: 10 } },
    ];
    expect(closestCenter({ pointer: { x: 80, y: 0 }, droppables })?.id).toBe('r');
  },
  'collision pointerWithin': () => {
    const droppables = [
      { id: 'big', rect: { x: 0, y: 0, width: 100, height: 100 } },
      { id: 'small', rect: { x: 0, y: 0, width: 10, height: 10 } },
    ];
    expect(pointerWithin({ pointer: { x: 5, y: 5 }, droppables })?.id).toBe('small');
  },
  'collision rectIntersection': () => {
    const droppables = [
      { id: 'l', rect: { x: 0, y: 0, width: 50, height: 50 } },
      { id: 'r', rect: { x: 50, y: 0, width: 50, height: 50 } },
    ];
    expect(
      rectIntersection({
        pointer: { x: 0, y: 0 },
        active: { x: 40, y: 0, width: 50, height: 50 },
        droppables,
      })?.id
    ).toBe('r');
  },
  'collision midpointIndex': () => {
    expect(midpointIndex([10, 30, 50], 31)).toBe(2);
  },
  'modifier axis lock': () => {
    expect(restrictToAxis('y')({ x: 9, y: 4 }, {})).toEqual({ x: 0, y: 4 });
  },
  'modifier bounds': () => {
    expect(
      restrictToBounds({ x: 0, y: 0, width: 100, height: 100 })(
        { x: 999, y: 0 },
        { activeRect: { x: 0, y: 0, width: 20, height: 20 } }
      )
    ).toEqual({ x: 80, y: 0 });
  },
  'modifier snap-to-grid': () => {
    expect(snapToGrid(8)({ x: 13, y: 3 }, {})).toEqual({ x: 16, y: 0 });
  },
  'auto-scroll edge zones and speed curve': () => {
    const metrics = {
      rect: { x: 0, y: 0, width: 100, height: 400 },
      scrollLeft: 0,
      scrollTop: 0,
      scrollWidth: 100,
      scrollHeight: 2000,
      clientWidth: 100,
      clientHeight: 400,
    };
    const frames = createFakeFrames();
    let scrolled = 0;
    createAutoScroller({
      frame: frames,
      targets: () => [
        {
          metrics: () => metrics,
          scrollBy: (_x, y) => {
            scrolled += y;
          },
        },
      ],
    }).update({ x: 50, y: 400 });
    frames.step();
    expect(scrolled).toBe(20);
    expect(autoScrollVelocity({ x: 50, y: 376 }, metrics).y).toBeCloseTo(20 * easeInCurve(0.5));
  },
  'gesture tracker with capture fallback': () => {
    const listeners = new Map<string, (e: unknown) => void>();
    const doc = {
      addEventListener: (t: string, l: (e: never) => void) =>
        listeners.set(t, l as (e: unknown) => void),
      removeEventListener: (t: string) => listeners.delete(t),
    };
    const element = { addEventListener() {}, removeEventListener() {}, ownerDocument: doc };
    const tracker = createPointerTracker();
    bindPointerGesture(element, tracker);
    tracker.down(pointer(0, 0));
    expect(tracker.phase).toBe('pressed');
  },
  '4 px threshold': () => {
    const t = createPointerTracker();
    t.down(pointer(0, 0));
    t.move(pointer(3, 0));
    expect(t.phase).toBe('pressed');
    t.move(pointer(4, 0));
    expect(t.phase).toBe('dragging');
  },
  'pointercancel cancels': () => {
    let result = '';
    const t = createPointerTracker({
      onEnd: () => {
        result = 'end';
      },
      onCancel: () => {
        result = 'cancel';
      },
    });
    t.down(pointer(0, 0));
    t.move(pointer(10, 0));
    t.cancel(pointer(10, 0));
    expect(result).toBe('cancel');
  },
  'long-press': () => {
    const timer = createFakeTimer();
    const t = createPointerTracker({ longPress: { delay: 250 }, timer });
    t.down(pointer(0, 0, { pointerType: 'touch' }));
    timer.advance(250);
    expect(t.phase).toBe('dragging');
  },
  'spatial pan and zoom transforms': () => {
    const view = zoomAt({ x: 0, y: 0, zoom: 1 }, { x: 100, y: 100 }, 2);
    expect(screenToWorld({ x: 100, y: 100 }, view)).toEqual({ x: 100, y: 100 });
    expect(screenToWorld({ x: 300, y: 100 }, view)).toEqual({ x: 200, y: 100 });
  },
  'spatial free placement': () => {
    expect(
      moveFree(
        [{ id: 'n', rect: { x: 0, y: 0, width: 10, height: 10 } }],
        { x: 30, y: 30 },
        { x: 0, y: 0, zoom: 3 }
      )[0]?.rect.x
    ).toBe(10);
  },
  'spatial snapping and guides': () => {
    const snap = snapToGuides(
      { x: 98, y: 300, width: 10, height: 10 },
      [{ id: 'o', rect: { x: 100, y: 0, width: 10, height: 10 } }],
      4
    );
    expect(snap.offset.x).toBe(2);
    expect(snap.guides[0]).toEqual({ axis: 'x', position: 100, with: 'o' });
  },
  'spatial marquee': () => {
    expect(
      marqueeSelect({ x: 50, y: 50 }, { x: 0, y: 0 }, [
        { id: 'in', rect: { x: 10, y: 10, width: 5, height: 5 } },
        { id: 'out', rect: { x: 90, y: 90, width: 5, height: 5 } },
      ])
    ).toEqual(['in']);
  },
  'spatial resize bounds': () => {
    expect(
      resizeRect(
        { x: 0, y: 0, width: 50, height: 50 },
        'se',
        { x: 100, y: 100 },
        { maxWidth: 80, bounds: { x: 0, y: 0, width: 200, height: 60 } }
      )
    ).toEqual({ x: 0, y: 0, width: 80, height: 60 });
  },
  'graph port hit-testing': () => {
    const ports: Port[] = [{ id: 'p', nodeId: 'n', kind: 'out', point: { x: 0, y: 0 } }];
    expect(hitPort(ports, { x: 3, y: 4 }, 6)?.id).toBe('p');
  },
  'graph edge hit areas': () => {
    expect(
      hitEdge([edgeHitArea('e', edgePath({ x: 0, y: 0 }, { x: 100, y: 0 }))], { x: 50, y: 3 })
    ).toBe('e');
  },
  'graph connection rules': () => {
    const a: Port = { id: 'a', nodeId: 'n1', kind: 'out', point: { x: 0, y: 0 } };
    const b: Port = { id: 'b', nodeId: 'n1', kind: 'in', point: { x: 0, y: 0 } };
    expect(
      canConnect(
        a,
        b,
        new Map([
          ['a', a],
          ['b', b],
        ]),
        []
      )
    ).toMatchObject({ reason: 'self' });
  },
  'messages with position, total and container': () => {
    const es = resolveDragMessages({ dropped: '{item}: {position}/{total} ({container})' });
    expect(
      formatDragMessage(es.dropped, { item: 'X', position: 1, total: 2, container: 'C' })
    ).toBe('X: 1/2 (C)');
    expect(DEFAULT_DRAG_MESSAGES.reasons.cycle).toBeTruthy();
  },
  'keyboard intents with RTL': () => {
    expect(
      intentFromKey('ArrowLeft', { dragging: true, orientation: 'horizontal', direction: 'rtl' })
    ).toBe('moveNext');
    expect(intentFromKey('ArrowLeft', { dragging: true, nested: true, direction: 'rtl' })).toBe(
      'moveInto'
    );
  },
  'pluggable strategies': () => {
    const a = list('a', 3);
    const snap = createSortableSnapshot([measureList(a)]);
    expect(
      pointerTarget(
        snap,
        { x: 0, y: 0 },
        { model: createSortableModel([a]), activeIds: [], slot: () => 3 }
      )?.index
    ).toBe(3);
    const custom = createSortable({
      containers: [a],
      messages: resolveDragMessages({ pickedUp: () => 'custom' }),
      announce: (m) => expect(m).toBe('custom'),
    });
    custom.intent('pickUp', 'a1');
  },
  'rect snapshot, re-measured on scroll only': () => {
    const a = list('a', 3);
    const measured = measureList(a);
    const snap = createSortableSnapshot([measured]);
    const model = createSortableModel([a]);
    const before = pointerTarget(snap, { x: 10, y: 70 }, { model, activeIds: [] });
    const scrolled = createSortableSnapshot([measureList(a, { y: -40 })]);
    expect(before?.index).toBe(2);
    expect(pointerTarget(scrolled, { x: 10, y: 70 }, { model, activeIds: [] })?.index).toBe(3);
    expect(pointerTarget(snap, { x: 10, y: 70 }, { model, activeIds: [] })).toEqual(before);
  },
  'overlay and in-place preview': () => {
    const s = createSortable({ containers: [list('a', 3)] });
    s.pickUp('a1', { point: { x: 0, y: 0 } });
    s.pointerMove({ x: 0, y: 110 }, createSortableSnapshot([measureList(list('a', 3))]));
    expect(s.state.delta).toEqual({ x: 0, y: 110 });
    expect(s.state.move?.next.a).toEqual(['a2', 'a3', 'a1']);
  },
  'cancel restores the origin': () => {
    const r = createRecorder<SortableEvent>();
    const s = createSortable({ containers: [list('a', 3)], announce: r.announce });
    s.intent('pickUp', 'a1');
    s.intent('moveNext');
    s.intent('cancel');
    expect(s.state.phase).toBe('idle');
    expect(r.announcements.at(-1)).toContain('returned to position 1 of 3');
  },
  'SSR-safe entries': async () => {
    expect(typeof (globalThis as { window?: unknown }).window).toBe('undefined');
    await import('../src/sortable.ts');
    await import('../src/gesture.ts');
  },
  'testing helpers': () => {
    const frames = createFakeFrames();
    let ran = 0;
    frames.request(() => {
      ran += 1;
    });
    expect(frames.step()).toBe(1);
    expect(ran).toBe(1);
    expect(measureList(list('a', 2)).items[1]?.rect.y).toBe(40);
  },
};

describe('SortableJS-class parity matrix', () => {
  for (const [name, run] of Object.entries(CAPABILITIES)) it(name, run);

  it('docs/parity.md lists exactly these capabilities', () => {
    const doc = readFileSync(new URL('../docs/parity.md', import.meta.url), 'utf8');
    const rows = [...doc.matchAll(/^\| [^|]+ \| `([^`]+)` \|/gm)].map((match) => match[1]);
    expect(rows).toEqual(Object.keys(CAPABILITIES));
  });
});
