/**
 * The OpenAPI 3.1 description of texuli.com (PLAN_011 T-ar-api), the API
 * index and the health file: pure builders over typed facts. The build
 * integration (`src/integrations/api-surface.ts`) passes the facts (the
 * origin, the release line, the operations the remote MCP serves from the
 * `@texuli/tools` registry, examples read from the built files) and writes
 * the documents into `dist/`; {@link checkOpenApi} then fails the build if
 * an operationId repeats, a `$ref` does not resolve or a described path is
 * not built. Nothing here is hand-copied into `public/`.
 *
 * Shared pieces (the problem model, the rate-limit and version headers, the
 * JSON-RPC envelope) are written once and referenced by every operation, so
 * each operation carries an operationId, a typed `$ref` schema and an
 * example: what function calling and schema-coverage audits read.
 */
import {
  API_ERROR_CODES,
  API_PATHS,
  API_PREFIX,
  API_RATE_LIMIT,
  API_RELEASE_STATUS,
  API_RESOURCES,
  API_VERSIONING,
  type ApiResource,
  aliasOperationId,
  apiProblem,
} from './api-surface.ts';

/** A JSON Schema object as the registry declares it. */
export type Schema = Record<string, unknown>;

/** What the description needs to know about one remote MCP operation. */
export interface McpOperationFacts {
  name: string;
  title: string;
  summary: string;
  input: Schema;
  output: Schema;
}

export interface OpenApiFacts {
  /** `https://texuli.com`. */
  origin: string;
  /** The release line (`TOOLS_VERSION`), also `X-API-Version`. */
  version: string;
  /** The operations the remote MCP serves (every runtime but `node`). */
  operations: readonly McpOperationFacts[];
  mcp: {
    protocolVersion: string;
    protocolVersions: readonly string[];
    capacity: number;
    windowSeconds: number;
    batchMax: number;
    bodyMax: number;
    docsUrl: string;
    serverCard: string;
  };
  /** One real value per path parameter, keyed by resource key (`theme` → `ocean`). */
  parameterExamples: Readonly<Record<string, string>>;
  /** Example bodies keyed by component schema name, read from the build. */
  examples: Readonly<Record<string, unknown>>;
}

export const LICENSE = Object.freeze({ name: 'MIT', identifier: 'MIT' });
const REPOSITORY = 'https://github.com/DailybotHQ/texuli';

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const headerRef = (name: string) => ({ $ref: `#/components/headers/${name}` });

/** The component name of an MCP operation's input or output schema. */
export function toolSchemaName(operation: string, part: 'Input' | 'Output'): string {
  return `McpTool_${operation.replace(/[^A-Za-z0-9]+/g, '_')}_${part}`;
}

// ---------------------------------------------------------------------------
// The index and health files

export interface ApiIndexEndpoint {
  operationId: string;
  method: 'GET' | 'POST';
  path: string;
  title: string;
  summary: string;
}

/** Every operation the index lists: each resource and its alias, then the MCP. */
export function apiEndpoints(): ApiIndexEndpoint[] {
  const endpoints: ApiIndexEndpoint[] = [];
  for (const resource of API_RESOURCES) {
    endpoints.push({
      operationId: aliasOperationId(resource),
      method: 'GET',
      path: resource.alias,
      title: resource.title,
      summary: resource.summary,
    });
    endpoints.push({
      operationId: resource.operationId,
      method: 'GET',
      path: resource.path,
      title: resource.title,
      summary: `${resource.summary} Unversioned; prefer ${resource.alias}.`,
    });
  }
  endpoints.push({
    operationId: 'callMcp',
    method: 'POST',
    path: API_PATHS.mcp,
    title: 'MCP server',
    summary:
      'The read-only remote MCP server: JSON-RPC over stateless Streamable HTTP (tools, resources, prompts).',
  });
  return endpoints;
}

