import { cleanup, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Harness from './fixtures/SheetPartsHarness.svelte';

// G27: header, body, footer and close parts on every sheet surface.
// G6: ResponsiveModal `force` and host (container) sizing.

describe('sheet parts (G27)', () => {
  afterEach(cleanup);

  it('names, describes and closes every sheet surface through the styled parts', async () => {
    for (const surface of ['sheet', 'drawer', 'panel', 'responsive'] as const) {
      const view = render(Harness, { props: { surface } });
      const sheet = await screen.findByRole('dialog', { name: 'Filters' });
      expect(sheet.getAttribute('aria-describedby'), surface).toBeTruthy();
      const header = sheet.querySelector('[data-tx-sheet-header]');
      expect(header?.className, surface).toContain('tx-sheet__header');
      expect(sheet.querySelector('.tx-sheet__title')?.textContent, surface).toBe('Filters');
      expect(sheet.querySelector('.tx-sheet__description')?.textContent, surface).toBe(
        'Narrow the orders.'
      );
      expect(sheet.querySelector('[data-tx-sheet-body]')?.className, surface).toContain(
        'tx-sheet__body'
      );
      expect(sheet.querySelector('[data-tx-sheet-footer]')?.className, surface).toContain(
        'tx-sheet__footer'
      );
      const close = screen.getByRole('button', { name: 'Close filters' });
      expect(close.className, surface).toContain('tx-sheet__close');
      close.click();
      await waitFor(() => expect(screen.queryByRole('dialog'), surface).toBeNull());
      view.unmount();
    }
  });
});

describe('ResponsiveModal force and host sizing (G6)', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('force wins over the viewport query', async () => {
    // A phone-width viewport: auto would pick the sheet.
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: true,
      media: query,
      addEventListener() {},
      removeEventListener() {},
    }));
    for (const [force, side, presentation] of [
      ['auto', 'bottom', 'sheet'],
      ['dialog', 'center', 'dialog'],
      ['sheet', 'bottom', 'sheet'],
    ] as const) {
      const view = render(Harness, { props: { surface: 'responsive', force } });
      const modal = await screen.findByRole('dialog', { name: 'Filters' });
      await waitFor(() => expect(modal.getAttribute('data-side'), force).toBe(side));
      expect(modal.getAttribute('data-presentation'), force).toBe(presentation);
      view.unmount();
    }
  });

  it('sizes by the host element width through a ResizeObserver, not the viewport', async () => {
    // A wide viewport: the query alone would pick the dialog.
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: false,
      media: query,
      addEventListener() {},
      removeEventListener() {},
    }));
    const observers: { callback: () => void; target?: Element; disconnected: boolean }[] = [];
    class FakeResizeObserver {
      record: (typeof observers)[number];
      constructor(callback: () => void) {
        this.record = { callback, disconnected: false };
        observers.push(this.record);
      }
      observe(target: Element) {
        this.record.target = target;
      }
      disconnect() {
        this.record.disconnected = true;
      }
    }
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    const host = document.createElement('div');
    document.body.append(host);
    let width = 360;
    host.getBoundingClientRect = () => ({ width }) as DOMRect;

    const view = render(Harness, { props: { surface: 'responsive', host, breakpoint: 480 } });
    const modal = await screen.findByRole('dialog', { name: 'Filters' });
    await waitFor(() => expect(modal.getAttribute('data-side')).toBe('bottom'));
    const observer = observers.find((entry) => entry.target === host);
    expect(observer).toBeTruthy();

    width = 900;
    observer?.callback();
    await waitFor(() => expect(modal.getAttribute('data-side')).toBe('center'));
    expect(modal.getAttribute('data-presentation')).toBe('dialog');
    view.unmount();
    expect(observer?.disconnected).toBe(true);
    host.remove();
  });
});
