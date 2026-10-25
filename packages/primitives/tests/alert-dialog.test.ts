import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { getInertRegistry } from '@texuli/core/inert';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AlertDialogFixture from './alert-dialog-fixture.svelte';

afterEach(() => getInertRegistry().clear());

describe('AlertDialog', () => {
  it('names an alertdialog, focuses Cancel, and restores focus on Escape', async () => {
    const { container } = render(AlertDialogFixture);
    const trigger = screen.getByRole('button', { name: 'Delete project' });
    expect(container.querySelector('[role="alertdialog"]')).toBeNull();
    fireEvent.click(trigger);

    const alert = await screen.findByRole('alertdialog', { name: 'Delete project?' });
    const descriptionId = alert.getAttribute('aria-describedby');
    expect(document.getElementById(descriptionId ?? '')?.textContent).toBe(
      'The fictional Orbit project and its tasks will be removed.'
    );
    expect(alert.getAttribute('aria-modal')).toBe('true');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancel' }));

    const outsideAction = screen.getByRole('button', { name: 'Outside action' });
    expect(
      getInertRegistry()
        .inertElements()
        .some((element) => element.contains(outsideAction))
    ).toBe(true);

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(container.querySelector('[role="alertdialog"]')).toBeNull());
    expect(document.activeElement).toBe(trigger);
  });

  it('does not dismiss on outside pointer or overlay press', async () => {
    const { container } = render(AlertDialogFixture);
    fireEvent.click(screen.getByRole('button', { name: 'Delete project' }));
    const alert = await screen.findByRole('alertdialog', { name: 'Delete project?' });

    fireEvent.pointerDown(document.body);
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Outside action' }));
    const overlay = container.querySelector('[data-alert-dialog-overlay]');
    if (overlay) fireEvent.pointerDown(overlay);

    expect(screen.getByRole('alertdialog', { name: 'Delete project?' })).toBe(alert);
  });

  it('Cancel closes without confirming; Action confirms and closes', async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(AlertDialogFixture, { props: { onConfirm, onCancel } });
    fireEvent.click(screen.getByRole('button', { name: 'Delete project' }));
    await screen.findByRole('alertdialog', { name: 'Delete project?' });

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Delete project' }));
    await screen.findByRole('alertdialog', { name: 'Delete project?' });
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('traps Tab between Cancel and Action', async () => {
    render(AlertDialogFixture);
    fireEvent.click(screen.getByRole('button', { name: 'Delete project' }));
    await screen.findByRole('alertdialog', { name: 'Delete project?' });
    const cancel = screen.getByRole('button', { name: 'Cancel' });
    const action = screen.getByRole('button', { name: 'Delete' });
    expect(document.activeElement).toBe(cancel);

    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(action);
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(cancel);
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(action);
  });
});
