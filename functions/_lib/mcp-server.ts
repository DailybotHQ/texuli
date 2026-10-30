/**
 * The remote MCP server (T-mcp-remote, ADR-018): the isolate's handler,
 * limiter and counters, shared by `functions/mcp.ts` (`/mcp`) and the
 * middleware route for `/.well-known/mcp`, so both URLs are the same
 * server. Only `edge` operations are served: `node` operations (file
 * writes, PDF and DOCX conversion) are not listed and answer
 * `runtime-unavailable`.
 *
 * The handler is imported from the `@texuli/tools` source because the
 * package exports no `./mcp` subpath yet; switch to the package export when
 * it lands. `functions/` is not a workspace package, so the layer guard does
 * not apply here, and the website's own sources stay free of this import.
 */
import { buildBotEventRequest, buildMcpEventBody } from '../../apps/website/src/lib/bot-events.ts';
import { createMcpHandler } from '../../packages/tools/src/mcp/handler.ts';
import { MCP_SUPPORTED_PROTOCOL_VERSIONS } from '../../packages/tools/src/mcp/protocol.ts';
import { texuliOps } from '../../packages/tools/src/ops/index.ts';
import {
  createTokenBucket,
  handleMcpHttp,
  MCP_RATE_POLICY,
  type McpEndpointDeps,
} from './mcp-endpoint.ts';

/** The pieces of the Pages function context the endpoint touches. */
export interface McpContext {
  request: Request;
  env: { PUBLIC_UMAMI_WEBSITE_ID?: string; ASSETS?: unknown };
  waitUntil?: (promise: Promise<unknown>) => void;
}

const RUNTIMES = ['edge'] as const;

/** Every tool name the edge handler serves: operations, then their 0.8 aliases. */
const servedNames = new Set(texuliOps.list({ runtimes: RUNTIMES }).map((op) => op.name));
for (const alias of texuliOps.aliases())
  if (alias.targets.every((target) => servedNames.has(target))) servedNames.add(alias.name);

/** One handler and one bucket per isolate; nothing else lives between requests. */
const deps: McpEndpointDeps = {
  handler: createMcpHandler({ mode: 'stateless', runtimes: RUNTIMES }),
  supportedVersions: MCP_SUPPORTED_PROTOCOL_VERSIONS,
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
  const { response, counter } = await handleMcpHttp(context.request, deps);
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
