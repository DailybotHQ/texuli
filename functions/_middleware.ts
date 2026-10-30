/**
 * Cloudflare Pages middleware (T-26, T-27, T-28, T-37): request shaping
 * for agents plus server-side analytics for automated consumers. A
 * request that explicitly prefers `text/markdown` gets the page's static
 * twin from the build output (`/index.md` for `/`, `/guides/theming.md`
 * beside `/guides/theming/`; every page has one since PLAN_011 T-ar-twins),
 * and a `.md` URL is served as `text/markdown; charset=utf-8`; a
 * non-browser client that misses gets a Markdown 404 body (RFC 9457
 * `application/problem+json` under `/api/` and for JSON clients) instead of
 * the HTML 404; a strict-parser
 * auditing tool (Lighthouse family) gets the stripped robots variant;
 * counted bot page hits and served twins emit UA-class + path events
 * through the same-origin Umami proxy via waitUntil (never blocking the
 * response, silent unless `PUBLIC_UMAMI_WEBSITE_ID` is provisioned).
 * Every decision is pure and lives in the website's lib — this file only
 * fetches assets and shapes responses. No secrets, no PII, no request
 * bodies are read or logged. `/.well-known/mcp` is routed to the remote MCP
 * server (functions/_lib/mcp-server.ts), and `/mcp` passes straight to its
 * Function (T-mcp-remote).
 */

import { prefersMarkdown } from '../apps/website/src/components/docs/markdown-negotiation.ts';
import {
  discoveryLinks,
  formatLinkHeader,
} from '../apps/website/src/components/seo/agent-discovery.ts';
import { agentProblem, isAgentRequest } from '../apps/website/src/lib/agent-request.ts';
import {
  type BotEventName,
  botEventFor,
  buildBotEventBody,
  buildBotEventRequest,
} from '../apps/website/src/lib/bot-events.ts';
import {
  isDirectMarkdownPath,
  MARKDOWN_CONTENT_TYPE,
  markdownNotFound,
  negotiateTwin,
  prefersProblemJson,
} from '../apps/website/src/lib/md-negotiate.ts';
import {
  isStrictParserAudit,
  stripDirectivesForStrictParsers,
} from '../apps/website/src/lib/robots-variants.ts';

/** The pieces of the Pages environment this middleware touches. */
interface Env {
  ASSETS: { fetch: (request: Request) => Promise<Response> };
  PUBLIC_UMAMI_WEBSITE_ID?: string;
}

/** The pieces of the Pages function context this middleware touches. */
interface Context {
  request: Request;
  next: (input?: Request | string, init?: RequestInit) => Promise<Response>;
  env: Env;
  waitUntil?: (promise: Promise<unknown>) => void;
}

/** Fire-and-forget: queue the send when waitUntil exists, drop otherwise. */
function sendBotEvent(context: Context, event: BotEventName, pathname: string): void {
  const url = new URL(context.request.url);
  const body = buildBotEventBody(
    event,
    pathname,
    context.env.PUBLIC_UMAMI_WEBSITE_ID,
    url.hostname
  );
  if (!body) return;
  const send = fetch(buildBotEventRequest(body, url.origin)).then(
    () => undefined,
    () => undefined
  );
  if (context.waitUntil) context.waitUntil(send);
}

/**
 * The discovery `Link` value of a Markdown twin this middleware builds:
 * `_headers` never applies to a Function response (SECURITY S-2), so the
 * twin carries the same targets as its HTML page, minus `service-desc`
 * (only the build knows whether `/openapi.json` exists; the API catalog
 * names it) and minus the twin itself.
 */
const TWIN_LINK = formatLinkHeader(discoveryLinks({ openapi: false }));

/** The well-known alias of the remote MCP endpoint (`/mcp` is functions/mcp.ts). */
const MCP_WELL_KNOWN = '/.well-known/mcp';

