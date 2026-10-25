import { cleanup, render, screen, waitFor } from '@testing-library/svelte';
import { getInertRegistry } from '@texuli/core/inert';
import { afterEach, describe, expect, it, vi } from 'vitest';
import DialogMountedOpen from './fixtures/DialogMountedOpen.svelte';

/*
 * FIX-dialog-contained-focus: a dialog mounted already open keeps its initial
 * focus (the portal moves the node before the controller opens), and in
 * contained mode the backdrop stays in the container, below the content,
 * instead of entering the top layer over it.
 */

afterEach(() => {
  vi.restoreAllMocks();
  cleanup();
  getInertRegistry().clear();
});

describe.each(['dialog', 'sheet'] as const)('%s mounted open', (kind) => {
  it('focuses the first tabbable inside the content after mount', async () => {
    // Moving a focused node blurs it in real browsers, so the portal must move
    // the content BEFORE initial focus: record where the input is when focused.
    const focusedWhere: string[] = [];
    const focus = HTMLElement.prototype.focus;
    vi.spyOn(HTMLElement.prototype, 'focus').mockImplementation(function (
      this: HTMLElement,
      options?: FocusOptions
    ) {
      if (this.getAttribute('aria-label') === 'Search commands') {
        const portal = this.closest('[data-dialog-portal]');
        focusedWhere.push(portal?.parentElement === document.body ? 'portaled' : 'in place');
      }
      focus.call(this, options);
    });
    render(DialogMountedOpen, { props: { kind } });
    const input = await screen.findByRole('textbox', { name: 'Search commands' });
    await waitFor(() => expect(document.activeElement).toBe(input));
    // The content was portaled (to body) and is still focused there.
    expect(input.closest('[data-dialog-portal]')?.parentElement).toBe(document.body);
    expect(focusedWhere.length).toBeGreaterThan(0);
    expect(focusedWhere.every((where) => where === 'portaled')).toBe(true);
  });
});

describe.each(['dialog', 'alert', 'sheet'] as const)('%s contained mode', (kind) => {
  it('keeps the backdrop out of the top layer, in the container, below the content', async () => {
    render(DialogMountedOpen, { props: { contained: true, kind } });
    const input = await screen.findByRole('textbox', { name: 'Search commands' });
    const backdrop = screen.getByTestId('backdrop');
    const container = document.querySelector('[data-container]') as HTMLElement;
    expect(container.contains(backdrop)).toBe(true);
    expect(container.contains(input)).toBe(true);
    // Never shown as a popover (that would put it in the top layer).
    expect(backdrop.hasAttribute('popover')).toBe(false);
    expect(backdrop.getAttribute('data-contained')).toBe('');
    // Initial focus inside the content (an alert dialog starts on Cancel).
    const initial = kind === 'alert' ? screen.getByRole('button', { name: 'Cancel' }) : input;
    await waitFor(() => expect(document.activeElement).toBe(initial));
  });
});

describe('AlertDialog mounted open', () => {
  it('keeps initial focus after mount (Cancel, the least destructive action)', async () => {
    render(DialogMountedOpen, { props: { kind: 'alert' } });
    const cancel = await screen.findByRole('button', { name: 'Cancel' });
    await waitFor(() => expect(document.activeElement).toBe(cancel));
  });
});
