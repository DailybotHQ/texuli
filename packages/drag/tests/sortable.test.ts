// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  applyMove,
  createSortableModel,
  intentFromKey,
  keyboardTarget,
  matchesSelector,
  originTarget,
  pinLocked,
  planMove,
  type SortableContainer,
} from '../src/sortable.ts';

const list = (
  id: string,
  n: number,
  extra: Partial<SortableContainer> = {}
): SortableContainer => ({
  id,
  items: Array.from({ length: n }, (_, i) => `${id}${i + 1}`),
  ...extra,
});

const order = (plan: ReturnType<typeof planMove>, id: string) =>
  plan.ok ? plan.move.next[id] : plan.reason;

describe('sortable model', () => {
  it('indexes containers and items, and refuses duplicates', () => {
    const model = createSortableModel([list('a', 3), list('b', 2, { parentId: 'a1' })]);
    expect(model.locate('a3')).toEqual({ containerId: 'a', index: 2 });
    expect(model.childContainers('a1')).toEqual(['b']);
    expect(model.order('b')).toBe(1);
    expect(() => createSortableModel([list('a', 1), list('a', 1)])).toThrow(RangeError);
    expect(() =>
      createSortableModel([
        { id: 'x', items: ['k'] },
        { id: 'y', items: ['k'] },
      ])
    ).toThrow(RangeError);
  });
});

describe('planMove — single lists', () => {
  const model = createSortableModel([list('a', 5)]);

  it('reorders by final index', () => {
    const plan = planMove(model, ['a1'], { containerId: 'a', index: 2 });
    expect(order(plan, 'a')).toEqual(['a2', 'a3', 'a1', 'a4', 'a5']);
    expect(plan.ok && plan.move).toMatchObject({ kind: 'move', index: 2, changed: true });
  });

  it('clamps the index and reports unchanged drops', () => {
    expect(order(planMove(model, ['a1'], { containerId: 'a', index: 99 }), 'a')).toEqual([
      'a2',
      'a3',
      'a4',
      'a5',
      'a1',
    ]);
    const same = planMove(model, ['a2'], { containerId: 'a', index: 1 });
    expect(same.ok && same.move.changed).toBe(false);
  });

  it('moves several items together, in list order', () => {
    const plan = planMove(model, ['a3', 'a1'], { containerId: 'a', index: 1 });
    expect(order(plan, 'a')).toEqual(['a2', 'a1', 'a3', 'a4', 'a5']);
  });

  it('refuses unknown items, missing targets and filtered items', () => {
    expect(planMove(model, ['zz'], { containerId: 'a', index: 0 })).toEqual({
      ok: false,
      reason: 'unknown-item',
    });
    expect(planMove(model, [], { containerId: 'a', index: 0 })).toEqual({
      ok: false,
      reason: 'unknown-item',
    });
    expect(planMove(model, ['a1'], { containerId: 'nope', index: 0 })).toEqual({
      ok: false,
      reason: 'no-target',
    });
    expect(planMove(model, ['a1'], { containerId: 'a', index: Number.NaN })).toEqual({
      ok: false,
      reason: 'no-target',
    });
    expect(
      planMove(model, ['a1'], { containerId: 'a', index: 2 }, { filter: (id) => id === 'a1' })
    ).toEqual({
      ok: false,
      reason: 'filtered',
    });
  });

  it('keeps locked items at their index and never moves them', () => {
    const locked = createSortableModel([list('a', 5, { locked: ['a3'] })]);
    expect(planMove(locked, ['a3'], { containerId: 'a', index: 0 })).toEqual({
      ok: false,
      reason: 'locked',
    });
    expect(order(planMove(locked, ['a1'], { containerId: 'a', index: 4 }), 'a')).toEqual([
      'a2',
      'a4',
      'a3',
      'a5',
      'a1',
    ]);
    expect(
      planMove(model, ['a2'], { containerId: 'a', index: 0 }, { isLocked: (id) => id === 'a2' })
    ).toMatchObject({
      reason: 'locked',
    });
    expect(pinLocked(['x', 'L'], ['x'], () => true)).toEqual(['x']);
  });

  it('refuses reordering a sort:false list and disabled lists', () => {
    const fixed = createSortableModel([list('a', 3, { sort: false })]);
    expect(planMove(fixed, ['a1'], { containerId: 'a', index: 2 })).toEqual({
      ok: false,
      reason: 'sort',
    });
    const off = createSortableModel([list('a', 3, { disabled: true })]);
    expect(planMove(off, ['a1'], { containerId: 'a', index: 2 })).toEqual({
      ok: false,
      reason: 'disabled',
    });
  });

  it('lets canDrop veto a changed move', () => {
    const plan = planMove(
      model,
      ['a1'],
      { containerId: 'a', index: 3 },
      { canDrop: () => ({ ok: false, reason: 'quota' }) }
    );
    expect(plan).toEqual({ ok: false, reason: 'quota' });
  });
});

