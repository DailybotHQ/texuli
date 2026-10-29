import { buildCatalog } from '@texuli/catalog/build';
import { discoverManifestGroups } from '@texuli/catalog/build/node';
import { validateCatalogManifest, validateCatalogManifests } from '@texuli/catalog/manifest';
import {
  getFullThemeLibraryMeta,
  listFullThemeLibrary,
  loadFullLibraryTheme,
} from '@texuli/tokens/library-expand';
import { DECK_COMMANDS, type DeckCommandName, runDeckCommand } from '../deck/index.ts';
import {
  DOCUMENT_COMMANDS,
  type DocumentCommandName,
  runDocumentCommand,
} from '../document/index.ts';

const PROTOCOL_VERSION = '2025-11-25';
const SERVER_VERSION = '0.0.0';
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const SUPPORTED_PROTOCOL_VERSIONS = new Set([
  '2024-11-05',
  '2025-03-26',
  '2025-06-18',
  PROTOCOL_VERSION,
]);

type JsonObject = Record<string, unknown>;
type JsonRpcId = string | number;
type JsonRpcError = { code: number; message: string; data?: unknown };
type JsonRpcResponse =
  | { jsonrpc: '2.0'; id: JsonRpcId | null; result: JsonObject }
  | { jsonrpc: '2.0'; id: JsonRpcId | null; error: JsonRpcError };

interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: JsonObject;
  annotations: {
    readOnlyHint: true;
    destructiveHint: false;
    openWorldHint: false;
  };
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringArg(args: JsonObject, name: string, required = false): string | undefined {
  const value = args[name];
  if (value === undefined && !required) return undefined;
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError(`"${name}" must be a non-empty string${required ? '' : ' when provided'}.`);
  }
  return value.trim();
}

function limitArg(args: JsonObject): number {
  const value = args.limit;
  if (value === undefined) return DEFAULT_LIMIT;
  if (!Number.isInteger(value) || (value as number) < 1 || (value as number) > MAX_LIMIT) {
    throw new TypeError(`"limit" must be an integer from 1 to ${MAX_LIMIT}.`);
  }
  return value as number;
}

function rejectUnknownArgs(args: JsonObject, allowed: readonly string[]): void {
  const unknown = Object.keys(args).filter((key) => !allowed.includes(key));
  if (unknown.length > 0) {
    throw new TypeError(
      `Unknown argument${unknown.length === 1 ? '' : 's'}: ${unknown.join(', ')}.`
    );
  }
}

function textResult(value: unknown, isError = false): JsonObject {
  return {
    content: [{ type: 'text', text: JSON.stringify(value) }],
    ...(isError ? { isError: true } : {}),
  };
}

const COMMON_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: false,
} as const;

