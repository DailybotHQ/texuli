// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import {
  breadcrumbs,
  childrenOf,
  type FileEntry,
  formatSize,
  moveFocusIndex,
  previewOf,
  toggleSelectedId,
} from '../src/files/index.ts';
import FileBrowserHarness from './fixtures/FileBrowserHarness.svelte';

afterEach(cleanup);

const sample: FileEntry[] = [
  { id: 'root', parentId: null, name: 'Root', kind: 'folder' },
  {
    id: 'a',
    parentId: 'root',
    name: 'Alpha.pdf',
    kind: 'file',
    type: 'application/pdf',
    size: 1024,
  },
  { id: 'b', parentId: 'root', name: 'Beta', kind: 'folder' },
];

describe('@texuli/data/files model helpers', () => {
  it('re-exports engine hierarchy helpers and builds previews', () => {
    expect(childrenOf(sample, 'root').map((entry) => entry.id)).toEqual(['b', 'a']);
    expect(breadcrumbs(sample, 'b').map((entry) => entry.id)).toEqual(['root', 'b']);
    expect(formatSize(2048)).toBe('2.0 KB');
    const preview = previewOf(sample[1]!);
    expect(preview.category).toBe('pdf');
    expect(preview.imageSrc).toMatch(/^data:image\/svg\+xml/);
    expect(toggleSelectedId(['a'], 'b')).toEqual(['a', 'b']);
    expect(toggleSelectedId(['a', 'b'], 'a')).toEqual(['b']);
  });

  it('moves focus across a grid including RTL left/right', () => {
    // 2 columns, 5 items: indices 0 1 / 2 3 / 4
    expect(moveFocusIndex(0, 5, 2, 'ArrowRight', false)).toBe(1);
    expect(moveFocusIndex(1, 5, 2, 'ArrowDown', false)).toBe(3);
    expect(moveFocusIndex(3, 5, 2, 'ArrowLeft', false)).toBe(2);
    expect(moveFocusIndex(0, 5, 2, 'ArrowLeft', true)).toBe(1); // RTL: left goes forward
    expect(moveFocusIndex(4, 5, 2, 'Home', false)).toBe(0);
    expect(moveFocusIndex(0, 5, 2, 'End', false)).toBe(4);
  });
});

