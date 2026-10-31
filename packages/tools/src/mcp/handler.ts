/**
 * `createMcpHandler`: the transport-independent MCP protocol layer over the
 * operations registry (ADR-017). One JSON-RPC message in, one response (or
 * nothing, for a notification) out. Edge-safe: no Node built-ins, so the
 * stdio server and an HTTP endpoint share it.
 *
 * - `stateful` (stdio): the initialization gate; only `initialize` and
 *   `ping` answer before `notifications/initialized`.
 * - `stateless` (HTTP): every request stands alone; `initialize` answers but
 *   is never required, and the request's protocol version comes from the
 *   caller's context (the `MCP-Protocol-Version` header).
 */
import {
  type InvokeFailure,
  LOCAL_RUNTIMES,
  type LocalFiles,
  type Operation,
  type OperationAnnotations,
  type OperationRegistry,
  type OperationRuntime,
  type SiteContext,
  TOOLS_VERSION,
  texuliOps,
} from '../ops/index.ts';
import { TEXULI_PROMPTS } from './prompts.ts';
import {
  type JsonObject,
  type JsonRpcId,
  type JsonRpcResponse,
  MCP_ERROR_CODES,
  MCP_PROTOCOL_VERSION,
  MCP_SUPPORTED_PROTOCOL_VERSIONS,
  type McpPrompt,
  type McpResourceProvider,
  type McpResourceTemplate,
} from './protocol.ts';
import { texuliResources } from './resources.ts';

export type McpMode = 'stateful' | 'stateless';

/** Switch a capability off even when the handler has something to serve. */
export interface McpCapabilityOptions {
  resources?: boolean;
  prompts?: boolean;
  completions?: boolean;
}

export interface McpHandlerOptions {
  /** The operations served as tools (default: every Texuli operation). */
  registry?: OperationRegistry;
  /** `stateful` (stdio, the default) keeps the initialization gate; `stateless` (HTTP) never requires it. */
  mode?: McpMode;
  /** The runtime classes this door serves (default `edge` and `node`; the remote door passes `['edge', 'site']`). */
  runtimes?: readonly OperationRuntime[];
  capabilities?: McpCapabilityOptions;
  /** Resource sources (default: the Texuli resources). An empty list advertises no resources. */
  resources?: readonly McpResourceProvider[];
  /** Prompts (default: the Texuli prompts). An empty list advertises no prompts. */
  prompts?: readonly McpPrompt[];
  /** Items per page of every list method (default 100). */
  pageSize?: number;
  /** The local writer `ds.save` uses (the stdio door passes `localFiles()`); never on the remote door. */
  files?: LocalFiles;
}

/** Per-request context a transport passes. */
export interface McpRequestContext {
  /** Stateless only: the request's protocol version (the HTTP `MCP-Protocol-Version` header). */
  protocolVersion?: string;
  /** The built site `site` operations read (the remote door passes its `env.ASSETS`). */
  site?: SiteContext;
}

export type McpHandler = (
  message: unknown,
  context?: McpRequestContext
) => Promise<JsonRpcResponse | undefined>;

const DEFAULT_PAGE_SIZE = 100;
const MAX_COMPLETIONS = 100;
const MAX_URI_LENGTH = 2048;
const MAX_NAME_LENGTH = 256;
const MAX_CURSOR_LENGTH = 512;
const DEFAULT_ARGUMENT_LENGTH = 10_000;

const INSTRUCTIONS =
  "Texuli is a Svelte 5 component library with a closed agent catalog. Tools are group.verb operations: search the component catalog (catalog.search), read manifests (component.get) and worked examples (example.search), list content block types and read the shape and examples of each (block.list, block.schema), validate blueprint drafts (blueprint.validate) and catalog manifests, search, read and preview themes with their WCAG AA report, author design systems (ds.validate, ds.compile, ds.contrast, ds.suggest, ds.import, ds.diff, ds.preview, and blueprint.theme to apply one to a blueprint), and run deck and document commands. Every tool states its limits and returns structured JSON; failures are isError results with a stable code (invalid-input, input-too-large, not-found, runtime-unavailable, timeout …), and a refused design system is a valid: false result with the spec's codes and JSON paths. Resources: texuli://catalog, texuli://llms/full, texuli://component/{id}, texuli://docs/{slug}, texuli://theme/{id}, texuli://design-system/{id} and texuli://schema/{name}. Prompts build-ui, theme-blueprint, create-design-system and convert-deck walk through the main jobs. The remote endpoint also lists site.pages, site.read and site.search, which list, read (as Markdown) and search the pages of texuli.com. The 0.8 tool names (catalog, component, validate, example, theme, deck, document) are deprecated aliases. Nothing reaches the network; the only write is ds.save, on the local server, to an explicit path inside the working directory.";

