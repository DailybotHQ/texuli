/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import {
  TREE_DENSITIES,
  TREE_VARIANTS,
  type TreeNode,
  TreeView,
  treeViewClass,
} from '../src/components/tree/index.ts';

afterEach(cleanup);

const items: readonly TreeNode[] = [
  {
    id: 'workspace',
    label: 'Workspace',
    children: [
      { id: 'docs', label: 'Documentation', children: [{ id: 'guide', label: 'Guide' }] },
      { id: 'archive', label: 'Archive', disabled: true },
    ],
  },
  { id: 'team', label: 'Team' },
];

describe('TreeView variants', () => {
  it('maps every appearance and density variant to classes', () => {
    expect(treeViewClass()).toBe('tx-tree');
    for (const variant of TREE_VARIANTS) {
      for (const density of TREE_DENSITIES) {
        const expected = [
          'tx-tree',
          ...(variant === 'default' ? [] : [`tx-tree--${variant}`]),
          ...(density === 'default' ? [] : [`tx-tree--${density}`]),
        ].join(' ');
        expect(treeViewClass({ variant, density })).toBe(expected);
      }
    }
    expect(treeViewClass({ variant: 'bordered', density: 'compact', class: 'mine' })).toBe(
      'tx-tree tx-tree--bordered tx-tree--compact mine'
    );
  });
});

describe('TreeView', () => {
  it('renders the accessible hierarchy and visible expansion state', () => {
    render(TreeView, { props: { items, expanded: ['workspace', 'docs'], label: 'Project pages' } });
    const tree = screen.getByRole('tree', { name: 'Project pages' });
    const workspace = within(tree).getByRole('treeitem', { name: 'Workspace' });
    const docs = within(tree).getByRole('treeitem', { name: 'Documentation' });
    const guide = within(tree).getByRole('treeitem', { name: 'Guide' });

    expect(workspace.getAttribute('aria-expanded')).toBe('true');
    expect(docs.getAttribute('aria-level')).toBe('2');
    expect(guide.getAttribute('aria-level')).toBe('3');
    expect(workspace.querySelector('[data-icon="folder-open"]')).toBeTruthy();
    expect(guide.querySelector('[data-icon="file"]')).toBeTruthy();
    expect(guide.querySelector('.tx-tree__row')?.getAttribute('data-depth')).toBe('2');
    expect(workspace.id).toMatch(/^.*-item-workspace$/);
  });

  it('shows selected state and decorative checkboxes in multiple-selection mode', () => {
    render(TreeView, {
      props: { items, expanded: ['workspace'], selected: ['docs'], selectionMode: 'multiple' },
    });
    const tree = screen.getByRole('tree');
    const docs = within(tree).getByRole('treeitem', { name: 'Documentation' });
    const archive = within(tree).getByRole('treeitem', { name: 'Archive' });

    expect(tree.getAttribute('aria-multiselectable')).toBe('true');
    expect(docs.getAttribute('aria-selected')).toBe('true');
    expect(docs.querySelector('.tx-tree__checkbox')?.getAttribute('data-checked')).toBe('true');
    expect(docs.querySelector('.tx-tree__checkbox svg')).toBeTruthy();
    expect(archive.hasAttribute('data-disabled')).toBe(true);
    expect(archive.querySelector('.tx-tree__checkbox')?.getAttribute('data-checked')).toBe('false');
  });

  it('expands and selects using the Tree primitive keyboard contract', async () => {
    render(TreeView, { props: { items, label: 'Project pages', selectionMode: 'multiple' } });
    const tree = screen.getByRole('tree', { name: 'Project pages' });
    tree.focus();
    await fireEvent.keyDown(tree, { key: 'ArrowRight' });
    await waitFor(() =>
      expect(within(tree).getByRole('treeitem', { name: 'Documentation' })).toBeTruthy()
    );
    await fireEvent.keyDown(tree, { key: 'ArrowRight' });
    await fireEvent.keyDown(tree, { key: ' ' });
    await waitFor(() =>
      expect(
        within(tree).getByRole('treeitem', { name: 'Documentation' }).getAttribute('aria-selected')
      ).toBe('true')
    );
    expect(tree.getAttribute('aria-activedescendant')).toContain('item-docs');
  });

  it('supports click selection while leaving disabled nodes unselected', async () => {
    render(TreeView, { props: { items, expanded: ['workspace'], selectionMode: 'single' } });
    const tree = screen.getByRole('tree');
    await fireEvent.click(within(tree).getByRole('treeitem', { name: 'Documentation' }));
    expect(
      within(tree).getByRole('treeitem', { name: 'Documentation' }).getAttribute('aria-selected')
    ).toBe('true');
    await fireEvent.click(within(tree).getByRole('treeitem', { name: 'Archive' }));
    expect(
      within(tree).getByRole('treeitem', { name: 'Archive' }).getAttribute('aria-selected')
    ).toBe('false');
  });

  it('forwards consumer attributes and composes the consumer class last', () => {
    render(TreeView, { props: { items, id: 'folders', class: 'my-tree', label: 'Folders' } });
    const tree = screen.getByRole('tree', { name: 'Folders' });
    expect(tree.id).toBe('folders');
    expect(tree.className).toBe('tx-tree my-tree');
    expect(tree.getAttribute('data-tx-tree')).not.toBeNull();
  });
});

describe('TreeView styles', () => {
  const css = readFileSync(join(import.meta.dirname, '../src/components/tree/tree.css'), 'utf8');

  it('is in the components layer and uses logical properties', () => {
    expect(css).toMatch(/^@layer tx\.components \{/m);
    const physical =
      /(?:^|[\s;{])(?:left|right|top|bottom|width|height|min-width|max-width|min-height|max-height|(?:margin|padding|border)-(?:left|right|top|bottom)(?:-[a-z]+)?)\s*:/m;
    expect(css.replace(/\/\*[\s\S]*?\*\//g, '')).not.toMatch(physical);
  });

  it('has forced-colors and reduced-motion fallbacks', () => {
    expect(css).toContain('@media (forced-colors: active)');
    expect(css).toContain('@media (prefers-reduced-motion: no-preference)');
  });
});
