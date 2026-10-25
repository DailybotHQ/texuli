import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CheckboxHarness from './fixtures/CheckboxHarness.svelte';

afterEach(() => cleanup());

describe('Checkbox.Root', () => {
  it('toggles with click and Space, exposes data-state', async () => {
    render(CheckboxHarness, { props: { label: 'Accept' } });
    const box = screen.getByRole('checkbox', { name: 'Accept' });
    expect(box.getAttribute('aria-checked')).toBe('false');
    expect(box.getAttribute('data-state')).toBe('unchecked');
    await fireEvent.click(box);
    expect(box.getAttribute('aria-checked')).toBe('true');
    expect(box.getAttribute('data-state')).toBe('checked');
    box.focus();
    await fireEvent.keyDown(box, { key: ' ' });
    expect(box.getAttribute('aria-checked')).toBe('false');
  });

  it('announces mixed when indeterminate', async () => {
    render(CheckboxHarness, { props: { label: 'Partial', indeterminate: true } });
    const box = screen.getByRole('checkbox', { name: 'Partial' });
    expect(box.getAttribute('aria-checked')).toBe('mixed');
    expect(box.getAttribute('data-state')).toBe('indeterminate');
    await fireEvent.click(box);
    expect(box.getAttribute('aria-checked')).toBe('true');
  });

  it('does not toggle when disabled', async () => {
    render(CheckboxHarness, { props: { label: 'Locked', disabled: true } });
    const box = screen.getByRole('checkbox', { name: 'Locked' });
    expect((box as HTMLButtonElement).disabled).toBe(true);
    await fireEvent.click(box);
    expect(box.getAttribute('aria-checked')).toBe('false');
  });

  it('fires onCheckedChange', async () => {
    const onCheckedChange = vi.fn();
    render(CheckboxHarness, { props: { label: 'Notify', onCheckedChange } });
    await fireEvent.click(screen.getByRole('checkbox', { name: 'Notify' }));
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it('submits its value with a native form when checked', async () => {
    let submitted: Record<string, FormDataEntryValue> | null = null;
    render(CheckboxHarness, {
      props: {
        label: 'Email updates',
        name: 'updates',
        value: 'yes',
        withForm: true,
        onSubmit: (data: Record<string, FormDataEntryValue>) => {
          submitted = data;
        },
      },
    });
    await fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(submitted).toEqual({});
    await fireEvent.click(screen.getByRole('checkbox', { name: 'Email updates' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(submitted).toMatchObject({ updates: 'yes' });
  });
});

describe('Checkbox.Group', () => {
  it('tracks multiple values', async () => {
    render(CheckboxHarness, { props: { mode: 'group' } });
    const a = screen.getByRole('checkbox', { name: 'Alpha' });
    const b = screen.getByRole('checkbox', { name: 'Beta' });
    await fireEvent.click(a);
    await fireEvent.click(b);
    expect(a.getAttribute('aria-checked')).toBe('true');
    expect(b.getAttribute('aria-checked')).toBe('true');
    await fireEvent.click(a);
    expect(a.getAttribute('aria-checked')).toBe('false');
  });
});
