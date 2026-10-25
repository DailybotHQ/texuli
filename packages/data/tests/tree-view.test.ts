// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DRAG_THRESHOLD_PX,
  depthIndentRem,
  dropAsChild,
  indexFromPointer,
  placementsOf,
} from '../src/tree-view/model.ts';
import TreeDataViewHarness from './fixtures/TreeDataViewHarness.svelte';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('@texuli/data/tree-view model helpers', () => {
  it('computes pointer drop index, child-nest threshold and placements', () => {
    expect(indexFromPointer([10, 30], 5)).toBe(0);
    expect(indexFromPointer([10, 30], 20)).toBe(1);
    expect(indexFromPointer([10, 30], 40)).toBe(2);
    expect(dropAsChild(0, 100, 80, 'ltr')).toBe(true);
    expect(dropAsChild(0, 100, 40, 'ltr')).toBe(false);
    expect(dropAsChild(0, 100, 20, 'rtl')).toBe(true);
    expect(depthIndentRem(1)).toBe(0);
    expect(depthIndentRem(3)).toBe(2.5);
    expect(DRAG_THRESHOLD_PX).toBe(4);
    expect(
      placementsOf({
        id: 'a',
        parentId: 'p',
        rank: 'a1',
        rerank: [{ id: 'b', rank: 'a0' }],
      })
    ).toEqual({
      a: { parentId: 'p', rank: 'a1' },
      b: { parentId: 'p', rank: 'a0' },
    });
  });
});

describe('TreeDataView', () => {
  it('renders a tree with expanded branches, ARIA hierarchy and checkboxes', () => {
    render(TreeDataViewHarness);
    const tree = screen.getByRole('tree', { name: 'Tree' });
    expect(tree.getAttribute('aria-multiselectable')).toBe('true');
    const intro = screen.getByRole('treeitem', { name: /Intro/ });
    expect(intro.getAttribute('aria-level')).toBe('3');
    expect(intro.getAttribute('aria-posinset')).toBe('1');
    expect(screen.getByText('API')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Select Intro' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Move Intro' })).toBeTruthy();
  });

  it('toggles selection from the checkbox control', async () => {
    render(TreeDataViewHarness);
    const checkbox = screen.getByRole('button', { name: 'Select Intro' });
    await fireEvent.click(checkbox);
    expect(screen.getByLabelText('Selected ids').textContent).toBe('intro');
    expect(checkbox.getAttribute('aria-pressed')).toBe('true');
    await fireEvent.click(checkbox);
    expect(screen.getByLabelText('Selected ids').textContent).toBe('');
  });

  it('expands a lazy parent and loads children once', async () => {
    render(TreeDataViewHarness);
    const twist = screen.getByRole('button', { name: 'Expand Lazy folder' });
    await fireEvent.click(twist);
    await waitFor(() => expect(screen.getByLabelText('Load count').textContent).toBe('1'));
    await waitFor(() => expect(screen.getByText('Lazy folder child A')).toBeTruthy());
    expect(screen.getByText('Lazy folder child B')).toBeTruthy();
    const lazyRoot = document.querySelector('[data-tree-row-id="lazy-root"]');
    expect(lazyRoot?.getAttribute('aria-expanded')).toBe('true');
  });

  it('reorders siblings with Alt+Arrow and announces the move', async () => {
    render(TreeDataViewHarness);
    const setup = screen.getByRole('treeitem', { name: /Setup/ });
    setup.focus();
    await fireEvent.keyDown(setup, { key: 'ArrowUp', altKey: true });
    await waitFor(() => expect(screen.getByLabelText('Move count').textContent).toBe('1'));
    expect(document.querySelector('.tx-tree-view__live')?.textContent).toMatch(/Moved Setup/);
    const guides = screen.getByRole('treeitem', { name: /Guides/ });
    // After moving Setup above Intro, Setup is still under Guides.
    expect(guides.getAttribute('aria-expanded')).toBe('true');
  });

  it('indents with Tab using the engine move', async () => {
    render(TreeDataViewHarness);
    const api = screen.getByRole('treeitem', { name: /API/ });
    api.focus();
    await fireEvent.keyDown(api, { key: 'Tab' });
    await waitFor(() => expect(screen.getByLabelText('Move count').textContent).toBe('1'));
    expect(document.querySelector('.tx-tree-view__live')?.textContent).toMatch(/Moved API/);
  });

  it('moves a pointer drag onto a drop target row', async () => {
    render(TreeDataViewHarness);
    const handle = screen.getByRole('button', { name: 'Move API' });
    const intro = screen.getByRole('treeitem', { name: /Intro/ });
    const root = document.querySelector('[data-tree-view]');
    if (!root) throw new Error('Tree root missing');
    vi.spyOn(document, 'elementFromPoint').mockReturnValue(intro);

    await fireEvent.pointerDown(handle, { pointerId: 3, button: 0, clientX: 1, clientY: 1 });
    await fireEvent.pointerMove(root, { pointerId: 3, clientX: 40, clientY: 40 });
    await fireEvent.pointerUp(root, { pointerId: 3, clientX: 40, clientY: 40 });

    await waitFor(() =>
      expect(Number(screen.getByLabelText('Move count').textContent)).toBeGreaterThan(0)
    );
  });

  it('navigates rows with arrow keys', async () => {
    render(TreeDataViewHarness);
    const docs = screen.getByRole('treeitem', { name: /Docs/ });
    docs.focus();
    await fireEvent.keyDown(docs, { key: 'ArrowDown' });
    expect(document.activeElement?.getAttribute('data-tree-row-id')).toBe('guides');
    await fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'ArrowDown' });
    expect(document.activeElement?.getAttribute('data-tree-row-id')).toBe('intro');
  });
});
