import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import type { ComboboxItemData } from '../src/combobox/context.ts';
import {
  createFoldedFilter,
  defaultComboboxFilter,
  foldSearchText,
} from '../src/combobox/index.ts';
import ComboboxFormHarness from './ComboboxFormHarness.svelte';

afterEach(cleanup);

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

async function type(text: string): Promise<HTMLInputElement> {
  const input = screen.getByRole('combobox', { name: 'City' }) as HTMLInputElement;
  input.focus();
  await fireEvent.input(input, { target: { value: text } });
  return input;
}

const optionLabels = () => screen.queryAllByRole('option').map((option) => option.textContent);

async function choose(text: string, label: string): Promise<void> {
  await type(text);
  await fireEvent.click(screen.getByRole('option', { name: label }));
}

const form = () => screen.getByRole('form', { name: 'Trip' }) as HTMLFormElement;

describe('@texuli/primitives/combobox filter', () => {
  it('keeps the default label match: case-insensitive, accents significant', async () => {
    render(ComboboxFormHarness);
    await type('LIS');
    expect(optionLabels()).toEqual(['Lisbon']);
    await type('sao');
    expect(optionLabels()).toEqual([]);
    expect(defaultComboboxFilter({ value: 'x', label: 'Lisbon' }, 'lis')).toBe(true);
  });

  it('a custom filter replaces the default instead of narrowing it', async () => {
    // Value prefix only: "york" matches a label (default) but no value prefix.
    render(ComboboxFormHarness, {
      props: {
        filter: (item: ComboboxItemData, query: string) =>
          item.value.toLowerCase().startsWith(query.toLowerCase()),
      },
    });
    await type('york');
    expect(optionLabels()).toEqual([]);
    await type('europe/');
    expect(optionLabels()).toEqual(['Lisbon', 'Zürich']);
  });

  it('folds accents and case, and can match values too', async () => {
    expect(foldSearchText('São Paulo')).toBe('sao paulo');
    expect(foldSearchText('ZÜRICH')).toBe('zurich');
    expect(foldSearchText('İstanbul', 'tr')).toBe('istanbul');
    render(ComboboxFormHarness, {
      props: { filter: createFoldedFilter({ fields: (item) => [item.label, item.value] }) },
    });
    await type('sao paulo');
    expect(optionLabels()).toEqual(['São Paulo']);
    await type('new_york');
    expect(optionLabels()).toEqual(['New York']);
    await type('zurich');
    expect(optionLabels()).toEqual(['Zürich']);
  });

  it('a folded filter matches labels only by default', () => {
    const filter = createFoldedFilter();
    expect(filter({ value: 'America/New_York', label: 'New York' }, 'new_york')).toBe(false);
    expect(filter({ value: 'America/Sao_Paulo', label: 'São Paulo' }, 'SAO')).toBe(true);
  });
});

describe('@texuli/primitives/combobox form participation', () => {
  it('submits the selected value under its name', async () => {
    render(ComboboxFormHarness);
    expect(new FormData(form()).getAll('city')).toEqual(['']);
    await choose('lis', 'Lisbon');
    expect(new FormData(form()).getAll('city')).toEqual(['Europe/Lisbon']);
  });

  it('submits one entry per value when multiple', async () => {
    render(ComboboxFormHarness, { props: { multiple: true } });
    expect(new FormData(form()).getAll('city')).toEqual([]);
    await choose('lis', 'Lisbon');
    await choose('new', 'New York');
    expect(new FormData(form()).getAll('city')).toEqual(['Europe/Lisbon', 'America/New_York']);
  });

  it('required blocks submission until a value is chosen, with the given message', async () => {
    render(ComboboxFormHarness, {
      props: { required: true, requiredMessage: 'Choose a city to continue.' },
    });
    await tick();
    const bridge = form().querySelector<HTMLInputElement>('[data-tx-form-bridge]');
    expect(bridge?.hasAttribute('name')).toBe(false);
    expect(form().checkValidity()).toBe(false);
    expect(bridge?.validationMessage).toBe('Choose a city to continue.');
    await choose('lis', 'Lisbon');
    await tick();
    expect(form().checkValidity()).toBe(true);
    // The constraint field never submits: only the value does.
    expect([...new FormData(form()).keys()]).toEqual(['city']);
  });

  it('a form reset restores the default value and its label', async () => {
    render(ComboboxFormHarness, { props: { defaultValue: 'Europe/Zurich' } });
    expect(new FormData(form()).getAll('city')).toEqual(['Europe/Zurich']);
    await choose('lis', 'Lisbon');
    expect(new FormData(form()).getAll('city')).toEqual(['Europe/Lisbon']);
    form().reset();
    await tick();
    await tick();
    expect(new FormData(form()).getAll('city')).toEqual(['Europe/Zurich']);
    expect((screen.getByRole('combobox', { name: 'City' }) as HTMLInputElement).value).toBe(
      'Zürich'
    );
  });

  it('a disabled combobox submits nothing and is not required', async () => {
    render(ComboboxFormHarness, { props: { disabled: true, required: true } });
    await tick();
    expect(new FormData(form()).getAll('city')).toEqual([]);
    expect(form().checkValidity()).toBe(true);
  });

  it('adds, moves and removes the form field when name, required or form change after mount', async () => {
    const { rerender } = render(ComboboxFormHarness, { props: { name: '' } });
    await tick();
    const bridge = () => document.querySelector<HTMLInputElement>('[data-tx-form-bridge]');
    expect(bridge()).toBeNull();
    expect([...new FormData(form()).keys()]).toEqual([]);

    await rerender({ name: 'city', required: true });
    await tick();
    expect(bridge()?.required).toBe(true);
    expect(form().checkValidity()).toBe(false);
    expect(new FormData(form()).getAll('city')).toEqual(['']);

    // Moving the field to another form takes the value and the constraint with it.
    await rerender({ name: 'city', required: true, form: 'other-form' });
    await tick();
    const other = screen.getByRole('form', { name: 'Other' }) as HTMLFormElement;
    expect(bridge()?.getAttribute('form')).toBe('other-form');
    expect(form().querySelector('input[type="hidden"]')?.getAttribute('form')).toBe('other-form');
    // (happy-dom keeps an input's first form owner when its form attribute
    // changes, so the original form's validity is not checked here; browsers
    // re-associate the field.)
    expect(other.checkValidity()).toBe(false);
    await choose('lis', 'Lisbon');
    await tick();
    expect(new FormData(other).getAll('city')).toEqual(['Europe/Lisbon']);
    expect(other.checkValidity()).toBe(true);

    await rerender({ name: 'city', required: false, form: undefined });
    await tick();
    expect(bridge()?.required).toBe(false);
    expect(bridge()?.hasAttribute('form')).toBe(false);

    await rerender({ name: '', required: false });
    await tick();
    expect(bridge()).toBeNull();
    expect([...new FormData(form()).keys()]).toEqual([]);
  });
});
