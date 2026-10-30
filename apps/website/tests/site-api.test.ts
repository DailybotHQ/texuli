// @vitest-environment node
/**
 * The public JSON API (PLAN_011 T-ar-api): the typed surface
 * (`src/lib/api-surface.ts`), the OpenAPI generator and its structural
 * check (`src/lib/openapi.ts`), the edge envelope with its rate limit,
 * headers and RFC 9457 problems (`functions/_lib/api-endpoint.ts`), the
 * middleware route, the ARD and API catalogs, and the WebAPI JSON-LD. The
 * built files are checked by tests/e2e/site-developers.spec.ts.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { TOOLS_VERSION, texuliOps } from '@texuli/tools/ops';
import { describe, expect, it } from 'vitest';
import { createApiLimiter, handleApiRequest } from '../../../functions/_lib/api-endpoint.ts';
import { createTokenBucket } from '../../../functions/_lib/mcp-endpoint.ts';
import { onRequest } from '../../../functions/_middleware.ts';
import { MCP_SERVER_DATA } from '../src/components/mcp-server/mcp-server-data.ts';
import { aiCatalog, apiCatalog } from '../src/components/seo/agent-discovery.ts';
import {
  API_ERROR_CODES,
  API_RATE_LIMIT,
  API_RESOURCES,
  API_VERSION,
  aliasOperationId,
  aliasSource,
  apiAssetPath,
  apiHeaderRules,
  apiProblem,
  fillPath,
  isApiPath,
  problemInstance,
} from '../src/lib/api-surface.ts';
import {
  apiEndpoints,
  buildApiIndex,
  buildHealth,
  buildOpenApi,
  checkOpenApi,
  collectRefs,
  type McpOperationFacts,
  type OpenApiFacts,
  resolvePointer,
  toolSchemaName,
} from '../src/lib/openapi.ts';
import { webApiJsonLd } from '../src/lib/schema.ts';

const ORIGIN = 'https://texuli.com';

const remoteOperations = (): McpOperationFacts[] =>
  texuliOps
    .list()
    .filter((operation) => operation.runtime !== 'node')
    .map(({ name, title, summary, input, output }) => ({
      name,
      title,
      summary,
      input: input as Record<string, unknown>,
      output: output as Record<string, unknown>,
    }));

function facts(operations = remoteOperations()): OpenApiFacts {
  return {
    origin: ORIGIN,
    version: TOOLS_VERSION,
    operations,
    mcp: {
      protocolVersion: MCP_SERVER_DATA.protocolVersion,
      protocolVersions: MCP_SERVER_DATA.protocolVersions,
      capacity: 60,
      windowSeconds: 60,
      batchMax: 10,
      bodyMax: 262144,
      docsUrl: 'https://github.com/DailybotHQ/texuli/blob/main/packages/tools/docs/mcp.md',
      serverCard: '/.well-known/mcp/server-card.json',
    },
    parameterExamples: { theme: 'ocean' },
    examples: { TwinsManifest: { twins: { '/': '/index.md' } } },
  };
}

const allBuilt = { exists: () => true, expand: () => ['ocean'], functionPaths: ['/mcp'] };

type Operation = {
  operationId: string;
  tags: string[];
  responses: Record<string, { content?: Record<string, { schema?: unknown }> }>;
};
type Doc = {
  info: { version: string; license: { name: string; identifier: string } };
  servers: { url: string }[];
  paths: Record<string, Record<string, Operation>>;
  components: { schemas: Record<string, { required?: string[] }> };
};

describe('the API surface (api-surface.ts)', () => {
  it('versions with the release line of the registry', () => {
    expect(API_VERSION).toBe(TOOLS_VERSION);
  });

  it('maps every /api/v1/ alias to its source file, a parameter only when it is a plain id', () => {
    for (const resource of API_RESOURCES) {
      const value = resource.parameter ? 'volt-green' : undefined;
      expect(aliasSource(fillPath(resource.alias, value)), resource.alias).toBe(
        fillPath(resource.path, value)
      );
    }
    expect(aliasSource('/api/v1/index.json')).toBe('/api/index.json');
    expect(aliasSource('/api/v1/twins.json')).toBe('/md-manifest.json');
    expect(aliasSource('/api/v1/themes/ocean.json')).toBe('/theme-data/ocean.json');
    // Hostile or unknown ids map to nothing: no alias can name another file.
    for (const path of [
      '/api/v1/themes/../../_headers.json',
      '/api/v1/themes/a/b.json',
      '/api/v1/themes/.json',
      '/api/v1/themes/Ocean.json',
      '/api/v1/themes/ocean%2F..json',
      '/api/v1/themes/-ocean.json',
      '/api/v1/themes/ocean.json.json',
      '/api/v1/nope.json',
      '/api/v1/catalog.json/',
      '/api/catalog.json',
    ])
      expect(aliasSource(path), path).toBeNull();
  });

  it('routes /api paths to the envelope, never the analytics proxy', () => {
    for (const path of ['/api', '/api/', '/api/v1/catalog.json', '/api/nope', '/api/umamix'])
      expect(isApiPath(path), path).toBe(true);
    for (const path of ['/apix', '/api-catalog', '/api/umami', '/api/umami/api/send', '/'])
      expect(isApiPath(path), path).toBe(false);
    expect(apiAssetPath('/api')).toBe('/api/index.json');
    expect(apiAssetPath('/api/')).toBe('/api/index.json');
    expect(apiAssetPath('/api/v1')).toBe('/api/index.json');
    expect(apiAssetPath('/api/v1/')).toBe('/api/index.json');
    expect(apiAssetPath('/api/v1/themes.json')).toBe('/theme-catalog.json');
    expect(apiAssetPath('/api/v1/nope.json')).toBeNull();
    expect(apiAssetPath('/api/health.json')).toBe('/api/health.json');
  });

  it('builds RFC 9457 problems with a typed error object', () => {
    for (const code of API_ERROR_CODES) {
      const problem = apiProblem(code, '/api/v1/x.json', ORIGIN);
      expect(problem.type).toBe(`${ORIGIN}/developers/#errors`);
      expect(problem.error.code).toBe(code);
      expect(problem.error.documentation_url).toBe(`${ORIGIN}/developers/`);
      expect(problem.detail).toBe(problem.error.message);
      expect(problem.instance).toBe('/api/v1/x.json');
    }
    expect(apiProblem('resource_not_found', '/a', ORIGIN).status).toBe(404);
    expect(apiProblem('method_not_allowed', '/a', ORIGIN).status).toBe(405);
    expect(apiProblem('rate_limited', '/a', ORIGIN).status).toBe(429);
    expect(apiProblem('internal_error', '/a', ORIGIN).status).toBe(500);
  });

  it('echoes a hostile path only as capped text without control characters', () => {
    expect(problemInstance('/api/a\u0000b\nc\u007f')).toBe('/api/abc');
    const long = problemInstance(`/api/${'x'.repeat(5000)}`);
    expect(long.length).toBe(201);
    expect(long.endsWith('…')).toBe(true);
  });

  it('writes the _headers rules for /api/* and /openapi.json', () => {
    const [api, openapi] = apiHeaderRules();
    expect(api).toBe(
      `/api/*\n  X-API-Version: ${API_VERSION}\n  Access-Control-Allow-Origin: *\n  Access-Control-Expose-Headers: X-API-Version, RateLimit, RateLimit-Policy, Retry-After, Deprecation, Sunset, ETag\n  X-Content-Type-Options: nosniff\n  Cache-Control: public, max-age=300, must-revalidate`
    );
    expect(openapi).toContain('/openapi.json\n  Content-Type: application/json; charset=utf-8\n');
    expect(openapi).toContain('\n  Access-Control-Allow-Origin: *');
  });
});

describe('the OpenAPI document (openapi.ts)', () => {
  const doc = buildOpenApi(facts()) as unknown as Doc;
  const operations = Object.entries(doc.paths).flatMap(([path, item]) =>
    Object.entries(item).map(([method, operation]) => ({ path, method, operation }))
  );

  it('is 3.1 with the release version, the MIT license and the server', () => {
    expect((doc as unknown as { openapi: string }).openapi).toBe('3.1.0');
    expect(doc.info.version).toBe(TOOLS_VERSION);
    expect(doc.info.license).toEqual({ name: 'MIT', identifier: 'MIT' });
    expect(doc.servers.map((server) => server.url)).toEqual([ORIGIN]);
  });

  it('passes its own structural check: unique operationIds, typed 2xx, resolved refs', () => {
    expect(checkOpenApi(doc as unknown as Record<string, unknown>, allBuilt)).toEqual([]);
    const ids = operations.map((entry) => entry.operation.operationId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const pointer of collectRefs(doc))
      expect(resolvePointer(doc, pointer), pointer).toBeDefined();
  });

  it('describes every resource and its /api/v1/ alias, plus POST /mcp', () => {
    for (const resource of API_RESOURCES) {
      expect(doc.paths[resource.path]?.get?.operationId).toBe(resource.operationId);
      expect(doc.paths[resource.alias]?.get?.operationId).toBe(aliasOperationId(resource));
      const schema = doc.paths[resource.alias]?.get?.responses['200']?.content?.['application/json']
        ?.schema as { $ref: string };
      expect(schema.$ref).toBe(`#/components/schemas/${resource.schema}`);
    }
    const mcp = doc.paths['/mcp']?.post as Operation & { 'x-mcp-tools': { name: string }[] };
    expect(mcp.operationId).toBe('callMcp');
    expect(mcp['x-mcp-tools'].map((tool) => tool.name)).toEqual(
      remoteOperations().map((operation) => operation.name)
    );
    expect(operations).toHaveLength(API_RESOURCES.length * 2 + 1);
    // Every operation: an operationId, a tag and a $ref schema on its JSON 2xx.
    for (const { path, operation } of operations) {
      expect(operation.operationId, path).toMatch(/^[a-zA-Z][a-zA-Z0-9]*$/);
      expect(operation.tags.length, path).toBe(1);
      expect(JSON.stringify(operation.responses['200']), path).toContain('#/components/schemas/');
    }
    // Index and alias entries match the document.
    expect(
      apiEndpoints()
        .map((endpoint) => endpoint.operationId)
        .sort()
    ).toEqual(operations.map((entry) => entry.operation.operationId).sort());
  });

  it('sends the version and rate-limit headers and the problem model on /api/ paths', () => {
    const alias = doc.paths['/api/v1/catalog.json']?.get as Operation & {
      responses: Record<string, { headers?: Record<string, unknown> }>;
    };
    expect(Object.keys(alias.responses['200']?.headers ?? {})).toEqual(
      expect.arrayContaining(['X-API-Version', 'RateLimit-Policy', 'RateLimit'])
    );
    expect(Object.keys(alias.responses['429']?.headers ?? {})).toContain('Retry-After');
    expect(JSON.stringify(alias.responses['404'])).toContain('#/components/schemas/Problem');
    // The Problem schema requires exactly what apiProblem returns.
    expect(doc.components.schemas.Problem?.required?.sort()).toEqual(
      Object.keys(apiProblem('rate_limited', '/a', ORIGIN)).sort()
    );
    expect(doc.components.schemas.ProblemError?.required?.sort()).toEqual(
      Object.keys(apiProblem('rate_limited', '/a', ORIGIN).error).sort()
    );
  });

  it('picks up a new remote operation with its schemas, without an edit', () => {
    const extra: McpOperationFacts = {
      name: 'site.search',
      title: 'Search the site',
      summary: 'A stand-in operation.',
      input: { type: 'object', properties: { query: { type: 'string' } } },
      output: { type: 'object' },
    };
    const grown = buildOpenApi(facts([...remoteOperations(), extra])) as unknown as Doc;
    expect(grown.components.schemas[toolSchemaName('site.search', 'Input')]).toEqual(extra.input);
    expect(JSON.stringify(grown.paths['/mcp'])).toContain('site.search');
    expect(checkOpenApi(grown as unknown as Record<string, unknown>, allBuilt)).toEqual([]);
  });

  it('accepts an /api/v1/ alias only when its source file is built (no alias file needed)', () => {
    // A build with the site files, the static API files and no alias file at all.
    const built = new Set([
      ...API_RESOURCES.filter((resource) => !resource.parameter).map((resource) => resource.path),
      '/theme-data/ocean.json',
    ]);
    const options = { ...allBuilt, exists: (path: string) => built.has(path) };
    expect(checkOpenApi(doc as unknown as Record<string, unknown>, options)).toEqual([]);
    for (const path of built) expect(path.startsWith('/api/v1/')).toBe(false);
    built.delete('/md-manifest.json');
    expect(checkOpenApi(doc as unknown as Record<string, unknown>, options)).toEqual([
      '/api/v1/twins.json: /api/v1/twins.json reads /md-manifest.json, which is not built',
      '/md-manifest.json: /md-manifest.json is not built',
    ]);
    // A described alias that maps to no resource is refused.
    const stray = structuredClone(doc) as unknown as Doc;
    stray.paths['/api/v1/stray.json'] = structuredClone(
      stray.paths['/api/v1/twins.json']
    ) as Record<string, Operation>;
    (stray.paths['/api/v1/stray.json']?.get as Operation).operationId = 'getStray';
    built.add('/md-manifest.json');
    expect(checkOpenApi(stray as unknown as Record<string, unknown>, options)).toEqual([
      '/api/v1/stray.json: /api/v1/stray.json is not an alias of any resource',
    ]);
  });

  it('reports duplicate operationIds, unresolved refs, untyped 2xx and unbuilt paths', () => {
    const broken = structuredClone(doc) as unknown as Doc;
    const catalog = broken.paths['/catalog/catalog.json']?.get as Operation;
    catalog.operationId = 'getCatalogV1';
    (catalog.responses['200'] as { content: unknown }).content = {
      'application/json': { schema: { $ref: '#/components/schemas/Nope' } },
    };
    const health = broken.paths['/api/health.json']?.get as Operation;
    (health.responses['200'] as { content: unknown }).content = {};
    const problems = checkOpenApi(broken as unknown as Record<string, unknown>, {
      ...allBuilt,
      exists: (path) => path !== '/theme-data/ocean.json',
    });
    expect(problems).toEqual(
      expect.arrayContaining([
        'get /catalog/catalog.json: duplicate operationId getCatalogV1',
        'unresolved $ref #/components/schemas/Nope',
        'get /api/health.json: no application/json schema on its 2xx response',
        '/api/v1/themes/{id}.json: /api/v1/themes/ocean.json reads /theme-data/ocean.json, which is not built',
      ])
    );
    expect(
      checkOpenApi(doc as unknown as Record<string, unknown>, { ...allBuilt, expand: () => [] })
    ).toContain('/theme-data/{id}.json: no parameter values to check');
  });

  it('builds the index and the health file from the same facts', () => {
    const index = buildApiIndex({ origin: ORIGIN, version: TOOLS_VERSION }) as {
      version: string;
      endpoints: { url: string; operationId: string }[];
      rateLimit: { quota: number };
    };
    expect(index.version).toBe(TOOLS_VERSION);
    expect(index.rateLimit.quota).toBe(API_RATE_LIMIT.capacity);
    expect(index.endpoints.map((endpoint) => endpoint.url)).toContain(`${ORIGIN}/mcp`);
    const health = buildHealth({
      version: TOOLS_VERSION,
      builtAt: new Date('2026-10-30T00:00:00Z'),
      endpoints: 3,
    }) as Record<string, unknown>;
    expect(health).toMatchObject({ status: 'ok', builtAt: '2026-10-30T00:00:00.000Z' });
  });
});

// ---------------------------------------------------------------------------
// The edge envelope

/** The static files: no /api/v1/ alias is a file. */
const FILES: Record<string, string> = {
  '/api/index.json': '{"name":"index"}',
  '/catalog/catalog.json': '{"entries":[]}',
  '/theme-data/ocean.json': '{"id":"ocean"}',
};

