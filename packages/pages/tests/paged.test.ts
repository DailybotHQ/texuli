import { render, screen, waitFor } from '@testing-library/svelte';
import type { PagedLayout } from '@texuli/document/paged';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  adoptCustomPage,
  customPageRule,
  lineBottoms,
  PagedView,
  pageName,
  resolvePagedLabels,
  splitPoints,
} from '../src/paged/index.ts';
import { doc, para, text } from './fixtures.ts';

describe('paged measuring', () => {
  it('merges line boxes per visual line and never splits inside an atomic element', () => {
    // Two runs on line one (a taller code run), one on line two, an image, line three.
    const bottoms = lineBottoms([
      [0, 20],
      [-1, 22],
      [24, 44],
      [Number.NaN, 5],
      [150, 170],
      [10, 5],
    ]);
    expect(bottoms).toEqual([22, 44, 170]);
    expect(splitPoints([22, 44, 100, 170, 200], [[50, 140]], 180)).toEqual([22, 44, 170]);
    expect(splitPoints([22, 95], [[20, 100]], 100)).toEqual([]);
  });

  it('names print pages and writes custom @page rules from finite numbers only', () => {
    expect(pageName({ size: 'letter', orientation: 'landscape' })).toBe(
      'tx-pages-letter-landscape'
    );
    expect(pageName({ size: 'custom', orientation: 'portrait' })).toBe('tx-pages-custom');
    expect(customPageRule(100, 150.5)).toBe(
      '@page tx-pages-custom { size: 100.000mm 150.500mm; margin: 0; }'
    );
    expect(customPageRule(Number.NaN, 10)).toBeNull();
    expect(customPageRule(-1, 10)).toBeNull();
    // The rule is adopted through CSSOM and removed by the cleanup.
    const before = document.adoptedStyleSheets?.length ?? 0;
    const cleanup = adoptCustomPage(document, 100, 150);
    if ('adoptedStyleSheets' in document && typeof CSSStyleSheet === 'function') {
      expect(document.adoptedStyleSheets.length).toBe(before + 1);
    }
    cleanup();
    expect(document.adoptedStyleSheets?.length ?? 0).toBe(before);
  });

  it('resolves paged labels over the English defaults', () => {
    const labels = resolvePagedLabels({
      paged: '',
      pageOf: (page, total) => `Seite ${page} von ${total}`,
    });
    expect(labels.paged).toBe('Pages');
    expect(labels.pageOf(2, 5)).toBe('Seite 2 von 5');
  });
});

describe('PagedView', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  /** Lay out blocks with fixed measured heights: happy-dom has no layout engine. */
  function measured(heights: readonly number[]) {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement
    ) {
      const unit = this.closest('.tx-pages-paged__measure [data-paged-unit]');
      if (this.classList.contains('tx-pages-paged__measure')) return new DOMRect(0, 0, 600, 5_000);
      if (unit === this)
        return new DOMRect(0, 0, 600, heights[Number(this.dataset.pagedUnit)] ?? 20);
      return new DOMRect(0, 0, 0, 0);
    });
  }

  it('lays the document out on pages with page names, numbers, headers and print isolation', async () => {
    // A4 with one-inch margins: about 930 px of content per page.
    measured([300, 300, 300, 300, 300, 2_000, 30, 40]);
    const page = doc([
      para('a', 'A'),
      para('b', 'B'),
      para('c', 'C'),
      para('d', 'D'),
      para('e', 'E'),
      { id: 'big', type: 'media', ref: 'https://example.com/x.png', alt: 'Tall' },
      { id: 'h', type: 'heading', level: 2, content: text('Last') },
      para('z', 'End'),
    ]);
    page.page = {
      size: 'a4',
      orientation: 'portrait',
      header: { start: '{title}' },
      breaks: ['z'],
    };
    let last: PagedLayout | null = null;
    const { container } = render(PagedView, {
      props: { document: page, onLayout: (layout: PagedLayout) => (last = layout) },
    });
    const root = container.querySelector('.tx-pages-paged') as HTMLElement;
    await waitFor(() => expect(root.dataset.pagedReady).toBe('true'));
    expect(root.dataset.txPrintIsolate).toBe('true');
    const layout = last as unknown as PagedLayout;
    expect(layout.pages.length).toBeGreaterThan(3);
    const sheets = screen.getAllByRole('group');
    expect(sheets).toHaveLength(layout.pages.length);
    expect(sheets[0]?.getAttribute('aria-label')).toBe(`Page 1 of ${layout.pages.length}`);
    expect(sheets[0]?.dataset.pageName).toBe('tx-pages-a4-portrait');
    expect(sheets[0]?.style.inlineSize).toBe('210mm');
    expect(sheets[0]?.querySelector('[data-band="footer"]')?.textContent).toContain(
      `1 / ${layout.pages.length}`
    );
    expect(sheets[0]?.querySelector('[data-band="header"]')?.textContent).toContain('Field notes');
    // The tall image is clipped across pages; its continuations are inert copies.
    const parts = root.querySelectorAll<HTMLElement>(
      '.tx-pages-paged__sheets [data-block-id="big"].tx-pages-paged__slice'
    );
    expect(parts.length).toBeGreaterThan(1);
    expect(parts[0]?.inert).toBe(false);
    expect(
      [...parts].slice(1).every((part) => part.inert && part.dataset.continued === 'true')
    ).toBe(true);
    // The heading stays with the paragraph after it... unless a break comes first: z starts a page.
    const lastSheet = sheets.at(-1) as HTMLElement;
    expect(lastSheet.querySelector('.tx-pages-paged__slice')?.getAttribute('data-block-id')).toBe(
      'z'
    );
    // The measuring copy is hidden from assistive technology and focus.
    const measure = root.querySelector('.tx-pages-paged__measure') as HTMLElement;
    expect(measure.getAttribute('aria-hidden')).toBe('true');
    expect(measure.inert).toBe(true);
    expect(measure.querySelector('[id]')).toBeNull();
  });

  it('can leave print isolation off and number nothing', async () => {
    measured([100]);
    const { container } = render(PagedView, {
      props: { document: doc([para('a', 'A')]), isolate: false, pageNumbers: false },
    });
    const root = container.querySelector('.tx-pages-paged') as HTMLElement;
    await waitFor(() => expect(root.dataset.pagedReady).toBe('true'));
    expect(root.hasAttribute('data-tx-print-isolate')).toBe(false);
    expect(root.querySelector('[data-band]')).toBeNull();
    expect(root.dataset.pageCount).toBe('1');
  });
});
