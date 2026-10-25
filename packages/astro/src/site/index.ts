import { type Block, type FieldIssue, safeParseBlocks } from '@texuli/blocks/core';
import { safeHref } from '@texuli/core/url-policy';

/**
 * The site kind identifier that Protoyard static-site exports declare. A
 * `defineSite` input may carry it to fail fast when a future revision of the
 * contract changes shape; today only this revision exists.
 */
export const SITE_KIND = 'texuli.site/v1';

export interface TexuliSitePageInput {
  /** kebab-case path segment; the home page's slug is ignored in favor of `home`. */
  slug: string;
  title: string;
  description?: string;
  /** ISO calendar date (YYYY-MM-DD) emitted as the sitemap `lastmod` when set. */
  updated?: string;
  /** Navigation label; a page with one joins `site.navigation` in declared order. */
  nav?: string;
  /** Marks the site's home page; exactly one page per site sets it. */
  home?: boolean;
  /** Page content validated against the closed Texuli block schema. */
  blocks?: unknown;
}

export interface TexuliSiteInput {
  /** Contract discriminator; when present it must be `texuli.site/v1`. */
  kind?: string;
  name: string;
  /** Deployed origin plus optional base path, without a trailing slash. */
  url: string;
  /** BCP 47-ish document language; defaults to `en`. */
  lang?: string;
  pages: TexuliSitePageInput[];
}

export interface TexuliSitePage {
  slug: string;
  /** Root path for the home page, otherwise `/${slug}`. */
  path: string;
  title: string;
  description?: string;
  updated?: string;
  nav?: string;
  home: boolean;
  /** Absolute same-origin URL built from the site base. */
  href: string;
  blocks: Block[];
}

export interface TexuliSiteNavEntry {
  slug: string;
  label: string;
  href: string;
}

export interface TexuliSite {
  name: string;
  url: string;
  lang: string;
  pages: TexuliSitePage[];
  navigation: TexuliSiteNavEntry[];
}

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const LANG_PATTERN = /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/;

function fail(message: string): never {
  throw new TypeError(`Invalid Texuli site: ${message}`);
}

function text(value: unknown, field: string, max: number): string {
  if (typeof value !== 'string' || value.trim() === '')
    fail(`${field} must be a non-empty string.`);
  const trimmed = value.trim();
  if (trimmed.length > max) fail(`${field} must be at most ${max} characters.`);
  return trimmed;
}

