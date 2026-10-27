// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';
import {
  applyEditOp,
  applyEditOps,
  blueprintDigest,
  canonicalBlueprintJson,
  createEditHistory,
  type EditEvent,
  type EditOp,
  getNode,
  parseEditOp,
  parseEditOps,
} from '../src/edit/index.ts';
import type { CatalogTreeInput } from '../src/render/renderer/types.ts';

describe('edit ops', () => {
  /** A fictional report: doc root, summary text, a card holding a chart and a table. */
  function report(): CatalogTreeInput {
    return {
      id: 'layout-doc',
      props: { title: 'Delivery report, week 42' },
      children: [
        { id: 'blocks-text', props: { block: { type: 'heading', level: 2, text: 'Summary' } } },
        {
          id: 'layout-card',
          props: { title: 'Throughput' },
          children: [
            {
              id: 'charts-line',
              props: { title: 'Items done', series: [{ name: 'Done', points: [3, 5, 8] }] },
            },
            {
              id: 'blocks-data',
              props: { block: { type: 'kpi', label: 'Cycle time', value: '2.1 d' } },
            },
          ],
        },
        { id: 'blocks-text', props: { block: { type: 'text', text: 'Data from example.com.' } } },
      ],
    };
  }

  function frozen<T>(value: T): T {
    if (typeof value === 'object' && value !== null) {
      for (const field of Object.values(value)) frozen(field);
      Object.freeze(value);
    }
    return value;
  }

  const canonical = canonicalBlueprintJson;

  /** Every op kind, valid against report(). */
  const OPS: readonly EditOp[] = [
    {
      op: 'insert',
      parent: [1],
      index: 1,
      node: { id: 'charts-bar', props: { title: 'Open items' } },
    },
    {
      op: 'insert',
      parent: [],
      index: 3,
      node: { id: 'blocks-text', props: { block: { type: 'text', text: 'End' } } },
    },
    { op: 'remove', path: [0] },
    { op: 'remove', path: [1, 0] },
    { op: 'move', path: [1, 1], parent: [], index: 0 },
    { op: 'move', path: [0], parent: [0], index: 0 },
    { op: 'move', path: [2], parent: [1], index: 2 },
    { op: 'setProp', path: [1], name: 'title', value: 'Flow' },
    { op: 'setProp', path: [1, 0], name: 'description', value: 'Weekly count' },
    { op: 'unsetProp', path: [1, 0], name: 'title' },
    {
      op: 'replace',
      path: [2],
      node: { id: 'blocks-text', props: { block: { type: 'quote', text: 'Ship it.' } } },
    },
    { op: 'replace', path: [], node: { id: 'layout-page', props: { title: 'New' } } },
    { op: 'replaceAll', tree: { id: 'layout-deck', props: { title: 'Planning' } } },
  ];

  /** Ops applied one after another to report(), covering every kind but replaceAll. */
  const BATCH: readonly EditOp[] = [
    {
      op: 'insert',
      parent: [1],
      index: 1,
      node: { id: 'charts-bar', props: { title: 'Open items' } },
    },
    { op: 'move', path: [1, 2], parent: [], index: 0 },
    { op: 'setProp', path: [2], name: 'title', value: 'Flow' },
    { op: 'unsetProp', path: [2, 0], name: 'title' },
    { op: 'setProp', path: [2, 0], name: 'description', value: 'Weekly count' },
    {
      op: 'replace',
      path: [3],
      node: { id: 'blocks-text', props: { block: { type: 'quote', text: 'Ship it.' } } },
    },
    { op: 'remove', path: [1] },
  ];

  it('structural ops insert, share, remove and move nodes, and refuse the root, missing addresses and self-moves', () => {
    // inserts a node as the given child and leaves the input untouched
    {
      const tree = frozen(report());
      const result = applyEditOp(tree, OPS[0] as EditOp);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(getNode(result.tree, [1, 1])?.id).toBe('charts-bar');
      expect(result.tree.children?.[1]?.children).toHaveLength(3);
      expect(canonical(tree)).toBe(canonical(report()));
    }
    // shares every subtree off the edited path
    {
      const tree = report();
      const result = applyEditOp(tree, {
        op: 'setProp',
        path: [1, 0],
        name: 'title',
        value: 'Done',
      });
      if (!result.ok) throw new Error(result.error.message);
      expect(result.tree.children?.[0]).toBe(tree.children?.[0]);
      expect(result.tree.children?.[2]).toBe(tree.children?.[2]);
      expect(result.tree.children?.[1]?.children?.[1]).toBe(tree.children?.[1]?.children?.[1]);
    }
    // removes a subtree
    {
      const result = applyEditOp(report(), { op: 'remove', path: [1] });
      if (!result.ok) throw new Error(result.error.message);
      expect(result.tree.children?.map((child) => child.id)).toEqual([
        'blocks-text',
        'blocks-text',
      ]);
    }
    // moves a node out of a card to the top, addressing the tree after removal
    {
      const result = applyEditOp(report(), { op: 'move', path: [1, 1], parent: [], index: 0 });
      if (!result.ok) throw new Error(result.error.message);
      expect(result.tree.children?.[0]?.id).toBe('blocks-data');
      expect(result.tree.children?.[2]?.children?.map((child) => child.id)).toEqual([
        'charts-line',
      ]);
    }
    // moves a node later among its own siblings
    {
      const result = applyEditOp(report(), { op: 'move', path: [0], parent: [], index: 2 });
      if (!result.ok) throw new Error(result.error.message);
      expect(result.tree.children?.map((child) => child.id)).toEqual([
        'layout-card',
        'blocks-text',
        'blocks-text',
      ]);
      expect(result.tree.children?.[2]?.props).toEqual({
        block: { type: 'heading', level: 2, text: 'Summary' },
      });
    }
    // refuses to remove the root, and to address missing nodes or indexes
    {
      const tree = report();
      const cases: [EditOp, string][] = [
        [{ op: 'remove', path: [] }, 'root-op'],
        [{ op: 'remove', path: [7] }, 'path-not-found'],
        [{ op: 'insert', parent: [0, 3], index: 0, node: { id: 'card' } }, 'path-not-found'],
        [{ op: 'insert', parent: [1], index: 3, node: { id: 'card' } }, 'index-out-of-range'],
        [{ op: 'move', path: [1], parent: [5], index: 0 }, 'path-not-found'],
        [{ op: 'setProp', path: [9], name: 'title', value: 'x' }, 'path-not-found'],
        [{ op: 'replace', path: [1, 4], node: { id: 'card' } }, 'path-not-found'],
      ];
      for (const [op, code] of cases) {
        const result = applyEditOp(tree, op);
        expect(result.ok, JSON.stringify(op)).toBe(false);
        if (!result.ok) expect(result.error.code).toBe(code);
      }
    }
    // cannot move a node into its own subtree
    {
      // The parent is addressed after the card is removed: [1] is then the trailing
      // text, which has no children, so the card's old descendants cannot be named.
      const tree = report();
      const result = applyEditOp(tree, { op: 'move', path: [1], parent: [1, 0], index: 0 });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe('path-not-found');
    }
  });

  it('property ops set, create, unset and refuse prototype names and inexact values', () => {
    // sets, overwrites and unsets one prop
    {
      let tree = report();
      for (const op of [
        { op: 'setProp', path: [1], name: 'variant', value: 'flat' },
        { op: 'setProp', path: [1], name: 'title', value: 'Flow' },
        { op: 'unsetProp', path: [1], name: 'variant' },
      ] as const) {
        const result = applyEditOp(tree, op);
        if (!result.ok) throw new Error(result.error.message);
        tree = result.tree;
      }
      expect(getNode(tree, [1])?.props).toEqual({ title: 'Flow' });
    }
    // creates the props bag on a node without one
    {
      const tree: CatalogTreeInput = { id: 'layout-page', children: [{ id: 'layout-grid' }] };
      const result = applyEditOp(tree, { op: 'setProp', path: [0], name: 'columns', value: 3 });
      if (!result.ok) throw new Error(result.error.message);
      expect(getNode(result.tree, [0])).toEqual({ id: 'layout-grid', props: { columns: 3 } });
    }
    // reports an absent unsetProp as unchanged
    {
      const tree = report();
      const result = applyEditOp(tree, { op: 'unsetProp', path: [1], name: 'missing' });
      expect(result.ok && result.changed).toBe(false);
      if (result.ok) expect(result.tree).toBe(tree);
    }
    // never lets a prop name reach the prototype
    {
      const tree = report();
      for (const name of ['__proto__', 'constructor ', '', '9lives', 'a'.repeat(65), 'on click']) {
        const result = applyEditOp(tree, {
          op: 'setProp',
          path: [1],
          name,
          value: { polluted: true },
        });
        expect(result.ok, name).toBe(false);
      }
      expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    }
    // refuses values JSON cannot carry exactly
    {
      const tree = report();
      const bad: unknown[] = [
        undefined,
        Number.NaN,
        Number.POSITIVE_INFINITY,
        () => 1,
        new Date(0),
        { at: new Map() },
      ];
      for (const value of bad) {
        const result = applyEditOp(tree, { op: 'setProp', path: [1], name: 'title', value });
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.code).toBe('invalid-value');
      }
    }
  });

  it('inverse ops restore every op kind and whole batches as plain JSON; batches apply all or none', () => {
    for (const op of OPS) {
      const tree = report();
      const forward = applyEditOp(tree, op);
      if (!forward.ok) throw new Error(`${op.op}: ${forward.error.message}`);
      const back = applyEditOps(forward.tree, forward.inverse);
      if (!back.ok) throw new Error(`${op.op} inverse: ${back.error.message}`);
      expect(canonical(back.tree), op.op).toBe(canonical(tree));
    }
    // restore a node that had no props bag after setProp
    {
      const tree: CatalogTreeInput = { id: 'layout-page', children: [{ id: 'layout-grid' }] };
      const forward = applyEditOp(tree, { op: 'setProp', path: [0], name: 'columns', value: 2 });
      if (!forward.ok) throw new Error(forward.error.message);
      const back = applyEditOps(forward.tree, forward.inverse);
      if (!back.ok) throw new Error(back.error.message);
      expect(back.tree).toEqual(tree);
    }
    // undo a whole batch in reverse order
    {
      const tree = report();
      const forward = applyEditOps(tree, BATCH);
      if (!forward.ok) throw new Error(forward.error.message);
      const back = applyEditOps(forward.tree, forward.inverse);
      if (!back.ok) throw new Error(back.error.message);
      expect(canonical(back.tree)).toBe(canonical(tree));
    }
    // are plain JSON that survives a serialize round trip as a patch
    {
      const forward = applyEditOps(report(), BATCH);
      if (!forward.ok) throw new Error(forward.error.message);
      const patch = parseEditOps(JSON.parse(JSON.stringify(forward.inverse)));
      expect(patch.ok).toBe(true);
      if (!patch.ok) return;
      const back = applyEditOps(forward.tree, patch.ops);
      if (!back.ok) throw new Error(back.error.message);
      expect(canonical(back.tree)).toBe(canonical(report()));
    }
    // apply all or none
    {
      const tree = report();
      const result = applyEditOps(tree, [
        { op: 'setProp', path: [1], name: 'title', value: 'Flow' },
        { op: 'remove', path: [12] },
      ]);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.opIndex).toBe(1);
      expect(getNode(tree, [1])?.props?.title).toBe('Throughput');
    }
  });

  it('parseEditOp accepts every op kind and refuses unknown kinds, non-data nodes, depth and oversize patches', () => {
    for (const op of OPS) expect(parseEditOp(JSON.parse(JSON.stringify(op))).ok, op.op).toBe(true);
    // refuses unknown kinds, extra fields and bad addresses
    {
      const bad: unknown[] = [
        null,
        'remove',
        [],
        { op: 'eval', code: '1' },
        { op: 'remove', path: [0], extra: true },
        { op: 'remove', path: '0.children.1' },
        { op: 'remove', path: [-1] },
        { op: 'remove', path: [1.5] },
        { op: 'remove', path: Array.from({ length: 65 }, () => 0) },
        { op: 'insert', parent: [], index: -1, node: { id: 'card' } },
        { op: 'move', path: [0], parent: [] },
        { op: 'toString', path: [] },
        { op: '__proto__', path: [] },
        Object.create({ op: 'remove', path: [0] }),
      ];
      for (const value of bad) {
        const result = parseEditOp(value);
        expect(result.ok, JSON.stringify(value)).toBe(false);
        if (!result.ok) expect(result.error.code).toBe('invalid-op');
      }
    }
    // refuses nodes that are not plain catalog data
    {
      const nodes: unknown[] = [
        { props: {} },
        { id: '' },
        { id: 'card', class: 'x' },
        { id: 'card', innerHTML: '<b>x</b>' },
        { id: 'card', props: [] },
        { id: 'card', props: { onClick: () => 1 } },
        { id: 'card', children: {} },
        { id: 'card', children: [{ id: 'card', children: [{ nope: 1 }] }] },
      ];
      for (const node of nodes) {
        for (const op of [
          { op: 'insert', parent: [], index: 0, node },
          { op: 'replace', path: [], node },
          { op: 'replaceAll', tree: node },
        ]) {
          const result = parseEditOp(op);
          expect(result.ok, JSON.stringify(op)).toBe(false);
          if (!result.ok) expect(result.error.code).toBe('invalid-node');
        }
      }
    }
    // refuses a node nested deeper than the data walk allows
    {
      let node: CatalogTreeInput = { id: 'card' };
      for (let depth = 0; depth < 300; depth += 1) node = { id: 'card', children: [node] };
      expect(parseEditOp({ op: 'replaceAll', tree: node }).ok).toBe(false);
    }
    // caps the size of a patch and names the failing op
    {
      const tooMany = Array.from({ length: 257 }, () => ({ op: 'remove', path: [0] }));
      expect(parseEditOps(tooMany).ok).toBe(false);
      const result = parseEditOps([{ op: 'remove', path: [0] }, { op: 'nope' }]);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.opIndex).toBe(1);
      expect(parseEditOps({ op: 'remove', path: [0] }).ok).toBe(false);
    }
    // is enforced by applyEditOps on untyped input
    {
      const result = applyEditOps(report(), [
        { op: 'eval', code: 'alert(1)' } as unknown as EditOp,
      ]);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe('invalid-op');
    }
  });

  it('canonical JSON round-trips byte-identically and digests as lowercase SHA-256', async () => {
    // export → import → export is byte-identical
    {
      const once = canonical(report());
      const twice = canonical(JSON.parse(once) as CatalogTreeInput);
      expect(twice).toBe(once);
      expect(once).not.toMatch(/\s{2}|\n/);
    }
    // does not depend on key order or undefined fields
    {
      const a: CatalogTreeInput = { id: 'card', props: { title: 'A', tone: 'info' } };
      const b = {
        children: undefined,
        props: { tone: 'info', title: 'A', note: undefined },
        id: 'card',
      };
      expect(canonical(b as CatalogTreeInput)).toBe(canonical(a));
      expect(await blueprintDigest(b as CatalogTreeInput)).toBe(await blueprintDigest(a));
    }
    // is a lowercase SHA-256 that changes with any edit
    {
      const tree = report();
      const digest = await blueprintDigest(tree);
      expect(digest).toMatch(/^[0-9a-f]{64}$/);
      const edited = applyEditOp(tree, { op: 'setProp', path: [1], name: 'title', value: 'Flow' });
      if (!edited.ok) throw new Error(edited.error.message);
      expect(await blueprintDigest(edited.tree)).not.toBe(digest);
      const back = applyEditOps(edited.tree, edited.inverse);
      if (!back.ok) throw new Error(back.error.message);
      expect(await blueprintDigest(back.tree)).toBe(digest);
    }
    // matches SHA-256 of the canonical text
    {
      const tree: CatalogTreeInput = { id: 'card' };
      expect(canonical(tree)).toBe('{"id":"card"}');
      // printf '{"id":"card"}' | shasum -a 256
      expect(await blueprintDigest(tree)).toBe(
        '1d28e224e608d2cb70b2a4dd9a5c85b5de53b671ad60eb82fadd68cc2e2162b2'
      );
    }
  });
});

