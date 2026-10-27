// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
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

  it('leaves Tab for focus movement instead of trapping it for indent', async () => {
    render(TreeDataViewHarness);
    const api = screen.getByRole('treeitem', { name: /API/ });
    api.focus();
    let prevented = true;
    const listener = (event: Event): void => {
      prevented = event.defaultPrevented;
    };
    api.addEventListener('keydown', listener);
    await fireEvent.keyDown(api, { key: 'Tab', cancelable: true });
    api.removeEventListener('keydown', listener);
    expect(prevented).toBe(false);
    expect(screen.getByLabelText('Move count').textContent).toBe('0');
    const instructions = screen.getByText(/Arrow keys move focus/);
    expect(instructions.textContent).not.toMatch(/Tab indents/);
  });

  it('leaves Alt+Arrow alone in a read-only tree (no onMove)', async () => {
    render(TreeDataViewHarness, { props: { readOnly: true } });
    const api = screen.getByRole('treeitem', { name: /API/ });
    api.focus();
    for (const key of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']) {
      // fireEvent resolves to dispatchEvent's result: false once prevented.
      const notPrevented = await fireEvent.keyDown(api, { key, altKey: true, cancelable: true });
      expect(notPrevented, `Alt+${key} keeps its default`).toBe(true);
      expect(document.querySelector('.tx-tree-view__live')?.textContent ?? '').not.toMatch(/Moved/);
    }
    expect(screen.getByLabelText('Move count').textContent).toBe('0');
  });

  it('indents with Alt+ArrowRight and outdents with Alt+ArrowLeft', async () => {
    render(TreeDataViewHarness);
    const api = screen.getByRole('treeitem', { name: /API/ });
    api.focus();
    await fireEvent.keyDown(api, { key: 'ArrowRight', altKey: true });
    await waitFor(() => expect(screen.getByLabelText('Move count').textContent).toBe('1'));
    expect(document.querySelector('.tx-tree-view__live')?.textContent).toMatch(/Moved API/);
    await fireEvent.keyDown(document.activeElement as HTMLElement, {
      key: 'ArrowLeft',
      altKey: true,
    });
    await waitFor(() => expect(screen.getByLabelText('Move count').textContent).toBe('2'));
  });

  it('flips the indent direction under RTL so Alt+ArrowLeft indents', async () => {
    render(TreeDataViewHarness, { props: { dir: 'rtl' } });
    const api = screen.getByRole('treeitem', { name: /API/ });
    api.focus();
    await fireEvent.keyDown(api, { key: 'ArrowLeft', altKey: true });
    await waitFor(() => expect(screen.getByLabelText('Move count').textContent).toBe('1'));
    expect(document.querySelector('.tx-tree-view__live')?.textContent).toMatch(/Moved API/);
  });

  it('exposes selection to assistive tech even without checkboxes', () => {
    render(TreeDataViewHarness, { props: { checkboxes: false, selectedIds: ['api'] } });
    const tree = screen.getByRole('tree', { name: 'Tree' });
    expect(tree.getAttribute('aria-multiselectable')).toBe('true');
    const row = screen.getByRole('treeitem', { name: /API/ });
    expect(row.getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('treeitem', { name: /Docs/ }).getAttribute('aria-selected')).toBe(
      'false'
    );
    expect(screen.queryByRole('button', { name: 'Select API' })).toBeNull();
  });

  it('keeps every row control at or above the 24px tap target', () => {
    // The unit environment injects no stylesheet, so the CSS contract is read
    // from the component source (same pattern as texuli avatar contrast).
    const source = readFileSync(
      join(import.meta.dirname, '../src/tree-view/TreeDataView.svelte'),
      'utf8'
    );
    const shared = source.match(/\.tx-tree-view__handle,[^{]*?\.tx-tree-view__twist\s*\{([^}]*)\}/);
    expect(shared?.[1]).toMatch(/inline-size:\s*2\.25rem/);
    const check = source.match(/\.tx-tree-view__check\s*\{([^}]*)\}/);
    expect(check).toBeTruthy();
    // The drawn checkbox is a ::before box; the button keeps the shared size.
    expect(check?.[1]).not.toMatch(/inline-size/);
    const drawnBox = source.match(/\.tx-tree-view__check::before\s*\{([^}]*)\}/);
    expect(drawnBox?.[1]).toMatch(/inline-size:\s*1\.25rem/);
  });

  it('announces the keyboard move instructions when the grip is activated without a drag', async () => {
    render(TreeDataViewHarness);
    const handle = screen.getByRole('button', { name: 'Move API' });
    await fireEvent.click(handle);
    expect(document.querySelector('.tx-tree-view__live')?.textContent).toContain(
      'Arrow keys move focus'
    );
  });

  it('does not repeat the instructions after a completed pointer drag', async () => {
    render(TreeDataViewHarness);
    const handle = screen.getByRole('button', { name: 'Move API' });
    const intro = screen.getByRole('treeitem', { name: /Intro/ });
    const root = document.querySelector('[data-tree-view]');
    if (!root) throw new Error('Tree root missing');
    vi.spyOn(document, 'elementFromPoint').mockReturnValue(intro);

    await fireEvent.pointerDown(handle, { pointerId: 5, button: 0, clientX: 1, clientY: 1 });
    await fireEvent.pointerMove(root, { pointerId: 5, clientX: 40, clientY: 40 });
    await fireEvent.pointerUp(root, { pointerId: 5, clientX: 40, clientY: 40 });
    await waitFor(() => expect(screen.getByLabelText('Move count').textContent).toBe('1'));
    await fireEvent.click(handle);

    const live = document.querySelector('.tx-tree-view__live')?.textContent ?? '';
    expect(live).not.toContain('Arrow keys move focus');
    expect(live).toMatch(/Moved API/);
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
