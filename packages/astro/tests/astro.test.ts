// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseTexuliBlocks } from '../src/content/index.ts';
import { texuli, themeBootstrapScript } from '../src/integration/index.ts';
import {
  defineSite,
  SITE_KIND,
  sitePage,
  sitePageMeta,
  siteSitemap,
  type TexuliSite,
} from '../src/site/index.ts';

describe('parseTexuliBlocks', () => {
  it('returns validated blocks and rejects unknown block types and malformed entries', () => {
    const result = parseTexuliBlocks([{ type: 'heading', text: 'Welcome', level: 1 }]);
    expect(result.success).toBe(true);
    if (result.success)
      expect(result.blocks[0]).toMatchObject({ type: 'heading', text: 'Welcome' });
    expect(parseTexuliBlocks([{ type: 'raw-html', html: '<script>bad()</script>' }]).success).toBe(
      false
    );
    expect(parseTexuliBlocks({ type: 'text' }).success).toBe(false);
  });
});

function appearance(mode: 'light' | 'dark', background: string, density = '1') {
  return JSON.stringify({
    v: 1,
    themeId: 'ocean',
    mode,
    vars: {
      '--tx-background': background,
      '--tx-density': density,
      '--tx-radius': '8px',
      '--tx-radius-scale': '1',
      '--tx-radius-step-2': '2px',
    },
  });
}

function runBootstrap(
  script: string,
  seed: Record<string, string> = {},
  dark = false,
  initialDataset: Record<string, string> = {}
) {
  const values = new Map(Object.entries(seed));
  const vars = new Map<string, string>();
  const classes = new Set<string>();
  const mediaListeners = new Map<string, (event: unknown) => void>();
  const mediaMatches = new Map<string, boolean>([
    ['(prefers-color-scheme: dark)', dark],
    ['(prefers-contrast: more)', false],
  ]);
  const windowListeners = new Map<
    string,
    (event: { key: string | null; newValue: string | null }) => void
  >();
  const root = {
    dataset: { ...initialDataset } as Record<string, string>,
    classList: {
      toggle(name: string, enabled: boolean) {
        if (enabled) classes.add(name);
        else classes.delete(name);
      },
    },
    style: {
      colorScheme: '',
      setProperty(name: string, value: string) {
        vars.set(name, String(value));
      },
      removeProperty(name: string) {
        vars.delete(name);
      },
    },
  };
  const store = {
    getItem(key: string) {
      return values.get(key) ?? null;
    },
  };
  const matchMedia = (query: string) => ({
    matches: mediaMatches.get(query) ?? false,
    addEventListener: (_type: string, listener: (event: unknown) => void) => {
      mediaListeners.set(query, listener);
    },
  });
  const addEventListener = (
    type: string,
    listener: (event: { key: string | null; newValue: string | null }) => void
  ) => windowListeners.set(type, listener);

  new Function('document', 'localStorage', 'matchMedia', 'addEventListener', script)(
    { documentElement: root },
    store,
    matchMedia,
    addEventListener
  );
  return { root, vars, classes, mediaListeners, mediaMatches, windowListeners };
}

