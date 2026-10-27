// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { resolveDragMessages } from '../src/messages.ts';
import { restrictToAxis } from '../src/modifiers.ts';
import {
  createSortable,
  createSortableModel,
  createSortableSnapshot,
  pointerTarget,
  type SortableContainer,
  type SortableEvent,
} from '../src/sortable.ts';
import { createRecorder, measureList } from '../src/testing.ts';

const list = (
  id: string,
  n: number,
  extra: Partial<SortableContainer> = {}
): SortableContainer => ({
  id,
  items: Array.from({ length: n }, (_, i) => `${id}${i + 1}`),
  ...extra,
});

describe('pointerTarget', () => {
  const a = list('a', 5);
  const model = createSortableModel([a]);

  it('finds the slot by midpoints in a vertical list, net of the dragged item', () => {
    const snapshot = createSortableSnapshot([measureList(a)]);
    expect(pointerTarget(snapshot, { x: 50, y: 95 }, { model, activeIds: ['a1'] })).toEqual({
      containerId: 'a',
      index: 1,
    });
    expect(pointerTarget(snapshot, { x: 50, y: 95 }, { model, activeIds: ['a5'] })).toEqual({
      containerId: 'a',
      index: 2,
    });
    expect(pointerTarget(snapshot, { x: 50, y: 199 }, { model, activeIds: ['a1'] })).toEqual({
      containerId: 'a',
      index: 4,
    });
  });

  it('reads horizontal lists right to left in RTL', () => {
    const ltr = createSortableSnapshot([measureList(a, { orientation: 'horizontal' })]);
    const rtl = createSortableSnapshot([
      measureList(a, { orientation: 'horizontal', direction: 'rtl' }),
    ]);
    expect(pointerTarget(ltr, { x: 650, y: 20 }, { model, activeIds: [] })).toEqual({
      containerId: 'a',
      index: 3,
    });
    expect(pointerTarget(rtl, { x: 650, y: 20 }, { model, activeIds: [] })).toEqual({
      containerId: 'a',
      index: 2,
    });
  });

  it('places by nearest center and inline half in grids (both directions)', () => {
    const grid = list('g', 8);
    const gridModel = createSortableModel([grid]);
    const ltr = createSortableSnapshot([measureList(grid, { orientation: 'grid', columns: 4 })]);
    expect(pointerTarget(ltr, { x: 350, y: 60 }, { model: gridModel, activeIds: [] })).toEqual({
      containerId: 'g',
      index: 6,
    });
    expect(pointerTarget(ltr, { x: 250, y: 60 }, { model: gridModel, activeIds: [] })).toEqual({
      containerId: 'g',
      index: 5,
    });
    const rtl = createSortableSnapshot([
      measureList(grid, { orientation: 'grid', columns: 4, direction: 'rtl' }),
    ]);
    // Item 5 sits at x 400–600 in RTL; its inline end is the left half.
    expect(pointerTarget(rtl, { x: 450, y: 60 }, { model: gridModel, activeIds: [] })).toEqual({
      containerId: 'g',
      index: 6,
    });
  });

  it('prefers the innermost list, falls back to the closest one, and supports custom strategies', () => {
    const inner = list('in', 2);
    const outer = list('out', 3);
    const both = createSortableModel([outer, inner]);
    const snapshot = createSortableSnapshot([
      measureList(outer, { itemHeight: 100 }),
      measureList(inner, { x: 20, y: 110, itemHeight: 30, itemWidth: 100 }),
    ]);
    expect(
      pointerTarget(snapshot, { x: 40, y: 150 }, { model: both, activeIds: [] })?.containerId
    ).toBe('in');
    expect(
      pointerTarget(snapshot, { x: 900, y: 50 }, { model: both, activeIds: [] })?.containerId
    ).toBe('out');
    expect(
      pointerTarget(
        snapshot,
        { x: 900, y: 50 },
        { model: both, activeIds: [], collision: () => null }
      )
    ).toBeNull();
    expect(
      pointerTarget(snapshot, { x: 40, y: 150 }, { model: both, activeIds: [], slot: () => 0 })
    ).toEqual({
      containerId: 'in',
      index: 0,
    });
  });

  it('drops into a row’s child list from the trailing inline zone', () => {
    const root = list('r', 3, { group: 't' });
    const kids: SortableContainer = { id: 'r2-kids', items: ['k1'], group: 't', parentId: 'r2' };
    const treeModel = createSortableModel([root, kids]);
    const measured = measureList(root, { children: { r2: 'r2-kids' } });
    const snapshot = createSortableSnapshot([measured]);
    const options = { model: treeModel, activeIds: ['r1'], nestZone: 1 / 3 };
    expect(pointerTarget(snapshot, { x: 190, y: 60 }, options)).toEqual({
      containerId: 'r2-kids',
      index: 1,
    });
    expect(pointerTarget(snapshot, { x: 20, y: 60 }, options)).toEqual({
      containerId: 'r',
      index: 1,
    });
    const rtlSnapshot = createSortableSnapshot([{ ...measured, direction: 'rtl' }]);
    expect(pointerTarget(rtlSnapshot, { x: 20, y: 60 }, options)).toEqual({
      containerId: 'r2-kids',
      index: 1,
    });
  });

  it('returns the item under the pointer in swap mode', () => {
    const snapshot = createSortableSnapshot([measureList(a)]);
    expect(
      pointerTarget(snapshot, { x: 50, y: 130 }, { model, activeIds: ['a1'], mode: 'swap' })
    ).toEqual({
      containerId: 'a',
      index: 3,
    });
    expect(
      pointerTarget(snapshot, { x: 500, y: 130 }, { model, activeIds: ['a1'], mode: 'swap' })
    ).toBeNull();
  });

  it('falls back to a linear scan when measured rects are out of order', () => {
    const shuffled = measureList(a);
    const snapshot = createSortableSnapshot([
      { ...shuffled, items: [...shuffled.items].reverse() },
    ]);
    expect(snapshot.containers[0]?.sorted).toBe(false);
    expect(pointerTarget(snapshot, { x: 50, y: 300 }, { model, activeIds: [] })?.index).toBe(5);
  });
});