export const onRequest = async (context: Context): Promise<Response> => {
  const url = new URL(context.request.url);
  // The remote MCP: `/.well-known/mcp` is answered here by the same server
  // as `/mcp`, loaded on first use; `/mcp` goes untouched to its Function,
  // so no twin, robots or 404 shaping ever rewrites a JSON-RPC answer.
  if (url.pathname === MCP_WELL_KNOWN) {
    const { serveMcp } = await import('./_lib/mcp-server.ts');
    return serveMcp(context);
  }
  if (url.pathname === '/mcp') return context.next();
  const userAgent = context.request.headers.get('user-agent');
  // Auditing tools see the stripped robots variant (one text file, no other
  // change): the full policy stays the default for every real crawler.
  if (url.pathname === '/robots.txt' && isStrictParserAudit(userAgent)) {
    const asset = new URL(context.request.url);
    asset.pathname = '/robots.txt';
    const response = await context.env.ASSETS.fetch(new Request(asset));
    if (response.ok) {
      const policy = await response.text();
      return new Response(`${stripDirectivesForStrictParsers(policy)}\n`, {
        status: 200,
        headers: { 'content-type': 'text/plain; charset=utf-8' },
      });
    }
  }
  const accept = context.request.headers.get('accept');
  const decision = negotiateTwin(url.pathname, accept);
  if (decision) {
    const asset = new URL(context.request.url);
    asset.pathname = decision.twin;
    asset.search = '';
    const response = await context.env.ASSETS.fetch(new Request(asset));
    // A twin that was not built falls through to the normal pipeline (the
    // site's own 404), never to a fabricated body.
    if (response.ok) {
      // Markdown twins are served to markdown-preferring consumers; the
      // fetch itself is the event, whatever fetched it.
      const twinEvent = botEventFor(userAgent, true);
      if (twinEvent) sendBotEvent(context, twinEvent, url.pathname);
      return new Response(response.body, {
        status: 200,
        headers: { ...decision.headers, link: TWIN_LINK },
      });
    }
  }
  const response = await context.next();
  const status = response.status;
  // A Markdown file asked for by its URL (`/index.md`, `/guides/theming.md`):
  // counted like a negotiated twin, and always labelled `text/markdown` with
  // UTF-8, whatever type the static host guessed for `.md` (PLAN_011
  // T-ar-twins). Only a 200 is rebuilt; misses and 304s pass through.
  if (status === 200 && isDirectMarkdownPath(url.pathname)) {
    const markdownEvent = botEventFor(userAgent, true);
    if (markdownEvent) sendBotEvent(context, markdownEvent, url.pathname);
    const headers = new Headers(response.headers);
    headers.set('content-type', MARKDOWN_CONTENT_TYPE);
    headers.set('x-content-type-options', 'nosniff');
    if (!headers.has('link')) headers.set('link', TWIN_LINK);
    return new Response(response.body, { status: 200, headers });
  }
  // Bot page hits count by class; only real HTML pages answered 200 — never
  // assets, redirects, errors or the HTML 404 (whose path the client chose).
  const pageEvent = botEventFor(userAgent, false);
  if (
    pageEvent &&
    status === 200 &&
    (response.headers.get('content-type') ?? '').includes('text/html')
  ) {
    sendBotEvent(context, pageEvent, url.pathname);
  }
  // A miss for a non-browser client (an agent user agent, or any request
  // that asks for Markdown): RFC 9457 problem JSON under /api/ and for JSON
  // clients, a Markdown body otherwise. Browsers and Lighthouse keep the
  // static 404.html.
  if (status === 404 && (isAgentRequest(userAgent) || prefersMarkdown(accept))) {
    if (prefersProblemJson(url.pathname, accept))
      return new Response(JSON.stringify(agentProblem(url.pathname, url.origin)), {
        status: 404,
        headers: { 'content-type': 'application/problem+json', vary: 'Accept' },
      });
    return new Response(markdownNotFound(url.pathname, url.origin), {
      status: 404,
      headers: {
        'content-type': MARKDOWN_CONTENT_TYPE,
        vary: 'Accept',
        'x-content-type-options': 'nosniff',
      },
    });
  }
  // Pass-through responses are returned as the very object the pipeline
  // gave: Cloudflare applies `_headers` (the page CSP, and `Vary: Accept` on
  // every page with a twin) only to that asset response, so a rebuilt copy
  // would drop them (PLAN_006 T-100 S-2).
  return response;
};
