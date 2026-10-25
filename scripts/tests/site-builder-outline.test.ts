import { applyEditOp, applyEditOps, type EditOp } from '@texuli/catalog/edit';
import { CONTENT_MANIFESTS } from '@texuli/catalog/manifests/content';
import {
  cardLayoutManifest,
  gridLayoutManifest,
  pageLayoutManifest,
} from '@texuli/catalog/manifests/layouts';
import type { CatalogTreeInput } from '@texuli/catalog/render/renderer';
import { describe, expect, it } from 'vitest';
import { createBuilderHistory } from '../../apps/website/src/components/builder/model.ts';
import {
  blockIds,
  cloneSubtree,
  copySubtrees,
  duplicateOps,
  freshBlockId,
  type GroupResult,
  groupDropMove,
  groupKeyboardMove,
  groupRemoveOps,
  groupRoots,
  pasteOps,
  pathAfterOp,
  placedPaths,
  rangeKeys,
  toggleKey,
} from '../../apps/website/src/components/builder/outline/group.ts';
import {
  moveKeepsStructure,
  structuralErrors,
} from '../../apps/website/src/components/builder/outline/guard.ts';
import {
  type DropPosition,
  dropMove,
  dropPosition,
  keyboardMove,
  type MoveResult,
  manifestCanContain,
  nodeAt,
  outlineRows,
  pathAfterRemoval,
} from '../../apps/website/src/components/builder/outline/model.ts';

const CONTAINERS = new Set(['layout-page', 'layout-card', 'layout-grid']);
const canContain = (id: string) => CONTAINERS.has(id);
// Unique fictional text per node, so a moved node can be found after the move.
const text = (markdown: string): CatalogTreeInput => ({
  id: 'blocks-text',
  props: { block: { type: 'text', markdown } },
});
const card = (title: string, children: CatalogTreeInput[]): CatalogTreeInput => ({
  id: 'layout-card',
  props: { title },
  children,
});
const TREE: CatalogTreeInput = {
  id: 'layout-page',
  props: { title: 'Fictional report' },
  children: [
    card('Alpha', [text('one'), text('two')]),
    { id: 'layout-grid', props: { columns: 2 }, children: [card('Beta', [text('three')])] },
    text('four'),
  ],
};

function applied(result: MoveResult): CatalogTreeInput {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.reason);
  const next = applyEditOp(TREE, result.op);
  expect(next.ok).toBe(true);
  if (!next.ok) throw new Error(next.error.message);
  return next.tree;
}

const markdownOf = (node: CatalogTreeInput | undefined) =>
  (node?.props?.block as { markdown?: string } | undefined)?.markdown;

describe('outline rows', () => {
  it('lists every node in reading order with tree semantics', () => {
    const rows = outlineRows(TREE, (id) => id, canContain);
    expect(rows.map((row) => row.key)).toEqual(['', '0', '0.0', '0.1', '1', '1.0', '1.0.0', '2']);
    const two = rows.find((row) => row.key === '0.1');
    expect(two).toMatchObject({
      level: 3,
      position: 2,
      siblings: 2,
      childCount: 0,
      canContain: false,
    });
    expect(rows[0]).toMatchObject({
      level: 1,
      position: 1,
      siblings: 1,
      childCount: 3,
      canContain: true,
    });
  });

  it('reads child support from the manifest children slot', () => {
    for (const manifest of [pageLayoutManifest, cardLayoutManifest, gridLayoutManifest]) {
      expect(manifestCanContain(manifest)).toBe(true);
    }
    for (const manifest of CONTENT_MANIFESTS) expect(manifestCanContain(manifest)).toBe(false);
  });
});

describe('keyboard moves (Alt+Arrow)', () => {
  it('moves up and down among siblings', () => {
    const down = applied(keyboardMove(TREE, [0, 0], 'down', canContain));
    expect(markdownOf(nodeAt(down, [0, 1]))).toBe('one');
    const up = applied(keyboardMove(TREE, [0, 1], 'up', canContain));
    expect(markdownOf(nodeAt(up, [0, 0]))).toBe('two');
  });

  it('indents into the previous sibling, as its last child', () => {
    const next = applied(keyboardMove(TREE, [2], 'indent', canContain));
    // "four" follows the grid, so it becomes the grid's last child.
    expect(markdownOf(nodeAt(next, [1, 1]))).toBe('four');
    expect(next.children).toHaveLength(2);
  });

  it('outdents to just after its parent', () => {
    const next = applied(keyboardMove(TREE, [0, 1], 'outdent', canContain));
    expect(markdownOf(nodeAt(next, [1]))).toBe('two');
    expect(nodeAt(next, [0])?.children).toHaveLength(1);
  });

  it('refuses moves that cannot happen, with a reason', () => {
    expect(keyboardMove(TREE, [], 'down', canContain)).toEqual({ ok: false, reason: 'root' });
    expect(keyboardMove(TREE, [0, 0], 'up', canContain)).toEqual({ ok: false, reason: 'first' });
    expect(keyboardMove(TREE, [2], 'down', canContain)).toEqual({ ok: false, reason: 'last' });
    expect(keyboardMove(TREE, [0, 1], 'indent', canContain)).toEqual({
      ok: false,
      reason: 'no-container',
    });
    expect(keyboardMove(TREE, [1], 'outdent', canContain)).toEqual({
      ok: false,
      reason: 'top-level',
    });
  });
});

