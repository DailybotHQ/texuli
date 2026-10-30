/**
 * Cloudflare Pages Function for `/mcp`: the remote Texuli MCP server
 * (T-mcp-remote, ADR-018). Stateless Streamable HTTP, POST JSON-RPC with
 * JSON responses, `edge` operations only. Every rule lives in
 * `functions/_lib/mcp-endpoint.ts` (limits, Origin and Host, headers) and
 * `functions/_lib/mcp-server.ts` (the handler and counters); the middleware
 * routes `/.well-known/mcp` to the same server.
 */
import { type McpContext, serveMcp } from './_lib/mcp-server.ts';

export const onRequest = (context: McpContext): Promise<Response> => serveMcp(context);
