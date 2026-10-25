// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  buildExampleCatalog,
  listExampleKinds,
  listExamplePackages,
} from '../../apps/website/src/components/examples/catalog.ts';
import { filterExampleCatalog } from '../../apps/website/src/components/examples/filter.ts';
import {
  examplePreviewHref,
  isFullPageExample,
} from '../../apps/website/src/components/examples/full-page.ts';

describe('site examples catalog', () => {
  it('lists every registered example with package and kind', () => {
    const items = buildExampleCatalog();
    expect(items.length).toBeGreaterThan(50);
    expect(items.every((i) => i.id && i.title && i.packageId && i.kind)).toBe(true);
    expect(listExamplePackages(items).length).toBeGreaterThan(1);
    expect(listExampleKinds(items).length).toBeGreaterThan(1);
    const button = items.find((i) => i.id === 'texuli-button');
    expect(button?.packageId).toBe('texuli');
    expect(button?.source?.length ?? 0).toBeGreaterThan(20);
  });

  it('filters by package, kind and query', () => {
    const items = buildExampleCatalog();
    const onlyTexuli = filterExampleCatalog(items, {
      query: '',
      packageId: 'texuli',
      kind: 'all',
    });
    expect(onlyTexuli.length).toBeGreaterThan(0);
    expect(onlyTexuli.every((i) => i.packageId === 'texuli')).toBe(true);

    const q = filterExampleCatalog(items, {
      query: 'button',
      packageId: 'all',
      kind: 'all',
    });
    expect(q.some((i) => i.id.includes('button'))).toBe(true);

    const empty = filterExampleCatalog(items, {
      query: 'no-such-example-xyz',
      packageId: 'all',
      kind: 'all',
    });
    expect(empty).toEqual([]);
  });

  it('marks full-page layouts and builds preview hrefs', () => {
    expect(isFullPageExample('texuli-app-layouts')).toBe(true);
    expect(isFullPageExample('texuli-button')).toBe(false);
    expect(examplePreviewHref('/', 'texuli-button')).toBe('/examples/preview/texuli-button/');
    expect(examplePreviewHref('/', 'texuli-button', { mode: 'dark', dir: 'rtl' })).toBe(
      '/examples/preview/texuli-button/?mode=dark&dir=rtl'
    );
    expect(examplePreviewHref('/', 'texuli-button', { embed: true })).toBe(
      '/examples/preview/texuli-button/?embed=1'
    );
    expect(examplePreviewHref('/', 'texuli-button', { embed: false })).toBe(
      '/examples/preview/texuli-button/?embed=0'
    );
  });
});
