import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import ListboxHarness from './ListboxHarness.svelte';

afterEach(cleanup);

describe('@texuli/primitives/listbox', () => {
  it('exposes a named listbox and options with the selected state', () => {
    render(ListboxHarness);
    const listbox = screen.getByRole('listbox', { name: 'Colors' });
    expect(listbox.getAttribute('tabindex')).toBe('0');
    const amber = screen.getByRole('option', { name: 'Amber' });
    expect(amber.getAttribute('aria-selected')).toBe('false');
    expect(amber.getAttribute('data-state')).toBe('unselected');
    expect(screen.getByRole('option', { name: 'Coral' }).getAttribute('aria-disabled')).toBe(
      'true'
    );
  });

  it('moves the active descendant, skips disabled items and selects in single mode', async () => {
    render(ListboxHarness);
    const listbox = screen.getByRole('listbox', { name: 'Colors' });

    await fireEvent.keyDown(listbox, { key: 'ArrowDown' });
    expect(listbox.getAttribute('aria-activedescendant')).toContain('amber');
    expect(screen.getByLabelText('Selection').textContent).toBe('amber');
    await fireEvent.keyDown(listbox, { key: 'ArrowDown' });
    expect(listbox.getAttribute('aria-activedescendant')).toContain('blue');
    await fireEvent.keyDown(listbox, { key: 'ArrowDown' });
    expect(listbox.getAttribute('aria-activedescendant')).toContain('jade');
    expect(screen.getByLabelText('Selection').textContent).toBe('jade');
  });

  it('supports multiple selection with Space and pointer activation', async () => {
    render(ListboxHarness, { props: { multiple: true } });
    const listbox = screen.getByRole('listbox', { name: 'Colors' });
    expect(listbox.getAttribute('aria-multiselectable')).toBe('true');

    await fireEvent.keyDown(listbox, { key: 'ArrowDown' });
    await fireEvent.keyDown(listbox, { key: ' ' });
    await fireEvent.click(screen.getByRole('option', { name: 'Jade' }));
    expect(screen.getByLabelText('Selection').textContent).toBe('amber,jade');
    expect(screen.getByRole('option', { name: 'Jade' }).getAttribute('aria-selected')).toBe('true');
  });

  it('uses the full collection order for a virtualized visible window', async () => {
    render(ListboxHarness, { props: { virtualized: true } });
    const listbox = screen.getByRole('listbox', { name: 'Colors' });

    await fireEvent.keyDown(listbox, { key: 'ArrowDown' });
    await fireEvent.keyDown(listbox, { key: 'ArrowDown' });
    await fireEvent.keyDown(listbox, { key: 'ArrowDown' });
    expect(screen.getByLabelText('Active option').textContent).toBe('jade');
    expect(screen.getByLabelText('Active index').textContent).toBe('3');
    const jade = screen.getByRole('option', { name: 'Jade' });
    expect(listbox.getAttribute('aria-activedescendant')).toBe(jade.id);
  });

  it('supports typeahead and disabled roots', async () => {
    const { unmount } = render(ListboxHarness);
    const listbox = screen.getByRole('listbox', { name: 'Colors' });
    await fireEvent.keyDown(listbox, { key: 'j' });
    expect(listbox.getAttribute('aria-activedescendant')).toContain('jade');
    unmount();

    render(ListboxHarness, { props: { disabled: true } });
    expect(screen.getByRole('listbox', { name: 'Colors' }).getAttribute('aria-disabled')).toBe(
      'true'
    );
  });
});
