import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CommandHarness from './CommandHarness.svelte';

afterEach(cleanup);

function renderCommand(
  props: {
    debounceMs?: number;
    onSearch?: (query: string) => void | Promise<void>;
    onSelect?: (value: string) => void;
  } = {}
) {
  return render(CommandHarness, { props });
}

describe('@texuli/primitives/command', () => {
  it('exposes a named combobox, listbox, groups, and the initially active option', () => {
    renderCommand();
    expect(
      screen.getByRole('combobox', { name: 'Search commands' }).getAttribute('aria-expanded')
    ).toBe('true');
    expect(screen.getByRole('listbox', { name: 'Search commands' })).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Navigation' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Open inbox' }).getAttribute('aria-selected')).toBe(
      'true'
    );
  });

  it('filters by scored label and keywords while removing unmatched groups', async () => {
    renderCommand();
    const input = screen.getByRole('combobox');
    await fireEvent.input(input, { target: { value: 'settings' } });
    expect(input.getAttribute('aria-activedescendant')).toBe(
      screen.getByRole('option', { name: 'Settings' }).id
    );
    await fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(
      screen.getByRole('option', { name: 'Open settings' }).getAttribute('aria-selected')
    ).toBe('true');
    await fireEvent.input(input, { target: { value: 'mail' } });
    expect(screen.getByRole('option', { name: 'Open inbox' })).toBeTruthy();
    expect(screen.queryByRole('group', { name: 'Actions' })).toBeNull();
    await fireEvent.input(input, { target: { value: 'missing' } });
    expect(screen.queryByRole('option')).toBeNull();
    expect(screen.getByText('No results')).toBeTruthy();
  });

  it('wraps keyboard navigation, skips disabled options, and selects with Enter', async () => {
    const onSelect = vi.fn();
    renderCommand({ onSelect });
    const input = screen.getByRole('combobox');
    await fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(
      screen.getByRole('option', { name: 'Open settings' }).getAttribute('aria-selected')
    ).toBe('true');
    await fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(screen.getByRole('option', { name: 'Settings' }).getAttribute('aria-selected')).toBe(
      'true'
    );
    await fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(screen.getByRole('option', { name: 'Create task' }).getAttribute('aria-selected')).toBe(
      'true'
    );
    await fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(screen.getByRole('option', { name: 'Open inbox' }).getAttribute('aria-selected')).toBe(
      'true'
    );
    await fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledWith('Open inbox');
  });

  it('leaves IME composition keys to the text input', async () => {
    const onSelect = vi.fn();
    renderCommand({ onSelect });
    const input = screen.getByRole('combobox');
    await fireEvent.keyDown(input, { key: 'ArrowDown', isComposing: true });
    expect(screen.getByRole('option', { name: 'Open inbox' }).getAttribute('aria-selected')).toBe(
      'true'
    );
    await fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('debounces async searches and ignores stale completions', async () => {
    let resolveOld: (() => void) | undefined;
    const onSearch = vi.fn((query: string) =>
      query === 'old'
        ? new Promise<void>((resolve) => {
            resolveOld = resolve;
          })
        : Promise.resolve()
    );
    renderCommand({ onSearch, debounceMs: 0 });
    const input = screen.getByRole('combobox');
    await fireEvent.input(input, { target: { value: 'old' } });
    await waitFor(() => expect(onSearch).toHaveBeenCalledWith('old'));
    await fireEvent.input(input, { target: { value: 'new' } });
    await waitFor(() => expect(onSearch).toHaveBeenCalledWith('new'));
    expect(screen.queryByText('Searching…')).toBeNull();
    resolveOld?.();
    await Promise.resolve();
    expect(screen.queryByText('Searching…')).toBeNull();
  });

  it('presents the loading state during a pending search', async () => {
    const onSearch = vi.fn(() => new Promise<void>(() => {}));
    renderCommand({ onSearch, debounceMs: 0 });
    await fireEvent.input(screen.getByRole('combobox'), { target: { value: 'query' } });
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Searching'));
    expect(screen.getByRole('listbox').getAttribute('aria-busy')).toBe('true');
  });

  it('exposes a compound component API', () => {
    const { component } = renderCommand();
    expect(component).toBeTruthy();
  });

  it('passes typed native input attributes through, keeping the ones it owns', () => {
    renderCommand();
    const input = screen.getByRole('combobox') as HTMLInputElement;
    expect(input.maxLength).toBe(40);
    expect(input.getAttribute('spellcheck')).toBe('false');
    expect(input.getAttribute('inputmode')).toBe('search');
    expect(input.getAttribute('autocomplete')).toBe('off');
    expect(input.getAttribute('aria-autocomplete')).toBe('list');
  });
});
