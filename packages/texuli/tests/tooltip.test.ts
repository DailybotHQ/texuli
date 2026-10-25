import { cleanup, fireEvent, render } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TOOLTIP_SIDES, tooltipContentClass } from '../src/components/tooltip/index.ts';
import TooltipHarness from './fixtures/TooltipHarness.svelte';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('tooltipContentClass', () => {
  it('applies base and side classes', () => {
    expect(tooltipContentClass({ side: 'bottom' })).toContain('tx-tooltip');
    expect(tooltipContentClass({ side: 'bottom' })).toContain('tx-tooltip--bottom');
    expect(TOOLTIP_SIDES).toContain('top');
  });
});

describe('Tooltip', () => {
  it('opens on pointer enter and describes the trigger', async () => {
    vi.useFakeTimers();
    const { getByRole, container } = render(TooltipHarness, {
      props: { content: 'Saves without publishing', label: 'Save draft' },
    });
    const trigger = getByRole('button', { name: 'Save draft' });
    await fireEvent.pointerEnter(trigger, { pointerType: 'mouse' });
    await vi.advanceTimersByTimeAsync(350);
    const tip = container.ownerDocument.querySelector('[role="tooltip"]');
    expect(tip).toBeTruthy();
    expect(tip?.textContent).toContain('Saves without publishing');
    expect(tip?.className).toContain('tx-tooltip');
    const describedBy = trigger.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    expect(container.ownerDocument.getElementById(describedBy!)).toBe(tip);
  });

  it('renders shortcut kbd chips when provided', async () => {
    const { getByRole, container } = render(TooltipHarness, {
      props: {
        content: 'Save',
        shortcut: ['⌘', 'S'],
        open: true,
      },
    });
    // Controlled open may need a tick for content mount.
    await vi.waitFor(() => {
      expect(container.ownerDocument.querySelector('[role="tooltip"]')).toBeTruthy();
    });
    const shortcuts = container.ownerDocument.querySelector('[data-tx-tooltip-shortcuts]');
    expect(shortcuts).toBeTruthy();
    expect(shortcuts?.querySelectorAll('[data-tx-kbd]').length).toBe(2);
    expect(getByRole('button', { name: 'Save draft' })).toBeTruthy();
  });

  it('does not open when disabled', async () => {
    vi.useFakeTimers();
    const { getByRole, container } = render(TooltipHarness, {
      props: { disabled: true, content: 'Hidden tip' },
    });
    const trigger = getByRole('button', { name: 'Save draft' });
    await fireEvent.pointerEnter(trigger, { pointerType: 'mouse' });
    await vi.advanceTimersByTimeAsync(500);
    expect(container.ownerDocument.querySelector('[role="tooltip"]')).toBeNull();
  });

  it('supports every side class on forced open', async () => {
    for (const side of TOOLTIP_SIDES) {
      const { container, unmount } = render(TooltipHarness, {
        props: { open: true, side, content: `Side ${side}` },
      });
      await vi.waitFor(() => {
        const tip = container.ownerDocument.querySelector('[role="tooltip"]');
        expect(tip?.className).toContain(`tx-tooltip--${side}`);
      });
      unmount();
    }
  });
});