describe('planMove — groups, clone and capacity', () => {
  const containers = [
    list('a', 3, { group: 'g' }),
    list('b', 2, { group: 'g' }),
    list('c', 1, { group: 'h' }),
    list('d', 1),
  ];
  const model = createSortableModel(containers);

  it('moves between lists of the same group and emits both next orders', () => {
    const plan = planMove(model, ['a1'], { containerId: 'b', index: 1 });
    expect(order(plan, 'b')).toEqual(['b1', 'a1', 'b2']);
    expect(order(plan, 'a')).toEqual(['a2', 'a3']);
    expect(plan.ok && applyMove(containers, plan.move).map((c) => c.items.length)).toEqual([
      2, 3, 1, 1,
    ]);
  });

  it('refuses other groups and ungrouped lists', () => {
    expect(planMove(model, ['a1'], { containerId: 'c', index: 0 })).toEqual({
      ok: false,
      reason: 'put',
    });
    expect(planMove(model, ['a1'], { containerId: 'd', index: 0 })).toEqual({
      ok: false,
      reason: 'pull',
    });
  });

  it('honours pull and put rules (boolean, list and function)', () => {
    const rules = createSortableModel([
      list('a', 2, { group: { name: 'g', pull: false } }),
      list('b', 2, { group: { name: 'g', pull: ['h'] } }),
      list('c', 1, { group: { name: 'h', put: ['g'] } }),
      list('e', 1, { group: { name: 'k', put: true, pull: ({ to }) => to.id === 'b' } }),
      list('f', 1, { group: { name: 'k', put: () => false } }),
    ]);
    expect(planMove(rules, ['a1'], { containerId: 'b', index: 0 })).toMatchObject({
      reason: 'pull',
    });
    expect(planMove(rules, ['b1'], { containerId: 'c', index: 0 }).ok).toBe(true);
    expect(planMove(rules, ['b1'], { containerId: 'a', index: 0 })).toMatchObject({
      reason: 'pull',
    });
    expect(planMove(rules, ['e1'], { containerId: 'b', index: 0 })).toMatchObject({
      reason: 'put',
    });
    expect(planMove(rules, ['e1'], { containerId: 'f', index: 0 })).toMatchObject({
      reason: 'pull',
    });
    expect(planMove(rules, ['b1'], { containerId: 'e', index: 0 })).toMatchObject({
      reason: 'pull',
    });
  });

  it('clones with pull: "clone", leaving the source untouched', () => {
    const palette = createSortableModel([
      {
        id: 'palette',
        items: ['card', 'card-copy'],
        group: { name: 'g', pull: 'clone', put: false },
      },
      { id: 'board', items: ['x'], group: 'g' },
    ]);
    const plan = planMove(palette, ['card'], { containerId: 'board', index: 1 });
    expect(plan.ok && plan.move.kind).toBe('clone');
    expect(order(plan, 'board')).toEqual(['x', 'card-copy-2']);
    expect(plan.ok && plan.move.next.palette).toBeUndefined();
    const custom = planMove(
      palette,
      ['card'],
      { containerId: 'board', index: 0 },
      { cloneId: (id) => `${id}#1` }
    );
    expect(order(custom, 'board')).toEqual(['card#1', 'x']);
    expect(planMove(palette, ['x'], { containerId: 'palette', index: 0 })).toMatchObject({
      reason: 'put',
    });
  });

  it('refuses arrivals past maxItems but allows reorders inside a full list', () => {
    const full = createSortableModel([
      list('a', 2, { group: 'g' }),
      list('b', 2, { group: 'g', maxItems: 2 }),
    ]);
    expect(planMove(full, ['a1'], { containerId: 'b', index: 0 })).toEqual({
      ok: false,
      reason: 'full',
    });
    expect(planMove(full, ['b1'], { containerId: 'b', index: 1 }).ok).toBe(true);
  });
});