function deps(options: { capacity?: number; throws?: boolean } = {}) {
  const fetched: { path: string; headers: Headers }[] = [];
  return {
    fetched,
    deps: {
      limiter: options.capacity
        ? createTokenBucket({ name: 'api', capacity: options.capacity, windowSeconds: 60 })
        : createApiLimiter(),
      now: () => 1_000_000,
      fetchAsset: async (path: string, headers: Headers) => {
        fetched.push({ path, headers });
        if (options.throws) throw new Error('down');
        if (headers.get('if-none-match') === '"v1"')
          return new Response(null, { status: 304, headers: { etag: '"v1"' } });
        const body = FILES[path];
        return body === undefined
          ? new Response('<!doctype html><title>404</title>', {
              status: 404,
              headers: { 'content-type': 'text/html' },
            })
          : new Response(body, { status: 200, headers: { etag: '"v1"' } });
      },
    },
  };
}

const request = (path: string, init: RequestInit = {}) => new Request(`${ORIGIN}${path}`, init);

describe('the /api/ envelope (functions/_lib/api-endpoint.ts)', () => {
  it('serves an alias from its source file with the version, rate-limit, CORS and security headers', async () => {
    const { deps: d, fetched } = deps();
    const response = await handleApiRequest(request('/api/v1/catalog.json'), d);
    // The alias is read from the site file through the asset store.
    expect(fetched.map((entry) => entry.path)).toEqual(['/catalog/catalog.json']);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('{"entries":[]}');
    const h = response.headers;
    expect(h.get('content-type')).toBe('application/json; charset=utf-8');
    expect(h.get('x-api-version')).toBe(API_VERSION);
    expect(h.get('ratelimit-policy')).toBe('"api";q=300;w=60');
    expect(h.get('ratelimit')).toMatch(/^"api";r=299;t=\d+$/);
    expect(h.get('access-control-allow-origin')).toBe('*');
    expect(h.get('access-control-expose-headers')).toContain('X-API-Version');
    expect(h.get('x-content-type-options')).toBe('nosniff');
    expect(h.get('content-security-policy')).toBe("default-src 'none'; frame-ancestors 'none'");
    expect(h.get('etag')).toBe('"v1"');
    expect(h.get('link')).toContain('</openapi.json>; rel="service-desc"');
  });

  it('answers HEAD without a body, forwards validators for a 304, and maps directories to the index', async () => {
    const { deps: d, fetched } = deps();
    const head = await handleApiRequest(request('/api/v1/catalog.json', { method: 'HEAD' }), d);
    expect(head.status).toBe(200);
    expect(await head.text()).toBe('');
    const cached = await handleApiRequest(
      request('/api/v1/catalog.json', { headers: { 'if-none-match': '"v1"' } }),
      d
    );
    expect(cached.status).toBe(304);
    expect(cached.headers.get('x-api-version')).toBe(API_VERSION);
    expect(fetched.at(-1)?.headers.get('if-none-match')).toBe('"v1"');
    for (const [path, body] of [
      ['/api', '{"name":"index"}'],
      ['/api/', '{"name":"index"}'],
      ['/api/v1', '{"name":"index"}'],
      ['/api/v1/', '{"name":"index"}'],
      ['/api/v1/index.json', '{"name":"index"}'],
      ['/api/v1/themes/ocean.json', '{"id":"ocean"}'],
    ] as const) {
      const response = await handleApiRequest(request(path), d);
      expect(await response.text(), path).toBe(body);
    }
  });

  it('answers a miss with problem+json, never the HTML 404, for every client', async () => {
    const { deps: d, fetched } = deps();
    for (const path of ['/api/nope', '/api/v1/themes/../../etc/passwd', '/api/v1/%00.json']) {
      const response = await handleApiRequest(request(path), d);
      expect(response.status, path).toBe(404);
      expect(response.headers.get('content-type')).toBe('application/problem+json');
      expect(response.headers.get('x-api-version')).toBe(API_VERSION);
      const body = (await response.json()) as { error: { code: string }; instance: string };
      expect(body.error.code).toBe('resource_not_found');
      // biome-ignore lint/suspicious/noControlCharactersInRegex: asserting their absence.
      expect(body.instance).not.toMatch(/[\u0000-\u001f]/);
    }
    // Unmapped /api/v1/ paths never reach the asset store; other /api/ paths
    // (the traversal is normalized by URL parsing to /api/etc/passwd) are looked up and miss.
    expect(fetched.map((entry) => entry.path)).toEqual(['/api/nope', '/api/etc/passwd']);
  });

  it('refuses writes with 405 and Allow, and answers a CORS preflight', async () => {
    const { deps: d, fetched } = deps();
    for (const method of ['POST', 'PUT', 'DELETE', 'PATCH']) {
      const response = await handleApiRequest(request('/api/v1/catalog.json', { method }), d);
      expect(response.status, method).toBe(405);
      expect(response.headers.get('allow')).toBe('GET, HEAD, OPTIONS');
      expect(((await response.json()) as { error: { code: string } }).error.code).toBe(
        'method_not_allowed'
      );
    }
    const preflight = await handleApiRequest(
      request('/api/v1/catalog.json', { method: 'OPTIONS' }),
      d
    );
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get('access-control-allow-methods')).toBe('GET, HEAD, OPTIONS');
    expect(fetched).toEqual([]);
  });

  it('rate limits per client: 429 with Retry-After and a problem body, other clients unaffected', async () => {
    const { deps: d } = deps({ capacity: 2 });
    const as = (ip: string) =>
      handleApiRequest(request('/api/v1/catalog.json', { headers: { 'cf-connecting-ip': ip } }), d);
    expect((await as('192.0.2.1')).status).toBe(200);
    expect((await as('192.0.2.1')).status).toBe(200);
    const limited = await as('192.0.2.1');
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get('retry-after'))).toBeGreaterThanOrEqual(1);
    expect(limited.headers.get('ratelimit')).toMatch(/^"api";r=0;t=\d+$/);
    expect(limited.headers.get('x-api-version')).toBe(API_VERSION);
    expect(((await limited.json()) as { error: { code: string } }).error.code).toBe('rate_limited');
    expect((await as('192.0.2.2')).status).toBe(200);
  });

  it('answers 500 problem details when the asset store fails', async () => {
    const { deps: d } = deps({ throws: true });
    const response = await handleApiRequest(request('/api/v1/catalog.json'), d);
    expect(response.status).toBe(500);
    expect(((await response.json()) as { error: { code: string } }).error.code).toBe(
      'internal_error'
    );
  });
});