describe('drag drops', () => {
  it('places every accepted drop exactly before, after or inside its target', () => {
    const rows = outlineRows(TREE, (id) => id, canContain);
    let accepted = 0;
    for (const from of rows) {
      for (const target of rows) {
        for (const position of ['before', 'after', 'inside'] as DropPosition[]) {
          const result = dropMove(TREE, from.path, target.path, position, canContain);
          if (!result.ok) continue;
          accepted += 1;
          const next = applyEditOp(TREE, result.op);
          expect(next.ok, JSON.stringify(result.op)).toBe(true);
          if (!next.ok) continue;
          const destination = [...result.op.parent, result.op.index];
          // The moved subtree arrives unchanged.
          expect(nodeAt(next.tree, destination)).toEqual(nodeAt(TREE, from.path));
          const parent = nodeAt(next.tree, result.op.parent);
          const targetNode = nodeAt(TREE, target.path);
          if (position === 'inside') {
            expect(parent?.id).toBe(targetNode?.id);
            expect(parent?.props).toEqual(targetNode?.props);
            expect(result.op.index).toBe((parent?.children?.length ?? 0) - 1);
          } else {
            const neighbor = parent?.children?.[result.op.index + (position === 'before' ? 1 : -1)];
            expect(neighbor?.id).toBe(targetNode?.id);
            expect(neighbor?.props).toEqual(targetNode?.props);
          }
        }
      }
    }
    expect(accepted).toBeGreaterThan(20);
  });

  it('refuses drops into itself, into leaves, onto the root edge and in place', () => {
    expect(dropMove(TREE, [1], [1, 0], 'inside', canContain)).toEqual({
      ok: false,
      reason: 'into-itself',
    });
    expect(dropMove(TREE, [0, 0], [2], 'inside', canContain)).toEqual({
      ok: false,
      reason: 'no-container',
    });
    expect(dropMove(TREE, [2], [], 'before', canContain)).toEqual({ ok: false, reason: 'root' });
    expect(dropMove(TREE, [0, 0], [0, 1], 'before', canContain)).toEqual({
      ok: false,
      reason: 'same-place',
    });
  });

  it('readdresses the target after removal and picks the drop zone from the pointer', () => {
    expect(pathAfterRemoval([0], [2])).toEqual([1]);
    expect(pathAfterRemoval([0, 0], [0, 1])).toEqual([0, 0]);
    expect(pathAfterRemoval([2], [0, 1])).toEqual([0, 1]);
    expect(pathAfterRemoval([1], [1, 0])).toBeNull();
    expect(dropPosition(2, 40, true)).toBe('before');
    expect(dropPosition(20, 40, true)).toBe('inside');
    expect(dropPosition(38, 40, true)).toBe('after');
    expect(dropPosition(19, 40, false)).toBe('before');
    expect(dropPosition(21, 40, false)).toBe('after');
  });
});

describe('builder history', () => {
  it('applies an outline move as one undoable edit', () => {
    const history = createBuilderHistory();
    expect(history.apply({ op: 'replaceAll', tree: TREE }).ok).toBe(true);
    const move = keyboardMove(history.tree, [0, 0], 'down', canContain);
    expect(move.ok).toBe(true);
    if (!move.ok) return;
    expect(history.apply(move.op).ok).toBe(true);
    expect(markdownOf(nodeAt(history.tree, [0, 1]))).toBe('one');
    expect(history.undo()).toBe(true);
    expect(history.tree).toEqual(TREE);
  });
});

