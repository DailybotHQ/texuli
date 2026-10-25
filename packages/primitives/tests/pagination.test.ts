import { cleanup, render, screen } from '@testing-library/svelte';
import { getPageCount, getPageTokens, Pagination } from '@texuli/primitives/pagination';
import { afterEach, describe, expect, it } from 'vitest';
import PaginationChildHarness from './fixtures/PaginationChildHarness.svelte';
import PaginationHarness from './fixtures/PaginationHarness.svelte';

afterEach(cleanup);

describe('pagination page model', () => {
  it('keeps boundary and sibling pages and inserts leading and trailing ellipses', () => {
    expect(getPageTokens(6, 40, 1, 1)).toEqual([1, 'ellipsis-start', 5, 6, 7, 'ellipsis-end', 40]);
  });

  it('fills a one-page gap instead of rendering an ellipsis', () => {
    expect(getPageTokens(4, 10, 1, 1)).toEqual([1, 2, 3, 4, 5, 'ellipsis-end', 10]);
  });

  it('normalizes invalid page, count and range inputs without creating unbounded output', () => {
    expect(getPageTokens(Number.NaN, Number.NaN)).toEqual([1]);
    expect(getPageTokens(500_000, 1_000_000)).toHaveLength(7);
    expect(getPageTokens(90, 8, -1, 0)).toEqual([8]);
    expect(getPageCount(undefined, 47, 10)).toBe(5);
    expect(getPageCount(undefined, 0, 0)).toBe(1);
    expect(getPageCount(3.8, 100, 10)).toBe(3);
  });
});

describe('Pagination.Root and parts', () => {
  it('renders a named navigation landmark, current-page semantics and edge-disabled controls', () => {
    const view = render(Pagination.Root, {
      props: { page: 1, pageCount: 5, label: 'Invoice pages' },
    });

    expect(view.getByRole('navigation', { name: 'Invoice pages' })).toBeTruthy();
    expect(view.getByRole('button', { name: 'Page 1' }).getAttribute('aria-current')).toBe('page');
    expect(view.getByRole('button', { name: 'Previous page' }).hasAttribute('disabled')).toBe(true);
    expect(view.getByRole('button', { name: 'Next page' }).hasAttribute('disabled')).toBe(false);
  });

  it('accepts localized navigation and page labels', () => {
    const view = render(Pagination.Root, {
      props: {
        page: 2,
        pageCount: 3,
        label: 'Pages',
        previousLabel: 'Back',
        nextLabel: 'Forward',
        getPageLabel: (page: number) => `Page number ${page}`,
      },
    });

    expect(view.getByRole('navigation', { name: 'Pages' })).toBeTruthy();
    expect(view.getByRole('button', { name: 'Back' })).toBeTruthy();
    expect(view.getByRole('button', { name: 'Forward' })).toBeTruthy();
    expect(view.getByRole('button', { name: 'Page number 2' }).getAttribute('aria-current')).toBe(
      'page'
    );
  });

  it('updates the bound page and callback through page and navigation buttons', async () => {
    const view = render(PaginationHarness);
    const navigation = screen.getByRole('navigation', { name: 'Search result pages' });

    await view.getByRole('button', { name: 'Next page' }).click();
    expect(screen.getByLabelText('Selected page').textContent).toBe('6');
    expect(screen.getByLabelText('Last changed page').textContent).toBe('6');
    expect(navigation.querySelector('[aria-current="page"]')?.textContent).toBe('6');

    await view.getByRole('button', { name: 'Page 7' }).click();
    expect(screen.getByLabelText('Selected page').textContent).toBe('7');
    await view.getByRole('button', { name: 'Previous page' }).click();
    expect(screen.getByLabelText('Selected page').textContent).toBe('6');
  });

  it('exposes disabled root and current-page state', () => {
    const view = render(Pagination.Root, {
      props: { page: 2, pageCount: 5, disabled: true, label: 'Disabled pages' },
    });
    const nav = view.getByRole('navigation', { name: 'Disabled pages' });
    expect(nav.getAttribute('data-state')).toBe('disabled');
    expect(view.getByRole('button', { name: 'Next page' }).hasAttribute('disabled')).toBe(true);
    expect(view.getByRole('button', { name: 'Page 2' }).getAttribute('data-state')).toBe('active');
  });

  it('composes a child navigation element with root accessibility and state props', () => {
    const view = render(PaginationChildHarness);
    const nav = view.getByRole('navigation', { name: 'Composed pages' });

    expect(nav.getAttribute('data-composed-pagination')).not.toBeNull();
    expect(nav.getAttribute('data-state')).toBe('active');
  });

  it('exports the compound public API', () => {
    expect(Pagination.Root).toBeTruthy();
    expect(Pagination.Page).toBeTruthy();
    expect(Pagination.PreviousButton).toBeTruthy();
    expect(Pagination.NextButton).toBeTruthy();
    expect(Pagination.Ellipsis).toBeTruthy();
  });
});
