import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Checkbox from '../src/components/choice/Checkbox.svelte';
import RadioGroup from '../src/components/choice/RadioGroup.svelte';
import Switch from '../src/components/choice/Switch.svelte';

afterEach(cleanup);

describe('Checkbox', () => {
  it('toggles with a labelled control and description', async () => {
    render(Checkbox, {
      props: {
        label: 'Email updates',
        description: 'Harbor Notes weekly digest (fictional).',
      },
    });
    const box = screen.getByRole('checkbox', { name: 'Email updates' });
    expect(box.getAttribute('aria-checked')).toBe('false');
    expect(box.getAttribute('aria-describedby')).toBeTruthy();
    expect(screen.getByText(/weekly digest/)).toBeTruthy();
    await fireEvent.click(box);
    expect(box.getAttribute('aria-checked')).toBe('true');
    expect(box.getAttribute('data-state')).toBe('checked');
  });

  it('supports indeterminate mixed state', async () => {
    render(Checkbox, {
      props: { label: 'Select all', indeterminate: true },
    });
    const box = screen.getByRole('checkbox', { name: 'Select all' });
    expect(box.getAttribute('aria-checked')).toBe('mixed');
    await fireEvent.click(box);
    expect(box.getAttribute('aria-checked')).toBe('true');
  });

  it('does not toggle when disabled', async () => {
    render(Checkbox, { props: { label: 'Locked', disabled: true } });
    const box = screen.getByRole('checkbox', { name: 'Locked' });
    await fireEvent.click(box);
    expect(box.getAttribute('aria-checked')).toBe('false');
  });
});

describe('Switch', () => {
  it('toggles with label and reports changes', async () => {
    const onCheckedChange = vi.fn();
    const view = render(Switch, {
      props: {
        checked: false,
        label: 'Dark mode',
        description: 'Preview only (simulated).',
        onCheckedChange,
      },
    });
    const control = () => screen.getByRole('switch', { name: 'Dark mode' });
    expect(control().getAttribute('aria-checked')).toBe('false');
    await fireEvent.click(control());
    expect(onCheckedChange).toHaveBeenCalledWith(true);
    // Controlled hosts update bind:checked; simulate that here.
    await view.rerender({
      checked: true,
      label: 'Dark mode',
      description: 'Preview only (simulated).',
      onCheckedChange,
    });
    expect(control().getAttribute('aria-checked')).toBe('true');
  });
});

describe('RadioGroup', () => {
  it('selects one option from items and supports card variant', async () => {
    const onValueChange = vi.fn();
    render(RadioGroup, {
      props: {
        value: 'a',
        onValueChange,
        name: 'plan',
        items: [
          { value: 'a', label: 'Starter', description: 'Solo workspace' },
          { value: 'b', label: 'Team', description: 'Shared notes' },
        ],
      },
    });
    const group = screen.getByRole('radiogroup');
    expect(group).toBeTruthy();
    const starter = screen.getByRole('radio', { name: 'Starter' });
    const team = screen.getByRole('radio', { name: 'Team' });
    expect(starter.getAttribute('aria-checked')).toBe('true');
    await fireEvent.click(team);
    expect(onValueChange).toHaveBeenCalledWith('b');
  });

  it('renders card layout with descriptions', () => {
    render(RadioGroup, {
      props: {
        variant: 'card',
        orientation: 'horizontal',
        items: [
          { value: 'light', label: 'Light', description: 'Day theme' },
          { value: 'dark', label: 'Dark', description: 'Night theme' },
        ],
      },
    });
    expect(screen.getByText('Day theme')).toBeTruthy();
    expect(document.querySelector('[data-variant="card"]')).toBeTruthy();
    expect(screen.getByRole('radio', { name: /Light/ })).toBeTruthy();
  });
});
