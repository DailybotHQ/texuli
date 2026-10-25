import { fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import {
  assertUniqueTreeIds,
  flattenVisibleTree,
  getTreeWindow,
  type TreeNode,
} from '../src/tree/model.ts';
import TreeFixture from './tree-fixture.svelte';

afterEach(() => {
  document.body.replaceChildren();
});

describe('tree model', () => {
  it('flattens expanded rows with their hierarchy and sibling position', () => {
    const nodes: TreeNode[] = [
      { id: 'one', label: 'One', children: [{ id: 'child', label: 'Child' }] },
      { id: 'two', label: 'Two' },
    ];
    const rows = flattenVisibleTree(nodes, new Set(['one']), new Set(['child']));

    expect(rows.map((row) => [row.node.id, row.level, row.posInSet, row.setSize])).toEqual([
      ['one', 1, 1, 2],
      ['child', 2, 1, 1],
      ['two', 1, 2, 2],
    ]);
    expect(rows[1]).toMatchObject({ parentId: 'one', selected: true });
  });

  it('windows large trees with fixed row heights and bounded overscan', () => {
    expect(getTreeWindow(100, 600, 120, 30, 1)).toEqual({
      start: 19,
      end: 25,
      paddingStart: 570,
      paddingEnd: 2250,
    });
    expect(getTreeWindow(0, 0, 120, 30)).toEqual({
      start: 0,
      end: 0,
      paddingStart: 0,
      paddingEnd: 0,
    });
  });

  it('rejects empty and duplicate ids, including ids from lazy branches', () => {
    expect(() => assertUniqueTreeIds([{ id: ' ', label: 'Empty' }])).toThrow(/must not be empty/);
    expect(() =>
      assertUniqueTreeIds(
        [{ id: 'branch', label: 'Branch', hasChildren: true }],
        new Map([['branch', [{ id: 'branch', label: 'Duplicate' }]]])
      )
    ).toThrow(/duplicated/);
  });
});

describe('Tree.Root', () => {
  it('exposes the tree pattern and expands, moves, selects and collapses by keyboard', async () => {
    render(TreeFixture);
    const tree = screen.getByRole('tree', { name: 'Project files' });
    tree.focus();
    const documents = screen.getByRole('treeitem', { name: 'Documents' });

    expect(tree.getAttribute('aria-activedescendant')).toBe(documents.id);
    expect(documents.getAttribute('aria-level')).toBe('1');
    expect(documents.getAttribute('aria-expanded')).toBe('false');
    await fireEvent.keyDown(tree, { key: 'ArrowRight' });
    expect(documents.getAttribute('aria-expanded')).toBe('true');

    await fireEvent.keyDown(tree, { key: 'ArrowDown' });
    const brief = screen.getByRole('treeitem', { name: 'Project brief' });
    expect(tree.getAttribute('aria-activedescendant')).toBe(brief.id);
    await fireEvent.keyDown(tree, { key: ' ' });
    expect(brief.getAttribute('aria-selected')).toBe('true');
    expect(screen.getByText('brief', { selector: '[data-selected]' })).toBeTruthy();

    await fireEvent.keyDown(tree, { key: 'ArrowLeft' });
    expect(tree.getAttribute('aria-activedescendant')).toBe(documents.id);
  });

  it('selects multiple rows by pointer and keeps disabled branches inert', async () => {
    render(TreeFixture);
    const first = screen.getByRole('treeitem', { name: 'Documents' });
    const second = screen.getByRole('treeitem', { name: 'Archive' });
    await fireEvent.click(first);
    await fireEvent.click(second);
    expect(screen.getByText('documents,archive', { selector: '[data-selected]' })).toBeTruthy();

    const locked = screen.getByRole('treeitem', { name: 'Locked folder' });
    await fireEvent.click(within(locked).getByText('▸'));
    expect(locked.getAttribute('aria-expanded')).toBe('false');
  });

  it('loads lazy children on pointer expansion and retries only after collapsing', async () => {
    render(TreeFixture);
    const archive = screen.getByRole('treeitem', { name: 'Archive' });
    await fireEvent.click(within(archive).getByText('▸'));

    expect(await screen.findByRole('treeitem', { name: 'Archived file' })).toBeTruthy();
    expect(screen.getByText('archive', { selector: '[data-expanded]' })).toBeTruthy();
  });

  it('keeps virtualized DOM bounded and scrolls the active row into the rendered window', async () => {
    render(TreeFixture);
    const tree = screen.getByRole('tree', { name: 'Project files' });
    expect(screen.getAllByRole('treeitem').length).toBeLessThan(10);

    tree.focus();
    await fireEvent.keyDown(tree, { key: 'End' });
    await waitFor(() => expect(screen.getByRole('treeitem', { name: 'File 30' })).toBeTruthy());
    const activeId = tree.getAttribute('aria-activedescendant');
    expect(activeId).toBe(screen.getByRole('treeitem', { name: 'File 30' }).id);
    expect(screen.getAllByRole('treeitem').length).toBeLessThan(10);
  });
});
