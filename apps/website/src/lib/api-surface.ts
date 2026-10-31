/**
 * The public JSON API of texuli.com (PLAN_011 T-ar-api): the one typed
 * source for its resources, version, limits, error model and static
 * headers. Pure: no file system, no network, no clock, no
 * `import.meta.env`, so the edge middleware (`functions/_middleware.ts`
 * through `functions/_lib/api-endpoint.ts`), the build integration
 * (`src/integrations/api-surface.ts`), the OpenAPI generator
 * (`src/lib/openapi.ts`) and the /developers/ page all read the same facts.
 *
 * texuli.com is static: every resource is a file the build writes. The
 * files the site's own pages fetch keep their paths (`/theme-catalog.json`
 * …), and the build writes `/api/index.json` and `/api/health.json`. The
 * versioned `/api/v1/` paths are not files: the middleware, which answers
 * every `/api/` request on Cloudflare Pages, maps each one to its source
 * file ({@link aliasSource}) and reads it from `env.ASSETS`, then adds
 * `X-API-Version` and the rate-limit fields, enforces the limit and
 * answers misses with RFC 9457 problem details. Without Functions only the
 * static files exist, with the `_headers` rule from {@link apiHeaderRules}.
 */

/**
 * The release line that builds these files. Every `/api/` response carries
 * it in `X-API-Version`, and the OpenAPI `info.version` is the same string.
 * A plain constant because the edge middleware cannot import the operations
 * registry; `apps/website/tests/site-api.test.ts` fails when it drifts from
 * `TOOLS_VERSION` in `@texuli/tools/ops`.
 */
export const API_VERSION = '0.11.1';

/**
 * Where the API stands in the release line (docs/RELEASE.md). One switch:
 * the release task of 0.9.0 flipped it to `released` for the merge that
 * published 0.9.0 and deployed texuli.com from main, and the release task
 * of 0.10.0 names the release the API version ships in (0.11.1 since the
 * 0.11.1 release); the index, health
 * file, OpenAPI document and portal follow.
 */
export const API_RELEASE_STATUS = Object.freeze({
  state: 'released' as 'in-development' | 'released',
  note: 'Released in 0.11.1 (first released in 0.9.0): published on npm and served by texuli.com, deployed from main.',
});

/** The path prefix of the current API major version. */
export const API_PREFIX = '/api/v1';

/** The developer portal; problem `type` URLs point at its anchors. */
export const API_DOCS_PATH = '/developers/';

/** Every fixed path of the API surface. */
export const API_PATHS = Object.freeze({
  index: '/api/index.json',
  health: '/api/health.json',
  openapi: '/openapi.json',
  mcp: '/mcp',
  docs: API_DOCS_PATH,
} as const);

/**
 * 300 requests per client per minute under `/api/`, bursts up to 300, per
 * isolate (the same token bucket as the remote MCP,
 * `functions/_lib/mcp-endpoint.ts`).
 */
export const API_RATE_LIMIT = Object.freeze({
  name: 'api',
  capacity: 300,
  windowSeconds: 60,
});

/** How long a client may cache an `/api/` file (seconds). */
export const API_CACHE_SECONDS = 300;

/** Where a resource comes from in the build. */
export type ApiResourceOrigin = 'site-file' | 'generated';

/** One JSON resource of the API: its site file and its `/api/v1/` alias. */
export interface ApiResource {
  /** Stable key, also the anchor on /developers/. */
  key: string;
  title: string;
  /** One sentence: what the file holds and who fetches it. */
  summary: string;
  /** The unversioned path the build writes (`{id}` for a path parameter). */
  path: string;
  /** The versioned alias, the same bytes (served by the middleware, not a file). */
  alias: string;
  /** The operationId of the unversioned path; the alias appends `V1`. */
  operationId: string;
  /** The OpenAPI component schema of the body. */
  schema: string;
  /** The OpenAPI tag. */
  tag: 'api' | 'catalog' | 'themes' | 'twins';
  origin: ApiResourceOrigin;
  /** The path parameter, when `path` has one. */
  parameter?: { name: string; description: string };
}

const theme = { name: 'id', description: 'A library theme id, as listed by listThemes.' };

/**
 * Every resource, in the order the index, the OpenAPI document and the
 * portal list them. A new JSON file the site serves joins here: the
 * middleware serves it under `/api/v1/`, and the build describes it and
 * checks its source file is built.
 */
