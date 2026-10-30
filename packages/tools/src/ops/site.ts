/**
 * The `site` runtime class (ADR-018, PLAN_011 T-ar-site-mcp): operations
 * that read the built texuli.com, served only by the remote MCP door. They
 * never fetch the network: the Pages Function passes its `env.ASSETS`
 * binding as `context.site.assets`, and every read is one asset request for
 * a path this module chose:
 *
 * - `/md-manifest.json`, the twin manifest the website build writes (its
 *   `pages` list: path, twin, title, description and h2/h3 headings);
 * - a page's Markdown twin, at the twin path the manifest names. The caller's
 *   path only selects a manifest entry; it never reaches the fetcher.
 *
 * Local doors (stdio, the CLI) do not list these operations: they have no
 * built site to read, and an agent working locally reads the repository.
 */
import { defineOperation } from './registry.ts';
import {
  type Operation,
  type OperationContext,
  OperationError,
  type SiteContext,
} from './types.ts';

/** The twin manifest the website build writes beside the pages. */
export const SITE_MANIFEST_PATH = '/md-manifest.json';
/** The largest manifest this module parses (the real one is a few hundred KB). */
export const SITE_MANIFEST_MAX_BYTES = 4 * 1024 * 1024;
/** The largest Markdown `site.read` returns; a longer twin is cut at a line and flagged. */
export const SITE_READ_MAX_BYTES = 256 * 1024;
/** The origin page URLs are reported under when the door does not name one. */
export const SITE_DEFAULT_ORIGIN = 'https://texuli.com';

export const SITE_PAGES_DEFAULT_LIMIT = 50;
export const SITE_PAGES_MAX_LIMIT = 200;
export const SITE_PAGES_MAX_OFFSET = 10_000;
export const SITE_SEARCH_DEFAULT_LIMIT = 10;
export const SITE_SEARCH_MAX_LIMIT = 50;
/** Query words beyond this many are ignored. */
export const SITE_SEARCH_MAX_TERMS = 12;

const MAX_HEADINGS = 64;
const MAX_FIELD = 1024;
const PATH_CHARS = /^\/[A-Za-z0-9._~/-]*$/u;
const TWIN_PATH = /^\/(?:[A-Za-z0-9_~-][A-Za-z0-9._~-]*\/)*[A-Za-z0-9_~-][A-Za-z0-9._~-]*\.md$/u;

/** One page of the built site, as the manifest describes it. */
export interface SitePage {
  /** The page route (`/`, `/guides/theming/`). */
  path: string;
  /** Its Markdown twin (`/index.md`, `/guides/theming.md`). */
  twin: string;
  title: string;
  description: string;
  /** The twin's h2 and h3 headings, in order. */
  headings: readonly string[];
}

interface IndexedPage extends SitePage {
  titleLower: string;
  titleWords: ReadonlySet<string>;
  pathLower: string;
  pathWords: ReadonlySet<string>;
  descriptionLower: string;
  headingsLower: readonly string[];
  headingWords: ReadonlySet<string>;
}

interface SiteIndex {
  pages: readonly IndexedPage[];
  byPath: ReadonlyMap<string, IndexedPage>;
}

const words = (text: string): string[] =>
  text
    .toLowerCase()
    .split(/[^a-z0-9]+/u)
    .filter(Boolean);

const clip = (value: unknown): string =>
  typeof value === 'string' ? value.replace(/\s+/gu, ' ').trim().slice(0, MAX_FIELD) : '';

/** A safe route: starts with `/`, plain characters, no empty, `.` or `..` segment. */
function isSafeRoute(path: string): boolean {
  if (!PATH_CHARS.test(path) || path.includes('//')) return false;
  return path
    .split('/')
    .slice(1, path.endsWith('/') ? -1 : undefined)
    .every((segment) => segment !== '' && segment !== '.' && segment !== '..');
}

/**
 * The pages of a parsed `md-manifest.json`: entries with a safe route and a
 * twin path under the site root are kept, everything else is dropped. Pure.
 */
export function siteIndexPages(manifest: unknown): SitePage[] {
  if (typeof manifest !== 'object' || manifest === null) return [];
  const list = (manifest as { pages?: unknown }).pages;
  if (!Array.isArray(list)) return [];
  const pages: SitePage[] = [];
  const seen = new Set<string>();
  for (const entry of list) {
    if (typeof entry !== 'object' || entry === null) continue;
    const record = entry as Record<string, unknown>;
    const path = typeof record.path === 'string' ? record.path : '';
    const twin = typeof record.twin === 'string' ? record.twin : '';
    if (!path.endsWith('/') || !isSafeRoute(path) || seen.has(path)) continue;
    if (!TWIN_PATH.test(twin) || twin.split('/').some((segment) => segment === '..')) continue;
    const headings = Array.isArray(record.headings)
      ? record.headings.map(clip).filter(Boolean).slice(0, MAX_HEADINGS)
      : [];
    seen.add(path);
    pages.push({
      path,
      twin,
      title: clip(record.title) || path,
      description: clip(record.description),
      headings,
    });
  }
  return pages;
}

