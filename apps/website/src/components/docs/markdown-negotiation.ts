/**
 * Markdown-twin URL negotiation (T-23): the pure half of content
 * negotiation. The build emits a `.md` twin beside every docs page's HTML
 * (`integration.ts`); the request-time wrapper that serves it on
 * `Accept: text/markdown` lands with the middleware slice (T-26), which
 * imports exactly these functions.
 */

/**
 * The twin URL for a docs page (`/guides/theming/` → `/guides/theming.md`),
 * or `undefined` for anything that has no twin: the root (a landing, not a
 * docs page) and non-directory paths.
 */
export function markdownTwinFor(pathname: string): string | undefined {
  if (pathname === '/' || !pathname.startsWith('/') || !pathname.endsWith('/')) return undefined;
  return `${pathname.slice(0, -1)}.md`;
}

/**
 * Whether the request explicitly asks for Markdown. Only an explicit
 * `text/markdown` entry negotiates — a wildcard Accept or `text/html` gets
 * the HTML page, so a browser never receives a raw twin by accident.
 */
export function prefersMarkdown(accept: string | null | undefined): boolean {
  if (!accept) return false;
  return accept
    .split(',')
    .some((part) => (part.trim().split(';')[0] ?? '').trim() === 'text/markdown');
}
