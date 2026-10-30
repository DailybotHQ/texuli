/**
 * MCP protocol constants and shapes shared by the handler, the resources
 * and the prompts. Framework-free and edge-safe: no Node built-ins.
 */

/** The protocol version the handler prefers. */
export const MCP_PROTOCOL_VERSION = '2025-11-25';

/** Every version the handler negotiates, newest first. */
export const MCP_SUPPORTED_PROTOCOL_VERSIONS: readonly string[] = Object.freeze([
  '2025-11-25',
  '2025-06-18',
  '2025-03-26',
  '2024-11-05',
]);

/**
 * The JSON-RPC error codes the handler returns. Tool failures are never
 * JSON-RPC errors: they are `isError` results carrying the operation's
 * stable code. `notInitialized` shares `-32600` (Invalid Request) because
 * MCP reserves `-32002` for an unknown resource.
 */
export const MCP_ERROR_CODES = Object.freeze({
  parseError: -32700,
  invalidRequest: -32600,
  methodNotFound: -32601,
  invalidParams: -32602,
  internalError: -32603,
  notInitialized: -32600,
  resourceNotFound: -32002,
} as const);

export type JsonObject = Record<string, unknown>;
export type JsonRpcId = string | number;
export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}
export type JsonRpcResponse =
  | { jsonrpc: '2.0'; id: JsonRpcId | null; result: JsonObject }
  | { jsonrpc: '2.0'; id: JsonRpcId | null; error: JsonRpcError };

/** A concrete resource `resources/list` returns. */
export interface McpResource {
  uri: string;
  name: string;
  title?: string;
  description: string;
  mimeType: string;
}

/** A parameterized resource `resources/templates/list` returns (one `{variable}`). */
export interface McpResourceTemplate {
  uriTemplate: string;
  name: string;
  title?: string;
  description: string;
  mimeType: string;
}

/** One item of a `resources/read` result. */
export interface McpResourceContents {
  uri: string;
  mimeType: string;
  text: string;
}

/**
 * A source of resources. `read` returns `undefined` for a URI it does not
 * own (the handler then answers resource-not-found); `complete` returns
 * every candidate value of a template variable, or `undefined` when the
 * template or variable is not its own.
 */
export interface McpResourceProvider {
  list(): readonly McpResource[] | Promise<readonly McpResource[]>;
  templates: readonly McpResourceTemplate[];
  read(uri: string): Promise<readonly McpResourceContents[] | undefined>;
  complete?(
    uriTemplate: string,
    variable: string
  ): readonly string[] | undefined | Promise<readonly string[] | undefined>;
}

/** A prompt argument. MCP prompt arguments are always strings. */
export interface McpPromptArgument {
  name: string;
  description: string;
  required?: boolean;
  /** The longest accepted value, in UTF-16 code units (default 10,000). */
  maxLength?: number;
  /** A closed set of values; also what completion offers. */
  enum?: readonly string[];
  /** Candidate values for completion (ids from the catalog or theme library). */
  complete?: () => readonly string[] | Promise<readonly string[]>;
}

export interface McpPromptMessage {
  role: 'user' | 'assistant';
  content: { type: 'text'; text: string };
}

/** A workflow an agent host can offer as a slash command or template. */
export interface McpPrompt {
  name: string;
  title: string;
  description: string;
  arguments: readonly McpPromptArgument[];
  render(args: Readonly<Record<string, string>>): {
    description?: string;
    messages: McpPromptMessage[];
  };
}
