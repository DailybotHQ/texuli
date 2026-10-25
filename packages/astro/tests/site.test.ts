import { describe, expect, it } from 'vitest';
import {
  defineSite,
  SITE_KIND,
  sitePage,
  sitePageMeta,
  siteSitemap,
  type TexuliSite,
} from '../src/site/index.ts';

function homePage(overrides: Record<string, unknown> = {}) {
  return { slug: 'home', title: 'Home', home: true, ...overrides };
}

function fixtureSite(overrides: Record<string, unknown> = {}): TexuliSite {
  return defineSite({
    name: 'Stories',
    url: 'https://stories.example/',
    pages: [
      homePage({ nav: 'Start' }),
      {
        slug: 'about',
        title: 'About',
        description: 'Who writes this.',
        nav: 'About',
        updated: '2026-10-24',
        blocks: [{ type: 'heading', text: 'About', level: 2 }],
      },
    ],
    ...overrides,
  });
}

describe('defineSite', () => {
  it('normalizes, freezes, and wires hrefs and navigation in declared order', () => {
    const site = fixtureSite();
    expect(site.url).toBe('https://stories.example');
    expect(site.lang).toBe('en');
    expect(site.pages.map((page) => page.path)).toEqual(['/', '/about']);
    expect(site.pages[1]?.href).toBe('https://stories.example/about');
    expect(site.navigation).toEqual([
      { slug: 'home', label: 'Start', href: 'https://stories.example/' },
      { slug: 'about', label: 'About', href: 'https://stories.example/about' },
    ]);
    expect(Object.isFrozen(site)).toBe(true);
    expect(Object.isFrozen(site.pages)).toBe(true);
    expect(Object.isFrozen(site.pages[0])).toBe(true);
    expect(Object.isFrozen(site.navigation)).toBe(true);
  });

  it('accepts the site-kind discriminator and rejects unknown kinds', () => {
    expect(defineSite({ ...fixtureSiteInput(), kind: SITE_KIND }).name).toBe('Stories');
    expect(() => defineSite({ ...fixtureSiteInput(), kind: 'texuli.site/v2' })).toThrow(
      /kind must be/
    );
  });

  it('rejects malformed slugs, titles, and duplicates', () => {
    expect(() => fixtureSite({ pages: [homePage(), { slug: 'About', title: 'A' }] })).toThrow(
      /kebab-case/
    );
    expect(() => fixtureSite({ pages: [homePage(), { slug: '', title: 'A' }] })).toThrow(
      /non-empty string/
    );
    expect(() => fixtureSite({ pages: [homePage(), { slug: 'a/b', title: 'A' }] })).toThrow(
      /kebab-case/
    );
    expect(() => fixtureSite({ pages: [homePage(), { slug: 'a', title: '  ' }] })).toThrow(
      /non-empty string/
    );
    expect(() =>
      fixtureSite({
        pages: [homePage(), { slug: 'same', title: 'A' }, { slug: 'same', title: 'B' }],
      })
    ).toThrow(/duplicated/);
  });

  it('requires exactly one home page', () => {
    expect(() =>
      fixtureSite({
        pages: [
          { slug: 'home', title: 'Home' },
          { slug: 'about', title: 'About' },
        ],
      })
    ).toThrow(/exactly one page must set home/);
    expect(() =>
      fixtureSite({ pages: [homePage({ home: true }), { slug: 'a', title: 'A', home: true }] })
    ).toThrow(/only one page may set home/);
  });

  it('requires at least one page', () => {
    expect(() => fixtureSite({ pages: [] })).toThrow(/at least one page/);
    expect(() => fixtureSite({ pages: 'home' as never })).toThrow(/must be an array/);
  });

  it('validates the base URL through the URL policy and rejects non-deployable forms', () => {
    expect(() => fixtureSite({ url: 'javascript:alert(1)' })).toThrow(/safe http/);
    expect(() => fixtureSite({ url: 'ftp://files.example' })).toThrow(/https or http/);
    expect(() => fixtureSite({ url: '/only-a-path' })).toThrow(/absolute/);
    expect(() => fixtureSite({ url: 'https://stories.example/?p=1' })).toThrow(/query/);
    expect(() => fixtureSite({ url: 'https://stories.example/#top' })).toThrow(/fragment/);
    expect(defineSite({ ...fixtureSiteInput(), url: 'https://stories.example/base/' }).url).toBe(
      'https://stories.example/base'
    );
  });

  it('validates ISO dates, language tags, and lengths', () => {
    expect(() => fixtureSite({ pages: [homePage({ updated: '10/24/2026' })] })).toThrow(
      /ISO calendar date/
    );
    expect(() => fixtureSite({ pages: [homePage({ updated: '2026-13-01' })] })).toThrow(
      /ISO calendar date/
    );
    expect(() => fixtureSite({ lang: 'e' })).toThrow(/lang/);
    expect(() => fixtureSite({ lang: 'en-US' })).toBeDefined();
    expect(() => fixtureSite({ name: '' })).toThrow(/name/);
  });

  it('validates page blocks against the closed schema and names the page', () => {
    expect(() =>
      fixtureSite({ pages: [homePage({ blocks: [{ type: 'raw-html', html: '<b>x</b>' }] })] })
    ).toThrow(/page "home" has invalid blocks/);
    const site = fixtureSite();
    expect(site.pages[1]?.blocks).toEqual([{ type: 'heading', text: 'About', level: 2 }]);
    expect(site.pages[0]?.blocks).toEqual([]);
  });
});

describe('sitePage and sitePageMeta', () => {
  it('looks pages up by slug and returns undefined for unknown slugs', () => {
    const site = fixtureSite();
    expect(sitePage(site, 'about')?.title).toBe('About');
    expect(sitePage(site, 'missing')).toBeUndefined();
  });

  it('derives ContentLayout metadata from the site and page', () => {
    const site = fixtureSite();
    expect(sitePageMeta(site, 'home')).toEqual({
      title: 'Stories',
      canonical: 'https://stories.example/',
      lang: 'en',
    });
    expect(sitePageMeta(site, 'about')).toEqual({
      title: 'About — Stories',
      description: 'Who writes this.',
      canonical: 'https://stories.example/about',
      lang: 'en',
    });
    expect(sitePageMeta(site, 'missing')).toBeUndefined();
  });
});

describe('siteSitemap', () => {
  it('emits a deterministic sitemap with lastmod only where declared', () => {
    const site = fixtureSite();
    const sitemap = siteSitemap(site);
    expect(sitemap).toBe(
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
        '  <url>\n    <loc>https://stories.example/</loc>\n  </url>\n' +
        '  <url>\n    <loc>https://stories.example/about</loc>\n    <lastmod>2026-10-24</lastmod>\n  </url>\n' +
        '</urlset>\n'
    );
    expect(sitemap).toBe(siteSitemap(fixtureSite()));
  });

  it('escapes XML-significant characters in locations', () => {
    const site = fixtureSite({ url: 'https://stories.example/a&b' });
    expect(siteSitemap(site)).toContain('<loc>https://stories.example/a&amp;b/</loc>');
  });
});

function fixtureSiteInput() {
  return {
    name: 'Stories',
    url: 'https://stories.example',
    pages: [homePage(), { slug: 'about', title: 'About' }],
  };
}