describe('planMove — swap mode', () => {
  const model = createSortableModel([list('a', 4, { group: 'g' }), list('b', 2, { group: 'g' })]);

  it('swaps two items in one list or across lists', () => {
    expect(
      order(planMove(model, ['a1'], { containerId: 'a', index: 3 }, { mode: 'swap' }), 'a')
    ).toEqual(['a4', 'a2', 'a3', 'a1']);
    const cross = planMove(model, ['a2'], { containerId: 'b', index: 0 }, { mode: 'swap' });
    expect(order(cross, 'a')).toEqual(['a1', 'b1', 'a3', 'a4']);
    expect(order(cross, 'b')).toEqual(['a2', 'b2']);
    expect(cross.ok && cross.move.swapWith).toBe('b1');
  });

  it('refuses multi-item swaps, empty slots and locked partners', () => {
    expect(
      planMove(model, ['a1', 'a2'], { containerId: 'a', index: 3 }, { mode: 'swap' })
    ).toMatchObject({
      reason: 'swap-multi',
    });
    expect(planMove(model, ['a1'], { containerId: 'b', index: 5 }, { mode: 'swap' })).toMatchObject(
      { reason: 'no-target' }
    );
    expect(
      planMove(
        model,
        ['a1'],
        { containerId: 'a', index: 1 },
        { mode: 'swap', isLocked: (id) => id === 'a2' }
      )
    ).toMatchObject({
      reason: 'locked',
    });
  });
});

describe('planMove — nested lists and trees', () => {
  const tree = [
    { id: 'root', items: ['n1', 'n2', 'n3'], group: 'tree' },
    { id: 'n1-kids', items: ['n1a', 'n1b'], group: 'tree', parentId: 'n1' },
    { id: 'n1a-kids', items: [], group: 'tree', parentId: 'n1a' },
    { id: 'n2-kids', items: [], group: 'tree', parentId: 'n2' },
  ] satisfies SortableContainer[];
  const model = createSortableModel(tree);

  it('reparents an item into another list', () => {
    const plan = planMove(model, ['n2'], { containerId: 'n1-kids', index: 0 });
    expect(order(plan, 'n1-kids')).toEqual(['n2', 'n1a', 'n1b']);
    expect(order(plan, 'root')).toEqual(['n1', 'n3']);
  });

  it('refuses moving an item inside its own subtree', () => {
    expect(planMove(model, ['n1'], { containerId: 'n1a-kids', index: 0 })).toEqual({
      ok: false,
      reason: 'cycle',
    });
    expect(planMove(model, ['n1'], { containerId: 'n1-kids', index: 0 })).toEqual({
      ok: false,
      reason: 'cycle',
    });
  });

  it('enforces maxDepth with the moved subtree height', () => {
    expect(planMove(model, ['n2'], { containerId: 'n1a-kids', index: 0 }, { maxDepth: 2 })).toEqual(
      { ok: false, reason: 'depth' }
    );
    expect(planMove(model, ['n2'], { containerId: 'n1a-kids', index: 0 }, { maxDepth: 3 }).ok).toBe(
      true
    );
    expect(planMove(model, ['n1'], { containerId: 'n2-kids', index: 0 }, { maxDepth: 2 })).toEqual({
      ok: false,
      reason: 'depth',
    });
  });

  it('survives cyclic host data without hanging', () => {
    const cyclic = createSortableModel([
      { id: 'p', items: ['x'], parentId: 'y', group: 't' },
      { id: 'q', items: ['y'], parentId: 'x', group: 't' },
      { id: 'r', items: ['z'], group: 't' },
    ]);
    expect(planMove(cyclic, ['z'], { containerId: 'p', index: 0 }, { maxDepth: 50 })).toBeDefined();
    expect(planMove(cyclic, ['x'], { containerId: 'r', index: 0 }, { maxDepth: 50 })).toBeDefined();
  });
});