function setup(
  containers: readonly SortableContainer[],
  extra: Partial<Parameters<typeof createSortable>[0]> = {}
) {
  const recorder = createRecorder<SortableEvent>();
  const sortable = createSortable({
    containers,
    labelOf: (id) => `Card ${id}`,
    containerLabelOf: (id) => `List ${id.toUpperCase()}`,
    announce: recorder.announce,
    onEvent: recorder.onEvent,
    ...extra,
  });
  return { sortable, ...recorder };
}

describe('sortable controller — keyboard', () => {
  it('picks up, moves, announces and drops with an update event', () => {
    const { sortable, announcements, types } = setup([list('a', 4)]);
    expect(sortable.intent('pickUp', 'a1')).toEqual({ ok: true });
    expect(sortable.state.phase).toBe('dragging');
    sortable.intent('moveNext');
    sortable.intent('moveNext');
    const move = sortable.intent('drop');
    expect(move).toBeNull();
    expect(announcements).toEqual([
      'Card a1 picked up. Position 1 of 4 in List A.',
      'Card a1 moved to position 2 of 4.',
      'Card a1 moved to position 3 of 4.',
      'Card a1 dropped at position 3 of 4 in List A.',
    ]);
    expect(types()).toEqual(['start', 'over', 'over', 'over', 'drop', 'update']);
    expect(sortable.state.phase).toBe('idle');
  });

  it('returns the move from drop() for the host to apply', () => {
    const { sortable } = setup([list('a', 3)]);
    sortable.intent('pickUp', 'a3');
    sortable.intent('movePrev');
    const move = sortable.drop();
    expect(move?.next.a).toEqual(['a1', 'a3', 'a2']);
  });

  it('announces refusals at an edge and keeps the target', () => {
    const { sortable, announcements } = setup([list('a', 3)]);
    sortable.intent('pickUp', 'a1');
    expect(sortable.intent('movePrev')).toEqual({ ok: false, reason: 'edge' });
    expect(announcements.at(-1)).toBe('Cannot move Card a1 there: it is already at the edge.');
    expect(sortable.state.target).toEqual({ containerId: 'a', index: 0 });
  });

  it('restores on cancel with a cancelled message', () => {
    const { sortable, announcements, types } = setup([list('a', 3)]);
    sortable.intent('pickUp', 'a2');
    sortable.intent('moveNext');
    sortable.intent('cancel');
    expect(announcements.at(-1)).toBe(
      'Move cancelled. Card a2 returned to position 2 of 3 in List A.'
    );
    expect(types().at(-1)).toBe('cancel');
    expect(sortable.state.phase).toBe('idle');
  });

  it('jumps over locked items', () => {
    const { sortable } = setup([list('a', 3, { locked: ['a2'] })]);
    sortable.intent('pickUp', 'a1');
    sortable.intent('moveNext');
    expect(sortable.state.move?.next.a).toEqual(['a3', 'a2', 'a1']);
  });

  it('moves into a sibling list with crossContainers and voices the new list', () => {
    const { sortable, announcements, types } = setup(
      [list('a', 2, { group: 'g' }), list('b', 1, { group: 'g' })],
      {
        crossContainers: true,
      }
    );
    sortable.intent('pickUp', 'a2');
    sortable.intent('moveNext');
    expect(announcements.at(-1)).toBe('Card a2 moved to List B, position 1 of 2.');
    sortable.intent('drop');
    expect(announcements.at(-1)).toBe('Card a2 moved from List A to List B, position 1 of 2.');
    expect(types().slice(-3)).toEqual(['drop', 'remove', 'add']);
  });

  it('refuses pick-ups for unknown, filtered, locked, handle-only and disabled items', () => {
    expect(setup([list('a', 2)]).sortable.pickUp('zz')).toEqual({
      ok: false,
      reason: 'unknown-item',
    });
    expect(setup([list('a', 2)], { filter: () => true }).sortable.pickUp('a1')).toMatchObject({
      reason: 'filtered',
    });
    expect(setup([list('a', 2, { locked: ['a1'] })]).sortable.pickUp('a1')).toMatchObject({
      reason: 'locked',
    });
    expect(setup([list('a', 2)], { requireHandle: true }).sortable.pickUp('a1')).toMatchObject({
      reason: 'handle',
    });
    expect(
      setup([list('a', 2)], { requireHandle: true }).sortable.pickUp('a1', { fromHandle: true })
    ).toEqual({ ok: true });
    expect(setup([list('a', 2, { disabled: true })]).sortable.pickUp('a1')).toMatchObject({
      reason: 'disabled',
    });
    const busy = setup([list('a', 2)]).sortable;
    busy.intent('pickUp', 'a1');
    expect(busy.pickUp('a2')).toMatchObject({ reason: 'cancelled' });
    expect(busy.intent('pickUp', 'a2')).toBeNull();
  });

  it('drags a multi-selection as one block', () => {
    const { sortable, announcements } = setup([list('a', 5)]);
    sortable.pickUp('a2', { input: 'keyboard', selection: ['a4', 'a2'] });
    expect(announcements[0]).toBe('2 items picked up. Position 2 of 5 in List A.');
    sortable.intent('moveNext');
    expect(sortable.drop()?.next.a).toEqual(['a1', 'a3', 'a2', 'a4', 'a5']);
  });

  it('uses localized messages and number formatting', () => {
    const messages = resolveDragMessages({ pickedUp: '{item} levantado: {position}/{total}.' });
    const { sortable, announcements } = setup([list('a', 2)], {
      messages,
      formatNumber: (n) => `#${n}`,
    });
    sortable.intent('pickUp', 'a1');
    expect(announcements[0]).toBe('Card a1 levantado: #1/#2.');
  });

  it('ignores intents while idle', () => {
    const { sortable } = setup([list('a', 2)]);
    expect(sortable.intent('moveNext')).toBeNull();
    expect(sortable.intent('pickUp')).toBeNull();
    expect(sortable.drop()).toBeNull();
  });
});

