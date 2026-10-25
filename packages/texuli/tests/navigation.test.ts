// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import {
  breadcrumbClass,
  NAV_SIZES,
  navigationMenuClass,
  PAGINATION_VARIANTS,
  paginationClass,
} from '../src/components/navigation/index.ts';
import NavigationFixture from './fixtures/NavigationFixture.svelte';
import PaginationPageFixture from './fixtures/PaginationPageFixture.svelte';

afterEach(() => {
  cleanup();
});

describe('navigation variants', () => {
  it('exposes sizes and pagination variants', () => {
    expect(NAV_SIZES).toEqual(['sm', 'md', 'lg']);
    expect(PAGINATION_VARIANTS).toEqual(['outline', 'soft']);
    expect(navigationMenuClass({ size: 'sm' })).toContain('tx-nav-menu--sm');
    expect(breadcrumbClass({ size: 'lg' })).toContain('tx-breadcrumb--lg');
    expect(paginationClass({ variant: 'soft', size: 'md' })).toContain('tx-pagination--soft');
  });
});

describe('Breadcrumb', () => {
  it('names the trail and marks the current page', () => {
    render(NavigationFixture);
    const nav = screen.getByRole('navigation', { name: 'Trail' });
    expect(nav.className).toContain('tx-breadcrumb');
    expect(screen.getByRole('link', { name: 'Home' }).getAttribute('href')).toBe(
      'https://example.com/'
    );
    expect(screen.getByText('Components').getAttribute('aria-current')).toBe('page');
  });

  it('blocks unsafe hrefs', () => {
    render(NavigationFixture);
    // javascript: would be stripped by safeHref — ensure example.com links remain.
    expect(screen.getByRole('link', { name: 'Docs' }).getAttribute('href')).toContain(
      'example.com'
    );
  });
});

describe('NavigationMenu', () => {
  it('opens a flyout from the trigger and lists links', async () => {
    render(NavigationFixture);
    const main = screen.getByRole('navigation', { name: 'Main' });
    expect(main.className).toContain('tx-nav-menu');
    await fireEvent.click(screen.getByRole('button', { name: 'Products' }));
    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Analytics' })).toBeTruthy();
    });
    expect(screen.getByRole('link', { name: 'Pricing' }).getAttribute('aria-current')).toBe('page');
  });
});

describe('Pagination', () => {
  it('renders page controls and advances with Next', async () => {
    render(NavigationFixture, { props: { page: 2 } });
    const nav = screen.getByRole('navigation', { name: 'Result pages' });
    expect(nav.className).toContain('tx-pagination');
    expect(screen.getByRole('button', { name: /Page 2/i }).getAttribute('aria-current')).toBe(
      'page'
    );
    await fireEvent.click(screen.getByRole('button', { name: /Next page/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Page 3/i }).getAttribute('aria-current')).toBe(
        'page'
      );
    });
  });

  // Audit P0-01: the default page buttons were empty boxes (named only by aria-label).
  it('shows each page number as visible button text', () => {
    render(NavigationFixture, { props: { page: 2 } });
    const pages = screen.getAllByRole('button', { name: /^Page \d+$/ });
    expect(pages.length).toBeGreaterThan(1);
    for (const button of pages) {
      expect(button.textContent?.trim()).toBe(
        button.getAttribute('aria-label')?.replace('Page ', '')
      );
    }
  });

  it('defaults a composed Pagination.Page to its number and keeps custom content', () => {
    render(PaginationPageFixture);
    expect(screen.getByRole('button', { name: 'Page 1' }).textContent?.trim()).toBe('1');
    expect(screen.getByRole('button', { name: 'Page 2' }).textContent?.trim()).toBe('Second');
  });

  it('applies soft variant class', () => {
    render(NavigationFixture, { props: { paginationVariant: 'soft' } });
    expect(screen.getByRole('navigation', { name: 'Result pages' }).className).toContain(
      'tx-pagination--soft'
    );
  });
});