/** `/api/index.json` (and its `/api/v1/` copy). */
export function buildApiIndex(facts: Pick<OpenApiFacts, 'origin' | 'version'>): unknown {
  const at = (path: string) => new URL(path, facts.origin).href;
  return {
    name: 'Texuli public API',
    version: facts.version,
    status: API_RELEASE_STATUS.state,
    statusNote: API_RELEASE_STATUS.note,
    documentation: at(API_PATHS.docs),
    openapi: at(API_PATHS.openapi),
    health: at(API_PATHS.health),
    authentication: 'none',
    rateLimit: {
      policy: API_RATE_LIMIT.name,
      quota: API_RATE_LIMIT.capacity,
      windowSeconds: API_RATE_LIMIT.windowSeconds,
      scope: 'per client IP, per edge isolate (best-effort)',
    },
    versioning: { ...API_VERSIONING },
    license: LICENSE.name,
    endpoints: apiEndpoints().map((endpoint) => ({ ...endpoint, url: at(endpoint.path) })),
  };
}

/** `/api/health.json`: what the build knows; a static file, not a liveness probe. */
export function buildHealth(
  facts: Pick<OpenApiFacts, 'version'> & { builtAt: Date; endpoints: number }
): unknown {
  return {
    status: 'ok',
    service: 'texuli.com',
    version: facts.version,
    release: API_RELEASE_STATUS.state,
    builtAt: facts.builtAt.toISOString(),
    endpoints: facts.endpoints,
    note: 'A static file written by the build: a 200 means the build is served. X-API-Version and the RateLimit fields on the response mean the edge middleware answered.',
  };
}

// ---------------------------------------------------------------------------
// Component schemas

const string = { type: 'string' };
const stringList = { type: 'array', items: string };
const hexColor = { type: 'string', description: 'A CSS color, usually #rrggbb.' };

function swatches(keys: readonly string[]): Schema {
  return {
    type: 'object',
    required: [...keys],
    properties: Object.fromEntries(keys.map((key) => [key, hexColor])),
    additionalProperties: hexColor,
  };
}

