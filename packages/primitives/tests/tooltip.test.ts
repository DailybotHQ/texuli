import { fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTooltipDelayGroup } from '../src/tooltip/delay-group.ts';
import TooltipFixture from './tooltip-fixture.svelte';

afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
});

describe('tooltip delay groups', () => {
  it('skips the delay after a tooltip opens, then restores it after the skip window', () => {
    vi.useFakeTimers();
    const group = createTooltipDelayGroup({ delayDuration: 300, skipDelayDuration: 400 });
    expect(group.openDelay()).toBe(300);
    group.opened();
    expect(group.openDelay()).toBe(0);
    group.closed();
    vi.advanceTimersByTime(399);
    expect(group.openDelay()).toBe(0);
    vi.advanceTimersByTime(1);
    expect(group.openDelay()).toBe(300);
    group.destroy();
  });

  it('keeps the skip window alive when another tooltip opens before it expires', () => {
    vi.useFakeTimers();
    const group = createTooltipDelayGroup({ delayDuration: 300, skipDelayDuration: 400 });
    group.opened();
    group.closed();
    vi.advanceTimersByTime(200);
    group.opened();
    group.closed();
    vi.advanceTimersByTime(399);
    expect(group.openDelay()).toBe(0);
    vi.advanceTimersByTime(1);
    expect(group.openDelay()).toBe(300);
    group.destroy();
  });
});

describe('Tooltip compound primitive', () => {
  it('opens after the provider delay on hover and describes the trigger', async () => {
    vi.useFakeTimers();
    render(TooltipFixture);
    const trigger = screen.getByRole('button', { name: 'First action' });

    await fireEvent.pointerEnter(trigger, { pointerType: 'mouse' });
    expect(screen.queryByRole('tooltip')).toBeNull();
    await vi.advanceTimersByTimeAsync(299);
    expect(screen.queryByRole('tooltip')).toBeNull();
    await vi.advanceTimersByTimeAsync(1);

    const tooltip = screen.getByRole('tooltip');
    expect(tooltip.textContent).toBe('First hint');
    expect(trigger.getAttribute('aria-describedby')).toBe(tooltip.id);
    expect(trigger.getAttribute('data-state')).toBe('open');
  });

  it('opens immediately on focus and Escape dismisses only the tooltip', async () => {
    render(TooltipFixture);
    const trigger = screen.getByRole('button', { name: 'First action' });
    const persistent = screen.getByRole('button', { name: 'Second action' });

    await fireEvent.focusIn(trigger);
    trigger.focus();
    expect(screen.getByRole('tooltip').textContent).toBe('First hint');
    expect(trigger.getAttribute('aria-describedby')).toBe(screen.getByRole('tooltip').id);

    await fireEvent.keyDown(document, { key: 'Escape', bubbles: true });
    expect(screen.queryByRole('tooltip')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(persistent.isConnected).toBe(true);
  });

  it('opens on a touch long press and closes when the press ends', async () => {
    vi.useFakeTimers();
    render(TooltipFixture);
    const trigger = screen.getByRole('button', { name: 'First action' });

    await fireEvent.pointerDown(trigger, { pointerType: 'touch' });
    await vi.advanceTimersByTimeAsync(499);
    expect(screen.queryByRole('tooltip')).toBeNull();
    await vi.advanceTimersByTimeAsync(1);
    expect(screen.getByRole('tooltip').textContent).toBe('First hint');
    await fireEvent.pointerUp(trigger, { pointerType: 'touch' });
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('opens the next tooltip without delay inside the provider skip window', async () => {
    vi.useFakeTimers();
    render(TooltipFixture);
    const first = screen.getByRole('button', { name: 'First action' });
    const second = screen.getByRole('button', { name: 'Second action' });

    await fireEvent.pointerEnter(first, { pointerType: 'mouse' });
    await vi.advanceTimersByTimeAsync(300);
    expect(screen.getByRole('tooltip').textContent).toBe('First hint');
    await fireEvent.pointerLeave(first, { pointerType: 'mouse' });
    await vi.advanceTimersByTimeAsync(100);
    expect(screen.queryByRole('tooltip')).toBeNull();

    await fireEvent.pointerEnter(second, { pointerType: 'mouse' });
    expect(screen.getByRole('tooltip').textContent).toBe('Second hint');
  });

  it('does not open a disabled tooltip and restores the bound open state after dismissal', async () => {
    render(TooltipFixture);
    const disabled = screen.getByRole('button', { name: 'Disabled action' });
    await fireEvent.focusIn(disabled);
    expect(screen.queryByRole('tooltip')).toBeNull();

    const trigger = screen.getByRole('button', { name: 'First action' });
    await fireEvent.focusIn(trigger);
    expect(screen.getByText('open', { selector: '[data-open-state]' })).toBeTruthy();
    await fireEvent.keyDown(document, { key: 'Escape', bubbles: true });
    expect(screen.getByText('closed', { selector: '[data-open-state]' })).toBeTruthy();
  });
});