describe('structure guard', () => {
  it('refuses a change that adds structural errors and allows one that removes them', () => {
    const nested: CatalogTreeInput = {
      id: 'layout-page',
      props: { title: 'Fictional' },
      children: [{ id: 'layout-doc', props: { title: 'Nested' }, children: [] }],
    };
    const clean: CatalogTreeInput = {
      id: 'layout-page',
      props: { title: 'Fictional' },
      children: [],
    };
    expect(structuralErrors(clean)).toBe(0);
    expect(structuralErrors(nested)).toBeGreaterThan(0);
    expect(moveKeepsStructure(clean, nested)).toBe(false);
    expect(moveKeepsStructure(nested, clean)).toBe(true);
    expect(moveKeepsStructure(TREE, TREE)).toBe(true);
  });
});

function appliedGroup<Op extends EditOp>(result: GroupResult<Op>, tree = TREE): CatalogTreeInput {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.reason);
  const next = applyEditOps(tree, result.ops);
  expect(next.ok).toBe(true);
  if (!next.ok) throw new Error(next.error.message);
  return next.tree;
}

/** Reading-order markdown of every text node: the order a group op must keep. */
const texts = (tree: CatalogTreeInput): string[] => {
  const out: string[] = [];
  const visit = (node: CatalogTreeInput) => {
    const markdown = markdownOf(node);
    if (markdown) out.push(markdown);
    for (const child of node.children ?? []) visit(child);
  };
  visit(tree);
  return out;
};

describe('multi-select', () => {
  it('toggles one row and selects the range from the anchor in reading order', () => {
    expect(toggleKey(['0'], '2')).toEqual(['0', '2']);
    expect(toggleKey(['0', '2'], '0')).toEqual(['2']);
    const keys = outlineRows(TREE, (id) => id, canContain).map((row) => row.key);
    expect(rangeKeys(keys, '0.1', '1.0')).toEqual(['0.1', '1', '1.0']);
    expect(rangeKeys(keys, '1.0', '0.1')).toEqual(['0.1', '1', '1.0']);
    expect(rangeKeys(keys, 'gone', '2')).toEqual(['2']);
  });

  it('acts on group roots: unique, in reading order, never the root or a carried descendant', () => {
    expect(groupRoots([[2], [0, 1], [], [0], [0, 1], [1, 0, 0]])).toEqual([[0], [1, 0, 0], [2]]);
  });
});

describe('group moves', () => {
  it('moves a selection up and down together, keeping its order, and reports where it lands', () => {
    const tree: CatalogTreeInput = {
      id: 'layout-page',
      children: [text('a'), text('b'), text('c'), text('d')],
    };
    const down = groupKeyboardMove(tree, [[1], [2]], 'down', canContain);
    expect(down.ok && down.paths).toEqual([[2], [3]]);
    expect(texts(appliedGroup(down, tree))).toEqual(['a', 'd', 'b', 'c']);
    const up = groupKeyboardMove(tree, [[2], [1]], 'up', canContain);
    expect(texts(appliedGroup(up, tree))).toEqual(['b', 'c', 'a', 'd']);
    // Non-adjacent rows each take one step.
    const spread = groupKeyboardMove(tree, [[1], [3]], 'up', canContain);
    expect(texts(appliedGroup(spread, tree))).toEqual(['b', 'a', 'd', 'c']);
  });

  it('indents and outdents a group without reversing it', () => {
    const tree: CatalogTreeInput = {
      id: 'layout-page',
      children: [card('Box', []), text('a'), text('b')],
    };
    const indent = groupKeyboardMove(tree, [[1], [2]], 'indent', canContain);
    const indented = appliedGroup(indent, tree);
    expect(indent.ok && indent.paths).toEqual([
      [0, 0],
      [0, 1],
    ]);
    expect(texts(nodeAt(indented, [0]) as CatalogTreeInput)).toEqual(['a', 'b']);
    const outdent = groupKeyboardMove(
      indented,
      [
        [0, 0],
        [0, 1],
      ],
      'outdent',
      canContain
    );
    expect(appliedGroup(outdent, indented)).toEqual(tree);
  });

  it('is all or nothing: one row that cannot move refuses the whole group', () => {
    expect(groupKeyboardMove(TREE, [[0, 0], [2]], 'up', canContain)).toEqual({
      ok: false,
      reason: 'first',
    });
    expect(groupKeyboardMove(TREE, [[0, 1], [2]], 'down', canContain)).toEqual({
      ok: false,
      reason: 'last',
    });
    expect(groupKeyboardMove(TREE, [[]], 'down', canContain)).toEqual({
      ok: false,
      reason: 'root',
    });
    expect(groupKeyboardMove(TREE, [[9]], 'down', canContain)).toEqual({
      ok: false,
      reason: 'missing',
    });
  });
});

