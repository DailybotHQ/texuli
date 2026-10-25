import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ToggleHarness from './fixtures/ToggleHarness.svelte';

afterEach(() => cleanup());

describe('Toggle', () => {
  it('renders a toggle button and toggles pressed state', async () => {
    render(ToggleHarness, { props: { label: 'Bold' } });
    const btn = screen.getByRole('button', { name: 'Bold' });
    expect(btn.getAttribute('aria-pressed')).toBe('false');
    expect(btn.getAttribute('data-state')).toBe('off');
    expect(btn.className).toContain('tx-toggle');
    await fireEvent.click(btn);
    expect(btn.getAttribute('aria-pressed')).toBe('true');
    expect(btn.getAttribute('data-state')).toBe('on');
  });

  it('applies outline variant and size classes', () => {
    render(ToggleHarness, {
      props: { label: 'Italic', variant: 'outline', size: 'sm' },
    });
    const btn = screen.getByRole('button', { name: 'Italic' });
    expect(btn.className).toContain('tx-toggle--outline');
    expect(btn.className).toContain('tx-toggle--sm');
  });

  it('does not toggle when disabled', async () => {
    render(ToggleHarness, { props: { label: 'Locked', disabled: true } });
    const btn = screen.getByRole('button', { name: 'Locked' });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
    await fireEvent.click(btn);
    expect(btn.getAttribute('aria-pressed')).toBe('false');
  });

  it('fires onPressedChange', async () => {
    const onPressedChange = vi.fn();
    render(ToggleHarness, { props: { label: 'Underline', onPressedChange } });
    await fireEvent.click(screen.getByRole('button', { name: 'Underline' }));
    expect(onPressedChange).toHaveBeenCalledWith(true);
  });
});

describe('ToggleGroup', () => {
  it('single type selects one value', async () => {
    render(ToggleHarness, { props: { mode: 'group-single' } });
    const left = screen.getByRole('button', { name: 'Left' });
    const center = screen.getByRole('button', { name: 'Center' });
    await fireEvent.click(left);
    expect(left.getAttribute('aria-pressed')).toBe('true');
    await fireEvent.click(center);
    expect(center.getAttribute('aria-pressed')).toBe('true');
    expect(left.getAttribute('aria-pressed')).toBe('false');
  });

  it('multiple type allows several values', async () => {
    render(ToggleHarness, { props: { mode: 'group-multiple' } });
    const bold = screen.getByRole('button', { name: 'Bold' });
    const italic = screen.getByRole('button', { name: 'Italic' });
    await fireEvent.click(bold);
    await fireEvent.click(italic);
    expect(bold.getAttribute('aria-pressed')).toBe('true');
    expect(italic.getAttribute('aria-pressed')).toBe('true');
  });

  it('exposes a labelled group shell', () => {
    render(ToggleHarness, { props: { mode: 'group-single' } });
    expect(screen.getByRole('group', { name: 'Align' })).toBeTruthy();
  });

  it('wraps long rows only when asked, keeping selection', async () => {
    render(ToggleHarness, { props: { mode: 'group-single' } });
    expect(
      screen.getByRole('group', { name: 'Align' }).classList.contains('tx-toggle-group--wrap')
    ).toBe(false);
    cleanup();
    render(ToggleHarness, { props: { mode: 'group-single', wrap: true } });
    const group = screen.getByRole('group', { name: 'Align' });
    expect(group.classList.contains('tx-toggle-group--wrap')).toBe(true);
    expect(group.classList.contains('tx-toggle-group--outline')).toBe(true);
    const right = screen.getByRole('button', { name: 'Right' });
    await fireEvent.click(right);
    expect(right.getAttribute('aria-pressed')).toBe('true');
  });
});