describe('Texuli Astro theme integration', () => {
  it('injects a deterministic bootstrap, supports manual placement and validates its options', () => {
    let injected: string | undefined;
    const integration = texuli({
      namespace: 'marketing',
      fallbackMode: 'dark',
      density: 'compact',
      radius: 'rounded',
    });
    const hook = integration.hooks['astro:config:setup'];
    if (typeof hook === 'function') {
      hook({
        injectScript: (stage: string, code: string) => {
          expect(stage).toBe('head-inline');
          injected = code;
        },
      } as never);
    }
    expect(injected).toBe(
      themeBootstrapScript({
        namespace: 'marketing',
        fallbackMode: 'dark',
        density: 'compact',
        radius: 'rounded',
      })
    );
    expect(injected).toContain('texuli.marketing.appearance');
    expect(injected).toContain("addEventListener('storage'");
    expect(injected).toContain('txDensity');
    expect(injected).not.toContain('fetch(');
    expect(injected).not.toContain('new Function');

    let manualInjected = false;
    const manual = texuli({ namespace: 'docs', bootstrap: 'manual' });
    const manualHook = manual.hooks['astro:config:setup'];
    if (typeof manualHook === 'function') {
      manualHook({ injectScript: () => (manualInjected = true) } as never);
    }
    expect(manualInjected).toBe(false);
    expect(themeBootstrapScript({ namespace: 'docs', bootstrap: 'manual' })).toContain(
      'texuli.docs.appearance'
    );
    expect(() => texuli({ namespace: '' })).toThrow(TypeError);
    expect(() => texuli({ fallbackMode: 'automatic' as never })).toThrow(/fallback mode/i);
    expect(() => texuli({ density: 'dense' as never })).toThrow(/density/i);
    expect(() => texuli({ radius: 'huge' as never })).toThrow(/radius/i);
  });

  it('applies cached appearances and same-origin storage updates without reloading', () => {
    const key = 'texuli.docs.appearance';
    const result = runBootstrap(
      themeBootstrapScript({ namespace: 'docs', density: 'compact', radius: 'rounded' }),
      { [key]: appearance('light', '#ffffff') }
    );

    expect(result.root.dataset).toMatchObject({
      txTheme: 'ocean',
      txMode: 'light',
      txDensity: 'compact',
      txRadius: 'rounded',
    });
    expect(result.vars.get('--tx-density')).toBe('0.875');
    expect(result.vars.get('--tx-radius')).toBe('calc(8px * 1.25)');
    expect(result.vars.get('--tx-radius-step-2')).toBe('calc(2px * 1.25)');

    result.windowListeners.get('storage')?.({
      key,
      newValue: appearance('dark', '#101820', '1.1'),
    });
    expect(result.root.dataset.txMode).toBe('dark');
    expect(result.vars.get('--tx-background')).toBe('#101820');
    expect(result.vars.get('--tx-density')).toBe('0.875');
    expect(result.vars.get('--tx-radius')).toBe('calc(8px * 1.25)');

    result.windowListeners.get('storage')?.({ key, newValue: null });
    expect(result.root.dataset.txTheme).toBeUndefined();
    expect(result.root.dataset.txMode).toBe('light');
    expect(result.vars.has('--tx-background')).toBe(false);
  });

  it('follows system color and contrast changes when the cache is absent', () => {
    const result = runBootstrap(themeBootstrapScript({ namespace: 'system' }));
    expect(result.root.dataset.txMode).toBe('light');
    result.mediaMatches.set('(prefers-color-scheme: dark)', true);
    result.mediaListeners.get('(prefers-color-scheme: dark)')?.({});
    expect(result.root.dataset.txMode).toBe('dark');
    result.mediaMatches.set('(prefers-contrast: more)', true);
    result.mediaListeners.get('(prefers-contrast: more)')?.({});
    expect(result.root.dataset.txMode).toBe('high-contrast');
  });

  it('keeps the server-rendered theme when nothing is cached and restores it when another tab clears the cache', () => {
    // ContentLayout renders data-tx-theme on <html>; a fresh visitor has no
    // cached appearance and must keep it (the packed astro-plain consumer
    // asserts exactly this).
    const result = runBootstrap(
      themeBootstrapScript({ namespace: 'site', fallbackMode: 'dark' }),
      {},
      false,
      { txTheme: 'sky' }
    );
    expect(result.root.dataset.txTheme).toBe('sky');
    expect(result.root.dataset.txMode).toBe('dark');

    const key = 'texuli.docs.appearance';
    const restored = runBootstrap(
      themeBootstrapScript({ namespace: 'docs' }),
      { [key]: appearance('dark', '#101820') },
      false,
      { txTheme: 'sky' }
    );
    expect(restored.root.dataset.txTheme).toBe('ocean');
    restored.windowListeners.get('storage')?.({ key, newValue: null });
    expect(restored.root.dataset.txTheme).toBe('sky');
    expect(restored.root.dataset.txMode).toBe('light');
  });
});

