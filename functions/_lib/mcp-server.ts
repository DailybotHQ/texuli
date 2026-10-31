/**
 * The remote MCP server (T-mcp-remote, ADR-018): the isolate's handler,
 * limiter and counters, shared by `functions/mcp.ts` (`/mcp`) and the
 * middleware route for `/.well-known/mcp`, so both URLs are the same
 * server. `edge` and `site` operations are served: `node` operations (file
 * writes, PDF and DOCX conversion) are not listed and answer
 * `runtime-unavailable`. The `site` operations (`site.pages`, `site.read`,
 * `site.search`, T-ar-site-mcp) read the built site through this request's
 * `env.ASSETS` binding, never the network; without the binding they answer
 * `runtime-unavailable`.
 *
 * The handler is imported from the `@texuli/tools` source because the
 * package exports no `./mcp` subpath yet; switch to the package export when
 * it lands. `functions/` is not a workspace package, so the layer guard does
 * not apply here, and the website's own sources stay free of this import.
 */
import { buildBotEventRequest, buildMcpEventBody } from '../../apps/website/src/lib/bot-events.ts';
import { createMcpHandler, type McpHandler } from '../../packages/tools/src/mcp/handler.ts';
import { MCP_PROTOCOL_REVISIONS } from '../../packages/tools/src/mcp/protocol.ts';
import { REMOTE_RUNTIMES, type SiteAssets, texuliOps } from '../../packages/tools/src/ops/index.ts';
import {
  createTokenBucket,
  handleMcpHttp,
  MCP_RATE_POLICY,
  type McpEndpointDeps,
} from './mcp-endpoint.ts';

/** The pieces of the Pages function context the endpoint touches. */
export interface McpContext {
  request: Request;
  env: { PUBLIC_UMAMI_WEBSITE_ID?: string; ASSETS?: SiteAssets };
  waitUntil?: (promise: Promise<unknown>) => void;
}

const RUNTIMES = REMOTE_RUNTIMES;

/** Every tool name the remote handler serves: operations, then their 0.8 aliases. */
const servedNames = new Set(texuliOps.list({ runtimes: RUNTIMES }).map((op) => op.name));
for (const alias of texuliOps.aliases())
  if (alias.targets.every((target) => servedNames.has(target))) servedNames.add(alias.name);

/** One handler and one bucket per isolate; nothing else lives between requests. */
const handler: McpHandler = createMcpHandler({ mode: 'stateless', runtimes: RUNTIMES });
const deps: McpEndpointDeps = {
  handler,
  // Every revision, 2026-07-28 included: the handler checks that the header agrees with _meta.
  supportedVersions: MCP_PROTOCOL_REVISIONS,
  limiter: createTokenBucket(MCP_RATE_POLICY),
  knownOperations: servedNames,
};

/**
 * Answer one request. A request that reached the handler queues one
 * `mcp_call` counter (operation label, status, duration bucket) through the
 * same-origin analytics proxy via waitUntil, only when analytics is
 * provisioned; otherwise nothing leaves the Function.
 */
export async function serveMcp(context: McpContext): Promise<Response> {
  const assets = context.env.ASSETS;
  const site = assets ? { assets, origin: new URL(context.request.url).origin } : undefined;
  const { response, counter } = await handleMcpHttp(
    context.request,
    site ? { ...deps, handler: (message, request) => handler(message, { ...request, site }) } : deps
  );
  if (counter && context.waitUntil) {
    const url = new URL(context.request.url);
    const body = buildMcpEventBody(counter, context.env.PUBLIC_UMAMI_WEBSITE_ID, url.hostname);
    if (body) {
      context.waitUntil(
        fetch(buildBotEventRequest(body, url.origin)).then(
          () => undefined,
          () => undefined
        )
      );
    }
  }
  return response;
}
