import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, fireEvent, render, waitFor, within } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createToastStore, resetToastStore } from '../src/components/toast/toast-store.ts';
import ToastHarness from './ToastHarness.svelte';

afterEach(() => {
  cleanup();
  resetToastStore();
});

describe('createToastStore', () => {
  it('publishes kinded toasts and replaces by id', () => {
    const store = createToastStore({ duration: 0, createId: () => 'fixed-id' });
    store.success('Saved', { description: 'Draft stored.' });
    expect(store.items()).toHaveLength(1);
    expect(store.items()[0]?.kind).toBe('success');
    expect(store.items()[0]?.title).toBe('Saved');

    store.info('Saving…', { id: 'fixed-id', duration: 0 });
    expect(store.items()).toHaveLength(1);
    expect(store.items()[0]?.kind).toBe('info');
    expect(store.items()[0]?.title).toBe('Saving…');

    store.dismiss('fixed-id');
    expect(store.items()).toHaveLength(0);
  });

  it('uses the store duration over the per-kind default, and the toast option over both', () => {
    const persistent = createToastStore({ duration: 0 });
    persistent.success('Saved');
    persistent.error('Failed', { duration: 1200 });
    expect(persistent.items().map((item) => item.duration)).toEqual([1200, 0]);
    const defaults = createToastStore();
    defaults.success('Saved');
    expect(defaults.items()[0]?.duration).toBe(4000);
  });

  it('resolves promise toasts to success or error', async () => {
    const store = createToastStore({ duration: 0, createId: () => 'p1' });
    let resolve!: (v: string) => void;
    const pending = new Promise<string>((r) => {
      resolve = r;
    });
    store.promise(pending, {
      loading: 'Working…',
      success: (v) => `Done: ${v}`,
      error: 'Failed',
    });
    expect(store.items()[0]?.pending).toBe(true);
    resolve('ok');
    await waitFor(() => {
      expect(store.items()[0]?.kind).toBe('success');
      expect(store.items()[0]?.title).toBe('Done: ok');
      expect(store.items()[0]?.pending).toBe(false);
    });
  });
});

describe('Toaster', () => {
  it('renders tones and dismisses on close', async () => {
    const store = createToastStore({ duration: 0 });
    store.error('Could not sync', { description: 'Try again later.' });
    store.success('Copied');
    const view = render(ToastHarness, { props: { store } });
    expect(view.getByText('Could not sync')).toBeTruthy();
    expect(view.getByText('Copied')).toBeTruthy();
    const region = view.getByRole('region', { name: 'Notifications' });
    expect(region).toBeTruthy();

    const dismiss = view.getByRole('button', { name: /Dismiss notification: Copied/i });
    await fireEvent.click(dismiss);
    await waitFor(() => {
      expect(
        within(view.getByRole('region', { name: 'Notifications' })).queryByText('Copied')
      ).toBeNull();
    });
  });

  it('runs action then dismisses', async () => {
    const store = createToastStore({ duration: 0 });
    const onClick = vi.fn();
    store.info('Archived', {
      action: { label: 'Undo', onClick },
    });
    const view = render(ToastHarness, { props: { store } });
    await fireEvent.click(view.getByRole('button', { name: 'Undo' }));
    expect(onClick).toHaveBeenCalledOnce();
    await waitFor(() =>
      expect(
        within(view.getByRole('region', { name: 'Notifications' })).queryByText('Archived')
      ).toBeNull()
    );
  });
});

describe('Toaster viewport placement and motion', () => {
  it('places the viewport by position (default bottom-end)', () => {
    const store = createToastStore({ duration: 0 });
    store.info('Queued');
    const first = render(ToastHarness, { props: { store } });
    expect(first.getByRole('region', { name: 'Notifications' }).getAttribute('data-position')).toBe(
      'bottom-end'
    );
    cleanup();
    const second = render(ToastHarness, { props: { store, position: 'top-start' } });
    expect(
      second.getByRole('region', { name: 'Notifications' }).getAttribute('data-position')
    ).toBe('top-start');
  });

  it('keeps a dismissed toast mounted, inert, for its exit motion', async () => {
    const store = createToastStore({ duration: 0 });
    store.success('Copied');
    const view = render(ToastHarness, { props: { store } });
    store.dismiss();
    await waitFor(() => {
      const leaving = view.container.ownerDocument.querySelector('[data-leaving="true"]');
      expect(leaving).toBeTruthy();
      expect(leaving?.hasAttribute('inert')).toBe(true);
      expect(leaving?.getAttribute('aria-hidden')).toBe('true');
    });
    await waitFor(() => {
      expect(
        within(view.getByRole('region', { name: 'Notifications' })).queryByText('Copied')
      ).toBeNull();
    });
  });

  it('removes a dismissed toast at once with reduced motion', async () => {
    const original = globalThis.matchMedia;
    globalThis.matchMedia = ((query: string) => ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })) as typeof globalThis.matchMedia;
    try {
      const store = createToastStore({ duration: 0 });
      store.success('Copied');
      const view = render(ToastHarness, { props: { store } });
      store.dismiss();
      await Promise.resolve();
      expect(view.container.ownerDocument.querySelector('[data-leaving]')).toBeNull();
      expect(
        within(view.getByRole('region', { name: 'Notifications' })).queryByText('Copied')
      ).toBeNull();
    } finally {
      globalThis.matchMedia = original;
    }
  });

  it('resets the popover UA box and honors reduced motion in toast.css', () => {
    const css = readFileSync(
      join(import.meta.dirname, '../src/components/toast/toast.css'),
      'utf8'
    );
    const viewport = css.slice(
      css.indexOf('.tx-toaster__viewport {'),
      css.indexOf('}', css.indexOf('.tx-toaster__viewport {'))
    );
    for (const rule of [
      'position: fixed;',
      'inset: auto;',
      'margin: 0;',
      'border: 0;',
      'background: transparent;',
      'overflow: visible;',
    ]) {
      expect(viewport).toContain(rule);
    }
    expect(css).toMatch(/\[data-position\$=["']-center["']\]/);
    expect(css).toContain('margin-inline: auto;');
    expect(css).toMatch(/prefers-reduced-motion: reduce\)[^}]*\.tx-toast,[^}]*animation: none;/s);
  });
});