describe('sortable controller — pointer', () => {
  const containers = [list('a', 3, { group: 'g' }), list('b', 2, { group: 'g' })];
  const snapshot = createSortableSnapshot([
    measureList(containers[0] as SortableContainer),
    measureList(containers[1] as SortableContainer, { x: 300 }),
  ]);

  it('waits for the threshold, hit-tests, then emits remove and add on a cross-list drop', () => {
    const { sortable, types, announcements } = setup(containers);
    sortable.pickUp('a1', { point: { x: 50, y: 20 } });
    expect(sortable.pointerMove({ x: 52, y: 21 }, snapshot)).toBeNull();
    expect(sortable.state.phase).toBe('pressed');
    expect(sortable.pointerMove({ x: 350, y: 45 }, snapshot)).toEqual({
      containerId: 'b',
      index: 1,
    });
    expect(announcements).toEqual([
      'Card a1 picked up. Position 1 of 3 in List A.',
      'Card a1 moved to List B, position 2 of 3.',
    ]);
    sortable.pointerMove({ x: 351, y: 46 }, snapshot);
    expect(announcements).toHaveLength(2);
    const move = sortable.drop();
    expect(move?.next).toEqual({ b: ['b1', 'a1', 'b2'], a: ['a2', 'a3'] });
    expect(types()).toEqual(['start', 'move', 'over', 'move', 'drop', 'remove', 'add']);
    sortable.setContainers(containers.map((c) => ({ ...c, items: move?.next[c.id] ?? c.items })));
    expect(sortable.model.locate('a1')).toEqual({ containerId: 'b', index: 1 });
  });

  it('cancels a refused drop with the reason', () => {
    const { sortable, types, announcements } = setup(containers, {
      canDrop: () => ({ ok: false, reason: 'full' }),
    });
    sortable.pickUp('a1', { point: { x: 50, y: 20 } });
    sortable.pointerMove({ x: 350, y: 45 }, snapshot);
    expect(announcements.at(-1)).toBe('Cannot move Card a1 there: List B is full.');
    expect(sortable.drop()).toBeNull();
    expect(types().at(-1)).toBe('cancel');
    expect(sortable.state.phase).toBe('idle');
  });

  it('treats a short press as a click and applies the transform', () => {
    const { sortable, types } = setup(containers, {
      transform: restrictToAxis('y') as (d: { x: number; y: number }) => { x: number; y: number },
    });
    sortable.pickUp('a1', { point: { x: 0, y: 0 } });
    expect(sortable.drop()).toBeNull();
    expect(types()).toEqual([]);
    sortable.pickUp('a1', { point: { x: 0, y: 0 } });
    sortable.pointerMove({ x: 30, y: 40 });
    expect(sortable.state.delta).toEqual({ x: 0, y: 40 });
    sortable.cancel();
  });

  it('swaps in swap mode and reports both lists', () => {
    const { sortable, types } = setup(containers, { mode: 'swap' });
    sortable.pickUp('a1', { point: { x: 50, y: 20 } });
    sortable.pointerMove({ x: 350, y: 60 }, snapshot);
    const move = sortable.drop();
    expect(move?.next).toEqual({ a: ['b2', 'a2', 'a3'], b: ['b1', 'a1'] });
    expect(types().slice(-4)).toEqual(['remove', 'add', 'remove', 'add']);
  });

  it('clones from a palette without a remove event', () => {
    const palette = [
      { id: 'p', items: ['tpl'], group: { name: 'g', pull: 'clone' as const, put: false } },
      list('b', 1, { group: 'g' }),
    ];
    const snap = createSortableSnapshot(palette.map((c, i) => measureList(c, { x: i * 300 })));
    const { sortable, types } = setup(palette);
    sortable.pickUp('tpl', { point: { x: 50, y: 20 } });
    sortable.pointerMove({ x: 350, y: 35 }, snap);
    expect(sortable.drop()?.next).toEqual({ b: ['b1', 'tpl-copy'] });
    expect(types().slice(-2)).toEqual(['drop', 'add']);
  });
});
