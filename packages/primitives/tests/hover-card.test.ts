import { fireEvent, render, screen } from '@testing-library/svelte';
import { flushSync } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import HoverCardFixture from './hover-card-fixture.svelte';

afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
});

describe('HoverCard', () => {
  it('opens after the hover delay and closes after the pointer leaves both parts', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    render(HoverCardFixture, { openDelay: 100, closeDelay: 80 });
    const trigger = screen.getByRole('button', { name: 'Profile preview' });

    fireEvent.pointerEnter(trigger, { pointerType: 'mouse' });
    flushSync();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    vi.advanceTimersByTime(99);
    flushSync();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    vi.advanceTimersByTime(1);
    flushSync();
    expect(trigger.getAttribute('aria-expanded')).toBe('true');

    fireEvent.pointerLeave(trigger, { pointerType: 'mouse', relatedTarget: document.body });
    vi.advanceTimersByTime(79);
    flushSync();
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    vi.advanceTimersByTime(1);
    flushSync();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('opens on focus and starts closing when focus leaves the trigger', async () => {
    render(HoverCardFixture, { openDelay: 0, closeDelay: 0 });
    const trigger = screen.getByRole('button', { name: 'Profile preview' });
    trigger.focus();
    await vi.waitFor(() => expect(trigger.getAttribute('aria-expanded')).toBe('true'));

    fireEvent.blur(trigger, { relatedTarget: document.body });
    await vi.waitFor(() => expect(trigger.getAttribute('aria-expanded')).toBe('false'));
  });
});
