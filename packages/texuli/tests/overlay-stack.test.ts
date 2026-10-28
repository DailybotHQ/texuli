import { cleanup, render, screen, waitFor } from '@testing-library/svelte';
import { createLayerStack, getLayerStack } from '@texuli/core/layer-stack';
import { afterEach, describe, expect, it } from 'vitest';
import Harness from './fixtures/OverlayStackHarness.svelte';

// G4: styled overlays register on a passed layer stack, and a focus-exempt
// region outside the modal (an undo toaster) keeps its own Tab order.

const tab = (shiftKey = false) => {
  const event = new KeyboardEvent('keydown', {
    key: 'Tab',
    shiftKey,
    bubbles: true,
    cancelable: true,
  });
  document.activeElement?.dispatchEvent(event);
  return event;
};

describe('overlay stack and focus-exempt regions (G4)', () => {
  afterEach(cleanup);

  it('Dialog, AlertDialog and Sheet register on the given stack, never the page-wide one', async () => {
    for (const kind of ['dialog', 'alert', 'sheet'] as const) {
      const stack = createLayerStack();
      const pageWide = getLayerStack().size();
      const view = render(Harness, { props: { kind, stack } });
      const surface = await screen.findByRole(kind === 'alert' ? 'alertdialog' : 'dialog');
      await waitFor(() => expect(stack.size(), kind).toBe(1));
      expect(stack.top()?.element, kind).toBe(surface);
      expect(getLayerStack().size(), kind).toBe(pageWide);
      view.unmount();
      expect(stack.size(), kind).toBe(0);
    }
  });

  it('keeps Tab inside an exempt undo toaster under an open Dialog, then wraps back into the dialog', async () => {
    render(Harness, { props: { kind: 'dialog' } });
    const dialog = await screen.findByRole('dialog', { name: 'Rename board' });
    const undo = screen.getByRole('button', { name: 'Undo' });
    const dismiss = screen.getByRole('button', { name: 'Dismiss' });
    expect(undo.closest('[inert]')).toBeNull();

    undo.focus();
    expect(tab().defaultPrevented).toBe(false);
    dismiss.focus();
    expect(tab().defaultPrevented).toBe(true);
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(screen.getByRole('dialog', { name: 'Rename board' })).toBeTruthy();
  });
});