describe('edit history', () => {
  function page(): CatalogTreeInput {
    return {
      id: 'layout-page',
      props: { title: 'Team update' },
      children: [{ id: 'layout-card', props: { title: 'Wins' } }],
    };
  }

  const addCard = (title: string): EditOp => ({
    op: 'insert',
    parent: [],
    index: 0,
    node: { id: 'layout-card', props: { title } },
  });

  it('applies, undoes and redoes exact trees, batches as one step, clears redo and coalesces by key', () => {
    // applies, undoes and redoes to the exact trees
    {
      const initial = page();
      const history = createEditHistory(initial);
      expect(history.canUndo).toBe(false);
      history.apply(addCard('Risks'));
      const after = history.tree;
      expect(history.tree.children).toHaveLength(2);

      expect(history.undo()).toBe(true);
      expect(history.tree).toBe(initial);
      expect(history.canRedo).toBe(true);

      expect(history.redo()).toBe(true);
      expect(history.tree).toBe(after);
      expect(history.redo()).toBe(false);
    }
    // treats a batch as one step
    {
      const history = createEditHistory(page());
      history.apply([addCard('A'), addCard('B'), { op: 'remove', path: [2] }]);
      expect(history.tree.children?.map((child) => child.props?.title)).toEqual(['B', 'A']);
      history.undo();
      expect(canonicalBlueprintJson(history.tree)).toBe(canonicalBlueprintJson(page()));
      expect(history.canUndo).toBe(false);
    }
    // a new apply clears the redo stack
    {
      const history = createEditHistory(page());
      history.apply(addCard('A'));
      history.undo();
      history.apply(addCard('B'));
      expect(history.canRedo).toBe(false);
    }
    // coalesces consecutive applies with the same key into one undo step
    {
      const history = createEditHistory(page());
      for (const title of ['W', 'Wi', 'Win', 'Wins!']) {
        history.apply(
          { op: 'setProp', path: [0], name: 'title', value: title },
          { coalesceKey: 'card-title' }
        );
      }
      expect(getNode(history.tree, [0])?.props?.title).toBe('Wins!');
      history.undo();
      expect(getNode(history.tree, [0])?.props?.title).toBe('Wins');
      expect(history.canUndo).toBe(false);
    }
    // does not coalesce across different keys or after an undo
    {
      const history = createEditHistory(page());
      history.apply({ op: 'setProp', path: [0], name: 'title', value: 'A' }, { coalesceKey: 'k' });
      history.apply({ op: 'setProp', path: [], name: 'title', value: 'B' }, { coalesceKey: 'j' });
      history.undo();
      history.redo();
      history.apply({ op: 'setProp', path: [], name: 'title', value: 'C' }, { coalesceKey: 'j' });
      history.undo();
      expect(history.tree.props?.title).toBe('B');
    }
  });

  it('gates commits, passes op errors, skips no-op edits, caps and clears steps, and notifies replayable ops', () => {
    // refuses an edit the commit gate rejects and leaves the tree as it was
    {
      const gate = vi.fn((tree: CatalogTreeInput) => {
        const ok = (tree.children?.length ?? 0) <= 1;
        return { ok, diagnostics: ok ? [] : [{ code: 'too-many' }] };
      });
      const initial = page();
      const history = createEditHistory(initial, { validate: gate });
      const result = history.apply(addCard('Extra'));
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('validation-failed');
        expect(result.error.diagnostics).toEqual([{ code: 'too-many' }]);
      }
      expect(history.tree).toBe(initial);
      expect(history.canUndo).toBe(false);
    }
    // uses the tree limits as the default commit gate
    {
      let deep: CatalogTreeInput = { id: 'layout-card' };
      for (let depth = 0; depth < 15; depth += 1) deep = { id: 'layout-card', children: [deep] };
      const history = createEditHistory({ id: 'layout-page' });
      // Root + 16 levels = depth 17, past the default maxDepth of 16.
      const result = history.apply({ op: 'insert', parent: [], index: 0, node: deep });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe('validation-failed');
    }
    // passes op errors through without touching history
    {
      const history = createEditHistory(page());
      const result = history.apply({ op: 'remove', path: [] });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe('root-op');
      expect(history.canUndo).toBe(false);
    }
    // records nothing for an edit that changes nothing
    {
      const history = createEditHistory(page());
      const listener = vi.fn();
      history.subscribe(listener);
      const result = history.apply({ op: 'unsetProp', path: [0], name: 'absent' });
      expect(result.ok && result.changed).toBe(false);
      expect(history.canUndo).toBe(false);
      expect(listener).not.toHaveBeenCalled();
    }
    // keeps at most `limit` steps
    {
      const history = createEditHistory(page(), { limit: 2 });
      history.apply(addCard('A'));
      history.apply(addCard('B'));
      history.apply(addCard('C'));
      expect(history.undo()).toBe(true);
      expect(history.undo()).toBe(true);
      expect(history.undo()).toBe(false);
      expect(history.tree.children?.map((child) => child.props?.title)).toEqual(['A', 'Wins']);
    }
    // clear drops every step but keeps the tree
    {
      const history = createEditHistory(page());
      history.apply(addCard('A'));
      const tree = history.tree;
      history.clear();
      expect(history.canUndo).toBe(false);
      expect(history.tree).toBe(tree);
    }
    // notifies listeners with ops a copy elsewhere can replay
    {
      const history = createEditHistory(page());
      const events: EditEvent[] = [];
      const unsubscribe = history.subscribe((event) => events.push(event));

      // A mirror (a server draft, another client) follows by replaying the ops.
      const mirror = createEditHistory(page());
      history.subscribe((event) => {
        const result = mirror.apply(event.ops);
        if (!result.ok) throw new Error(result.error.message);
      });

      history.apply([addCard('A'), { op: 'move', path: [0], parent: [], index: 1 }]);
      history.apply({ op: 'setProp', path: [], name: 'title', value: 'Week 42' });
      history.undo();
      history.undo();
      history.redo();

      expect(events.map((event) => event.type)).toEqual(['apply', 'apply', 'undo', 'undo', 'redo']);
      expect(canonicalBlueprintJson(mirror.tree)).toBe(canonicalBlueprintJson(history.tree));

      unsubscribe();
      history.redo();
      expect(events).toHaveLength(5);
    }
  });
});
