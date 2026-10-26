/**
 * Cloudflare Pages middleware (T-26): markdown content negotiation. A
 * request that explicitly prefers `text/markdown` gets the docs page's
 * static twin from the build output (`/guides/theming.md` beside
 * `/guides/theming/`); every other request passes through untouched, so
 * browsers never see raw twins and no caching edge case appears. The
 * decision logic is pure and lives in the website's lib — this file only
 * fetches the asset and attaches the response headers. No secrets, no PII,
 * no request bodies are read or logged.
 */
import { negotiateTwin } from '../apps/website/src/lib/md-negotiate.ts';

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
  const decision = negotiateTwin(
    new URL(context.request.url).pathname,
    context.request.headers.get('accept')
  );
  if (!decision) return context.next();
  const asset = new URL(context.request.url);
  asset.pathname = decision.twin;
  const response = await context.env.ASSETS.fetch(new Request(asset));
  // A twin that was not built falls through to the normal pipeline (the
  // site's own 404), never to a fabricated body.
  if (!response.ok) return context.next();
  return new Response(response.body, { status: 200, headers: decision.headers });
};
