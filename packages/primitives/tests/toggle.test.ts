// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ToggleFixture from './fixtures/ToggleFixture.svelte';
import ToggleGroupFixture from './fixtures/ToggleGroupFixture.svelte';

afterEach(() => {
  cleanup();
});

describe('Toggle', () => {
  it('starts off, toggles with click and exposes aria-pressed / data-state', async () => {
    render(ToggleFixture, { props: { label: 'Bold' } });
    const button = screen.getByRole('button', { name: 'Bold' });
    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(button.getAttribute('data-state')).toBe('off');

    await fireEvent.click(button);
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(button.getAttribute('data-state')).toBe('on');

    await fireEvent.click(button);
    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(button.getAttribute('data-state')).toBe('off');
  });

  it('toggles with Enter on keydown', async () => {
    render(ToggleFixture, { props: { label: 'Italic key' } });
    const button = screen.getByRole('button', { name: 'Italic key' });
    button.focus();
    // Dispatch on the focused node; handler prevents default activation.
    button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    // Allow Svelte to flush
    await Promise.resolve();
    expect(button.getAttribute('aria-pressed')).toBe('true');
  });

  it('calls onPressedChange and respects disabled', async () => {
    const onPressedChange = vi.fn();
    render(ToggleFixture, {
      props: { label: 'Italic', onPressedChange, disabled: true },
    });
    const button = screen.getByRole('button', { name: 'Italic' });
    expect(button.hasAttribute('disabled')).toBe(true);
    await fireEvent.click(button);
    expect(onPressedChange).not.toHaveBeenCalled();
    expect(button.getAttribute('aria-pressed')).toBe('false');
  });

  it('supports controlled pressed via bindable props', async () => {
    const onPressedChange = vi.fn();
    const { rerender } = render(ToggleFixture, {
      props: { label: 'Underline', pressed: false, onPressedChange },
    });
    const button = screen.getByRole('button', { name: 'Underline' });
    await fireEvent.click(button);
    expect(onPressedChange).toHaveBeenCalledWith(true);
    // Owner must apply the change; with $bindable the prop may update in-tree.
    await rerender({ label: 'Underline', pressed: true, onPressedChange });
    expect(screen.getByRole('button', { name: 'Underline' }).getAttribute('aria-pressed')).toBe(
      'true'
    );
  });
});

describe('ToggleGroup', () => {
  it('single mode selects one item and allows clearing', async () => {
    const onValueChange = vi.fn();
    render(ToggleGroupFixture, {
      props: { type: 'single', onValueChange, label: 'Align' },
    });
    const left = screen.getByRole('button', { name: 'Left' });
    const center = screen.getByRole('button', { name: 'Center' });

    await fireEvent.click(left);
    expect(onValueChange).toHaveBeenLastCalledWith('left');
    expect(left.getAttribute('aria-pressed')).toBe('true');

    await fireEvent.click(center);
    expect(onValueChange).toHaveBeenLastCalledWith('center');
    expect(center.getAttribute('aria-pressed')).toBe('true');
    expect(left.getAttribute('aria-pressed')).toBe('false');

    await fireEvent.click(center);
    expect(onValueChange).toHaveBeenLastCalledWith('');
  });

  it('multiple mode toggles membership independently', async () => {
    const onValueChange = vi.fn();
    render(ToggleGroupFixture, {
      props: { type: 'multiple', onValueChange, label: 'Style' },
    });
    const bold = screen.getByRole('button', { name: 'Bold' });
    const italic = screen.getByRole('button', { name: 'Italic' });

    await fireEvent.click(bold);
    expect(onValueChange).toHaveBeenLastCalledWith(['bold']);
    await fireEvent.click(italic);
    expect(onValueChange).toHaveBeenLastCalledWith(['bold', 'italic']);
    await fireEvent.click(bold);
    expect(onValueChange).toHaveBeenLastCalledWith(['italic']);
  });

  it('supports arrow-key roving focus between enabled items', async () => {
    render(ToggleGroupFixture, {
      props: { type: 'single', label: 'Align', rovingFocus: true },
    });
    const left = screen.getByRole('button', { name: 'Left' });
    const center = screen.getByRole('button', { name: 'Center' });
    left.focus();
    await fireEvent.keyDown(left.closest('[role="group"]')!, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(center);
  });

  it('skips disabled items and does not toggle them', async () => {
    const onValueChange = vi.fn();
    render(ToggleGroupFixture, {
      props: { type: 'single', onValueChange, label: 'Align', disableRight: true },
    });
    const right = screen.getByRole('button', { name: 'Right' });
    expect(right.hasAttribute('disabled')).toBe(true);
    await fireEvent.click(right);
    expect(onValueChange).not.toHaveBeenCalled();
  });
});
