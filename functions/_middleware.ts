/**
 * Cloudflare Pages middleware (T-26, T-27, T-28): request shaping for
 * agents. A request that explicitly prefers `text/markdown` gets the docs
 * page's static twin from the build output (`/guides/theming.md` beside
 * `/guides/theming/`); an automated consumer that misses gets RFC 9457
 * `application/problem+json` instead of the HTML 404; a strict-parser
 * auditing tool (Lighthouse family) gets the stripped robots variant; every
 * other request passes through untouched, so browsers never see raw twins,
 * machine errors or a policy meant for crawlers. The decisions are pure and
 * live in the website's lib — this file only fetches assets and shapes
 * responses. No secrets, no PII, no request bodies are read or logged.
 */
import { agentProblem, isAgentRequest } from '../apps/website/src/lib/agent-request.ts';
import { negotiateTwin } from '../apps/website/src/lib/md-negotiate.ts';
import {
  isStrictParserAudit,
  stripDirectivesForStrictParsers,
} from '../apps/website/src/lib/robots-variants.ts';

/** The pieces of the Pages environment this middleware touches. */
interface Env {
  ASSETS: { fetch: (request: Request) => Promise<Response> };
}

/** The pieces of the Pages function context this middleware touches. */
interface Context {
  request: Request;
  next: (input?: Request | string, init?: RequestInit) => Promise<Response>;
  env: Env;
}

export const onRequest = async (context: Context): Promise<Response> => {
  const url = new URL(context.request.url);
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
  const decision = negotiateTwin(url.pathname, context.request.headers.get('accept'));
  if (decision) {
    const asset = new URL(context.request.url);
    asset.pathname = decision.twin;
    const response = await context.env.ASSETS.fetch(new Request(asset));
    // A twin that was not built falls through to the normal pipeline (the
    // site's own 404), never to a fabricated body.
    if (response.ok) return new Response(response.body, { status: 200, headers: decision.headers });
  }
  const response = await context.next();
  const status = response.status;
  if (status === 404 && isAgentRequest(userAgent)) {
    return new Response(JSON.stringify(agentProblem(url.pathname, url.origin)), {
      status: 404,
      headers: { 'content-type': 'application/problem+json' },
    });
  }
  return response;
};