export const API_RESOURCES: readonly ApiResource[] = Object.freeze([
  {
    key: 'index',
    title: 'API index',
    summary:
      'The version, the limits, the deprecation policy and every endpoint with its operationId.',
    path: API_PATHS.index,
    alias: `${API_PREFIX}/index.json`,
    operationId: 'getApiIndex',
    schema: 'ApiIndex',
    tag: 'api',
    origin: 'generated',
  },
  {
    key: 'health',
    title: 'Health',
    summary:
      'A static file written by the build: status, release line and build time. It proves the build is served, not that a Function runs.',
    path: API_PATHS.health,
    alias: `${API_PREFIX}/health.json`,
    operationId: 'getHealth',
    schema: 'Health',
    tag: 'api',
    origin: 'generated',
  },
  {
    key: 'catalog',
    title: 'Component catalog',
    summary:
      'The agent catalog snapshot: every component manifest with props, examples, accessibility notes and the emit tiers that may place it.',
    path: '/catalog/catalog.json',
    alias: `${API_PREFIX}/catalog.json`,
    operationId: 'getCatalog',
    schema: 'Catalog',
    tag: 'catalog',
    origin: 'site-file',
  },
  {
    key: 'themes',
    title: 'Theme catalog',
    summary:
      'Every library theme: id, name, description, category, collection, tags and its light swatches.',
    path: '/theme-catalog.json',
    alias: `${API_PREFIX}/themes.json`,
    operationId: 'listThemes',
    schema: 'ThemeCatalog',
    tag: 'themes',
    origin: 'site-file',
  },
  {
    key: 'themes-dark',
    title: 'Dark swatches',
    summary: 'The dark-mode swatches of every theme that has a dark palette.',
    path: '/theme-catalog-dark.json',
    alias: `${API_PREFIX}/themes-dark.json`,
    operationId: 'listThemeDarkSwatches',
    schema: 'ThemeDarkSwatchList',
    tag: 'themes',
    origin: 'site-file',
  },
  {
    key: 'theme-gallery',
    title: 'Theme gallery cards',
    summary:
      'Every theme with its WCAG AA contrast summary per mode and the key colors of each mode.',
    path: '/theme-gallery.json',
    alias: `${API_PREFIX}/theme-gallery.json`,
    operationId: 'listThemeGalleryCards',
    schema: 'ThemeGalleryCardList',
    tag: 'themes',
    origin: 'site-file',
  },
  {
    key: 'theme',
    title: 'One theme',
    summary: "One theme's color explorer payload: its metadata and every color of each mode.",
    path: '/theme-data/{id}.json',
    alias: `${API_PREFIX}/themes/{id}.json`,
    operationId: 'getTheme',
    schema: 'ThemeData',
    tag: 'themes',
    origin: 'site-file',
    parameter: theme,
  },
  {
    key: 'twins',
    title: 'Markdown twins manifest',
    summary: 'Every page route mapped to its Markdown twin (the page URL plus .md).',
    path: '/md-manifest.json',
    alias: `${API_PREFIX}/twins.json`,
    operationId: 'getTwinsManifest',
    schema: 'TwinsManifest',
    tag: 'twins',
    origin: 'site-file',
  },
]);

/** The operationId of a resource's `/api/v1/` alias. */
export function aliasOperationId(resource: ApiResource): string {
  return `${resource.operationId}V1`;
}

/** Fill a resource path template: `/theme-data/{id}.json` + `ocean`. */
export function fillPath(template: string, value?: string): string {
  return value === undefined ? template : template.replace(/\{[a-z]+\}/, value);
}

/** A path parameter value: lowercase words joined by single hyphens. */
const PARAMETER_VALUE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * The built file an `/api/v1/` alias reads, or null when the path is not an
 * alias of any resource. The aliases are never written into `dist`: the
 * middleware maps each one to its source file and reads it from
 * `env.ASSETS` (the same deployment, not a network fetch). A path
 * parameter must be a plain id; anything else (dots, slashes, encoded
 * bytes, upper case) maps to nothing, so no alias can name another file.
 */
export function aliasSource(pathname: string): string | null {
  for (const resource of API_RESOURCES) {
    if (!resource.parameter) {
      if (pathname === resource.alias) return resource.path;
      continue;
    }
    const [before, after] = resource.alias.split(/\{[a-z]+\}/) as [string, string];
    if (!pathname.startsWith(before) || !pathname.endsWith(after)) continue;
    const value = pathname.slice(before.length, pathname.length - after.length);
    if (PARAMETER_VALUE.test(value)) return fillPath(resource.path, value);
  }
  return null;
}

/**
 * Paths under `/api/` that belong to another Pages Function: the
 * same-origin analytics proxy (`functions/api/umami/[[path]].ts`). The
 * API envelope never touches them.
 */
export const FUNCTION_API_PREFIXES: readonly string[] = Object.freeze(['/api/umami']);

