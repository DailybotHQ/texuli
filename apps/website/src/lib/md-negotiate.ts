/**
 * The middleware-facing decisions for Markdown content negotiation (T-26;
 * every page since PLAN_011 T-ar-twins): pure functions a Pages Functions
 * wrapper calls per request. They delegate to the T-23 pure helpers —
 * `prefersMarkdown` parses the Accept header and `markdownTwinFor` maps a
 * page path to its twin — so the site and the edge can never disagree about
 * what negotiates.
 */

import { markdownTwinFor, prefersMarkdown } from '../components/docs/markdown-negotiation.ts';

/** The content type every Markdown answer carries. */
export const MARKDOWN_CONTENT_TYPE = 'text/markdown; charset=utf-8';

/** What the middleware should serve for one request. */
export interface NegotiationDecision {
  /** The twin URL to fetch from assets (`/guides/theming.md`, `/index.md`). */
  twin: string;
  /** Headers every twin response carries. */
  headers: Record<string, string>;
}

/**
 * The twin decision for a request: a twin URL with its response headers
 * when the path is a page path (`/` included) and the request explicitly
 * prefers `text/markdown`, `null` otherwise (the wrapper passes the request
 * through untouched). A twin that was not built falls through at the edge.
 */
export function negotiateTwin(pathname: string, accept: string | null): NegotiationDecision | null {
  if (!prefersMarkdown(accept)) return null;
  const twin = markdownTwinFor(pathname);
  if (!twin) return null;
  return {
    twin,
    headers: {
      'content-type': MARKDOWN_CONTENT_TYPE,
      vary: 'Accept',
      'x-content-negotiation': 'markdown',
    },
  };
}

/** A direct request for a Markdown file (`/guides/theming.md`, `/index.md`). */
export function isDirectMarkdownPath(pathname: string): boolean {
  return pathname.startsWith('/') && !pathname.startsWith('//') && /\/[^/]+\.md$/i.test(pathname);
}

/**
 * Whether a miss answers with RFC 9457 problem JSON rather than Markdown:
 * API paths always, and clients that ask for JSON without asking for
 * Markdown.
 */
export function prefersProblemJson(pathname: string, accept: string | null): boolean {
  if (pathname.startsWith('/api/')) return true;
  if (prefersMarkdown(accept)) return false;
  return /\bapplication\/(?:problem\+)?json\b/i.test(accept ?? '');
}

/** The longest missed path a Markdown 404 echoes. */
const ECHO_MAX = 200;

/**
 * The Markdown body of a 404 for a non-browser client: the missed path (as
 * inert code, capped, with backticks and control characters removed) and
 * where to go instead. The path is the client's own input, so it is only
 * ever shown as code text.
 */
export function markdownNotFound(pathname: string, origin: string): string {
  const shown = pathname
    // biome-ignore lint/suspicious/noControlCharactersInRegex: stripping control characters is the point
    .replace(/[`\u0000-\u001f\u007f]/g, '')
    .slice(0, ECHO_MAX);
  return `# Not found

There is no page at \`${shown}\` on texuli.com (HTTP 404).

- [Site guide for agents (llms.txt)](${origin}/llms.txt): every area of the site, with links.
- [Sitemap](${origin}/sitemap.xml): every page.
- [Home page as Markdown](${origin}/index.md).
- [How agents access texuli.com](${origin}/auth.md): anonymous, read-only, and the MCP server at ${origin}/mcp.

Every texuli.com page has a Markdown twin at its URL plus \`.md\`, and any page URL answers \`Accept: text/markdown\` with its twin instead of HTML.
`;
}
