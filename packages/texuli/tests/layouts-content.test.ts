import { cleanup, render, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import BlogLayout from '../src/layouts/content/BlogLayout.svelte';
import DocsLayout from '../src/layouts/content/DocsLayout.svelte';
import EditorialLayout from '../src/layouts/content/EditorialLayout.svelte';
import { buildToc, headingSlug } from '../src/layouts/content/toc.ts';
import { LAYOUTS, layoutForWidth } from '../src/layouts/host/contract.ts';
import { registerLayout, unregisterLayout } from '../src/layouts/host/registry.ts';
import ContentLayoutHostHarness from './fixtures/ContentLayoutHostHarness.svelte';

let observedWidth = 360;
const priorResizeObserver = globalThis.ResizeObserver;

class FakeResizeObserver {
  private readonly callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }
  observe(target: Element): void {
    this.callback(
      [
        {
          target,
          contentRect: { width: observedWidth, height: 900 } as DOMRectReadOnly,
        } as ResizeObserverEntry,
      ],
      this as unknown as ResizeObserver
    );
  }
  disconnect(): void {}
  unobserve(): void {}
}

afterEach(() => {
  cleanup();
  if (priorResizeObserver) globalThis.ResizeObserver = priorResizeObserver;
  else Reflect.deleteProperty(globalThis, 'ResizeObserver');
  unregisterLayout('docs');
  unregisterLayout('blog');
  unregisterLayout('editorial');
});

beforeEach(() => {
  registerLayout('docs', { load: async () => ({ default: DocsLayout }) });
  registerLayout('blog', { load: async () => ({ default: BlogLayout }) });
  registerLayout('editorial', { load: async () => ({ default: EditorialLayout }) });
});

describe('content layout contract and table of contents', () => {
  it('keeps content layouts responsive at narrow and wide host widths', () => {
    for (const id of ['docs', 'blog', 'editorial'] as const) {
      expect(LAYOUTS.find((layout) => layout.id === id)?.platforms).toContain('responsive');
      expect(layoutForWidth(id, 360)).toBe(id);
      expect(layoutForWidth(id, 1280)).toBe(id);
    }
  });

  it('creates stable readable ids and disambiguates duplicates', () => {
    expect(headingSlug('  Café & tea / notes  ')).toBe('cafe-tea-notes');
    expect(
      buildToc([
        { text: 'Getting started', level: 2 },
        { text: 'Getting started', level: 3 },
        { text: 'Custom section', level: 2 },
        { id: 'reserved-heading', text: 'Reserved heading', level: 2 },
        { id: 'custom-section', text: 'Custom section', level: 2 },
        { text: '   ', level: 3 },
      ])
    ).toEqual([
      { id: 'getting-started', label: 'Getting started', level: 2 },
      { id: 'getting-started-2', label: 'Getting started', level: 3 },
      { id: 'custom-section-2', label: 'Custom section', level: 2 },
      { id: 'reserved-heading', label: 'Reserved heading', level: 2 },
      { id: 'custom-section', label: 'Custom section', level: 2 },
    ]);
  });

  it.each(
    (['docs', 'blog', 'editorial'] as const).flatMap((layout) =>
      (['phone', 'desktop'] as const).flatMap((size) =>
        (['ltr', 'rtl'] as const).map(
          (dir) => [layout, size, dir, size === 'phone' ? 360 : 1280] as const
        )
      )
    )
  )(
    'renders %s content at %s width in %s direction with a usable table of contents',
    async (layout, _size, dir, width) => {
      observedWidth = width;
      globalThis.ResizeObserver = FakeResizeObserver as unknown as typeof ResizeObserver;
      const view = render(ContentLayoutHostHarness, {
        props: {
          layout,
          dir,
          options: {
            title: 'A guide for thoughtful teams',
            author: 'Ari Sol',
            date: 'October 20, 2026',
            readingTime: '5 minute read',
          },
          nav: {
            brand: { label: 'Northstar', href: '#/' },
            sections: [
              {
                id: 'main',
                label: 'Guide',
                items: [
                  { id: 'overview', label: 'Overview', href: '#/guide' },
                  { id: 'unsafe', label: 'Unsafe', href: 'javascript:alert(1)' },
                ],
              },
            ],
          },
        },
      });

      await waitFor(() =>
        expect(view.container.querySelector(`[data-tx-content-layout="${layout}"]`)).toBeTruthy()
      );
      expect(view.container.querySelector(`[dir="${dir}"]`)).toBeTruthy();
      expect(view.container.querySelector(`[data-layout="${layout}"]`)).toBeTruthy();
      expect(
        view.getByRole('heading', { level: 1, name: 'A guide for thoughtful teams' })
      ).toBeTruthy();
      expect(view.getByRole('heading', { level: 2, name: 'Reader first' }).id).toBe('reader-first');
      expect(view.getByRole('link', { name: 'Reader first' }).getAttribute('href')).toBe(
        '#reader-first'
      );
      expect(view.queryByRole('link', { name: 'Unsafe' })).toBeNull();
      expect(
        view
          .getAllByRole('link', { name: 'Overview' })
          .every((link) => link.getAttribute('href') === '#/guide')
      ).toBe(true);
    }
  );
});
