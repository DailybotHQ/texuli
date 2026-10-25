import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { COMMAND_SIZES, COMMAND_VARIANTS } from '../src/components/command/variants.ts';
import CommandHarness from './fixtures/CommandHarness.svelte';

afterEach(cleanup);

describe('Command panel', () => {
  it('renders the combobox input and grouped options', () => {
    render(CommandHarness, { props: { mode: 'panel' } });
    expect(screen.getByRole('combobox', { name: 'Search commands' })).toBeTruthy();
    expect(screen.getByRole('listbox', { name: 'Search commands' })).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Navigation' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Navigation' })).toBeNull();
    expect(screen.getByRole('option', { name: /Open inbox/i })).toBeTruthy();
    expect(screen.getByRole('option', { name: /Create task/i })).toBeTruthy();
  });

  it('filters options as the query changes', async () => {
    render(CommandHarness, { props: { mode: 'panel' } });
    const input = screen.getByRole('combobox', { name: 'Search commands' });
    await fireEvent.input(input, { target: { value: 'mail' } });
    expect(screen.getByRole('option', { name: /Open inbox/i })).toBeTruthy();
    expect(screen.queryByRole('option', { name: /Create task/i })).toBeNull();
  });

  it('selects an option and reports its value', async () => {
    const onSelect = vi.fn();
    render(CommandHarness, { props: { mode: 'panel', onSelect } });
    await fireEvent.click(screen.getByRole('option', { name: /Open settings/i }));
    expect(onSelect).toHaveBeenCalledWith('open-settings');
  });

  it('applies every size and variant class on the root', () => {
    for (const size of COMMAND_SIZES) {
      for (const variant of COMMAND_VARIANTS) {
        const view = render(CommandHarness, { props: { mode: 'panel', size, variant } });
        const root = view.container.querySelector('[data-tx-command]');
        expect(root?.getAttribute('data-size')).toBe(size);
        expect(root?.getAttribute('data-variant')).toBe(variant);
        expect(root?.className).toContain(`tx-command--${size}`);
        expect(root?.className).toContain(`tx-command--${variant}`);
        view.unmount();
      }
    }
  });

  it('shows the empty state when nothing matches', async () => {
    render(CommandHarness, { props: { mode: 'panel' } });
    const input = screen.getByRole('combobox', { name: 'Search commands' });
    await fireEvent.input(input, { target: { value: 'zzzz-no-match' } });
    expect(screen.getByText('No results')).toBeTruthy();
  });
});

describe('Command palette', () => {
  it('opens from the ⌘K trigger and lists recent items', async () => {
    render(CommandHarness, { props: { mode: 'palette', open: false, shortcut: false } });
    expect(screen.queryByRole('dialog')).toBeNull();
    await fireEvent.click(screen.getByRole('button', { name: /Search commands/i }));
    const dialog = await screen.findByRole('dialog', { name: 'Command palette' });
    expect(dialog).toBeTruthy();
    expect(screen.getByRole('option', { name: /Open inbox/i })).toBeTruthy();
  });

  it('runs search and selects a result', async () => {
    const onPaletteSelect = vi.fn();
    render(CommandHarness, {
      props: { mode: 'palette', open: true, shortcut: false, onPaletteSelect },
    });
    const input = await screen.findByRole('combobox', { name: 'Command palette' });
    await fireEvent.input(input, { target: { value: 'settings' } });
    await waitFor(() => {
      expect(screen.getByRole('option', { name: /Open settings/i })).toBeTruthy();
    });
    await fireEvent.click(screen.getByRole('option', { name: /Open settings/i }));
    expect(onPaletteSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'open-settings', label: 'Open settings' })
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});

describe('Command.Trigger options', () => {
  it('adds a search glyph and a narrow collapse that keeps the label as the name', async () => {
    const { default: Trigger } = await import('../src/components/command/CommandTrigger.svelte');
    const plain = render(Trigger, { props: { label: 'Search the site' } });
    expect(plain.container.querySelector('.tx-command-trigger__icon')).toBeNull();
    expect(plain.container.querySelector('button')?.hasAttribute('aria-label')).toBe(false);
    cleanup();
    const slim = render(Trigger, { props: { label: 'Search the site', collapse: 'narrow' } });
    const button = slim.getByRole('button', { name: 'Search the site' });
    expect(button.dataset.collapse).toBe('narrow');
    // The name comes from the label text in the button, never an aria-label
    // that could differ from what sighted users see (WCAG 2.5.3).
    expect(button.hasAttribute('aria-label')).toBe(false);
    expect(button.querySelector('.tx-command-trigger__label')?.textContent).toBe('Search the site');
    expect(button.querySelector('.tx-command-trigger__icon')?.getAttribute('aria-hidden')).toBe(
      'true'
    );
    cleanup();
    const iconOnly = render(Trigger, { props: { label: 'Find', icon: true } });
    expect(iconOnly.container.querySelector('.tx-command-trigger__icon')).not.toBeNull();
    expect(iconOnly.getByRole('button', { name: /Find/ }).dataset.collapse).toBeUndefined();
  });
});