describe('group drag drops', () => {
  it('drops a selection together before, after or inside a target, in reading order', () => {
    const inside = groupDropMove(TREE, [[2], [0, 0]], [1, 0], 'inside', canContain);
    const next = appliedGroup(inside);
    // Alpha keeps its index once its child leaves, so Beta's card stays at 1.0.
    expect(texts(nodeAt(next, [1, 0]) as CatalogTreeInput)).toEqual(['three', 'one', 'four']);
    expect(texts(nodeAt(next, [0]) as CatalogTreeInput)).toEqual(['two']);
    expect(inside.ok && inside.paths.map((path) => markdownOf(nodeAt(next, path)))).toEqual([
      'one',
      'four',
    ]);
    const before = appliedGroup(groupDropMove(TREE, [[0, 1], [2]], [0], 'before', canContain));
    expect(texts(before)).toEqual(['two', 'four', 'one', 'three']);
    // Dropping after a member of the group itself is allowed and keeps the group together.
    const after = appliedGroup(groupDropMove(TREE, [[0, 0], [2]], [0, 0], 'after', canContain));
    expect(texts(nodeAt(after, [0]) as CatalogTreeInput)).toEqual(['one', 'four', 'two']);
  });

  it('refuses drops into a member, into leaves, onto the root edge and in place', () => {
    expect(groupDropMove(TREE, [[1], [2]], [1, 0], 'inside', canContain)).toEqual({
      ok: false,
      reason: 'into-itself',
    });
    expect(groupDropMove(TREE, [[0, 0], [1]], [1], 'inside', canContain)).toEqual({
      ok: false,
      reason: 'into-itself',
    });
    expect(groupDropMove(TREE, [[0, 0], [1]], [2], 'inside', canContain)).toEqual({
      ok: false,
      reason: 'no-container',
    });
    expect(groupDropMove(TREE, [[0, 0], [1]], [], 'after', canContain)).toEqual({
      ok: false,
      reason: 'root',
    });
    expect(
      groupDropMove(
        TREE,
        [
          [0, 0],
          [0, 1],
        ],
        [0, 0],
        'before',
        canContain
      )
    ).toEqual({
      ok: false,
      reason: 'same-place',
    });
  });

  it('agrees with a single drop for a group of one', () => {
    const rows = outlineRows(TREE, (id) => id, canContain);
    let compared = 0;
    for (const from of rows) {
      for (const target of rows) {
        for (const position of ['before', 'after', 'inside'] as DropPosition[]) {
          const single = dropMove(TREE, from.path, target.path, position, canContain);
          const group = groupDropMove(TREE, [from.path], target.path, position, canContain);
          expect(group.ok, `${from.key} ${position} ${target.key}`).toBe(single.ok);
          if (!single.ok || !group.ok) continue;
          compared += 1;
          expect(appliedGroup(group)).toEqual(applied(single));
        }
      }
    }
    expect(compared).toBeGreaterThan(20);
  });
});

describe('group delete', () => {
  it('removes every selected subtree last first, as one batch', () => {
    const ops = groupRemoveOps([[0, 0], [2], [0, 0], [1, 0, 0], [1, 0]]);
    expect(ops).toEqual([
      { op: 'remove', path: [2] },
      { op: 'remove', path: [1, 0] },
      { op: 'remove', path: [0, 0] },
    ]);
    const next = applyEditOps(TREE, ops);
    expect(next.ok && texts(next.tree)).toEqual(['two']);
    expect(groupRemoveOps([[]])).toEqual([]);
  });
});

