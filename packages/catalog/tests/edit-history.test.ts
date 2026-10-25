// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import {
  canonicalBlueprintJson,
  createEditHistory,
  type EditEvent,
  type EditOp,
  getNode,
} from '../src/edit/index.ts';
import type { CatalogTreeInput } from '../src/render/renderer/types.ts';

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

describe('createEditHistory', () => {
  it('applies, undoes and redoes to the exact trees', () => {
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
  });

  it('treats a batch as one step', () => {
    const history = createEditHistory(page());
    history.apply([addCard('A'), addCard('B'), { op: 'remove', path: [2] }]);
    expect(history.tree.children?.map((child) => child.props?.title)).toEqual(['B', 'A']);
    history.undo();
    expect(canonicalBlueprintJson(history.tree)).toBe(canonicalBlueprintJson(page()));
    expect(history.canUndo).toBe(false);
  });

  it('a new apply clears the redo stack', () => {
    const history = createEditHistory(page());
    history.apply(addCard('A'));
    history.undo();
    history.apply(addCard('B'));
    expect(history.canRedo).toBe(false);
  });

  it('coalesces consecutive applies with the same key into one undo step', () => {
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
  });

  it('does not coalesce across different keys or after an undo', () => {
    const history = createEditHistory(page());
    history.apply({ op: 'setProp', path: [0], name: 'title', value: 'A' }, { coalesceKey: 'k' });
    history.apply({ op: 'setProp', path: [], name: 'title', value: 'B' }, { coalesceKey: 'j' });
    history.undo();
    history.redo();
    history.apply({ op: 'setProp', path: [], name: 'title', value: 'C' }, { coalesceKey: 'j' });
    history.undo();
    expect(history.tree.props?.title).toBe('B');
  });

  it('refuses an edit the commit gate rejects and leaves the tree as it was', () => {
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
  });

  it('uses the tree limits as the default commit gate', () => {
    let deep: CatalogTreeInput = { id: 'layout-card' };
    for (let depth = 0; depth < 15; depth += 1) deep = { id: 'layout-card', children: [deep] };
    const history = createEditHistory({ id: 'layout-page' });
    // Root + 16 levels = depth 17, past the default maxDepth of 16.
    const result = history.apply({ op: 'insert', parent: [], index: 0, node: deep });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('validation-failed');
  });

  it('passes op errors through without touching history', () => {
    const history = createEditHistory(page());
    const result = history.apply({ op: 'remove', path: [] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('root-op');
    expect(history.canUndo).toBe(false);
  });

  it('records nothing for an edit that changes nothing', () => {
    const history = createEditHistory(page());
    const listener = vi.fn();
    history.subscribe(listener);
    const result = history.apply({ op: 'unsetProp', path: [0], name: 'absent' });
    expect(result.ok && result.changed).toBe(false);
    expect(history.canUndo).toBe(false);
    expect(listener).not.toHaveBeenCalled();
  });

  it('keeps at most `limit` steps', () => {
    const history = createEditHistory(page(), { limit: 2 });
    history.apply(addCard('A'));
    history.apply(addCard('B'));
    history.apply(addCard('C'));
    expect(history.undo()).toBe(true);
    expect(history.undo()).toBe(true);
    expect(history.undo()).toBe(false);
    expect(history.tree.children?.map((child) => child.props?.title)).toEqual(['A', 'Wins']);
  });

  it('clear drops every step but keeps the tree', () => {
    const history = createEditHistory(page());
    history.apply(addCard('A'));
    const tree = history.tree;
    history.clear();
    expect(history.canUndo).toBe(false);
    expect(history.tree).toBe(tree);
  });

  it('notifies listeners with ops a copy elsewhere can replay', () => {
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
  });
});