function optionalText(value: unknown, field: string, max: number): string | undefined {
  if (value === undefined) return undefined;
  return text(value, field, max);
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function normalizeBaseUrl(value: unknown): string {
  const raw = text(value, 'url', 2048);
  // Site definitions are developer-authored, so the developer tier applies;
  // the scheme check below still narrows to deployable http(s) origins.
  const safe = safeHref(raw, 'developer');
  if (safe === undefined) fail('url must be a safe http(s) URL.');
  let parsed: URL;
  try {
    parsed = new URL(safe);
  } catch {
    fail('url must be an absolute http(s) URL.');
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    fail('url must use the https or http scheme.');
  }
  if (parsed.search !== '') fail('url must not carry a query string.');
  if (parsed.hash !== '') fail('url must not carry a fragment.');
  const base = `${parsed.origin}${parsed.pathname.replace(/\/+$/, '')}`;
  return base;
}

function joinHref(base: string, path: string): string {
  return path === '/' ? `${base}/` : `${base}${path}`;
}

function validateBlocks(slug: string, value: unknown): Block[] {
  const parsed = safeParseBlocks(value);
  if (parsed.success) return parsed.data;
  const summarize = (issue: FieldIssue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`;
  const listed = parsed.issues.slice(0, 8).map(summarize).join('; ');
  const more = parsed.issues.length > 8 ? ` (+${parsed.issues.length - 8} more)` : '';
  fail(`page "${slug}" has invalid blocks — ${listed}${more}`);
}

function validatePage(
  input: TexuliSitePageInput,
  base: string,
  seenSlugs: Set<string>
): TexuliSitePage {
  if (typeof input !== 'object' || input === null) fail('every page must be an object.');
  const slug = text(input.slug, 'page slug', 100);
  if (!SLUG_PATTERN.test(slug)) {
    fail(`page slug "${slug}" must be lowercase kebab-case (a-z, 0-9, dashes).`);
  }
  if (seenSlugs.has(slug)) fail(`page slug "${slug}" is duplicated.`);
  seenSlugs.add(slug);

  const title = text(input.title, `page "${slug}" title`, 200);
  const description = optionalText(input.description, `page "${slug}" description`, 300);
  const nav = optionalText(input.nav, `page "${slug}" nav label`, 120);
  let updated: string | undefined;
  if (input.updated !== undefined) {
    updated = text(input.updated, `page "${slug}" updated`, 10);
    if (!DATE_PATTERN.test(updated) || Number.isNaN(Date.parse(`${updated}T00:00:00Z`))) {
      fail(`page "${slug}" updated must be an ISO calendar date (YYYY-MM-DD).`);
    }
  }
  const home = input.home === true;
  const path = home ? '/' : `/${slug}`;
  return Object.freeze({
    slug,
    path,
    title,
    ...(description === undefined ? {} : { description }),
    ...(updated === undefined ? {} : { updated }),
    ...(nav === undefined ? {} : { nav }),
    home,
    href: joinHref(base, path),
    blocks: validateBlocks(slug, input.blocks ?? []),
  });
}

function deepFreezeSite(site: TexuliSite): TexuliSite {
  for (const page of site.pages) Object.freeze(page);
  Object.freeze(site.pages);
  Object.freeze(site.navigation);
  return Object.freeze(site);
}

/**
 * Validate a static-site definition and return the frozen, normalized model
 * that Protoyard `site` exports hand to the layouts, navigation and sitemap
 * helpers. Throws a `TypeError` naming the offending field when any part of
 * the closed schema fails: one home page, unique lowercase kebab-case slugs,
 * an http(s) base URL without query or fragment, and page content that
 * passes the closed Texuli block schema. Blocks are validated but never
 * rendered here; painting them stays with the host's sink-free renderer.
 */
export function defineSite(input: TexuliSiteInput): TexuliSite {
  if (typeof input !== 'object' || input === null) fail('the site definition must be an object.');
  if (input.kind !== undefined && input.kind !== SITE_KIND) {
    fail(`kind must be "${SITE_KIND}" when present.`);
  }
  const name = text(input.name, 'name', 120);
  const base = normalizeBaseUrl(input.url);
  const lang = input.lang === undefined ? 'en' : text(input.lang, 'lang', 35);
  if (!LANG_PATTERN.test(lang)) fail('lang must be a base language tag with optional subtags.');
  if (!Array.isArray(input.pages)) fail('pages must be an array.');
  if (input.pages.length === 0) fail('a site needs at least one page.');

  const seenSlugs = new Set<string>();
  const pages = input.pages.map((page) => validatePage(page, base, seenSlugs));
  const homes = pages.filter((page) => page.home);
  if (homes.length === 0) fail('exactly one page must set home: true.');
  if (homes.length > 1) fail('only one page may set home: true.');

  const navigation = pages
    .filter((page): page is TexuliSitePage & { nav: string } => page.nav !== undefined)
    .map((page) => Object.freeze({ slug: page.slug, label: page.nav, href: page.href }));

  return deepFreezeSite({ name, url: base, lang, pages, navigation });
}

/** Return the site's page for a slug, or `undefined` when absent. */
export function sitePage(site: TexuliSite, slug: string): TexuliSitePage | undefined {
  return site.pages.find((page) => page.slug === slug);
}

/**
 * Metadata for a page as ContentLayout props: the home page titles as the
 * site name, others as `page title — site name`; the canonical is the
 * page's absolute URL.
 */
export function sitePageMeta(
  site: TexuliSite,
  slug: string
): { title: string; description?: string; canonical: string; lang: string } | undefined {
  const page = sitePage(site, slug);
  if (page === undefined) return undefined;
  return {
    title: page.home ? site.name : `${page.title} — ${site.name}`,
    ...(page.description === undefined ? {} : { description: page.description }),
    canonical: page.href,
    lang: site.lang,
  };
}

/**
 * Deterministic sitemap XML for the site: one entry per page in declared
 * order, with `lastmod` only for pages that declare an `updated` date. The
 * result is data for a `sitemap.xml` endpoint, never HTML.
 */
export function siteSitemap(site: TexuliSite): string {
  const entries = site.pages
    .map((page) => {
      const lastmod = page.updated === undefined ? '' : `    <lastmod>${page.updated}</lastmod>\n`;
      return `  <url>\n    <loc>${xmlEscape(page.href)}</loc>\n${lastmod}  </url>`;
    })
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`;
}