describe('ContentLayout and stylesheet contract', () => {
  it('keeps density and radius names in step, validates them, and guards the Open Graph image', () => {
    const layout = readFileSync('packages/astro/src/layouts/ContentLayout.astro', 'utf8');
    const integration = readFileSync('packages/astro/src/integration/index.ts', 'utf8');
    const css = readFileSync('packages/astro/src/styles.css', 'utf8');
    // The static attributes are the counterparts of the script-driven dataset
    // names (txDensity / txRadius), and the stylesheet consumes the same names.
    expect(layout).toContain('data-tx-density={density}');
    expect(layout).toContain('data-tx-radius={radius}');
    expect(integration).toContain('txDensity');
    expect(integration).toContain('txRadius');
    for (const selector of [
      ':root[data-tx-density="compact"]',
      ':root[data-tx-density="spacious"]',
      ':root[data-tx-radius="rounded"]',
      '@import "@texuli/tokens/base.css"',
      '@import "@texuli/tokens/forced-colors.css"',
      '@media print',
      'color-scheme: light',
    ]) {
      expect(css, selector).toContain(selector);
    }
    expect(layout).toContain('Density must be compact, comfortable, or spacious.');
    expect(layout).toContain('Radius must be compact, comfortable, or rounded.');
    expect(layout).toContain('<meta name="robots" content="noindex" />');
    // The Open Graph image passes the developer URL policy, and a rejected
    // image does not render: the guard uses the sanitized value.
    expect(layout).toContain("safeHref(ogImage, 'developer')");
    expect(layout).toContain('<meta property="og:image" content={ogImageHref} />');
    expect(layout).toContain('{ogImageHref &&');
    expect(layout).not.toContain('{ogImage &&');
  });
});

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
  it('normalizes, freezes, wires hrefs and navigation, and checks the site kind', () => {
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

    expect(defineSite({ ...fixtureSiteInput(), kind: SITE_KIND }).name).toBe('Stories');
    expect(() => defineSite({ ...fixtureSiteInput(), kind: 'texuli.site/v2' })).toThrow(
      /kind must be/
    );
  });

  it('rejects malformed slugs, titles, duplicates, home counts and page lists', () => {
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

    expect(() => fixtureSite({ pages: [] })).toThrow(/at least one page/);
    expect(() => fixtureSite({ pages: 'home' as never })).toThrow(/must be an array/);
  });

  it('validates the base URL through the URL policy, ISO dates, lang tags and page blocks', () => {
    expect(() => fixtureSite({ url: 'javascript:alert(1)' })).toThrow(/safe http/);
    expect(() => fixtureSite({ url: 'ftp://files.example' })).toThrow(/https or http/);
    expect(() => fixtureSite({ url: '/only-a-path' })).toThrow(/absolute/);
    expect(() => fixtureSite({ url: 'https://stories.example/?p=1' })).toThrow(/query/);
    expect(() => fixtureSite({ url: 'https://stories.example/#top' })).toThrow(/fragment/);
    expect(defineSite({ ...fixtureSiteInput(), url: 'https://stories.example/base/' }).url).toBe(
      'https://stories.example/base'
    );

    expect(() => fixtureSite({ pages: [homePage({ updated: '10/24/2026' })] })).toThrow(
      /ISO calendar date/
    );
    expect(() => fixtureSite({ pages: [homePage({ updated: '2026-13-01' })] })).toThrow(
      /ISO calendar date/
    );
    expect(() => fixtureSite({ lang: 'e' })).toThrow(/lang/);
    expect(() => fixtureSite({ lang: 'en-US' })).toBeDefined();
    expect(() => fixtureSite({ name: '' })).toThrow(/name/);

    expect(() =>
      fixtureSite({ pages: [homePage({ blocks: [{ type: 'raw-html', html: '<b>x</b>' }] })] })
    ).toThrow(/page "home" has invalid blocks/);
    const site = fixtureSite();
    expect(site.pages[1]?.blocks).toEqual([{ type: 'heading', text: 'About', level: 2 }]);
    expect(site.pages[0]?.blocks).toEqual([]);
  });
});

describe('sitePage and sitePageMeta', () => {
  it('looks pages up by slug and derives ContentLayout metadata', () => {
    const site = fixtureSite();
    expect(sitePage(site, 'about')?.title).toBe('About');
    expect(sitePage(site, 'missing')).toBeUndefined();
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
  it('emits a deterministic, escaped sitemap with lastmod only where declared', () => {
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

    const escaped = fixtureSite({ url: 'https://stories.example/a&b' });
    expect(siteSitemap(escaped)).toContain('<loc>https://stories.example/a&amp;b/</loc>');
  });
});

function fixtureSiteInput() {
  return {
    name: 'Stories',
    url: 'https://stories.example',
    pages: [homePage(), { slug: 'about', title: 'About' }],
  };
}