const TOOLS: readonly ToolDefinition[] = [
  {
    name: 'deck',
    description: 'Inspect, validate and convert a Texuli deck with the shared v2 model.',
    inputSchema: {
      type: 'object',
      properties: {
        command: { type: 'string', enum: DECK_COMMANDS },
        deck: {
          type: 'object',
          description: 'A JSON deck value for lint, inspect or to-markdown.',
        },
        markdown: {
          type: 'string',
          maxLength: 2000000,
          description: 'A deck Markdown document for from-markdown.',
        },
      },
      required: ['command'],
      additionalProperties: false,
    },
    annotations: COMMON_ANNOTATIONS,
  },
  {
    name: 'document',
    description:
      'Create, validate, patch and convert a Texuli document (spec 0.7.0): from Markdown, bounded RFC 6902 patches, a document blueprint, and Markdown, DOCX or PDF export (bytes as base64; no files are written).',
    inputSchema: {
      type: 'object',
      properties: {
        command: { type: 'string', enum: DOCUMENT_COMMANDS },
        document: {
          type: 'object',
          description:
            'A Texuli document (format texuli-document, formatVersion 1) for every command but capabilities, schema and from-markdown.',
        },
        markdown: {
          type: 'string',
          maxLength: 2000000,
          description: 'Markdown text for from-markdown.',
        },
        patch: {
          type: 'array',
          maxItems: 1000,
          items: { type: 'object' },
          description: 'RFC 6902 operations for patch (add, remove, replace, move, copy, test).',
        },
        tier: {
          type: 'string',
          enum: ['developer', 'untrusted'],
          description: 'The URL policy tier; default untrusted.',
        },
        key: { type: 'string', description: 'The node key for to-blueprint.' },
      },
      required: ['command'],
      additionalProperties: false,
    },
    annotations: COMMON_ANNOTATIONS,
  },
  {
    name: 'catalog',
    description: 'Search the built, content-addressed Texuli component catalog.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Text to match against component ids, labels and summaries.',
        },
        group: { type: 'string', description: 'Exact manifest group id.' },
        tier: { type: 'string', enum: ['developer', 'untrusted'] },
        limit: { type: 'integer', minimum: 1, maximum: MAX_LIMIT },
      },
      additionalProperties: false,
    },
    annotations: COMMON_ANNOTATIONS,
  },
  {
    name: 'component',
    description: 'Read one component manifest, including props, examples and allowed emit tiers.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', minLength: 1 } },
      required: ['id'],
      additionalProperties: false,
    },
    annotations: COMMON_ANNOTATIONS,
  },
  {
    name: 'validate',
    description: 'Validate one catalog manifest or a list of manifests without writing files.',
    inputSchema: {
      type: 'object',
      properties: {
        manifest: { type: 'object', description: 'One candidate manifest.' },
        manifests: {
          type: 'array',
          items: { type: 'object' },
          description: 'A candidate manifest set.',
        },
      },
      additionalProperties: false,
    },
    annotations: COMMON_ANNOTATIONS,
  },
  {
    name: 'example',
    description: 'Find manifest examples by component and/or example id, or search their titles.',
    inputSchema: {
      type: 'object',
      properties: {
        componentId: { type: 'string', minLength: 1 },
        exampleId: { type: 'string', minLength: 1 },
        query: { type: 'string' },
        limit: { type: 'integer', minimum: 1, maximum: MAX_LIMIT },
      },
      additionalProperties: false,
    },
    annotations: COMMON_ANNOTATIONS,
  },
  {
    name: 'theme',
    description: 'Search theme metadata or read the full token definition for one theme id.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', minLength: 1 },
        query: { type: 'string' },
        category: { type: 'string' },
        collection: { type: 'string' },
        mood: { type: 'string' },
        tag: { type: 'string' },
        limit: { type: 'integer', minimum: 1, maximum: MAX_LIMIT },
      },
      additionalProperties: false,
    },
    annotations: COMMON_ANNOTATIONS,
  },
];

function validId(id: unknown): id is JsonRpcId {
  return typeof id === 'string' || (typeof id === 'number' && Number.isFinite(id));
}

function response(id: JsonRpcId | null, result: JsonObject): JsonRpcResponse {
  return { jsonrpc: '2.0', id, result };
}

function errorResponse(id: JsonRpcId | null, code: number, message: string): JsonRpcResponse {
  return { jsonrpc: '2.0', id, error: { code, message } };
}

