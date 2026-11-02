/**
 * The structured-data source of truth (T-18): code-authored schema.org
 * objects for the site. Facts come from this repository — the package
 * version from the installed workspace package, urls from the site config —
 * so a page can never state something the repo cannot back. Consumers pass
 * the result through `JsonLd.astro`; the CSP integration hashes the emitted
 * inline block automatically (it hashes every inline script in the built
 * HTML).
 */
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { SITE_NAME, SITE_URL } from './constances';

const require = createRequire(import.meta.url);

/** The shared node ids every page's graph (siteJsonLd) defines once. */
const ORGANIZATION_ID = 'https://dailybot.com/#organization';
const WEBSITE_ID = `${SITE_URL}/#website`;

/**
 * The published version of the `texuli` package, resolved through the
 * installed entry point — never hand-copied into the site. The exports map
 * points into `src/`, so the manifest is found by walking up from the entry.
 */
export function texuliPackageVersion(): string {
  let dir = dirname(require.resolve('texuli'));
  for (;;) {
    const manifestPath = join(dir, 'package.json');
    if (existsSync(manifestPath)) {
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
        name?: string;
        version?: string;
      };
      if (manifest.name === 'texuli') {
        if (!manifest.version) throw new Error('the texuli package manifest carries no version');
        return manifest.version;
      }
    }
    const parent = dirname(dir);
    if (parent === dir) throw new Error('the texuli package manifest was not found from its entry');
    dir = parent;
  }
}

export function libraryJsonLd(): { '@context': string; '@graph': Array<Record<string, unknown>> } {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        name: 'Dailybot, Inc.',
        url: 'https://dailybot.com/',
      },
      {
        '@type': 'WebSite',
        name: SITE_NAME,
        url: `${SITE_URL}/`,
        potentialAction: {
          '@type': 'SearchAction',
          target: {
            '@type': 'EntryPoint',
            urlTemplate: `${SITE_URL}/search/?q={search_term_string}`,
          },
          'query-input': 'required name=search_term_string',
        },
      },
      {
        '@type': 'SoftwareApplication',
        name: SITE_NAME,
        applicationCategory: 'DeveloperApplication',
        operatingSystem: 'Web',
        softwareVersion: texuliPackageVersion(),
        license: 'https://opensource.org/licenses/MIT',
        description:
          'Open-source Svelte 5 component system with a closed agent catalog and a sink-free renderer. Pre-1.0 release on npm; the native Kotlin Multiplatform renderer is in development.',
        url: `${SITE_URL}/`,
      },
    ],
  };
}

/**
 * The TechArticle graph for the architecture reading page (PLAN_006 T-17
 * contract, `subsite-ia-nav.md` §3): the page is a technical article about
 * how one catalog contract serves two runtimes, part of the Texuli site,
 * authored by the owner organization.
 */
export function techArticleJsonLd(headline: string, description: string, path: string) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'TechArticle',
        headline,
        description,
        url: `${SITE_URL}${path}`,
        inLanguage: 'en',
        isPartOf: { '@id': WEBSITE_ID },
        mainEntityOfPage: { '@id': `${SITE_URL}${path}#webpage` },
        author: { '@id': ORGANIZATION_ID },
        publisher: { '@id': ORGANIZATION_ID },
        license: 'https://opensource.org/licenses/MIT',
        about: [
          'Svelte 5 web components',
          'Kotlin Multiplatform renderer',
          'agent catalog contract',
        ],
      },
    ],
  };
}

/**
 * The WebAPI graph of /developers/ (PLAN_011 T-ar-api): the read-only JSON
 * API and the MCP server, their machine-readable description (the OpenAPI
 * document) and the provider. Facts only: the URLs are built paths.
 */
export function webApiJsonLd(description: string) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebAPI',
        name: 'Texuli public API',
        description,
        url: `${SITE_URL}/developers/`,
        documentation: `${SITE_URL}/openapi.json`,
        termsOfService: 'https://opensource.org/licenses/MIT',
        license: 'https://opensource.org/licenses/MIT',
        isAccessibleForFree: true,
        inLanguage: 'en',
        provider: { '@id': ORGANIZATION_ID },
        isPartOf: { '@id': WEBSITE_ID },
        mainEntityOfPage: { '@id': `${SITE_URL}/developers/#webpage` },
        potentialAction: {
          '@type': 'ConsumeAction',
          target: [
            { '@type': 'EntryPoint', urlTemplate: `${SITE_URL}/api/index.json` },
            { '@type': 'EntryPoint', urlTemplate: `${SITE_URL}/mcp`, httpMethod: 'POST' },
          ],
        },
      },
    ],
  };
}

type JsonLdNode = Record<string, unknown>;

/**
 * The site graph every page carries (PLAN_014 T-seo): the owner
 * organization, the website with its search action, and this page as a
 * WebPage that is part of the website. A page's own graph (`jsonLd` on
 * BaseLayout) is merged into the same block; its Organization and WebSite
 * nodes are dropped there, since these two carry the canonical ones.
 */
export function siteJsonLd(
  url: string,
  name: string,
  description: string,
  page?: Record<string, unknown>
): { '@context': string; '@graph': JsonLdNode[] } {
  const own = ((page?.['@graph'] as JsonLdNode[] | undefined) ?? (page ? [page] : []))
    .filter((node) => node['@type'] !== 'Organization' && node['@type'] !== 'WebSite')
    .map(({ '@context': _context, ...node }) => node);
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': ORGANIZATION_ID,
        name: 'Dailybot, Inc.',
        url: 'https://dailybot.com/',
      },
      {
        '@type': 'WebSite',
        '@id': WEBSITE_ID,
        name: SITE_NAME,
        url: `${SITE_URL}/`,
        inLanguage: 'en',
        publisher: { '@id': ORGANIZATION_ID },
        potentialAction: {
          '@type': 'SearchAction',
          target: {
            '@type': 'EntryPoint',
            urlTemplate: `${SITE_URL}/search/?q={search_term_string}`,
          },
          'query-input': 'required name=search_term_string',
        },
      },
      {
        '@type': 'WebPage',
        '@id': `${url}#webpage`,
        url,
        name,
        description,
        inLanguage: 'en',
        isPartOf: { '@id': WEBSITE_ID },
      },
      ...own,
    ],
  };
}
