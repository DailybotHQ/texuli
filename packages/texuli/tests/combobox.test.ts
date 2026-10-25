import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import {
  COMBOBOX_SIZES,
  COMBOBOX_VARIANTS,
  comboboxFieldClass,
  comboboxItemClass,
  createFoldedFilter,
} from '../src/components/combobox/index.ts';
import ComboboxHarness from './fixtures/ComboboxHarness.svelte';

afterEach(() => cleanup());

describe('combobox variants', () => {
  it('exposes sizes and field variants', () => {
    expect(COMBOBOX_SIZES).toEqual(['sm', 'md', 'lg']);
    expect(COMBOBOX_VARIANTS).toEqual(['outline', 'soft']);
    expect(comboboxFieldClass({ variant: 'soft', size: 'sm' })).toContain(
      'tx-combobox-field--soft'
    );
    expect(comboboxItemClass({ disabled: true })).toContain('tx-combobox-item--disabled');
  });
});

describe('Combobox', () => {
  it('renders a styled combobox and lists filtered options', async () => {
    render(ComboboxHarness);
    const input = screen.getByRole('combobox', { name: 'Colors' });
    expect(input.className).toContain('tx-combobox-input');
    await fireEvent.input(input, { target: { value: 'ja' } });
    expect(screen.getByRole('listbox', { name: 'Color options' }).className).toContain(
      'tx-combobox-content'
    );
    expect(screen.getByRole('option', { name: 'Jade' })).toBeTruthy();
  });

  it('shows Empty when there are no matches', async () => {
    const { container } = render(ComboboxHarness);
    const input = screen.getByRole('combobox', { name: 'Colors' });
    await fireEvent.input(input, { target: { value: 'zzzz' } });
    expect(container.querySelector('[data-tx-combobox-empty]')?.textContent).toMatch(/No results/i);
  });

  it('marks aria-busy while loading and clears after resolve', async () => {
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

  it('shows Error with retry after a failed load', async () => {
    let attempts = 0;
    const loadOptions = () => {
      attempts += 1;
      if (attempts === 1) return Promise.reject(new Error('Offline'));
      return Promise.resolve([{ value: 'blue', label: 'Blue' }] as const);
    };
    const { container } = render(ComboboxHarness, { props: { items: [], loadOptions } });
    const input = screen.getByRole('combobox', { name: 'Colors' });
    await fireEvent.input(input, { target: { value: 'b' } });
    await waitFor(() =>
      expect(container.querySelector('[data-tx-combobox-error]')?.textContent).toMatch(/Offline/)
    );
    await fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(screen.getByRole('option', { name: 'Blue' })).toBeTruthy());
    expect(attempts).toBe(2);
  });

  it('supports MultiSelect chips', async () => {
    render(ComboboxHarness, { props: { mode: 'multi', value: [] } });
    const input = screen.getByRole('combobox', { name: 'Colors' });
    await fireEvent.input(input, { target: { value: 'am' } });
    await fireEvent.click(screen.getByRole('option', { name: 'Amber' }));
    expect(screen.getByRole('listitem').textContent).toMatch(/Amber/);
    await fireEvent.click(screen.getByRole('button', { name: /Remove Amber/i }));
    expect(screen.queryByRole('listitem')).toBeNull();
  });

  it('does not open when disabled', () => {
    render(ComboboxHarness, { props: { disabled: true } });
    const input = screen.getByRole('combobox', { name: 'Colors' });
    expect((input as HTMLInputElement).disabled).toBe(true);
  });
});

describe('Combobox filter and form props', () => {
  const accented = [
    { value: 'cafe', label: 'Café crème' },
    { value: 'jade', label: 'Jade' },
  ];
  const palette = () => screen.getByRole('form', { name: 'Palette' }) as HTMLFormElement;

  it('passes a custom filter through to the primitive', async () => {
    render(ComboboxHarness, { props: { items: accented, filter: createFoldedFilter() } });
    await fireEvent.input(screen.getByRole('combobox', { name: 'Colors' }), {
      target: { value: 'cafe creme' },
    });
    expect(screen.getAllByRole('option').map((option) => option.textContent?.trim())).toEqual([
      'Café crème',
    ]);
  });

  it('submits the Combobox value and enforces required', async () => {
    render(ComboboxHarness, { props: { name: 'color', required: true } });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(palette().checkValidity()).toBe(false);
    await fireEvent.input(screen.getByRole('combobox', { name: 'Colors' }), {
      target: { value: 'ja' },
    });
    await fireEvent.click(screen.getByRole('option', { name: 'Jade' }));
    expect(new FormData(palette()).getAll('color')).toEqual(['jade']);
    expect(palette().checkValidity()).toBe(true);
  });

  it('submits one entry per MultiSelect value', async () => {
    render(ComboboxHarness, { props: { mode: 'multi', name: 'colors', value: [] } });
    const input = screen.getByRole('combobox', { name: 'Colors' });
    for (const [text, label] of [
      ['am', 'Amber'],
      ['ja', 'Jade'],
    ]) {
      await fireEvent.input(input, { target: { value: text } });
      await fireEvent.click(screen.getByRole('option', { name: label }));
    }
    expect(new FormData(palette()).getAll('colors')).toEqual(['amber', 'jade']);
  });
});