/** Whether the middleware's API handler answers this path. */
export function isApiPath(pathname: string): boolean {
  if (pathname !== '/api' && !pathname.startsWith('/api/')) return false;
  return !FUNCTION_API_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

/**
 * The built file an `/api/` URL reads: `/api`, `/api/`, `/api/v1` and
 * `/api/v1/` are the index; an `/api/v1/` path is its alias's source file
 * ({@link aliasSource}), or null when it names no resource (answered 404
 * without touching the asset store); any other path is itself (the static
 * `/api/index.json` and `/api/health.json`).
 */
export function apiAssetPath(pathname: string): string | null {
  if (pathname === '/api' || pathname === '/api/') return API_PATHS.index;
  if (pathname === API_PREFIX || pathname === `${API_PREFIX}/`) return API_PATHS.index;
  if (pathname.startsWith(`${API_PREFIX}/`)) return aliasSource(pathname);
  return pathname;
}

// ---------------------------------------------------------------------------
// Errors (RFC 9457)

/** Stable, machine-readable error codes. Never renamed. */
export const API_ERROR_CODES = Object.freeze([
  'resource_not_found',
  'method_not_allowed',
  'rate_limited',
  'internal_error',
] as const);

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

/** An RFC 9457 problem plus an `error` object for agents that read `error.message`. */
export interface ApiProblem {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  error: {
    code: ApiErrorCode;
    message: string;
    hint: string;
    documentation_url: string;
  };
}

const TITLES: Record<ApiErrorCode, string> = {
  resource_not_found: 'Not Found',
  method_not_allowed: 'Method Not Allowed',
  rate_limited: 'Too Many Requests',
  internal_error: 'Internal Server Error',
};

const STATUS: Record<ApiErrorCode, number> = {
  resource_not_found: 404,
  method_not_allowed: 405,
  rate_limited: 429,
  internal_error: 500,
};

/** The longest client path a problem echoes. */
const INSTANCE_MAX = 200;

/**
 * The client's path as a problem `instance`: control characters removed,
 * capped. It is the client's own input, so it is never interpreted.
 */
export function problemInstance(pathname: string): string {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: removing them is the point.
  const clean = pathname.replace(/[\u0000-\u001f\u007f]/g, '');
  return clean.length > INSTANCE_MAX ? `${clean.slice(0, INSTANCE_MAX)}…` : clean;
}

/** The problem body for one failed `/api/` request. */
export function apiProblem(code: ApiErrorCode, pathname: string, origin: string): ApiProblem {
  const docs = new URL(API_DOCS_PATH, origin).href;
  const index = new URL(`${API_PREFIX}/index.json`, origin).href;
  const openapi = new URL(API_PATHS.openapi, origin).href;
  const instance = problemInstance(pathname);
  const message: Record<ApiErrorCode, string> = {
    resource_not_found: `No API resource exists at ${instance}.`,
    method_not_allowed: `${instance} is read-only: it accepts GET, HEAD and OPTIONS.`,
    rate_limited: `Too many requests to ${instance}. The limit is in the RateLimit-Policy header.`,
    internal_error: `The request for ${instance} could not be completed.`,
  };
  const hint: Record<ApiErrorCode, string> = {
    resource_not_found: `Fetch ${index} for every endpoint, or ${openapi} for the OpenAPI description. Endpoint paths end in ".json".`,
    method_not_allowed: 'Retry the same URL with GET.',
    rate_limited: `Wait the number of seconds in the Retry-After header, then retry; see ${docs}#limits.`,
    internal_error: `Retry in a few seconds; if it keeps failing, see ${docs}.`,
  };
  return {
    type: `${docs}#errors`,
    title: TITLES[code],
    status: STATUS[code],
    detail: message[code],
    instance,
    error: { code, message: message[code], hint: hint[code], documentation_url: docs },
  };
}

// ---------------------------------------------------------------------------
// Headers

/** The response headers a browser script may read on an `/api/` answer. */
export const API_EXPOSE_HEADERS =
  'X-API-Version, RateLimit, RateLimit-Policy, Retry-After, Deprecation, Sunset, ETag';

/** The headers every `/api/` file carries, whatever serves it. */
export function apiStaticHeaders(): Record<string, string> {
  return {
    'X-API-Version': API_VERSION,
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Expose-Headers': API_EXPOSE_HEADERS,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': `public, max-age=${API_CACHE_SECONDS}, must-revalidate`,
  };
}

/**
 * The `_headers` rules of the API surface: one rule for every file under
 * `/api/` (Cloudflare Pages applies them to static asset responses only, so
 * they matter when no Function answers) and one for `/openapi.json`.
 * Rate-limit fields, `429` and problem details need the middleware: a
 * static rule cannot count requests or change a status.
 */
export function apiHeaderRules(): string[] {
  const lines = (headers: Record<string, string>) =>
    Object.entries(headers)
      .map(([name, value]) => `\n  ${name}: ${value}`)
      .join('');
  return [
    `/api/*${lines(apiStaticHeaders())}`,
    `${API_PATHS.openapi}${lines({
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': `public, max-age=${API_CACHE_SECONDS}, must-revalidate`,
    })}`,
  ];
}

// ---------------------------------------------------------------------------
// Versioning

/** The versioning and deprecation policy, as the index, OpenAPI and portal state it. */
export const API_VERSIONING = Object.freeze({
  current: API_VERSION,
  prefix: `${API_PREFIX}/`,
  header: 'X-API-Version',
  policy:
    'Paths under /api/v1/ only change additively: new endpoints and new optional fields. A breaking change ships under /api/v2/, and /api/v1/ keeps serving for at least one release line (0.x minor) after that, with Deprecation (RFC 9745) and Sunset (RFC 8594) headers on every affected response. The unversioned paths are the files the site itself fetches: they follow the site and may change in any release, so pin /api/v1/.',
  deprecationHeaders: ['Deprecation', 'Sunset'],
});