describe('the middleware route', () => {
  function context(path: string) {
    let nextCalls = 0;
    return {
      get nextCalls() {
        return nextCalls;
      },
      value: {
        request: request(path, { headers: { 'user-agent': 'curl/8.4.0' } }),
        next: async () => {
          nextCalls += 1;
          return new Response('proxied', { status: 200 });
        },
        env: {
          ASSETS: {
            fetch: async (asset: Request) => {
              const body = FILES[new URL(asset.url).pathname];
              return body === undefined
                ? new Response('missing', { status: 404 })
                : new Response(body, { status: 200 });
            },
          },
        },
      },
    };
  }

  it('sends /api/ through the envelope and leaves the analytics proxy alone', async () => {
    const api = context('/api/v1/catalog.json');
    const response = await onRequest(api.value);
    expect(response.headers.get('x-api-version')).toBe(API_VERSION);
    expect(response.headers.get('ratelimit-policy')).toBe('"api";q=300;w=60');
    expect(api.nextCalls).toBe(0);

    const umami = context('/api/umami/api/send');
    const proxied = await onRequest(umami.value);
    expect(await proxied.text()).toBe('proxied');
    expect(proxied.headers.get('x-api-version')).toBeNull();
    expect(umami.nextCalls).toBe(1);
  });
});

