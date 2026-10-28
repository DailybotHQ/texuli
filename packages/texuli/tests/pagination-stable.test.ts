import { cleanup, fireEvent, render } from '@testing-library/svelte';
import { tick } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getStablePageTokens,
  PaginationEllipsis,
  PaginationRoot,
  stablePageSlots,
} from '../src/components/navigation/index.ts';

// G30: stable-count pagination tokens and composable PaginationEllipsis.

describe('Pagination stable count (G30)', () => {
  afterEach(cleanup);

  it('yields the same token count on every page, with valid, ordered, unique pages', () => {
    for (const [siblings, boundaries, total] of [
      [1, 1, 20],
      [2, 1, 30],
      [1, 2, 12],
      [0, 0, 9],
    ] as const) {
      const slots = stablePageSlots(siblings, boundaries);
      for (let page = 1; page <= total; page += 1) {
        const tokens = getStablePageTokens(page, total, siblings, boundaries);
        const label = `${siblings}/${boundaries}/${total} page ${page}`;
        expect(tokens.length, label).toBe(slots);
        const pages = tokens.filter((token) => typeof token === 'number');
        expect(pages, label).toContain(page);
        expect(
          [...pages].sort((a, b) => a - b),
          label
        ).toEqual(pages);
        expect(new Set(tokens).size, label).toBe(tokens.length);
        expect(Math.min(...pages) >= 1 && Math.max(...pages) <= total, label).toBe(true);
      }
    }
    // Short ranges list every page.
    expect(getStablePageTokens(3, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it('keeps the rendered control the same length as the page moves, and reserves the widest number', async () => {
    const view = render(PaginationRoot, {
      props: { page: 1, pageCount: 120, stableCount: true, label: 'Results' },
    });
    const nav = view.getByRole('navigation', { name: 'Results' });
    expect(nav.hasAttribute('data-stable-count')).toBe(true);
    const list = nav.querySelector('ul');
    expect(list?.getAttribute('style')).toContain('--tx-pagination-digits: 3');
    const counts = new Set<number>();
    for (const page of [1, 4, 5, 60, 116, 117, 120]) {
      await view.rerender({ page, pageCount: 120, stableCount: true, label: 'Results' });
      await tick();
      counts.add(nav.querySelectorAll('li').length);
      expect(view.getByRole('button', { name: `Page ${page}` }).getAttribute('aria-current')).toBe(
        'page'
      );
    }
    expect([...counts]).toEqual([stablePageSlots() + 2]);
  });

  it('PaginationEllipsis forwards attributes and composes handlers on its wrapper', async () => {
    const onclick = vi.fn();
    const view = render(PaginationEllipsis, {
      props: { onclick, 'data-testid': 'gap', title: 'More pages', class: 'custom' },
    });
    const wrapper = view.getByTestId('gap');
    expect(wrapper.hasAttribute('data-tx-pagination-ellipsis')).toBe(true);
    expect(wrapper.getAttribute('title')).toBe('More pages');
    expect(wrapper.querySelector('.tx-pagination__ellipsis.custom')).toBeTruthy();
    await fireEvent.click(wrapper);
    expect(onclick).toHaveBeenCalledTimes(1);
  });
});
