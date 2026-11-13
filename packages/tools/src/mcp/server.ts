import { texuliOps } from '../ops/index.ts';
import type { OperationRegistry } from '../ops/registry.ts';
import { createMcpHandler, type McpHandler } from './handler.ts';
import { MCP_PROTOCOL_VERSION } from './protocol.ts';

/**
 * @deprecated Since 0.9.0; use `createMcpHandler({ registry, mode: 'stateful' })`.
 * The 0.8 entry point: the stateful local handler (every `edge` and `node`
 * operation, the Texuli resources and prompts) over `registry`.
 */
export function createTexuliMcpServer(registry?: OperationRegistry): McpHandler {
  return createMcpHandler({ registry: registry ?? texuliOps, mode: 'stateful' });
}

export { MCP_PROTOCOL_VERSION };