describe('keyboard targets and intents', () => {
  const model = createSortableModel([
    { id: 'root', items: ['n1', 'n2', 'n3'], group: 'tree' },
    { id: 'n1-kids', items: ['n1a', 'n1b'], group: 'tree', parentId: 'n1' },
    { id: 'other', items: ['o1'], group: 'tree' },
  ]);

  it('steps within a list and stops at its edges', () => {
    expect(keyboardTarget(model, ['n2'], 'movePrev', { containerId: 'root', index: 1 })).toEqual({
      containerId: 'root',
      index: 0,
    });
    expect(keyboardTarget(model, ['n1'], 'movePrev', { containerId: 'root', index: 0 })).toEqual({
      reason: 'edge',
    });
    expect(keyboardTarget(model, ['n3'], 'moveNext', { containerId: 'root', index: 2 })).toEqual({
      reason: 'edge',
    });
  });

  it('crosses into sibling lists when asked', () => {
    expect(
      keyboardTarget(
        model,
        ['n3'],
        'moveNext',
        { containerId: 'root', index: 2 },
        { crossContainers: true }
      )
    ).toEqual({
      containerId: 'other',
      index: 0,
    });
    expect(
      keyboardTarget(
        model,
        ['o1'],
        'movePrev',
        { containerId: 'other', index: 0 },
        { crossContainers: true }
      )
    ).toEqual({
      containerId: 'root',
      index: 3,
    });
  });

  it('nests under the previous item and un-nests after the parent', () => {
    expect(keyboardTarget(model, ['n2'], 'moveInto', { containerId: 'root', index: 1 })).toEqual({
      containerId: 'n1-kids',
      index: 2,
    });
    expect(keyboardTarget(model, ['n3'], 'moveInto', { containerId: 'root', index: 1 })).toEqual({
      containerId: 'n1-kids',
      index: 2,
    });
    expect(keyboardTarget(model, ['n1'], 'moveInto', { containerId: 'root', index: 0 })).toEqual({
      reason: 'edge',
    });
    expect(keyboardTarget(model, ['n3'], 'moveInto', { containerId: 'root', index: 2 })).toEqual({
      reason: 'no-target',
    });
    expect(keyboardTarget(model, ['n1a'], 'moveOut', { containerId: 'n1-kids', index: 0 })).toEqual(
      { containerId: 'root', index: 1 }
    );
    expect(keyboardTarget(model, ['n2'], 'moveOut', { containerId: 'root', index: 1 })).toEqual({
      reason: 'edge',
    });
  });

  it('computes the origin target net of the moved items', () => {
    expect(originTarget(model, ['n3'])).toEqual({ containerId: 'root', index: 2 });
    expect(originTarget(model, ['n1', 'n3'])).toEqual({ containerId: 'root', index: 0 });
    expect(originTarget(model, ['zz'])).toBeNull();
  });

  it('maps keys to intents, flipping inline arrows in RTL', () => {
    expect(intentFromKey(' ')).toBe('pickUp');
    expect(intentFromKey('Enter', { dragging: true })).toBe('drop');
    expect(intentFromKey('Escape', { dragging: true })).toBe('cancel');
    expect(intentFromKey('Tab', { dragging: true })).toBe('cancel');
    expect(intentFromKey('ArrowUp')).toBeNull();
    expect(intentFromKey('ArrowUp', { dragging: true })).toBe('movePrev');
    expect(intentFromKey('ArrowDown', { dragging: true })).toBe('moveNext');
    expect(intentFromKey('ArrowRight', { dragging: true })).toBeNull();
    expect(intentFromKey('ArrowRight', { dragging: true, nested: true })).toBe('moveInto');
    expect(intentFromKey('ArrowLeft', { dragging: true, nested: true })).toBe('moveOut');
    expect(intentFromKey('ArrowLeft', { dragging: true, nested: true, direction: 'rtl' })).toBe(
      'moveInto'
    );
    expect(intentFromKey('ArrowRight', { dragging: true, nested: true, direction: 'rtl' })).toBe(
      'moveOut'
    );
    const row = { dragging: true, orientation: 'horizontal' as const };
    expect(intentFromKey('ArrowRight', row)).toBe('moveNext');
    expect(intentFromKey('ArrowLeft', row)).toBe('movePrev');
    expect(intentFromKey('ArrowLeft', { ...row, direction: 'rtl' })).toBe('moveNext');
    expect(intentFromKey('ArrowRight', { ...row, direction: 'rtl' })).toBe('movePrev');
    expect(intentFromKey('ArrowDown', { ...row, nested: true })).toBe('moveInto');
    expect(intentFromKey('ArrowUp', { ...row, nested: true })).toBe('moveOut');
    expect(intentFromKey('ArrowDown', row)).toBeNull();
    const grid = { dragging: true, orientation: 'grid' as const };
    expect(intentFromKey('ArrowDown', grid)).toBe('moveNext');
    expect(intentFromKey('ArrowUp', grid)).toBe('movePrev');
  });

  it('matches handle and filter selectors on event targets', () => {
    const target = { closest: (s: string) => (s === '[data-handle]' ? {} : null) };
    expect(matchesSelector(target, '[data-handle]')).toBe(true);
    expect(matchesSelector(target, 'input')).toBe(false);
    expect(matchesSelector(null, 'input')).toBe(false);
  });
});
