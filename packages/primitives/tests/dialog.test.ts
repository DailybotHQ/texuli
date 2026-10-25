import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { getInertRegistry } from '@texuli/core/inert';
import { afterEach, describe, expect, it, vi } from 'vitest';
import DialogFixture from './dialog-fixture.svelte';

afterEach(() => getInertRegistry().clear());

describe('Dialog', () => {
  it('names and describes a modal dialog, focuses inside, and restores focus on Escape', async () => {
    const { container } = render(DialogFixture);
    const trigger = screen.getByRole('button', { name: 'Open settings' });
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    fireEvent.click(trigger);

    const dialog = await screen.findByRole('dialog', { name: 'Settings' });
    const descriptionId = dialog.getAttribute('aria-describedby');
    expect(document.getElementById(descriptionId ?? '')?.textContent).toBe(
      'Change how your fictional workspace looks.'
    );
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Preferred focus' }));
    const outsideAction = screen.getByRole('button', { name: 'Outside action' });
    expect(
      getInertRegistry()
        .inertElements()
        .some((element) => element.contains(outsideAction))
    ).toBe(true);
    expect(document.documentElement.style.overflow).toBe('hidden');

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(container.querySelector('[role="dialog"]')).toBeNull());
    expect(document.activeElement).toBe(trigger);
    expect(
      getInertRegistry()
        .inertElements()
        .some((element) => element.contains(outsideAction))
    ).toBe(false);
    expect(document.documentElement.style.overflow).toBe('');
  });

  it('restores focus through the preventable close autofocus callback', async () => {
    const onCloseAutoFocus = vi.fn((event: { preventDefault(): void }) => event.preventDefault());
    render(DialogFixture, { props: { onCloseAutoFocus } });
    const trigger = screen.getByRole('button', { name: 'Open settings' });
    fireEvent.click(trigger);
    await screen.findByRole('dialog', { name: 'Settings' });
    const preferredFocus = screen.getByRole('button', { name: 'Preferred focus' });
    expect(document.activeElement).toBe(preferredFocus);

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Settings' })).toBeNull());
    expect(onCloseAutoFocus).toHaveBeenCalledOnce();
    expect(document.activeElement).not.toBe(trigger);
  });

  it('closes only the top nested dialog on Escape', async () => {
    render(DialogFixture);
    const trigger = screen.getByRole('button', { name: 'Open settings' });
    fireEvent.click(trigger);
    const outer = await screen.findByRole('dialog', { name: 'Settings' });
    const nestedTrigger = screen.getByRole('button', { name: 'Open details' });
    nestedTrigger.focus();
    fireEvent.click(nestedTrigger);

    expect(await screen.findByRole('dialog', { name: 'Details' })).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Details' })).toBeNull());
    expect(screen.getByRole('dialog', { name: 'Settings' })).toBe(outer);
    expect(document.activeElement).toBe(nestedTrigger);

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Settings' })).toBeNull());
    expect(document.activeElement).toBe(trigger);
  });

  it('keeps a contained dialog and its inert scope inside the supplied frame', async () => {
    const { container } = render(DialogFixture, { props: { contained: true } });
    const trigger = screen.getByRole('button', { name: 'Open settings' });
    fireEvent.click(trigger);

    const dialog = await screen.findByRole('dialog', { name: 'Settings' });
    const frame = container.querySelector('[data-dialog-frame]');
    expect(frame?.contains(dialog)).toBe(true);
    expect(frame?.querySelector('[data-dialog-overlay]')).toBeTruthy();
    const frameAction = screen.getByRole('button', { name: 'Frame action' });
    const outsideAction = screen.getByRole('button', { name: 'Outside action' });
    expect(
      getInertRegistry()
        .inertElements()
        .some((element) => element.contains(frameAction))
    ).toBe(true);
    expect(
      getInertRegistry()
        .inertElements()
        .some((element) => element.contains(outsideAction))
    ).toBe(false);
    expect(document.documentElement.style.overflow).toBe('');
  });
});
