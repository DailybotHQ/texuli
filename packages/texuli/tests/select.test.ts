// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import {
  SELECT_SIZES,
  SELECT_VARIANTS,
  selectTriggerClass,
} from '../src/components/select/index.ts';
import SelectFixture from './fixtures/SelectFixture.svelte';

afterEach(() => {
  cleanup();
});

describe('select variants', () => {
  it('exposes outline/soft variants and sm/md/lg sizes', () => {
    expect(SELECT_VARIANTS).toEqual(['outline', 'soft']);
    expect(SELECT_SIZES).toEqual(['sm', 'md', 'lg']);
    expect(selectTriggerClass({ variant: 'soft', size: 'sm' })).toContain(
      'tx-select-trigger--soft'
    );
    expect(selectTriggerClass({ variant: 'soft', size: 'sm' })).toContain('tx-select-trigger--sm');
  });
});

describe('Select', () => {
  it('renders a combobox trigger with the selected label', () => {
    render(SelectFixture, { props: { value: 'team' } });
    const trigger = screen.getByRole('combobox', { name: 'Plan' });
    expect(trigger.textContent).toMatch(/Team/);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('opens the listbox and lists options including a disabled plan', async () => {
    render(SelectFixture, { props: { open: true, value: 'free' } });
    const listbox = await screen.findByRole('listbox');
    expect(listbox.className).toContain('tx-select-content');
    expect(screen.getByRole('option', { name: /Free/ })).toBeTruthy();
    expect(screen.getByRole('option', { name: /Business/ }).getAttribute('aria-disabled')).toBe(
      'true'
    );
    expect(screen.getByText('Coming soon')).toBeTruthy();
  });

  it('keeps the separator out of the listbox semantics', async () => {
    render(SelectFixture, { props: { open: true, value: 'free' } });
    const listbox = await screen.findByRole('listbox');
    // A listbox may own only options and groups: the rule is decorative.
    const separator = listbox.querySelector('[data-tx-select-separator]');
    expect(separator?.getAttribute('aria-hidden')).toBe('true');
    expect(separator?.tagName).not.toBe('HR');
    expect(listbox.querySelector('hr, [role="separator"]')).toBeNull();
  });

  it('selects an option and closes', async () => {
    render(SelectFixture, { props: { open: true, value: 'free' } });
    await screen.findByRole('listbox');
    await fireEvent.click(screen.getByRole('option', { name: /Enterprise/ }));
    await waitFor(() => {
      expect(screen.queryByRole('listbox')).toBeNull();
    });
    expect(screen.getByRole('combobox', { name: 'Plan' }).textContent).toMatch(/Enterprise/);
  });

  it('applies soft and large classes on the trigger', () => {
    render(SelectFixture, { props: { variant: 'soft', size: 'lg' } });
    const trigger = screen.getByRole('combobox', { name: 'Plan' });
    expect(trigger.className).toContain('tx-select-trigger--soft');
    expect(trigger.className).toContain('tx-select-trigger--lg');
    expect(trigger.getAttribute('data-variant')).toBe('soft');
    expect(trigger.getAttribute('data-size')).toBe('lg');
  });

  it('disables the trigger when disabled', () => {
    render(SelectFixture, { props: { disabled: true } });
    expect(screen.getByRole('combobox', { name: 'Plan' }).hasAttribute('disabled')).toBe(true);
  });
});
