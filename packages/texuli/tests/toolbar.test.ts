import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import ToolbarHarness from './fixtures/ToolbarHarness.svelte';

afterEach(() => cleanup());

describe('Toolbar', () => {
  it('renders a labelled toolbar with buttons and a separator', () => {
    render(ToolbarHarness, { props: { mode: 'default' } });
    const bar = screen.getByRole('toolbar', { name: 'Editor' });
    expect(bar.className).toContain('tx-toolbar');
    expect(screen.getByRole('button', { name: 'Undo' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Redo' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save' }).getAttribute('aria-disabled')).toBe('true');
    expect(document.querySelector('[data-toolbar-separator]')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Help' }).getAttribute('href')).toBe(
      'https://example.com/help'
    );
  });

  it('applies outline variant classes', () => {
    render(ToolbarHarness, { props: { mode: 'default', variant: 'outline' } });
    expect(document.querySelector('.tx-toolbar--outline')).toBeTruthy();
  });

  it('supports single and multiple groups', async () => {
    render(ToolbarHarness, { props: { mode: 'group' } });
    expect(screen.getByRole('toolbar', { name: 'Format' })).toBeTruthy();
    // harness starts with align="left"
    const left = screen.getByRole('radio', { name: 'Left' });
    const center = screen.getByRole('radio', { name: 'Center' });
    expect(left.getAttribute('aria-checked')).toBe('true');
    await fireEvent.click(center);
    expect(center.getAttribute('aria-checked')).toBe('true');
    expect(left.getAttribute('aria-checked')).toBe('false');

    const bold = screen.getByRole('button', { name: 'Bold' });
    const italic = screen.getByRole('button', { name: 'Italic' });
    // harness starts with format including bold
    expect(bold.getAttribute('aria-pressed')).toBe('true');
    await fireEvent.click(italic);
    expect(italic.getAttribute('aria-pressed')).toBe('true');
    expect(bold.getAttribute('aria-pressed')).toBe('true');
  });

  it('supports vertical orientation', () => {
    render(ToolbarHarness, { props: { mode: 'vertical' } });
    const bar = screen.getByRole('toolbar', { name: 'Side tools' });
    expect(bar.getAttribute('data-orientation')).toBe('vertical');
    expect(bar.className).toContain('tx-toolbar--vertical');
  });

  it('applies the URL policy on toolbar links', () => {
    render(ToolbarHarness, { props: { mode: 'disabled-link' } });
    const unsafe = document.querySelector('[aria-label="Unsafe"]');
    expect(unsafe).toBeTruthy();
    expect(unsafe?.getAttribute('href')).toBeNull();
    expect(unsafe?.getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByRole('link', { name: 'Safe' }).getAttribute('href')).toBe(
      'https://example.com'
    );
  });
});