function indexPages(pages: readonly SitePage[]): SiteIndex {
  const indexed = pages.map((page) => {
    const headingsLower = page.headings.map((heading) => heading.toLowerCase());
    return {
      ...page,
      titleLower: page.title.toLowerCase(),
      titleWords: new Set(words(page.title)),
      pathLower: page.path.toLowerCase(),
      pathWords: new Set(words(page.path)),
      descriptionLower: page.description.toLowerCase(),
      headingsLower,
      headingWords: new Set(headingsLower.flatMap(words)),
    };
  });
  return { pages: indexed, byPath: new Map(indexed.map((page) => [page.path, page])) };
}

/** Read at most `max` bytes of a body; `over` is true when more followed. */
async function readCapped(
  response: Response,
  max: number
): Promise<{ bytes: Uint8Array; over: boolean }> {
  if (!response.body) {
    const all = new Uint8Array(await response.arrayBuffer());
    return { bytes: all.subarray(0, max), over: all.byteLength > max };
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  let over = false;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    const room = max - size;
    if (value.byteLength > room) {
      chunks.push(value.subarray(0, room));
      size += room;
      over = true;
      await reader.cancel().catch(() => undefined);
      break;
    }
    chunks.push(value);
    size += value.byteLength;
  }
  const bytes = new Uint8Array(size);
  let at = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, at);
    at += chunk.byteLength;
  }
  return { bytes, over };
}

function siteOf(context: OperationContext): SiteContext {
  if (!context.site)
    throw new OperationError(
      'runtime-unavailable',
      'This operation reads the built texuli.com and runs only on the remote MCP (https://texuli.com/mcp).'
    );
  return context.site;
}

function originOf(site: SiteContext): string {
  try {
    return new URL(site.origin ?? SITE_DEFAULT_ORIGIN).origin;
  } catch {
    return SITE_DEFAULT_ORIGIN;
  }
}

/** One asset request for a path this module chose (never caller text). */
function fetchAsset(site: SiteContext, path: string, signal: AbortSignal): Promise<Response> {
  return site.assets.fetch(new Request(new URL(path, originOf(site)), { signal }));
}

const indexes = new WeakMap<object, Promise<SiteIndex>>();

async function buildIndex(site: SiteContext, signal: AbortSignal): Promise<SiteIndex> {
  const response = await fetchAsset(site, SITE_MANIFEST_PATH, signal);
  if (!response.ok)
    throw new OperationError(
      'operation-failed',
      `The site index (${SITE_MANIFEST_PATH}) answered ${response.status}.`
    );
  const { bytes, over } = await readCapped(response, SITE_MANIFEST_MAX_BYTES);
  if (over)
    throw new OperationError(
      'operation-failed',
      `The site index is larger than ${SITE_MANIFEST_MAX_BYTES} bytes.`
    );
  let manifest: unknown;
  try {
    manifest = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    throw new OperationError('operation-failed', 'The site index is not valid JSON.');
  }
  const pages = siteIndexPages(manifest);
  if (pages.length === 0)
    throw new OperationError('operation-failed', 'The site index lists no pages.');
  return indexPages(pages);
}

/** The parsed manifest, once per assets binding (a failure is not cached). */
function loadIndex(site: SiteContext, signal: AbortSignal): Promise<SiteIndex> {
  const cached = indexes.get(site.assets);
  if (cached) return cached;
  const pending = buildIndex(site, signal);
  indexes.set(site.assets, pending);
  pending.catch(() => indexes.delete(site.assets));
  return pending;
}

export type SitePathResult =
  | { ok: true; route: string }
  | { ok: false; code: 'invalid-input'; message: string };

/**
 * The page route a caller's path names, or why it is refused. Accepts a
 * route (`/guides/theming/`), the same without the trailing slash, its twin
 * (`/guides/theming.md`, `/index.md`), `…/index.html`, or an absolute URL on
 * `origin` (query and fragment dropped). Refuses traversal (`..`, `.`,
 * encoded or backslashed forms), other hosts and anything outside plain path
 * characters. Pure.
 */
