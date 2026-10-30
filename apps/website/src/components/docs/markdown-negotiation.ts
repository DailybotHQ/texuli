/**
 * Markdown-twin URL negotiation (T-23; every page since PLAN_011
 * T-ar-twins): the pure half of content negotiation. The build emits a
 * `.md` twin beside every page's HTML (`integration.ts`); the middleware
 * (`functions/_middleware.ts`, through `src/lib/md-negotiate.ts`) serves it
 * on `Accept: text/markdown` with exactly these functions.
 */

/** Paths that are never pages: APIs, discovery files, the MCP, build assets. */
const NOT_PAGES = /^\/(?:api\/|\.well-known\/|mcp(?:\/|$)|_astro\/)/;

/**
 * The twin URL for a page path (PLAN_011 T-ar-twins: every page has one):
 * `/` and `/index.html` → `/index.md`, `/guides/theming/` (or its
 * `index.html`, or `/guides/theming` without the slash) →
 * `/guides/theming.md`. `undefined` for anything that is not a page path: a
 * file with an extension (`.md`, `.json`, `.css`…), an API, discovery or MCP
 * path, or a malformed one. Whether the twin exists is the build's answer
 * (the middleware falls through when the asset is missing).
 */
export function markdownTwinFor(pathname: string): string | undefined {
  if (!pathname.startsWith('/') || pathname.startsWith('//') || NOT_PAGES.test(pathname))
    return undefined;
  if (pathname.includes('/../') || pathname.endsWith('/..')) return undefined;
  const page = pathname.endsWith('/index.html')
    ? pathname.slice(0, -'index.html'.length)
    : pathname;
  if (page === '/') return '/index.md';
  if (page.endsWith('/')) return page.length > 2 ? `${page.slice(0, -1)}.md` : undefined;
  const last = page.slice(page.lastIndexOf('/') + 1);
  return last && !last.includes('.') ? `${page}.md` : undefined;
}

/**
 * Whether the request explicitly asks for Markdown. Only an explicit
 * `text/markdown` entry negotiates — a wildcard Accept or `text/html` gets
 * the HTML page, so a browser never receives a raw twin by accident. An
 * entry weighted `q=0` means "not acceptable" (RFC 9110 §12.4.2) and is
 * ignored.
 */
export function prefersMarkdown(accept: string | null | undefined): boolean {
  if (!accept) return false;
  return accept.split(',').some((part) => {
    const [type = '', ...params] = part.split(';');
    if (type.trim().toLowerCase() !== 'text/markdown') return false;
    const weight = params
      .map((param) => param.split('='))
      .find(([name]) => name?.trim().toLowerCase() === 'q')?.[1];
    return weight === undefined || Number(weight.trim()) > 0;
  });
}