function baseSchemas(facts: OpenApiFacts): Record<string, Schema> {
  const endpoint = {
    type: 'object',
    required: ['operationId', 'method', 'path', 'url', 'title', 'summary'],
    properties: {
      operationId: string,
      method: { type: 'string', enum: ['GET', 'POST'] },
      path: string,
      url: { type: 'string', format: 'uri' },
      title: string,
      summary: string,
    },
  };
  return {
    Problem: {
      type: 'object',
      description:
        'RFC 9457 problem details, plus an `error` object with a stable code, a message, a recovery hint and the documentation URL.',
      required: ['type', 'title', 'status', 'detail', 'instance', 'error'],
      properties: {
        type: { type: 'string', format: 'uri' },
        title: string,
        status: { type: 'integer', minimum: 400, maximum: 599 },
        detail: string,
        instance: string,
        error: ref('ProblemError'),
      },
    },
    ProblemError: {
      type: 'object',
      required: ['code', 'message', 'hint', 'documentation_url'],
      properties: {
        code: { type: 'string', enum: [...API_ERROR_CODES] },
        message: string,
        hint: string,
        documentation_url: { type: 'string', format: 'uri' },
      },
    },
    SiteProblem: {
      type: 'object',
      description:
        'The 404 an agent or JSON client gets for a missed site file (RFC 9457, `type: about:blank`, with the llms.txt guide).',
      required: ['type', 'title', 'status', 'instance'],
      properties: {
        type: { type: 'string', const: 'about:blank' },
        title: string,
        status: { type: 'integer', const: 404 },
        instance: string,
        guide: { type: 'string', format: 'uri' },
      },
    },
    McpProblem: {
      type: 'object',
      description: 'An HTTP-level refusal of the MCP endpoint (RFC 9457, `type: about:blank`).',
      required: ['type', 'title', 'status'],
      properties: {
        type: { type: 'string', const: 'about:blank' },
        title: string,
        status: { type: 'integer' },
        detail: string,
        docs: { type: 'string', format: 'uri' },
        serverCard: string,
      },
    },
    ApiIndex: {
      type: 'object',
      required: ['name', 'version', 'status', 'documentation', 'openapi', 'endpoints'],
      properties: {
        name: string,
        version: string,
        status: { type: 'string', enum: ['in-development', 'released'] },
        statusNote: string,
        documentation: { type: 'string', format: 'uri' },
        openapi: { type: 'string', format: 'uri' },
        health: { type: 'string', format: 'uri' },
        authentication: { type: 'string', const: 'none' },
        rateLimit: {
          type: 'object',
          properties: {
            policy: string,
            quota: { type: 'integer' },
            windowSeconds: { type: 'integer' },
            scope: string,
          },
        },
        versioning: { type: 'object' },
        license: string,
        endpoints: { type: 'array', items: endpoint },
      },
    },
    Health: {
      type: 'object',
      required: ['status', 'service', 'version', 'release', 'builtAt', 'endpoints'],
      properties: {
        status: { type: 'string', const: 'ok' },
        service: string,
        version: string,
        release: { type: 'string', enum: ['in-development', 'released'] },
        builtAt: { type: 'string', format: 'date-time' },
        endpoints: { type: 'integer', minimum: 0 },
        note: string,
      },
    },
    Catalog: {
      type: 'object',
      description: 'The catalog snapshot `@texuli/catalog` validates against.',
      required: ['format', 'version', 'groups', 'tiers', 'entries'],
      properties: {
        format: string,
        version: { type: 'integer' },
        groups: { type: 'object', additionalProperties: true },
        tiers: { type: 'object', additionalProperties: true },
        entries: { type: 'array', items: ref('CatalogEntry') },
      },
    },
    CatalogEntry: {
      type: 'object',
      required: ['id', 'label', 'package', 'summary', 'group', 'tier', 'emit', 'props'],
      properties: {
        id: string,
        label: string,
        package: string,
        summary: string,
        group: string,
        tier: string,
        emit: { type: 'array', items: { type: 'string', enum: ['developer', 'untrusted'] } },
        agentEmittable: { type: 'boolean' },
        props: { type: 'array', items: { type: 'object', additionalProperties: true } },
        events: stringList,
        examples: { type: 'array', items: { type: 'object', additionalProperties: true } },
        useWhen: stringList,
        dontUseWhen: stringList,
        related: stringList,
      },
      additionalProperties: true,
    },
    ThemeSwatches: swatches(['background', 'foreground', 'primary', 'accent', 'surface']),
    ThemeCatalogEntry: {
      type: 'object',
      required: ['id', 'name', 'description', 'category', 'collection', 'tags', 'swatches'],
      properties: {
        id: string,
        name: string,
        description: string,
        category: string,
        collection: string,
        tags: stringList,
        swatches: ref('ThemeSwatches'),
      },
      additionalProperties: true,
    },
    ThemeCatalog: { type: 'array', items: ref('ThemeCatalogEntry') },
    ThemeDarkSwatches: {
      type: 'object',
      required: ['id', 'swatches'],
      properties: { id: string, swatches: ref('ThemeSwatches') },
    },
    ThemeDarkSwatchList: { type: 'array', items: ref('ThemeDarkSwatches') },
    ThemeGalleryCard: {
      type: 'object',
      required: ['id', 'name', 'category', 'contrastLevel', 'pass', 'issueCount', 'swatches'],
      properties: {
        id: string,
        name: string,
        description: string,
        category: string,
        collection: string,
        tags: stringList,
        darkFirst: { type: 'boolean' },
        contrastLevel: string,
        pass: { type: 'boolean', description: 'WCAG 2.x AA passes in light and dark.' },
        issueCount: { type: 'integer', minimum: 0 },
        scores: { type: 'array', items: { type: 'object', additionalProperties: true } },
        swatches: {
          type: 'object',
          description: 'Key colors per preview mode.',
          additionalProperties: {
            ...swatches([
              'background',
              'foreground',
              'primary',
              'primaryForeground',
              'accent',
              'muted',
              'border',
            ]),
          },
        },
      },
      additionalProperties: true,
    },
    ThemeGalleryCardList: { type: 'array', items: ref('ThemeGalleryCard') },
    ThemeData: {
      type: 'object',
      description: "The color explorer's payload for one theme.",
      required: ['id', 'name'],
      properties: {
        id: string,
        name: string,
        description: string,
        category: string,
        contrastLevel: string,
      },
      additionalProperties: true,
    },
    TwinsManifest: {
      type: 'object',
      required: ['twins'],
      properties: {
        twins: {
          type: 'object',
          description: 'Page route → Markdown twin path.',
          additionalProperties: { type: 'string', pattern: '^/.*\\.md$' },
        },
      },
    },
    JsonRpcRequest: {
      type: 'object',
      description: 'One JSON-RPC 2.0 message: a request (with `id`) or a notification.',
      required: ['jsonrpc', 'method'],
      properties: {
        jsonrpc: { type: 'string', const: '2.0' },
        id: { type: ['string', 'integer'] },
        method: {
          type: 'string',
          examples: ['initialize', 'tools/list', 'tools/call', 'resources/read'],
        },
        params: { type: 'object', additionalProperties: true },
      },
    },
    JsonRpcBatch: {
      type: 'array',
      minItems: 1,
      maxItems: facts.mcp.batchMax,
      items: ref('JsonRpcRequest'),
    },
    ToolsCallParams: {
      type: 'object',
      description:
        'The `params` of `tools/call`: an operation name and its arguments (the McpTool_*_Input schemas).',
      required: ['name'],
      properties: {
        name: { type: 'string', enum: facts.operations.map((operation) => operation.name) },
        arguments: { type: 'object', additionalProperties: true },
      },
    },
    JsonRpcError: {
      type: 'object',
      required: ['code', 'message'],
      properties: { code: { type: 'integer' }, message: string, data: {} },
    },
    JsonRpcResponse: {
      type: 'object',
      required: ['jsonrpc', 'id'],
      properties: {
        jsonrpc: { type: 'string', const: '2.0' },
        id: { type: ['string', 'integer', 'null'] },
        result: { type: 'object', additionalProperties: true },
        error: ref('JsonRpcError'),
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Operations

function problemContent(example?: unknown): Schema {
  return {
    'application/problem+json': {
      schema: ref('Problem'),
      ...(example === undefined ? {} : { examples: { default: { value: example } } }),
    },
  };
}

function resourceOperation(
  facts: OpenApiFacts,
  resource: ApiResource,
  versioned: boolean
): { path: string; operation: Schema } {
  const path = versioned ? resource.alias : resource.path;
  const api = path.startsWith('/api/');
  const headers = api
    ? {
        'X-API-Version': headerRef('XApiVersion'),
        'RateLimit-Policy': headerRef('RateLimitPolicy'),
        RateLimit: headerRef('RateLimit'),
        Deprecation: headerRef('Deprecation'),
        Sunset: headerRef('Sunset'),
        ETag: headerRef('ETag'),
      }
    : { ETag: headerRef('ETag') };
  const example = facts.examples[resource.schema];
  const exampleValue = resource.parameter ? facts.parameterExamples[resource.key] : undefined;
  const concrete = exampleValue === undefined ? path : path.replace(/\{[a-z]+\}/, exampleValue);
  const responses: Schema = {
    '200': {
      description: resource.title,
      headers,
      content: {
        'application/json': {
          schema: ref(resource.schema),
          ...(example === undefined
            ? {}
            : { examples: { default: { $ref: `#/components/examples/${resource.schema}` } } }),
        },
      },
    },
    '304': { description: 'Not modified (the `If-None-Match` validator matched).', headers },
    '404': {
      description: api
        ? 'No resource at this path. Under /api/ every miss is problem details, never HTML.'
        : 'No file at this path. Agent clients and JSON clients get problem details; browsers get the HTML 404 page.',
      content: api
        ? problemContent(
            apiProblem('resource_not_found', `${API_PREFIX}/no-such-file.json`, facts.origin)
          )
        : { 'application/problem+json': { schema: ref('SiteProblem') } },
    },
  };
  if (api) {
    responses['405'] = {
      description: 'A method other than GET, HEAD or OPTIONS.',
      headers: { 'X-API-Version': headerRef('XApiVersion') },
      content: problemContent(apiProblem('method_not_allowed', concrete, facts.origin)),
    };
    responses['429'] = {
      description: `More than ${API_RATE_LIMIT.capacity} requests per ${API_RATE_LIMIT.windowSeconds} seconds from one client. Wait the Retry-After delay.`,
      headers: { ...headers, 'Retry-After': headerRef('RetryAfter') },
      content: problemContent(apiProblem('rate_limited', concrete, facts.origin)),
    };
  }
  const description = [
    resource.summary,
    versioned
      ? `The same bytes as ${resource.path}, under the versioned prefix: pin this path.`
      : api
        ? `Also served as ${resource.alias}.`
        : `A file the site's own pages fetch; it follows the site and may change in any release. The same bytes are served as ${resource.alias}, which is versioned.`,
  ].join(' ');
  return {
    path,
    operation: {
      operationId: versioned ? aliasOperationId(resource) : resource.operationId,
      tags: [resource.tag],
      summary: resource.title,
      description,
      ...(resource.parameter ? { parameters: [{ $ref: '#/components/parameters/ThemeId' }] } : {}),
      responses,
    },
  };
}

function mcpOperation(facts: OpenApiFacts): Schema {
  const limits = {
    'RateLimit-Policy': headerRef('RateLimitPolicy'),
    RateLimit: headerRef('RateLimit'),
  };
  const mcpProblem = (description: string, extra: Schema = {}) => ({
    description,
    headers: { ...limits, ...extra },
    content: { 'application/problem+json': { schema: ref('McpProblem') } },
  });
  const first = facts.operations[0];
  return {
    operationId: 'callMcp',
    tags: ['mcp'],
    summary: 'Call the remote MCP server (JSON-RPC)',
    description: [
      `The read-only Texuli MCP server over stateless Streamable HTTP, protocol ${facts.mcp.protocolVersion} (also ${facts.mcp.protocolVersions.filter((version) => version !== facts.mcp.protocolVersion).join(', ')}).`,
      'POST one JSON-RPC message or a batch; responses are JSON (no SSE stream, no session). A notification gets 202 with no body.',
      `Tools (\`tools/call\` names): ${facts.operations.map((operation) => operation.name).join(', ')}. Their argument and result schemas are the McpTool_* components and \`x-mcp-tools\` below.`,
      `Limits: ${facts.mcp.capacity} messages per client per ${facts.mcp.windowSeconds} seconds (each message of a batch counts), batches of at most ${facts.mcp.batchMax}, bodies of at most ${facts.mcp.bodyMax} bytes.`,
      'Browsers may call it only from texuli.com; a server-side agent sends no Origin header and is allowed.',
    ].join(' '),
    externalDocs: {
      description: 'The MCP server: tools, resources, prompts',
      url: facts.mcp.docsUrl,
    },
    parameters: [
      {
        name: 'MCP-Protocol-Version',
        in: 'header',
        required: false,
        schema: { type: 'string', enum: [...facts.mcp.protocolVersions] },
      },
    ],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: { oneOf: [ref('JsonRpcRequest'), ref('JsonRpcBatch')] },
          examples: {
            initialize: {
              value: {
                jsonrpc: '2.0',
                id: 1,
                method: 'initialize',
                params: {
                  protocolVersion: facts.mcp.protocolVersion,
                  capabilities: {},
                  clientInfo: { name: 'example-agent', version: '1.0.0' },
                },
              },
            },
            toolsList: { value: { jsonrpc: '2.0', id: 2, method: 'tools/list' } },
            ...(first
              ? {
                  toolsCall: {
                    value: {
                      jsonrpc: '2.0',
                      id: 3,
                      method: 'tools/call',
                      params: { name: first.name, arguments: {} },
                    },
                  },
                }
              : {}),
          },
        },
      },
    },
    responses: {
      '200': {
        description: 'The JSON-RPC response (an array for a batch).',
        headers: limits,
        content: {
          'application/json': {
            schema: {
              oneOf: [ref('JsonRpcResponse'), { type: 'array', items: ref('JsonRpcResponse') }],
            },
            examples: {
              toolsList: {
                value: {
                  jsonrpc: '2.0',
                  id: 2,
                  result: {
                    tools: facts.operations.slice(0, 1).map((operation) => ({
                      name: operation.name,
                      title: operation.title,
                      description: operation.summary,
                    })),
                  },
                },
              },
            },
          },
        },
      },
      '202': { description: 'Only notifications or client responses were sent.', headers: limits },
      '400': {
        description:
          'Parse error, an invalid request or batch, or an unsupported MCP-Protocol-Version (a JSON-RPC error with id null).',
        headers: limits,
        content: { 'application/json': { schema: ref('JsonRpcResponse') } },
      },
      '403': mcpProblem('The Host or the browser Origin is not allowed.'),
      '405': mcpProblem('Any method but POST and OPTIONS.'),
      '406': mcpProblem('The Accept header does not allow application/json.'),
      '413': mcpProblem(`The body is over ${facts.mcp.bodyMax} bytes.`),
      '415': mcpProblem('The Content-Type is not application/json.'),
      '429': mcpProblem('Over the rate limit; wait the Retry-After delay.', {
        'Retry-After': headerRef('RetryAfter'),
      }),
    },
    'x-mcp-server-card': new URL(facts.mcp.serverCard, facts.origin).href,
    'x-mcp-tools': facts.operations.map((operation) => ({
      name: operation.name,
      title: operation.title,
      summary: operation.summary,
      inputSchema: ref(toolSchemaName(operation.name, 'Input')),
      outputSchema: ref(toolSchemaName(operation.name, 'Output')),
    })),
  };
}

// ---------------------------------------------------------------------------
// The document

/** The OpenAPI 3.1 document of texuli.com. */
export function buildOpenApi(facts: OpenApiFacts): Record<string, unknown> {
  const at = (path: string) => new URL(path, facts.origin).href;
  const paths: Record<string, Record<string, unknown>> = {};
  for (const resource of API_RESOURCES) {
    for (const versioned of [true, false]) {
      const { path, operation } = resourceOperation(facts, resource, versioned);
      paths[path] = { get: operation };
    }
  }
  paths[API_PATHS.mcp] = { post: mcpOperation(facts) };

  const schemas: Record<string, Schema> = baseSchemas(facts);
  for (const operation of facts.operations) {
    schemas[toolSchemaName(operation.name, 'Input')] = operation.input;
    schemas[toolSchemaName(operation.name, 'Output')] = operation.output;
  }

  return {
    openapi: '3.1.0',
    jsonSchemaDialect: 'https://json-schema.org/draft/2020-12/schema',
    info: {
      title: 'Texuli public API (texuli.com)',
      version: facts.version,
      summary:
        'Read-only JSON files of texuli.com (the component catalog, themes, the Markdown twins manifest) and the remote MCP server.',
      description: [
        `**${API_RELEASE_STATUS.note}**`,
        '',
        'texuli.com is a static site on Cloudflare Pages: every GET endpoint is a file the build writes, fronted by an edge middleware. The endpoints under /api/v1/ are the same bytes as the files the site fetches, under a versioned prefix.',
        '',
        '## Authentication',
        '',
        `None. Every endpoint is public, anonymous and read-only. See ${at('/auth.md')}.`,
        '',
        '## Limits',
        '',
        `/api/: ${API_RATE_LIMIT.capacity} requests per client per ${API_RATE_LIMIT.windowSeconds} seconds (\`RateLimit-Policy: "${API_RATE_LIMIT.name}";q=${API_RATE_LIMIT.capacity};w=${API_RATE_LIMIT.windowSeconds}\`), and /mcp: ${facts.mcp.capacity} messages per client per ${facts.mcp.windowSeconds} seconds. Both are best-effort per edge isolate. Past a limit the answer is 429 with Retry-After. The RateLimit fields and the 429 come from the Pages middleware; a static file served without it carries X-API-Version and CORS from _headers, and no rate-limit fields.`,
        '',
        '## Versioning and deprecation',
        '',
        `Every /api/ response carries X-API-Version (${facts.version}, the release line). ${API_VERSIONING.policy}`,
        '',
        '## Errors',
        '',
        'Failed /api/ requests return RFC 9457 `application/problem+json` (type, title, status, detail, instance) plus an `error` object with a stable code, a message, a hint and the documentation URL. HTML is never returned under /api/.',
      ].join('\n'),
      contact: { name: 'Dailybot, Inc.', url: REPOSITORY },
      license: { ...LICENSE },
    },
    externalDocs: { description: 'The Texuli developer portal', url: at(API_PATHS.docs) },
    servers: [
      { url: facts.origin, description: 'texuli.com (Cloudflare Pages, deployed from main)' },
    ],
    security: [],
    tags: [
      { name: 'api', description: 'The index and the health file.' },
      { name: 'catalog', description: 'The agent component catalog.' },
      { name: 'themes', description: 'The theme library.' },
      { name: 'twins', description: 'The Markdown twin of every page.' },
      {
        name: 'mcp',
        description: 'The remote MCP server.',
        externalDocs: { url: facts.mcp.docsUrl },
      },
    ],
    'x-versioning': {
      strategy: ['url-prefix', 'response-header'],
      current: facts.version,
      prefix: `${API_PREFIX}/`,
      header: API_VERSIONING.header,
      deprecation: {
        headers: [...API_VERSIONING.deprecationHeaders],
        specification: ['RFC 9745', 'RFC 8594'],
        policy: API_VERSIONING.policy,
      },
    },
    paths,
    components: {
      schemas,
      // Each example once, referenced by the path and its /api/v1/ alias.
      examples: Object.fromEntries(
        Object.entries(facts.examples).map(([name, value]) => [
          name,
          { summary: `A real ${name} body from the build (lists cut short)`, value },
        ])
      ),
      parameters: {
        ThemeId: {
          name: 'id',
          in: 'path',
          required: true,
          description: 'A library theme id, as listed by listThemes.',
          schema: { type: 'string', pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$' },
          ...(facts.parameterExamples.theme ? { example: facts.parameterExamples.theme } : {}),
        },
      },
      headers: {
        XApiVersion: {
          description: 'The release line that built the response.',
          schema: { type: 'string', example: facts.version },
        },
        RateLimitPolicy: {
          description:
            'The quota (draft-ietf-httpapi-ratelimit-headers): `"name";q=<requests>;w=<seconds>`.',
          schema: {
            type: 'string',
            example: `"${API_RATE_LIMIT.name}";q=${API_RATE_LIMIT.capacity};w=${API_RATE_LIMIT.windowSeconds}`,
          },
        },
        RateLimit: {
          description: 'What is left: `"name";r=<remaining>;t=<seconds until full>`.',
          schema: { type: 'string', example: `"${API_RATE_LIMIT.name}";r=299;t=1` },
        },
        RetryAfter: {
          description: 'Seconds to wait before retrying (RFC 9110).',
          schema: { type: 'integer', minimum: 1 },
        },
        Deprecation: {
          description: 'Sent only on a deprecated endpoint (RFC 9745). None is deprecated today.',
          schema: { type: 'string' },
        },
        Sunset: {
          description: 'Sent only on a deprecated endpoint: when it stops serving (RFC 8594).',
          schema: { type: 'string' },
        },
        ETag: { description: 'The validator for If-None-Match.', schema: { type: 'string' } },
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Structural checks (the build and the tests run the same ones)

/** Every `$ref` string in a value. */
export function collectRefs(value: unknown, into: string[] = []): string[] {
  if (Array.isArray(value)) for (const item of value) collectRefs(item, into);
  else if (value && typeof value === 'object')
    for (const [key, child] of Object.entries(value)) {
      if (key === '$ref' && typeof child === 'string') into.push(child);
      else collectRefs(child, into);
    }
  return into;
}

/** Resolve a local JSON pointer (`#/components/schemas/X`), or undefined. */
export function resolvePointer(document: unknown, pointer: string): unknown {
  if (!pointer.startsWith('#/')) return undefined;
  let node: unknown = document;
  for (const raw of pointer.slice(2).split('/')) {
    const key = raw.replace(/~1/g, '/').replace(/~0/g, '~');
    if (!node || typeof node !== 'object' || !Object.hasOwn(node, key)) return undefined;
    node = (node as Record<string, unknown>)[key];
  }
  return node;
}

const METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'];

export interface OpenApiCheckOptions {
  /** Whether the build serves this concrete root-relative path. */
  exists: (path: string) => boolean;
  /** The values of each path parameter to try, by template path. */
  expand: (template: string) => readonly string[];
  /** Paths answered by a Function, not a file (`/mcp`). */
  functionPaths?: readonly string[];
}

/**
 * The structural problems of a document: duplicate or missing operationIds,
 * operations without a typed 2xx JSON schema, unresolved `$ref`s, and
 * described paths the build does not serve. An empty list passes.
 */
export function checkOpenApi(
  document: Record<string, unknown>,
  options: OpenApiCheckOptions
): string[] {
  const problems: string[] = [];
  if (document.openapi !== '3.1.0') problems.push('openapi is not 3.1.0');
  const seen = new Set<string>();
  const paths = (document.paths ?? {}) as Record<string, Record<string, Schema>>;
  for (const [path, item] of Object.entries(paths)) {
    for (const method of METHODS) {
      const operation = item[method];
      if (!operation) continue;
      const id = operation.operationId;
      if (typeof id !== 'string' || id === '') problems.push(`${method} ${path}: no operationId`);
      else if (seen.has(id)) problems.push(`${method} ${path}: duplicate operationId ${id}`);
      else seen.add(id);
      const ok = Object.entries((operation.responses ?? {}) as Record<string, Schema>).find(
        ([status]) => status.startsWith('2')
      );
      const content = (ok?.[1]?.content ?? {}) as Record<string, Schema>;
      if (!content['application/json']?.schema)
        problems.push(`${method} ${path}: no application/json schema on its 2xx response`);
    }
    if (options.functionPaths?.includes(path)) continue;
    const templated = /\{[a-z]+\}/i.test(path);
    const concrete = templated
      ? options.expand(path).map((value) => path.replace(/\{[a-z]+\}/i, value))
      : [path];
    if (concrete.length === 0) problems.push(`${path}: no parameter values to check`);
    for (const candidate of concrete)
      if (!options.exists(candidate)) problems.push(`${path}: ${candidate} is not built`);
  }
  for (const pointer of new Set(collectRefs(document)))
    if (resolvePointer(document, pointer) === undefined)
      problems.push(`unresolved $ref ${pointer}`);
  return problems;
}