export function normalizeSitePath(
  raw: string,
  origin: string = SITE_DEFAULT_ORIGIN
): SitePathResult {
  const refuse = (message: string): SitePathResult => ({
    ok: false,
    code: 'invalid-input',
    message,
  });
  let path = raw.trim();
  if (/^[a-z][a-z0-9+.-]*:/iu.test(path)) {
    let url: URL;
    try {
      url = new URL(path);
    } catch {
      return refuse('The path is not a valid URL.');
    }
    const allowed = new Set([new URL(SITE_DEFAULT_ORIGIN).host, new URL(origin).host]);
    if ((url.protocol !== 'https:' && url.protocol !== 'http:') || !allowed.has(url.host))
      return refuse(`Only texuli.com pages can be read; pass a path such as /guides/theming/.`);
    path = url.pathname;
  } else {
    path = path.replace(/[?#].*$/su, '');
  }
  if (!path.startsWith('/')) return refuse('The path must start with "/", e.g. /guides/theming/.');
  if (/[\\%]/u.test(path))
    return refuse('The path has an escaped or backslashed character; pass a plain path.');
  if (path.split('/').some((segment) => segment === '..' || segment === '.'))
    return refuse('Path traversal ("." or ".." segments) is refused.');
  if (!isSafeRoute(path))
    return refuse('The path has characters or empty segments no texuli.com page uses.');
  let route = path;
  if (route.endsWith('/index.html')) route = route.slice(0, -'index.html'.length);
  else if (route === '/index.md') route = '/';
  else if (route.endsWith('.md')) route = `${route.slice(0, -3)}/`;
  if (!route.endsWith('/')) route = `${route}/`;
  return { ok: true, route };
}

/** The search terms of a query: lowercase words, deduplicated, at most {@link SITE_SEARCH_MAX_TERMS}. */
export function siteSearchTerms(query: string): string[] {
  return [...new Set(words(query))].slice(0, SITE_SEARCH_MAX_TERMS);
}

/** One ranked search hit. */
export interface SiteSearchHit {
  page: SitePage;
  score: number;
  /** How many query terms the page matched. */
  matched: number;
  /** Headings that matched, at most three. */
  headings: string[];
}

/**
 * Rank pages for a query, deterministically: pages that match more terms
 * first, then the higher score (title word 10, in title 6, path word 4, in
 * path 2, heading word 3, in a heading 2, in the description 2, and a phrase
 * bonus of 8 in the title or 4 in a heading), then the shorter path, then
 * the path. Pure.
 */
export function rankSitePages(pages: readonly SitePage[], query: string): SiteSearchHit[] {
  const terms = siteSearchTerms(query);
  if (terms.length === 0) return [];
  const indexed = indexPages(pages).pages;
  return rankIndexed(indexed, terms);
}

function rankIndexed(pages: readonly IndexedPage[], terms: readonly string[]): SiteSearchHit[] {
  const phrase = terms.length > 1 ? terms.join(' ') : undefined;
  const hits: SiteSearchHit[] = [];
  for (const page of pages) {
    let score = 0;
    let matched = 0;
    const headingHits = new Set<number>();
    for (const term of terms) {
      let termScore = 0;
      if (page.titleWords.has(term)) termScore += 10;
      else if (page.titleLower.includes(term)) termScore += 6;
      if (page.pathWords.has(term)) termScore += 4;
      else if (page.pathLower.includes(term)) termScore += 2;
      let inHeading = false;
      page.headingsLower.forEach((heading, index) => {
        if (heading.includes(term)) {
          inHeading = true;
          headingHits.add(index);
        }
      });
      if (page.headingWords.has(term)) termScore += 3;
      else if (inHeading) termScore += 2;
      if (page.descriptionLower.includes(term)) termScore += 2;
      if (termScore > 0) matched += 1;
      score += termScore;
    }
    if (matched === 0) continue;
    if (phrase) {
      if (page.titleLower.includes(phrase)) score += 8;
      if (page.headingsLower.some((heading) => heading.includes(phrase))) score += 4;
    }
    hits.push({
      page,
      score,
      matched,
      headings: [...headingHits]
        .sort((a, b) => a - b)
        .slice(0, 3)
        .map((index) => page.headings[index] as string),
    });
  }
  return hits.sort(
    (a, b) =>
      b.matched - a.matched ||
      b.score - a.score ||
      a.page.path.length - b.page.path.length ||
      (a.page.path < b.page.path ? -1 : a.page.path > b.page.path ? 1 : 0)
  );
}

/** Cut text to at most `max` UTF-8 bytes, on a character and, when possible, a line boundary. */
export function cutUtf8(bytes: Uint8Array, max: number): string {
  let end = Math.min(max, bytes.byteLength);
  while (end > 0 && end < bytes.byteLength && ((bytes[end] as number) & 0xc0) === 0x80) end -= 1;
  const text = new TextDecoder('utf-8').decode(bytes.subarray(0, end));
  const line = text.lastIndexOf('\n');
  return line > text.length / 2 ? text.slice(0, line + 1) : text;
}

const READ_ONLY = {
  readOnly: true,
  destructive: false,
  idempotent: true,
  openWorld: false,
} as const;

const pageSummarySchema = {
  type: 'object',
  properties: {
    path: { type: 'string' },
    twin: { type: 'string' },
    url: { type: 'string' },
    title: { type: 'string' },
    description: { type: 'string' },
  },
  required: ['path', 'twin', 'url', 'title', 'description'],
} as const;

const summary = (page: SitePage, origin: string) => ({
  path: page.path,
  twin: page.twin,
  url: `${origin}${page.path}`,
  title: page.title,
  description: page.description,
});

export const sitePages: Operation = defineOperation({
  name: 'site.pages',
  title: 'List texuli.com pages',
  summary:
    'List the pages of texuli.com from its Markdown twin manifest, in path order, optionally under a path prefix, a page at a time. Returns the total, the offset, the next offset when more follow, and each page’s path, twin path, URL, title and description.',
  input: {
    type: 'object',
    properties: {
      prefix: {
        type: 'string',
        maxLength: 200,
        pattern: '^/[A-Za-z0-9._~/-]*$',
        description:
          'Keep only pages whose path starts with this, e.g. "/guides/" or "/component-pages/".',
      },
      offset: {
        type: 'integer',
        minimum: 0,
        maximum: SITE_PAGES_MAX_OFFSET,
        default: 0,
        description: `How many pages to skip (0 to ${SITE_PAGES_MAX_OFFSET}); pass the previous answer's nextOffset.`,
      },
      limit: {
        type: 'integer',
        minimum: 1,
        maximum: SITE_PAGES_MAX_LIMIT,
        default: SITE_PAGES_DEFAULT_LIMIT,
        description: `How many pages to return (1 to ${SITE_PAGES_MAX_LIMIT}, default ${SITE_PAGES_DEFAULT_LIMIT}).`,
      },
    },
    additionalProperties: false,
  },
  output: {
    type: 'object',
    properties: {
      total: { type: 'integer', minimum: 0 },
      offset: { type: 'integer', minimum: 0 },
      limit: { type: 'integer', minimum: 1 },
      nextOffset: { type: 'integer', minimum: 1 },
      pages: { type: 'array', items: pageSummarySchema },
    },
    required: ['total', 'offset', 'limit', 'pages'],
  },
  annotations: READ_ONLY,
  runtime: 'site',
  limits: { inputBytes: 1024, items: SITE_PAGES_MAX_LIMIT, timeMs: 5000 },
  examples: [
    { title: 'The first guides', input: { prefix: '/guides/', limit: 5 } },
    { title: 'The second page of every page', input: { offset: 50, limit: 50 } },
  ],
  async handler(input, context) {
    const site = siteOf(context);
    const index = await loadIndex(site, context.signal);
    const prefix = typeof input.prefix === 'string' ? input.prefix : '';
    const offset = typeof input.offset === 'number' ? input.offset : 0;
    const limit = typeof input.limit === 'number' ? input.limit : SITE_PAGES_DEFAULT_LIMIT;
    const selected = index.pages
      .filter((page) => page.path.startsWith(prefix))
      .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
    const end = offset + limit;
    const origin = originOf(site);
    return {
      total: selected.length,
      offset,
      limit,
      ...(end < selected.length ? { nextOffset: end } : {}),
      pages: selected.slice(offset, end).map((page) => summary(page, origin)),
    };
  },
});

export const siteRead: Operation = defineOperation({
  name: 'site.read',
  title: 'Read a texuli.com page as Markdown',
  summary:
    'Read one texuli.com page as its Markdown twin: the page’s own content with a header block (title, description, canonical URL, last updated). Accepts a route, its .md twin path or a texuli.com URL. Returns the path, twin, URL, title, the Markdown, its size and whether it was cut at the size cap.',
  input: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        minLength: 1,
        maxLength: 512,
        description:
          'The page: a route such as "/guides/theming/" or "/", its twin "/guides/theming.md", or "https://texuli.com/guides/theming/". Find paths with site.pages or site.search.',
      },
    },
    required: ['path'],
    additionalProperties: false,
  },
  output: {
    type: 'object',
    properties: {
      path: { type: 'string' },
      twin: { type: 'string' },
      url: { type: 'string' },
      title: { type: 'string' },
      markdown: { type: 'string' },
      bytes: { type: 'integer', minimum: 0 },
      truncated: { type: 'boolean' },
    },
    required: ['path', 'twin', 'url', 'title', 'markdown', 'bytes', 'truncated'],
  },
  annotations: READ_ONLY,
  runtime: 'site',
  limits: { inputBytes: 1024, timeMs: 5000 },
  examples: [
    { title: 'The theming guide', input: { path: '/guides/theming/' } },
    { title: 'The home page by its twin path', input: { path: '/index.md' } },
  ],
  async handler(input, context) {
    const site = siteOf(context);
    const origin = originOf(site);
    const normalized = normalizeSitePath(String(input.path), origin);
    if (!normalized.ok) throw new OperationError(normalized.code, normalized.message);
    const index = await loadIndex(site, context.signal);
    const page = index.byPath.get(normalized.route);
    if (!page)
      throw new OperationError(
        'not-found',
        `No texuli.com page at ${normalized.route}. List pages with site.pages or find one with site.search.`
      );
    const response = await fetchAsset(site, page.twin, context.signal);
    if (!response.ok)
      throw new OperationError(
        'not-found',
        `The Markdown twin of ${page.path} answered ${response.status}.`
      );
    const { bytes, over } = await readCapped(response, SITE_READ_MAX_BYTES);
    const markdown = over ? cutUtf8(bytes, SITE_READ_MAX_BYTES) : new TextDecoder().decode(bytes);
    return {
      path: page.path,
      twin: page.twin,
      url: `${origin}${page.path}`,
      title: page.title,
      markdown,
      bytes: new TextEncoder().encode(markdown).byteLength,
      truncated: over,
    };
  },
});

