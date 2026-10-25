import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import ComboboxHarness from './ComboboxHarness.svelte';

afterEach(cleanup);

describe('@texuli/primitives/combobox', () => {
  it('exposes the APG combobox relationships and keeps DOM focus on the input', async () => {
    render(ComboboxHarness);
    const input = screen.getByRole('combobox', { name: 'Colors' });
    input.focus();
    expect(input.getAttribute('aria-autocomplete')).toBe('list');
    expect(input.getAttribute('aria-expanded')).toBe('false');
    await fireEvent.input(input, { target: { value: 'ja' } });
    const listbox = screen.getByRole('listbox', { name: 'Color options' });
    expect(input.getAttribute('aria-controls')).toBe(listbox.id);
    expect(input.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getAllByRole('option').map((item) => item.textContent)).toEqual(['Jade']);
    await fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input.getAttribute('aria-activedescendant')).toBe(screen.getByRole('option').id);
    expect(document.activeElement).toBe(input);
  });

  it('selects with Enter, skips disabled options, mirrors externally controlled selection and closes on Escape', async () => {
    render(ComboboxHarness);
    const input = screen.getByRole('combobox', { name: 'Colors' });
    await fireEvent.input(input, { target: { value: 'ja' } });
    await fireEvent.keyDown(input, { key: 'ArrowDown' });
    await fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByLabelText('Selection').textContent).toBe('jade');
    expect((input as HTMLInputElement).value).toBe('Jade');
    await fireEvent.keyDown(input, { key: 'Escape' });
    expect(input.getAttribute('aria-expanded')).toBe('false');
    await fireEvent.click(screen.getByRole('button', { name: 'Choose Blue' }));
    expect((input as HTMLInputElement).value).toBe('Blue');
  });

  it('moves the active descendant across enabled options and skips disabled options', async () => {
    render(ComboboxHarness);
    const input = screen.getByRole('combobox', { name: 'Colors' });
    input.focus();
    await fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input.getAttribute('aria-activedescendant')).toContain('amber');
    await fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input.getAttribute('aria-activedescendant')).toContain('blue');
    await fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input.getAttribute('aria-activedescendant')).toContain('jade');
  });

  it('supports multi-select chips, toggling, and removal with focus restored to the input', async () => {
    render(ComboboxHarness, { props: { multiple: true } });
    const input = screen.getByRole('combobox', { name: 'Colors' });
    await fireEvent.input(input, { target: { value: 'am' } });
    await fireEvent.click(screen.getByRole('option', { name: 'Amber' }));
    expect(screen.getByLabelText('Selection').textContent).toBe('amber');
    expect(screen.getByRole('listitem').textContent).toContain('Amber');
    expect((input as HTMLInputElement).value).toBe('');
    await fireEvent.click(screen.getByRole('button', { name: 'Remove Amber' }));
    expect(screen.getByLabelText('Selection').textContent).toBe('');
    expect(document.activeElement).toBe(input);
  });

  it('aborts a superseded async request and only publishes the latest results', async () => {
    let firstSignal: AbortSignal | undefined;
    const loadOptions = (query: string, signal: AbortSignal) =>
      new Promise<readonly { value: string; label: string }[]>((resolve) => {
        if (query === 'a') firstSignal = signal;
        setTimeout(
          () => resolve([{ value: query, label: query.toUpperCase() }]),
          query === 'a' ? 20 : 0
        );
      });
    render(ComboboxHarness, { props: { items: [], loadOptions } });
    const input = screen.getByRole('combobox', { name: 'Colors' });
    await fireEvent.input(input, { target: { value: 'a' } });
    await fireEvent.input(input, { target: { value: 'b' } });
    await waitFor(() => expect(screen.getByRole('option', { name: 'B' })).toBeTruthy());
    expect(firstSignal?.aborted).toBe(true);
    expect(screen.queryByRole('option', { name: 'A' })).toBeNull();
  });

  it('virtualizes the option window only when the collection exceeds 200 items', async () => {
    const items = Array.from({ length: 240 }, (_, index) => ({
      value: String(index),
      label: `Item ${index}`,
    }));
    render(ComboboxHarness, { props: { items } });
    await fireEvent.click(screen.getByRole('button', { name: 'Show colors' }));
    expect(screen.getAllByRole('option').length).toBeLessThan(20);
    expect(screen.getAllByRole('option')[0]?.textContent).toBe('Item 0');
    const input = screen.getByRole('combobox', { name: 'Colors' });
    input.focus();
    for (let index = 0; index < 25; index += 1) {
      await fireEvent.keyDown(input, { key: 'ArrowDown' });
    }
    const activeId = input.getAttribute('aria-activedescendant');
    const activeOption = activeId ? document.getElementById(activeId) : null;
    expect(activeOption?.textContent).toBe('Item 24');
    expect(activeOption?.getAttribute('aria-posinset')).toBe('25');
  });

  it('does not open when disabled', async () => {
    render(ComboboxHarness, { props: { disabled: true } });
    const input = screen.getByRole('combobox', { name: 'Colors' });
    expect((input as HTMLInputElement).disabled).toBe(true);
    expect(input.getAttribute('aria-expanded')).toBe('false');
  });

  it('shows Empty when a local filter yields no results', async () => {
    const { container } = render(ComboboxHarness);
    const input = screen.getByRole('combobox', { name: 'Colors' });
    await fireEvent.input(input, { target: { value: 'zzzz' } });
    expect(container.querySelector('[data-tx-combobox-empty]')?.textContent).toMatch(/No results/i);
    expect(screen.queryByRole('option')).toBeNull();
  });

  it('marks the input aria-busy while loadOptions is in flight and shows Loading', async () => {
    let resolveLoad!: (value: readonly { value: string; label: string }[]) => void;
    const loadOptions = () =>
      new Promise<readonly { value: string; label: string }[]>((resolve) => {
        resolveLoad = resolve;
      });
    const { container } = render(ComboboxHarness, { props: { items: [], loadOptions } });
    const input = screen.getByRole('combobox', { name: 'Colors' });
    await fireEvent.input(input, { target: { value: 'a' } });
    expect(input.getAttribute('aria-busy')).toBe('true');
    expect(container.querySelector('[data-tx-combobox-loading]')?.textContent).toMatch(/Loading/i);
    resolveLoad([{ value: 'amber', label: 'Amber' }]);
    await waitFor(() => expect(input.getAttribute('aria-busy')).toBeNull());
    expect(screen.getByRole('option', { name: 'Amber' })).toBeTruthy();
  });

  it('shows Error with retry after loadOptions rejects', async () => {
    let attempts = 0;
    const loadOptions = () => {
      attempts += 1;
      if (attempts === 1) return Promise.reject(new Error('Network offline'));
      return Promise.resolve([{ value: 'blue', label: 'Blue' }] as const);
    };
    const { container } = render(ComboboxHarness, { props: { items: [], loadOptions } });
    const input = screen.getByRole('combobox', { name: 'Colors' });
    await fireEvent.input(input, { target: { value: 'b' } });
    await waitFor(() =>
      expect(container.querySelector('[data-tx-combobox-error]')?.textContent).toMatch(
        /Network offline/
      )
    );
    await fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(screen.getByRole('option', { name: 'Blue' })).toBeTruthy());
    expect(attempts).toBe(2);
  });

  it('shows Empty for an open list with no options, before anything is typed', async () => {
    const { container } = render(ComboboxHarness, { props: { items: [] } });
    const empty = () => container.querySelector('[data-tx-combobox-empty]');
    expect(empty()).toBeNull();
    await fireEvent.click(screen.getByRole('button', { name: 'Show colors' }));
    expect(screen.getByRole('combobox', { name: 'Colors' }).getAttribute('aria-expanded')).toBe(
      'true'
    );
    expect(empty()?.textContent).toMatch(/No results/i);
    expect(screen.queryByRole('option')).toBeNull();
    // Closed again: no Empty.
    await fireEvent.click(screen.getByRole('button', { name: 'Show colors' }));
    expect(empty()).toBeNull();
  });

  it('shows Empty when an async load returns no options; an unloaded list stays idle', async () => {
    const loadOptions = () => Promise.resolve([] as const);
    const { container } = render(ComboboxHarness, { props: { items: [], loadOptions } });
    const empty = () => container.querySelector('[data-tx-combobox-empty]');
    // Opening does not load, so there is nothing to call empty yet.
    await fireEvent.click(screen.getByRole('button', { name: 'Show colors' }));
    expect(empty()).toBeNull();
    await fireEvent.input(screen.getByRole('combobox', { name: 'Colors' }), {
      target: { value: 'q' },
    });
    await waitFor(() => expect(empty()?.textContent).toMatch(/No results/i));
  });
});