describe('the catalogs and the JSON-LD', () => {
  it('lists @texuli/mcp and @texuli/tools as npm packages in the ARD catalog', () => {
    const ard = aiCatalog({ origin: ORIGIN, openapi: true }) as {
      entries: { identifier: string; type: string; url: string }[];
    };
    const npm = ard.entries.filter((entry) => entry.type === 'application/vnd.npm.package+json');
    expect(npm.map((entry) => entry.url)).toEqual([
      'https://www.npmjs.com/package/texuli',
      'https://www.npmjs.com/package/@texuli/mcp',
      'https://www.npmjs.com/package/@texuli/tools',
    ]);
    expect(ard.entries.map((entry) => entry.url)).toContain(`${ORIGIN}/openapi.json`);
    const identifiers = ard.entries.map((entry) => entry.identifier);
    expect(new Set(identifiers).size).toBe(identifiers.length);
    const without = aiCatalog({ origin: ORIGIN, openapi: false }) as { entries: { url: string }[] };
    expect(without.entries.map((entry) => entry.url)).not.toContain(`${ORIGIN}/openapi.json`);
  });

  it('links the portal, the health file and the API index from the API catalog', () => {
    const linkset = apiCatalog({ origin: ORIGIN, openapi: true }) as {
      linkset: { links: { rel: string; href: string }[] }[];
    };
    const links = linkset.linkset[0]?.links ?? [];
    expect(links).toContainEqual(
      expect.objectContaining({ rel: 'service-desc', href: `${ORIGIN}/openapi.json` })
    );
    expect(links).toContainEqual(
      expect.objectContaining({ rel: 'service-doc', href: `${ORIGIN}/developers/` })
    );
    expect(links).toContainEqual(
      expect.objectContaining({ rel: 'status', href: `${ORIGIN}/api/health.json` })
    );
  });

  it('static discovery documents link only built files, never a Function-only /api/v1/ alias', () => {
    const llms = readFileSync(
      fileURLToPath(new URL('../public/llms.txt', import.meta.url)),
      'utf8'
    );
    const documents = [
      JSON.stringify(apiCatalog({ origin: ORIGIN, openapi: true })),
      JSON.stringify(aiCatalog({ origin: ORIGIN, openapi: true })),
      llms,
      JSON.stringify(webApiJsonLd('x')),
    ];
    for (const text of documents) expect(text).not.toMatch(/https:\/\/texuli\.com\/api\/v1\//);
    expect(llms).toContain('(https://texuli.com/api/index.json)');
  });

  it('describes the API as a WebAPI on /developers/', () => {
    const graph = webApiJsonLd('x')['@graph'][0] as Record<string, unknown>;
    expect(graph['@type']).toBe('WebAPI');
    expect(graph.url).toBe(`${ORIGIN}/developers/`);
    expect(graph.documentation).toBe(`${ORIGIN}/openapi.json`);
  });
});