describe('duplicate and paste', () => {
  const ided = (id: string, markdown: string): CatalogTreeInput => ({
    id: 'blocks-text',
    props: { block: { type: 'text', id, markdown } },
  });

  it('gives every copied block a fresh, valid, deterministic id', () => {
    const taken = new Set(['intro', 'intro-copy']);
    expect(freshBlockId('intro', taken)).toBe('intro-copy-2');
    expect(freshBlockId('intro-copy', new Set())).toBe('intro-copy');
    const long = `a${'b'.repeat(47)}`;
    const fresh = freshBlockId(long, new Set());
    expect(fresh).toMatch(/^[a-z][a-z0-9-]{0,47}$/);
    expect(fresh.endsWith('-copy')).toBe(true);
    const source = card('Box', [ided('intro', 'one'), text('plain')]);
    const clone = cloneSubtree(source, new Set(['intro']));
    expect(blockIds(clone)).toEqual(new Set(['intro-copy']));
    expect(markdownOf(nodeAt(clone, [1]))).toBe('plain');
    // The source is never touched.
    expect(blockIds(source)).toEqual(new Set(['intro']));
  });

  it('duplicates each selected subtree right after itself, with no repeated block id', () => {
    const tree: CatalogTreeInput = {
      id: 'layout-page',
      children: [ided('intro', 'one'), card('Box', [ided('detail', 'two')]), text('three')],
    };
    const result = duplicateOps(tree, [[0], [1]]);
    const next = appliedGroup(result, tree);
    expect(texts(next)).toEqual(['one', 'one', 'two', 'two', 'three']);
    expect(result.ok && result.paths).toEqual([[1], [3]]);
    const ids = [...blockIds(next)].sort();
    expect(ids).toEqual(['detail', 'detail-copy', 'intro', 'intro-copy']);
    expect(blockIds(nodeAt(next, [1]) as CatalogTreeInput)).toEqual(new Set(['intro-copy']));
    expect(duplicateOps(tree, [[]])).toEqual({ ok: false, reason: 'root' });
  });

  it('copies plain subtrees and pastes inside a container or after a leaf, fresh each time', () => {
    const tree: CatalogTreeInput = {
      id: 'layout-page',
      children: [ided('intro', 'one'), card('Box', [])],
    };
    const clipboard = copySubtrees(tree, [[0], [0]]);
    expect(clipboard).toEqual([nodeAt(tree, [0])]);
    expect(clipboard[0]).not.toBe(nodeAt(tree, [0]));
    const inCard = pasteOps(tree, clipboard, [1], canContain);
    const afterCard = appliedGroup(inCard, tree);
    expect(inCard.ok && inCard.paths).toEqual([[1, 0]]);
    expect(blockIds(afterCard)).toEqual(new Set(['intro', 'intro-copy']));
    // Pasting again never reuses an id.
    const again = appliedGroup(pasteOps(afterCard, clipboard, [0], canContain), afterCard);
    expect(markdownOf(nodeAt(again, [1]))).toBe('one');
    expect([...blockIds(again)].sort()).toEqual(['intro', 'intro-copy', 'intro-copy-2']);
    // Nothing selected (or a stale path): the end of the page.
    const stale = pasteOps(tree, clipboard, [7, 7], canContain);
    expect(stale.ok && stale.ops[0]).toMatchObject({ parent: [], index: 2 });
    expect(pasteOps(tree, [], [1], canContain)).toEqual({ ok: false, reason: 'empty-clipboard' });
    expect(pasteOps({ id: 'blocks-text' }, clipboard, [], canContain)).toEqual({
      ok: false,
      reason: 'no-container',
    });
  });

  it('a paste the container rules refuse never reaches the tree', () => {
    // A doc layout pasted into a page adds structural errors: the builder's guard refuses it.
    const page: CatalogTreeInput = {
      id: 'layout-page',
      props: { title: 'Fictional' },
      children: [],
    };
    const result = pasteOps(
      page,
      [{ id: 'layout-doc', props: { title: 'Doc' }, children: [] }],
      [],
      canContain
    );
    const next = appliedGroup(result, page);
    expect(moveKeepsStructure(page, next)).toBe(false);
  });
});

describe('path bookkeeping', () => {
  it('follows nodes through inserts, removals and moves', () => {
    expect(pathAfterOp({ op: 'insert', parent: [0], index: 0, node: text('x') }, [0, 0])).toEqual([
      0, 1,
    ]);
    expect(pathAfterOp({ op: 'insert', parent: [0], index: 2, node: text('x') }, [0, 1])).toEqual([
      0, 1,
    ]);
    expect(pathAfterOp({ op: 'remove', path: [0] }, [0, 1])).toBeNull();
    expect(pathAfterOp({ op: 'move', path: [0], parent: [1], index: 0 }, [0, 1])).toEqual([
      1, 0, 1,
    ]);
    // Old [2] becomes [1] and is the new parent itself, so it does not shift.
    expect(pathAfterOp({ op: 'move', path: [0], parent: [1], index: 0 }, [2])).toEqual([1]);
    expect(pathAfterOp({ op: 'move', path: [0], parent: [], index: 0 }, [2])).toEqual([2]);
    expect(
      placedPaths([
        { op: 'insert', parent: [], index: 3, node: text('x') },
        { op: 'insert', parent: [], index: 1, node: text('y') },
      ])
    ).toEqual([[1], [4]]);
  });
});