type Failure = { code: number; message: string; data?: unknown };
class RpcFailure extends Error {
  readonly failure: Failure;
  constructor(code: number, message: string, data?: unknown) {
    super(message);
    this.failure = { code, message, ...(data === undefined ? {} : { data }) };
  }
}
const invalidParams = (message: string) => new RpcFailure(MCP_ERROR_CODES.invalidParams, message);

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validId(id: unknown): id is JsonRpcId {
  return typeof id === 'string' || (typeof id === 'number' && Number.isFinite(id));
}

function hints(annotations: OperationAnnotations) {
  return {
    readOnlyHint: annotations.readOnly,
    destructiveHint: annotations.destructive,
    idempotentHint: annotations.idempotent,
    openWorldHint: annotations.openWorld,
  };
}

/** True when `version` is at least `floor` (versions are ISO dates). */
const atLeast = (version: string, floor: string) => version >= floor;

/** Remove the fields a protocol version predates. */
function shape<T extends JsonObject>(item: T, version: string): JsonObject {
  const copy: JsonObject = { ...item };
  if (!atLeast(version, '2025-06-18')) {
    delete copy.title;
    delete copy.outputSchema;
  }
  if (!atLeast(version, '2025-03-26')) delete copy.annotations;
  return copy;
}

function encodeCursor(method: string, offset: number): string {
  return btoa(JSON.stringify({ m: method, o: offset }))
    .replace(/\+/gu, '-')
    .replace(/\//gu, '_')
    .replace(/=+$/u, '');
}

function decodeCursor(cursor: unknown, method: string, total: number): number {
  if (typeof cursor !== 'string' || cursor === '' || cursor.length > MAX_CURSOR_LENGTH)
    throw invalidParams('Invalid cursor: pass the nextCursor of the previous page unchanged.');
  try {
    const parsed = JSON.parse(atob(cursor.replace(/-/gu, '+').replace(/_/gu, '/'))) as unknown;
    if (
      isObject(parsed) &&
      parsed.m === method &&
      Number.isInteger(parsed.o) &&
      (parsed.o as number) > 0 &&
      (parsed.o as number) < total &&
      encodeCursor(method, parsed.o as number) === cursor
    )
      return parsed.o as number;
  } catch {
    // Fall through to the refusal below.
  }
  throw invalidParams('Invalid cursor: pass the nextCursor of the previous page unchanged.');
}

/** One page of `items`, with `nextCursor` when more follow. */
function page<T>(
  items: readonly T[],
  params: unknown,
  method: string,
  key: string,
  size: number
): JsonObject {
  const cursor = isObject(params) && params.cursor !== undefined ? params.cursor : undefined;
  const offset = cursor === undefined ? 0 : decodeCursor(cursor, method, items.length);
  const end = offset + size;
  return {
    [key]: items.slice(offset, end),
    ...(end < items.length ? { nextCursor: encodeCursor(method, end) } : {}),
  };
}

/** Candidate values that start with `value` (case-insensitive), at most 100 returned. */
function completion(candidates: readonly string[], value: string): JsonObject {
  const prefix = value.toLowerCase();
  const matches = candidates.filter((candidate) => candidate.toLowerCase().startsWith(prefix));
  return {
    completion: {
      values: matches.slice(0, MAX_COMPLETIONS),
      total: matches.length,
      hasMore: matches.length > MAX_COMPLETIONS,
    },
  };
}

const variableOf = (template: McpResourceTemplate) =>
  /\{([a-zA-Z]+)\}/u.exec(template.uriTemplate)?.[1];

/**
 * Create an MCP request handler over `registry`. Capabilities are advertised
 * only for what the handler serves: tools always; resources, prompts and
 * completions when there is something to list or complete and the option
 * does not switch them off. Logging, subscriptions and sampling are never
 * offered.
 */
export function createMcpHandler(options: McpHandlerOptions = {}): McpHandler {
  const registry = options.registry ?? texuliOps;
  const mode = options.mode ?? 'stateful';
  const runtimes = options.runtimes ?? LOCAL_RUNTIMES;
  const pageSize = Math.max(1, Math.floor(options.pageSize ?? DEFAULT_PAGE_SIZE));
  const providers = options.resources ?? [texuliResources];
  const prompts = options.prompts ?? TEXULI_PROMPTS;
  const templates = providers.flatMap((provider) =>
    provider.templates.map((template) => ({ provider, template }))
  );

  const resourcesOn = options.capabilities?.resources !== false && providers.length > 0;
  const promptsOn = options.capabilities?.prompts !== false && prompts.length > 0;
  const completionsOn =
    options.capabilities?.completions !== false &&
    ((resourcesOn && templates.some(({ provider }) => provider.complete)) ||
      (promptsOn &&
        prompts.some((prompt) =>
          prompt.arguments.some((argument) => argument.enum || argument.complete)
        )));

  // Tools: every served operation, then each alias whose targets are all served.
  const served = registry.list({ runtimes });
  const servedNames = new Set(served.map((operation) => operation.name));
  const tools: JsonObject[] = served.map((operation) => ({
    name: operation.name,
    title: operation.title,
    description: registry.describe(operation.name),
    inputSchema: operation.input,
    outputSchema: operation.output,
    annotations: hints(operation.annotations),
  }));
  for (const alias of registry.aliases()) {
    if (!alias.targets.every((target) => servedNames.has(target))) continue;
    const target = registry.get(alias.targets[0] as string) as Operation;
    tools.push({
      name: alias.name,
      description: registry.describe(alias.name),
      inputSchema: registry.inputSchema(alias.name),
      annotations: hints(target.annotations),
    });
  }

  let initialized = false;
  let initializeReceived = false;
  let negotiated = MCP_PROTOCOL_VERSION;

  function capabilities(version: string): JsonObject {
    return {
      tools: { listChanged: false },
      ...(resourcesOn ? { resources: { subscribe: false, listChanged: false } } : {}),
      ...(promptsOn ? { prompts: { listChanged: false } } : {}),
      ...(completionsOn && atLeast(version, '2025-03-26') ? { completions: {} } : {}),
    };
  }

  async function callTool(
    params: unknown,
    version: string,
    site: SiteContext | undefined
  ): Promise<JsonObject> {
    if (!isObject(params) || typeof params.name !== 'string')
      throw invalidParams('tools/call requires params.name, a tool name from tools/list.');
    const name = params.name;
    if (name.length > MAX_NAME_LENGTH || registry.describe(name) === undefined)
      throw invalidParams(
        `Unknown tool: ${name.slice(0, MAX_NAME_LENGTH)}. List tools with tools/list.`
      );
    const outcome = await registry.invoke(name, params.arguments ?? {}, {
      runtimes,
      ...(site ? { site } : {}),
      ...(options.files ? { files: options.files } : {}),
    });
    if (outcome.ok) {
      return {
        content: [{ type: 'text', text: JSON.stringify(outcome.output) }],
        ...(atLeast(version, '2025-06-18') ? { structuredContent: outcome.output } : {}),
      };
    }
    const error: InvokeFailure['error'] = outcome.error;
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: error.message,
            code: error.code,
            ...(error.issues ? { issues: error.issues } : {}),
          }),
        },
      ],
      isError: true,
    };
  }

  async function listResources(): Promise<JsonObject[]> {
    const lists = await Promise.all(providers.map((provider) => provider.list()));
    return lists.flat() as unknown as JsonObject[];
  }

  async function readResource(params: unknown): Promise<JsonObject> {
    if (!isObject(params) || typeof params.uri !== 'string')
      throw invalidParams('resources/read requires params.uri, e.g. texuli://catalog.');
    const uri = params.uri;
    if (uri.length > MAX_URI_LENGTH)
      throw invalidParams(`params.uri is longer than ${MAX_URI_LENGTH} characters.`);
    for (const provider of providers) {
      const contents = await provider.read(uri);
      if (contents) return { contents };
    }
    throw new RpcFailure(
      MCP_ERROR_CODES.resourceNotFound,
      'Resource not found. List resources with resources/list, or fill a template from resources/templates/list.',
      { uri }
    );
  }

  function promptArguments(prompt: McpPrompt, params: JsonObject): Record<string, string> {
    const given = params.arguments ?? {};
    if (!isObject(given)) throw invalidParams('params.arguments must be an object of strings.');
    const known = new Map(prompt.arguments.map((argument) => [argument.name, argument]));
    const values: Record<string, string> = {};
    for (const [name, value] of Object.entries(given)) {
      const argument = known.get(name);
      if (!argument)
        throw invalidParams(
          `Unknown argument "${name.slice(0, 64)}" for ${prompt.name}; accepted: ${[...known.keys()].join(', ')}.`
        );
      if (typeof value !== 'string') throw invalidParams(`Argument "${name}" must be a string.`);
      const max = argument.maxLength ?? DEFAULT_ARGUMENT_LENGTH;
      if (value.length > max)
        throw invalidParams(`Argument "${name}" is longer than ${max} characters.`);
      if (argument.enum && !argument.enum.includes(value))
        throw invalidParams(`Argument "${name}" must be one of ${argument.enum.join(', ')}.`);
      values[name] = value;
    }
    for (const argument of prompt.arguments)
      if (argument.required && values[argument.name] === undefined)
        throw invalidParams(`${prompt.name} requires the argument "${argument.name}".`);
    return values;
  }

  function findPrompt(name: unknown): McpPrompt {
    const prompt =
      typeof name === 'string' ? prompts.find((candidate) => candidate.name === name) : undefined;
    if (!prompt)
      throw invalidParams(
        `Unknown prompt. Known: ${prompts.map((candidate) => candidate.name).join(', ')}.`
      );
    return prompt;
  }

  async function complete(params: unknown): Promise<JsonObject> {
    if (!isObject(params) || !isObject(params.ref) || !isObject(params.argument))
      throw invalidParams('completion/complete requires params.ref and params.argument.');
    const { ref, argument } = params;
    if (typeof argument.name !== 'string' || typeof argument.value !== 'string')
      throw invalidParams('params.argument needs a name and a string value.');
    if (argument.value.length > DEFAULT_ARGUMENT_LENGTH)
      throw invalidParams('params.argument.value is too long.');
    if (ref.type === 'ref/prompt') {
      if (!promptsOn) throw invalidParams('This server offers no prompts.');
      const prompt = findPrompt(ref.name);
      const declared = prompt.arguments.find((item) => item.name === argument.name);
      if (!declared)
        throw invalidParams(`${prompt.name} has no argument "${argument.name.slice(0, 64)}".`);
      const candidates = declared.enum ?? (declared.complete ? await declared.complete() : []);
      return completion(candidates, argument.value);
    }
    if (ref.type === 'ref/resource') {
      if (!resourcesOn) throw invalidParams('This server offers no resources.');
      const match = templates.find(({ template }) => template.uriTemplate === ref.uri);
      if (!match) throw invalidParams('Unknown resource template; see resources/templates/list.');
      if (variableOf(match.template) !== argument.name)
        throw invalidParams(
          `${match.template.uriTemplate} has no variable "${argument.name.slice(0, 64)}".`
        );
      const candidates = (await match.provider.complete?.(ref.uri as string, argument.name)) ?? [];
      return completion(candidates, argument.value);
    }
    throw invalidParams('params.ref.type must be ref/prompt or ref/resource.');
  }

  async function dispatch(
    method: string,
    params: unknown,
    version: string,
    site: SiteContext | undefined
  ): Promise<JsonObject> {
    if (method === 'tools/list')
      return page(
        tools.map((tool) => shape(tool, version)),
        params,
        method,
        'tools',
        pageSize
      );
    if (method === 'tools/call') return callTool(params, version, site);
    if (resourcesOn) {
      if (method === 'resources/list')
        return page(
          (await listResources()).map((item) => shape(item, version)),
          params,
          method,
          'resources',
          pageSize
        );
      if (method === 'resources/templates/list')
        return page(
          templates.map(({ template }) => shape({ ...template }, version)),
          params,
          method,
          'resourceTemplates',
          pageSize
        );
      if (method === 'resources/read') return readResource(params);
    }
    if (promptsOn) {
      if (method === 'prompts/list')
        return page(
          prompts.map((prompt) =>
            shape(
              {
                name: prompt.name,
                title: prompt.title,
                description: prompt.description,
                arguments: prompt.arguments.map((argument) => ({
                  name: argument.name,
                  description: argument.description,
                  required: argument.required === true,
                })),
              },
              version
            )
          ),
          params,
          method,
          'prompts',
          pageSize
        );
      if (method === 'prompts/get') {
        if (!isObject(params)) throw invalidParams('prompts/get requires params.name.');
        const prompt = findPrompt(params.name);
        return prompt.render(promptArguments(prompt, params)) as unknown as JsonObject;
      }
    }
    if (completionsOn && method === 'completion/complete') return complete(params);
    throw new RpcFailure(
      MCP_ERROR_CODES.methodNotFound,
      `Method not found: ${method.slice(0, MAX_NAME_LENGTH)}`
    );
  }

  const reply = (id: JsonRpcId | null, result: JsonObject): JsonRpcResponse => ({
    jsonrpc: '2.0',
    id,
    result,
  });
  const fail = (id: JsonRpcId | null, failure: Failure): JsonRpcResponse => ({
    jsonrpc: '2.0',
    id,
    error: failure,
  });

  return async (message, context = {}) => {
    if (!isObject(message) || message.jsonrpc !== '2.0' || typeof message.method !== 'string') {
      const id = isObject(message) && validId(message.id) ? message.id : null;
      return fail(id, { code: MCP_ERROR_CODES.invalidRequest, message: 'Invalid Request' });
    }
    const hasId = Object.hasOwn(message, 'id');
    const id = validId(message.id) ? message.id : null;
    if (hasId && id === null)
      return fail(null, { code: MCP_ERROR_CODES.invalidRequest, message: 'Invalid Request' });
    if (!hasId) {
      if (mode === 'stateful' && message.method === 'notifications/initialized')
        initialized = initializeReceived;
      return undefined;
    }

    if (message.method === 'initialize') {
      const params = message.params;
      if (!isObject(params) || typeof params.protocolVersion !== 'string')
        return fail(id, {
          code: MCP_ERROR_CODES.invalidParams,
          message: 'initialize requires params.protocolVersion.',
        });
      const version = MCP_SUPPORTED_PROTOCOL_VERSIONS.includes(params.protocolVersion)
        ? params.protocolVersion
        : MCP_PROTOCOL_VERSION;
      if (mode === 'stateful') {
        initializeReceived = true;
        initialized = false;
        negotiated = version;
      }
      return reply(id, {
        protocolVersion: version,
        capabilities: capabilities(version),
        serverInfo: { name: 'texuli', version: TOOLS_VERSION },
        instructions: INSTRUCTIONS,
      });
    }
    if (message.method === 'ping') return reply(id, {});

    let version = negotiated;
    if (mode === 'stateful') {
      if (!initialized)
        return fail(id, {
          code: MCP_ERROR_CODES.notInitialized,
          message:
            'Server not initialized: send initialize, then notifications/initialized, before other requests.',
        });
    } else {
      version = context.protocolVersion ?? MCP_PROTOCOL_VERSION;
      if (!MCP_SUPPORTED_PROTOCOL_VERSIONS.includes(version))
        return fail(id, {
          code: MCP_ERROR_CODES.invalidRequest,
          message: `Unsupported protocol version; supported: ${MCP_SUPPORTED_PROTOCOL_VERSIONS.join(', ')}.`,
        });
    }

    try {
      return reply(id, await dispatch(message.method, message.params, version, context.site));
    } catch (error) {
      if (error instanceof RpcFailure) return fail(id, error.failure);
      return fail(id, { code: MCP_ERROR_CODES.internalError, message: 'Internal error' });
    }
  };
}
