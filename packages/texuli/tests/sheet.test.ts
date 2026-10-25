// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import Harness from './fixtures/SheetHarness.svelte';

afterEach(cleanup);

describe('styled sheet family', () => {
  it('defaults Sheet to logical start and resolves it against RTL trigger direction', async () => {
    render(Harness, { props: { dir: 'rtl' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Open sheet' }));
    const dialog = await screen.findByRole('dialog', { name: 'Filters' });

    await waitFor(() => expect(dialog.getAttribute('data-side')).toBe('right'));
    expect(dialog.getAttribute('dir')).toBe('rtl');
    expect(dialog.className).toContain('tx-sheet--md');
    expect(dialog.hasAttribute('data-tx-sheet')).toBe(true);
    expect(dialog.getAttribute('aria-modal')).toBe('true');
  });

  it('defaults Drawer and DetailPanel to logical end and keeps their surface styles', async () => {
    render(Harness);
    await fireEvent.click(screen.getByRole('button', { name: 'Open drawer' }));
    const drawer = await screen.findByRole('dialog', { name: 'Cart' });
    await waitFor(() => expect(drawer.getAttribute('data-side')).toBe('right'));
    expect(drawer.className).toContain('tx-drawer--md');
    expect(drawer.hasAttribute('data-snap-point')).toBe(true);

    await fireEvent.keyDown(document, { key: 'Escape' });
    await fireEvent.click(screen.getByRole('button', { name: 'Open details' }));
    const panel = await screen.findByRole('dialog', { name: 'Order details' });
    await waitFor(() => expect(panel.getAttribute('data-side')).toBe('right'));
    expect(panel.className).toContain('tx-detail-panel--md');
    expect(panel.hasAttribute('aria-modal')).toBe(false);
  });

  it('forwards dismissOutside and closeOnEscape to DetailPanel and a non-modal Sheet', async () => {
    render(Harness, { props: { dismissOutside: true } });
    await fireEvent.click(screen.getByRole('button', { name: 'Open details' }));
    await screen.findByRole('dialog', { name: 'Order details' });
    await fireEvent.pointerDown(screen.getByRole('button', { name: 'Open details' }));
    expect(screen.getByRole('dialog', { name: 'Order details' })).toBeTruthy();
    await fireEvent.pointerDown(screen.getByRole('button', { name: 'Page action' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    cleanup();

    render(Harness, { props: { sheetModal: false, closeOnEscape: true } });
    await fireEvent.click(screen.getByRole('button', { name: 'Open sheet' }));
    const sheet = await screen.findByRole('dialog', { name: 'Filters' });
    expect(sheet.hasAttribute('aria-modal')).toBe(false);
    const page = screen.getByRole('button', { name: 'Page action' });
    page.focus();
    await fireEvent.keyDown(page, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});