describe('FileBrowser', () => {
  it('renders root items, layout controls and a preview', () => {
    render(FileBrowserHarness);
    expect(screen.getByRole('navigation', { name: 'Location' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'All files' })).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Layout' })).toBeTruthy();
    expect(screen.getByRole('listbox', { name: 'Folder contents' })).toBeTruthy();
    expect(screen.getByRole('option', { name: /Docs/ })).toBeTruthy();
    expect(screen.getByRole('option', { name: /Notes\.txt/ })).toBeTruthy();
    expect(screen.getByRole('complementary', { name: 'Preview' })).toBeTruthy();
    // Folders sort first; preview follows the focused/first child (Docs).
    expect(document.querySelector('.tx-files__preview-name')?.textContent).toBe('Docs');
  });

  it('opens a folder from the item and updates breadcrumbs', async () => {
    render(FileBrowserHarness);
    await fireEvent.click(screen.getByRole('option', { name: /Docs/ }));
    await waitFor(() => expect(screen.getByLabelText('Folder id').textContent).toBe('docs'));
    expect(screen.getByRole('button', { name: 'Docs' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('option', { name: /Brief\.pdf/ })).toBeTruthy();
    expect(screen.getByRole('option', { name: /Harbor\.png/ })).toBeTruthy();
  });

  it('toggles multi-select with Space on the focused option', async () => {
    render(FileBrowserHarness);
    const notes = screen.getByRole('option', { name: /Notes\.txt/ });
    notes.focus();
    await fireEvent.keyDown(notes, { key: ' ' });
    expect(screen.getByLabelText('Selected ids').textContent).toBe('notes');
    expect(screen.getByText('1 selected')).toBeTruthy();
    await fireEvent.keyDown(notes, { key: ' ' });
    expect(screen.getByLabelText('Selected ids').textContent).toBe('');
  });

  it('switches between grid and list layout', async () => {
    render(FileBrowserHarness);
    const root = document.querySelector('[data-file-browser]');
    expect(root?.getAttribute('data-layout')).toBe('grid');
    await fireEvent.click(screen.getByRole('button', { name: 'List' }));
    expect(screen.getByLabelText('Layout mode').textContent).toBe('list');
    expect(root?.getAttribute('data-layout')).toBe('list');
    expect(screen.getByRole('button', { name: 'List' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('opens a file with Enter and moves focus with arrows', async () => {
    render(FileBrowserHarness);
    const docs = screen.getByRole('option', { name: /Docs/ });
    docs.focus();
    await fireEvent.keyDown(docs, { key: 'ArrowDown' });
    // With gridColumns=2: Docs(0), Empty(1) / Notes(2) — folders first then files
    // children at root: Docs, Empty, Notes.txt
    // ArrowDown from 0 with 2 cols -> index 2 (Notes)
    await waitFor(() => expect(document.activeElement?.getAttribute('data-file-id')).toBe('notes'));
    await fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'Enter' });
    await waitFor(() => expect(screen.getByLabelText('Open count').textContent).toBe('1'));
  });

  it('returns to the parent folder with Backspace', async () => {
    render(FileBrowserHarness);
    await fireEvent.click(screen.getByRole('option', { name: /Docs/ }));
    await waitFor(() => expect(screen.getByLabelText('Folder id').textContent).toBe('docs'));
    const brief = screen.getByRole('option', { name: /Brief\.pdf/ });
    brief.focus();
    await fireEvent.keyDown(brief, { key: 'Backspace' });
    await waitFor(() => expect(screen.getByLabelText('Folder id').textContent).toBe('root'));
  });

  it('drops the listbox role on an empty folder so the empty text is not a listbox child', async () => {
    render(FileBrowserHarness);
    // A folder with children keeps the full listbox contract.
    const filled = screen.getByRole('listbox', { name: 'Folder contents' });
    expect(filled.getAttribute('aria-multiselectable')).toBe('true');
    await fireEvent.click(screen.getByRole('option', { name: /Empty/ }));
    await waitFor(() => expect(screen.getByLabelText('Folder id').textContent).toBe('empty'));
    // listbox requires owned options; an empty folder renders a plain group.
    const items = screen.getByRole('group', { name: 'Folder contents' });
    expect(items.getAttribute('role')).toBe('group');
    expect(items.getAttribute('aria-multiselectable')).toBeNull();
    expect(items.getAttribute('aria-orientation')).toBeNull();
    expect(screen.getByText('This folder is empty')).toBeTruthy();
    // Going back to a populated folder restores the listbox.
    await fireEvent.click(screen.getByRole('button', { name: 'All files' }));
    await waitFor(() =>
      expect(screen.getByRole('listbox', { name: 'Folder contents' })).toBeTruthy()
    );
  });

  it('gives the selection check a 24px hit area without enlarging the visible 20px box', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const source = readFileSync(
      resolve(process.cwd(), 'packages/data/src/files/FileBrowser.svelte'),
      'utf8'
    );
    // Visible box stays 1.25rem; the invisible ::after ring widens the target to 1.5rem.
    expect(source).toMatch(/\.tx-files__check\s*{[^}]*position:\s*relative/s);
    expect(source).toMatch(
      /\.tx-files__check::after\s*{[^}]*inset-block:\s*-0\.125rem;[^}]*inset-inline:\s*-0\.125rem;/s
    );
    // The dead selected-state rule (the span never gets aria-pressed) is gone.
    expect(source).not.toMatch(/\.tx-files__check\[aria-pressed/);
  });
});
