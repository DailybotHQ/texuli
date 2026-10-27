// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DIALOG_SIZES, dialogContentClass } from '../src/components/dialog/index.ts';
import AlertDialogHarness from './fixtures/AlertDialogHarness.svelte';
import DialogHarness from './fixtures/DialogHarness.svelte';

afterEach(() => {
  cleanup();
});

describe('dialog CSS source', () => {
  it('takes danger colors from the shared destructive token with no hex or phantom fallbacks', () => {
    const source = readFileSync(
      join(process.cwd(), 'packages/texuli/src/components/dialog/dialog.css'),
      'utf8'
    );
    // Sibling convention (alert, toast, button): var(--tx-destructive, crimson).
    expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(source).not.toContain('--tx-color-danger');
    expect(source).toContain('var(--tx-destructive, crimson)');
  });
});

describe('dialog variants', () => {
  it('exposes sm/md/lg/xl sizes', () => {
    expect(DIALOG_SIZES).toEqual(['sm', 'md', 'lg', 'xl']);
    expect(dialogContentClass({ size: 'lg' })).toContain('tx-dialog--lg');
    expect(dialogContentClass({ size: 'sm' })).toContain('tx-dialog--sm');
  });
});

describe('Dialog', () => {
  it('opens from the trigger, shows header body footer, and closes with Escape', async () => {
    render(DialogHarness, { props: { open: false } });
    expect(screen.queryByRole('dialog')).toBeNull();

    await fireEvent.click(screen.getByRole('button', { name: 'Open settings' }));
    const dialog = await screen.findByRole('dialog', { name: 'Workspace settings' });
    expect(dialog.className).toContain('tx-dialog');
    expect(dialog.getAttribute('data-size')).toBe('md');
    expect(screen.getByText('Update the Harbor Labs workspace name and timezone.')).toBeTruthy();
    expect(
      screen.getByText('Name, region and default locale for the Harbor Labs workspace.')
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Close' })).toBeTruthy();

    await fireEvent.keyDown(dialog.ownerDocument, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  it('applies size classes and can hide the close control', async () => {
    render(DialogHarness, {
      props: { open: true, size: 'xl', hideClose: true },
    });
    const dialog = await screen.findByRole('dialog', { name: 'Workspace settings' });
    expect(dialog.className).toContain('tx-dialog--xl');
    expect(dialog.getAttribute('data-size')).toBe('xl');
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
  });

  it('closes from the header close control', async () => {
    render(DialogHarness, { props: { open: true, closeLabel: 'Dismiss dialog' } });
    await screen.findByRole('dialog');
    await fireEvent.click(screen.getByRole('button', { name: 'Dismiss dialog' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });
});

describe('AlertDialog', () => {
  it('opens as alertdialog and focuses the cancel control', async () => {
    render(AlertDialogHarness, { props: { open: false } });
    await fireEvent.click(screen.getByRole('button', { name: 'Delete project' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Delete project?' });
    expect(dialog.className).toContain('tx-alert-dialog');
    expect(dialog.getAttribute('data-destructive')).toBe('true');
    expect(dialog.querySelector('[data-tx-alert-dialog-icon]')).toBeTruthy();

    const cancel = screen.getByRole('button', { name: 'Keep project' });
    await waitFor(() => {
      expect(document.activeElement).toBe(cancel);
    });
  });

  it('confirms and closes when onConfirm resolves', async () => {
    const onConfirm = vi.fn(async () => undefined);
    render(AlertDialogHarness, {
      props: { open: false, onConfirm, destructive: false, confirmLabel: 'Confirm' },
    });
    await fireEvent.click(screen.getByRole('button', { name: 'Delete project' }));
    await screen.findByRole('alertdialog');
    await fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole('alertdialog')).toBeNull();
    });
  });

  it('keeps the dialog open and shows an error when onConfirm rejects', async () => {
    render(AlertDialogHarness, {
      props: { open: false, fail: true },
    });
    await fireEvent.click(screen.getByRole('button', { name: 'Delete project' }));
    await screen.findByRole('alertdialog');
    await fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain(
        'Harbor could not delete the project.'
      );
    });
    expect(screen.getByRole('alertdialog')).toBeTruthy();
  });

  it('stays open while the confirm is pending; Escape cannot dismiss it', async () => {
    let resolveConfirm: (() => void) | undefined;
    const onConfirm = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveConfirm = resolve;
        })
    );
    render(AlertDialogHarness, { props: { open: false, onConfirm } });
    await fireEvent.click(screen.getByRole('button', { name: 'Delete project' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Delete project?' });
    await fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => {
      expect(dialog.getAttribute('aria-busy')).toBe('true');
    });

    await fireEvent.keyDown(dialog.ownerDocument, { key: 'Escape' });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.getByRole('alertdialog', { name: 'Delete project?' })).toBeTruthy();
    expect(onConfirm).toHaveBeenCalledTimes(1);

    resolveConfirm?.();
    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).toBeNull();
    });
  });

  it('cancels without calling onConfirm', async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(AlertDialogHarness, {
      props: { open: false, onConfirm, onCancel },
    });
    await fireEvent.click(screen.getByRole('button', { name: 'Delete project' }));
    await screen.findByRole('alertdialog');
    await fireEvent.click(screen.getByRole('button', { name: 'Keep project' }));
    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).toBeNull();
    });
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
