/**
 * The remote MCP's published limits (PLAN_011): one source for the endpoint
 * that enforces them (`functions/_lib/mcp-endpoint.ts` re-exports these)
 * and the documents that state them (`/auth.md`, written at build by
 * `src/integrations/agent-discovery.ts`). The website's sources may not
 * import `functions/`, so the numbers live here.
 */

/** The largest request body the endpoint reads: 256 KB. */
export const MCP_BODY_MAX = 256 * 1024;

/** The most JSON-RPC messages one batch may carry. */
export const MCP_BATCH_MAX = 10;

/** 60 messages per client per minute, with bursts up to 60 (per isolate). */
export const MCP_RATE_LIMIT = Object.freeze({
  name: 'mcp',
  capacity: 60,
  windowSeconds: 60,
});