/** Create the request handler for a local, read-only MCP server. */
export function createTexuliMcpServer(): (
  message: unknown
) => Promise<JsonRpcResponse | undefined> {
  let catalogPromise: ReturnType<typeof buildCatalog> | undefined;
  let initialized = false;
  let initializeReceived = false;

  const getCatalog = () => {
    catalogPromise ??= discoverManifestGroups().then(buildCatalog);
    return catalogPromise;
  };

  async function callTool(name: string, rawArgs: unknown): Promise<JsonObject> {
    if (!isObject(rawArgs)) throw new TypeError('Tool arguments must be an object.');
    const args = rawArgs;

    if (name === 'deck') {
      rejectUnknownArgs(args, ['command', 'deck', 'markdown']);
      const command = stringArg(args, 'command', true) as DeckCommandName;
      if (!(DECK_COMMANDS as readonly string[]).includes(command))
        throw new TypeError(`Unknown deck command "${command}".`);
      if (Object.hasOwn(args, 'markdown') && typeof args.markdown !== 'string')
        throw new TypeError('"markdown" must be a string.');
      if (
        typeof args.markdown === 'string' &&
        new TextEncoder().encode(args.markdown).byteLength > 2_000_000
      )
        throw new TypeError('Deck Markdown exceeds 2000000 bytes.');
      const result = runDeckCommand(command, {
        ...(Object.hasOwn(args, 'deck') ? { deck: args.deck } : {}),
        ...(typeof args.markdown === 'string' ? { markdown: args.markdown } : {}),
      });
      return { result };
    }

    if (name === 'document') {
      rejectUnknownArgs(args, ['command', 'document', 'markdown', 'patch', 'tier', 'key']);
      const command = stringArg(args, 'command', true) as DocumentCommandName;
      if (!(DOCUMENT_COMMANDS as readonly string[]).includes(command))
        throw new TypeError(`Unknown document command "${command}".`);
      if (Object.hasOwn(args, 'markdown') && typeof args.markdown !== 'string')
        throw new TypeError('"markdown" must be a string.');
      if (
        typeof args.markdown === 'string' &&
        new TextEncoder().encode(args.markdown).byteLength > 2_000_000
      )
        throw new TypeError('Document Markdown exceeds 2000000 bytes.');
      if (Object.hasOwn(args, 'patch') && !Array.isArray(args.patch))
        throw new TypeError('"patch" must be an array of RFC 6902 operations.');
      const tier = stringArg(args, 'tier');
      if (tier !== undefined && tier !== 'developer' && tier !== 'untrusted')
        throw new TypeError('"tier" must be "developer" or "untrusted".');
      const key = stringArg(args, 'key');
      if (
        Object.hasOwn(args, 'document') &&
        new TextEncoder().encode(JSON.stringify(args.document) ?? '').byteLength > 2_000_000
      )
        throw new TypeError('The document exceeds 2000000 bytes.');
      const result = await runDocumentCommand(command, {
        ...(Object.hasOwn(args, 'document') ? { document: args.document } : {}),
        ...(typeof args.markdown === 'string' ? { markdown: args.markdown } : {}),
        ...(Object.hasOwn(args, 'patch') ? { patch: args.patch } : {}),
        ...(tier ? { tier } : {}),
        ...(key ? { key } : {}),
      });
      return { result };
    }

    if (name === 'catalog') {
      rejectUnknownArgs(args, ['query', 'group', 'tier', 'limit']);
      const query = stringArg(args, 'query')?.toLowerCase();
      const group = stringArg(args, 'group');
      const tier = stringArg(args, 'tier');
      const limit = limitArg(args);
      if (tier !== undefined && tier !== 'developer' && tier !== 'untrusted') {
        throw new TypeError('"tier" must be "developer" or "untrusted".');
      }
      const built = await getCatalog();
      const filtered = built.catalog.entries.filter((entry) => {
        if (group && entry.group !== group) return false;
        if (tier && !entry.emit.includes(tier)) return false;
        if (query && !`${entry.id} ${entry.label} ${entry.summary}`.toLowerCase().includes(query)) {
          return false;
        }
        return true;
      });
      return {
        hash: built.hash,
        fileName: built.fileName,
        total: filtered.length,
        entries: filtered
          .slice(0, limit)
          .map(
            ({
              id,
              package: packageName,
              label,
              summary,
              tier: componentTier,
              group: groupName,
              emit,
            }) => ({
              id,
              package: packageName,
              label,
              summary,
              tier: componentTier,
              group: groupName,
              emit,
            })
          ),
        limit,
      };
    }

    if (name === 'component') {
      rejectUnknownArgs(args, ['id']);
      const id = stringArg(args, 'id', true) as string;
      const entry = (await getCatalog()).catalog.entries.find((item) => item.id === id);
      if (!entry)
        throw new TypeError(`Unknown component "${id}". Search with the catalog tool first.`);
      return { component: entry };
    }

    if (name === 'validate') {
      rejectUnknownArgs(args, ['manifest', 'manifests']);
      const hasManifest = Object.hasOwn(args, 'manifest');
      const hasManifests = Object.hasOwn(args, 'manifests');
      if (hasManifest === hasManifests) {
        throw new TypeError('Provide exactly one of "manifest" or "manifests".');
      }
      if (hasManifest) return validateCatalogManifest(args.manifest) as unknown as JsonObject;
      if (!Array.isArray(args.manifests)) throw new TypeError('"manifests" must be an array.');
      return validateCatalogManifests(args.manifests) as unknown as JsonObject;
    }

    if (name === 'example') {
      rejectUnknownArgs(args, ['componentId', 'exampleId', 'query', 'limit']);
      const componentId = stringArg(args, 'componentId');
      const exampleId = stringArg(args, 'exampleId');
      const query = stringArg(args, 'query')?.toLowerCase();
      const limit = limitArg(args);
      const entries = (await getCatalog()).catalog.entries;
      const component = componentId ? entries.find((entry) => entry.id === componentId) : undefined;
      if (componentId && !component) {
        throw new TypeError(
          `Unknown component "${componentId}". Search with the catalog tool first.`
        );
      }
      const examples = (component ? [component] : entries).flatMap((entry) =>
        entry.examples
          .filter((example) => !exampleId || example.id === exampleId)
          .filter(
            (example) =>
              !query ||
              `${example.id} ${example.title} ${example.description ?? ''}`
                .toLowerCase()
                .includes(query)
          )
          .map((example) => ({ componentId: entry.id, package: entry.package, example }))
      );
      return { total: examples.length, examples: examples.slice(0, limit), limit };
    }

    if (name === 'theme') {
      rejectUnknownArgs(args, ['id', 'query', 'category', 'collection', 'mood', 'tag', 'limit']);
      const id = stringArg(args, 'id');
      const limit = limitArg(args);
      if (id) {
        const themes = await getFullThemeLibraryMeta();
        if (!themes.some((theme) => theme.id === id)) throw new TypeError(`Unknown theme "${id}".`);
        return { theme: await loadFullLibraryTheme(id) };
      }
      const query = stringArg(args, 'query')?.toLowerCase();
      const collection = stringArg(args, 'collection');
      const mood = stringArg(args, 'mood');
      const matches = (
        await listFullThemeLibrary({
          category: stringArg(args, 'category'),
          tag: stringArg(args, 'tag'),
        })
      ).filter((theme) => {
        if (collection && theme.collection !== collection) return false;
        if (mood && !theme.mood.includes(mood as (typeof theme.mood)[number])) return false;
        if (
          query &&
          !`${theme.id} ${theme.name} ${theme.description} ${theme.category} ${theme.tags.join(' ')}`
            .toLowerCase()
            .includes(query)
        ) {
          return false;
        }
        return true;
      });
      return { total: matches.length, themes: matches.slice(0, limit), limit };
    }

    throw new Error(`Unknown tool: ${name}`);
  }

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
        serverInfo: { name: 'texuli', version: SERVER_VERSION },
        instructions:
          'Read-only catalog, component, validation, example, theme, deck and document tools. No files or network are modified.',
      });
    }

    if (message.method === 'ping') return response(id, {});
    if (!initialized) return errorResponse(id, -32002, 'Server not initialized.');

    if (message.method === 'tools/list') {
      return response(id, { tools: TOOLS });
    }

    if (message.method === 'tools/call') {
      const params = message.params;
      if (!isObject(params) || typeof params.name !== 'string') {
        return errorResponse(id, -32602, 'tools/call requires params.name.');
      }
      const toolName = params.name;
      const tool = TOOLS.find((item) => item.name === toolName);
      if (!tool) return errorResponse(id, -32602, `Unknown tool: ${toolName}`);
      try {
        const data = await callTool(tool.name, params.arguments ?? {});
        return response(id, textResult(data));
      } catch (error) {
        return response(
          id,
          textResult({ error: error instanceof Error ? error.message : 'Tool failed.' }, true)
        );
      }
    }

    return errorResponse(id, -32601, `Method not found: ${message.method}`);
  };
}

export const MCP_PROTOCOL_VERSION = PROTOCOL_VERSION;
