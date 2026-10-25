import { applyEditOp } from '@texuli/catalog/edit';
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