export const siteSearch: Operation = defineOperation({
  name: 'site.search',
  title: 'Search texuli.com pages',
  summary:
    'Search texuli.com pages by words in their titles, headings, descriptions and paths, ranked deterministically (more matched words first, then title over path over heading over description). Returns the total and, per hit, the path, twin, URL, title, description, score and up to three matching headings.',
  input: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        minLength: 1,
        maxLength: 200,
        description: `Words to look for, e.g. "theming dark mode"; case-insensitive, at most ${SITE_SEARCH_MAX_TERMS} words are used.`,
      },
      limit: {
        type: 'integer',
        minimum: 1,
        maximum: SITE_SEARCH_MAX_LIMIT,
        default: SITE_SEARCH_DEFAULT_LIMIT,
        description: `How many hits to return (1 to ${SITE_SEARCH_MAX_LIMIT}, default ${SITE_SEARCH_DEFAULT_LIMIT}).`,
      },
    },
    required: ['query'],
    additionalProperties: false,
  },
  output: {
    type: 'object',
    properties: {
      query: { type: 'string' },
      total: { type: 'integer', minimum: 0 },
      limit: { type: 'integer', minimum: 1 },
      results: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            ...pageSummarySchema.properties,
            score: { type: 'integer', minimum: 1 },
            headings: { type: 'array', items: { type: 'string' } },
          },
          required: [...pageSummarySchema.required, 'score', 'headings'],
        },
      },
    },
    required: ['query', 'total', 'limit', 'results'],
  },
  annotations: READ_ONLY,
  runtime: 'site',
  limits: { inputBytes: 1024, items: SITE_SEARCH_MAX_LIMIT, timeMs: 5000 },
  examples: [
    { title: 'Pages about theming', input: { query: 'theming', limit: 5 } },
    { title: 'A two-word query', input: { query: 'dark mode' } },
  ],
  async handler(input, context) {
    const site = siteOf(context);
    const query = String(input.query);
    const terms = siteSearchTerms(query);
    if (terms.length === 0)
      throw new OperationError(
        'invalid-input',
        'The query has no letters or digits to search for.'
      );
    const limit = typeof input.limit === 'number' ? input.limit : SITE_SEARCH_DEFAULT_LIMIT;
    const index = await loadIndex(site, context.signal);
    const hits = rankIndexed(index.pages, terms);
    const origin = originOf(site);
    return {
      query,
      total: hits.length,
      limit,
      results: hits.slice(0, limit).map((hit) => ({
        ...summary(hit.page, origin),
        score: hit.score,
        headings: hit.headings,
      })),
    };
  },
});
