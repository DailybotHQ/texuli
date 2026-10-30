import {
  type Operation,
  type OperationAnnotations,
  type OperationRegistry,
  type OperationRuntime,
  TOOLS_VERSION,
  texuliOps,
} from '../ops/index.ts';

const PROTOCOL_VERSION = '2025-11-25';
const SUPPORTED_PROTOCOL_VERSIONS = new Set([
  '2024-11-05',
  '2025-03-26',
  '2025-06-18',
  PROTOCOL_VERSION,
]);
/** The local server runs every operation but the site-only ones. */
const LOCAL_RUNTIMES: readonly OperationRuntime[] = ['edge', 'node'];

type JsonObject = Record<string, unknown>;
type JsonRpcId = string | number;
type JsonRpcError = { code: number; message: string; data?: unknown };
type JsonRpcResponse =
  | { jsonrpc: '2.0'; id: JsonRpcId | null; result: JsonObject }
  | { jsonrpc: '2.0'; id: JsonRpcId | null; error: JsonRpcError };

interface ToolDefinition {
  name: string;
  title?: string;
  description: string;
  inputSchema: JsonObject;
  annotations: {
    readOnlyHint: boolean;
    destructiveHint: boolean;
    idempotentHint: boolean;
    openWorldHint: boolean;
  };
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function textResult(value: unknown, isError = false): JsonObject {
  return {
    content: [{ type: 'text', text: JSON.stringify(value) }],
    ...(isError ? { isError: true } : {}),
  };
}

function hints(annotations: OperationAnnotations): ToolDefinition['annotations'] {
  return {
    readOnlyHint: annotations.readOnly,
    destructiveHint: annotations.destructive,
    idempotentHint: annotations.idempotent,
    openWorldHint: annotations.openWorld,
  };
}

/**
 * The tool list, generated from the registry: every operation the local
 * runtimes serve, then the deprecated 0.8 aliases whose targets are served.
 */
function toolsFrom(registry: OperationRegistry): ToolDefinition[] {
  const served = registry.list({ runtimes: LOCAL_RUNTIMES });
  const names = new Set(served.map((operation) => operation.name));
  const tools: ToolDefinition[] = served.map((operation) => ({
    name: operation.name,
    title: operation.title,
    description: registry.describe(operation.name) as string,
    inputSchema: operation.input as JsonObject,
    annotations: hints(operation.annotations),
  }));
  for (const alias of registry.aliases()) {
    if (!alias.targets.every((target) => names.has(target))) continue;
    const target = registry.get(alias.targets[0] as string) as Operation;
    tools.push({
      name: alias.name,
      description: registry.describe(alias.name) as string,
      inputSchema: registry.inputSchema(alias.name) as JsonObject,
      annotations: hints(target.annotations),
    });
  }
  return tools;
}

function validId(id: unknown): id is JsonRpcId {
  return typeof id === 'string' || (typeof id === 'number' && Number.isFinite(id));
}

function response(id: JsonRpcId | null, result: JsonObject): JsonRpcResponse {
  return { jsonrpc: '2.0', id, result };
}

function errorResponse(id: JsonRpcId | null, code: number, message: string): JsonRpcResponse {
  return { jsonrpc: '2.0', id, error: { code, message } };
}

/**
 * Create the request handler for a local, read-only MCP server whose tools
 * are the operations of `registry` (default: every Texuli operation).
 */
export function createTexuliMcpServer(
  registry: OperationRegistry = texuliOps
): (message: unknown) => Promise<JsonRpcResponse | undefined> {
  let initialized = false;
  let initializeReceived = false;
  const tools = toolsFrom(registry);
  const toolNames = new Set(tools.map((tool) => tool.name));

  return async (message: unknown) => {
    if (!isObject(message) || message.jsonrpc !== '2.0' || typeof message.method !== 'string') {
      const id = isObject(message) && validId(message.id) ? message.id : null;
      return errorResponse(id, -32600, 'Invalid Request');
    }

    const hasId = Object.hasOwn(message, 'id');
    const id = validId(message.id) ? message.id : null;
    if (hasId && id === null) return errorResponse(null, -32600, 'Invalid Request');
    if (!hasId) {
      if (message.method === 'notifications/initialized') initialized = initializeReceived;
      return undefined;
    }

    if (message.method === 'initialize') {
      const params = message.params;
      if (!isObject(params) || typeof params.protocolVersion !== 'string') {
        return errorResponse(id, -32602, 'initialize requires params.protocolVersion.');
      }
      const protocolVersion = SUPPORTED_PROTOCOL_VERSIONS.has(params.protocolVersion)
        ? params.protocolVersion
        : PROTOCOL_VERSION;
      initializeReceived = true;
      initialized = false;
      return response(id, {
        protocolVersion,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'texuli', version: TOOLS_VERSION },
        instructions:
          'Texuli operations: search the component catalog, read manifests and examples, validate manifests, search, read and preview themes, and run deck and document commands. Tool names are group.verb; the 0.8 names (catalog, component, validate, example, theme, deck, document) are deprecated aliases. Read-only: no files or network are modified.',
      });
    }

    if (message.method === 'ping') return response(id, {});
    if (!initialized) return errorResponse(id, -32002, 'Server not initialized.');

    if (message.method === 'tools/list') {
      return response(id, { tools });
    }

    if (message.method === 'tools/call') {
      const params = message.params;
      if (!isObject(params) || typeof params.name !== 'string') {
        return errorResponse(id, -32602, 'tools/call requires params.name.');
      }
      const toolName = params.name;
      if (!toolNames.has(toolName)) return errorResponse(id, -32602, `Unknown tool: ${toolName}`);
      const outcome = await registry.invoke(toolName, params.arguments ?? {}, {
        runtimes: LOCAL_RUNTIMES,
      });
      if (outcome.ok) return response(id, textResult(outcome.output));
      return response(
        id,
        textResult(
          {
            error: outcome.error.message,
            code: outcome.error.code,
            ...(outcome.error.issues ? { issues: outcome.error.issues } : {}),
          },
          true
        )
      );
    }

    return errorResponse(id, -32601, `Method not found: ${message.method}`);
  };
}

export const MCP_PROTOCOL_VERSION = PROTOCOL_VERSION;
