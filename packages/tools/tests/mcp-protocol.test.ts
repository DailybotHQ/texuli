// @vitest-environment node
/**
 * MCP protocol conformance: every method, every error code, version
 * negotiation, pagination cursors, oversized input, stateless and stateful
 * handlers, and the runtime filter. The handler is `createMcpHandler` over
 * the operations registry (`src/mcp/handler.ts`).
 */
import { readFileSync } from 'node:fs';
import { PassThrough } from 'node:stream';
import { listFullThemeLibrary } from '@texuli/tokens/library-expand';
import { expect, it } from 'vitest';
import { runDeckCommand } from '../src/deck/index.ts';
import { runDocumentCommand } from '../src/document/index.ts';
import {
  createMcpHandler,
  createTexuliMcpServer,
  MCP_ERROR_CODES,
  MCP_PROTOCOL_VERSION,
  MCP_SUPPORTED_PROTOCOL_VERSIONS,
  type McpHandler,
  type McpResourceProvider,
  runMcpStdio,
  TEXULI_PROMPTS,
} from '../src/mcp/index.ts';
import {
  createOperationRegistry,
  defineOperation,
  loadOpsCatalog,
  OPERATION_ERROR_CODES,
  type OperationErrorCode,
  texuliOps,
} from '../src/ops/index.ts';
import { scenario } from './scenario.ts';

type Rpc = {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: Record<string, unknown>;
  error?: { code: number; message: string; data?: unknown };
};
type Tool = {
  name: string;
  title?: string;
  description: string;
  inputSchema: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  annotations?: Record<string, boolean>;
};

const PUBLIC = new URL('../../../apps/website/public/', import.meta.url);
const VERSION = (
  JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
    version: string;
  }
).version;

let nextId = 1;
async function rpc(
  handle: McpHandler,
  method: string,
  params?: unknown,
  context?: Parameters<McpHandler>[1]
): Promise<Rpc> {
  const message = { jsonrpc: '2.0', id: nextId++, method, ...(params ? { params } : {}) };
  return (await handle(message, context)) as Rpc;
}

async function ready(
  options: Parameters<typeof createMcpHandler>[0] = {},
  protocolVersion = MCP_PROTOCOL_VERSION
) {
  const handle = createMcpHandler({ mode: 'stateful', ...options });
  const init = await rpc(handle, 'initialize', {
    protocolVersion,
    capabilities: {},
    clientInfo: { name: 'conformance', version: '1' },
  });
  await handle({ jsonrpc: '2.0', method: 'notifications/initialized' });
  return { handle, init };
}

/** Every item of a paginated list method, following `nextCursor`. */
async function walk(
  handle: McpHandler,
  method: string,
  key: string
): Promise<{ items: Record<string, unknown>[]; pages: number }> {
  const items: Record<string, unknown>[] = [];
  let cursor: string | undefined;
  let pages = 0;
  do {
    const page = await rpc(handle, method, cursor ? { cursor } : {});
    expect(page.error, `${method} page ${pages}`).toBeUndefined();
    items.push(...((page.result?.[key] ?? []) as Record<string, unknown>[]));
    cursor = page.result?.nextCursor as string | undefined;
    pages++;
  } while (cursor !== undefined && pages < 100);
  return { items, pages };
}

function textOf(response: Rpc): unknown {
  const content = response.result?.content as { type: string; text: string }[];
  expect(content[0]?.type).toBe('text');
  return JSON.parse(content[0]?.text ?? 'null');
}

it('negotiates the four protocol versions and shapes every result to the negotiated one', async () => {
  await scenario(
    'answers each supported version with that version and the right capabilities',
    async () => {
      expect(MCP_SUPPORTED_PROTOCOL_VERSIONS).toEqual([
        '2025-11-25',
        '2025-06-18',
        '2025-03-26',
        '2024-11-05',
      ]);
      for (const version of MCP_SUPPORTED_PROTOCOL_VERSIONS) {
        const { handle, init } = await ready({}, version);
        expect(init.result?.protocolVersion, version).toBe(version);
        expect(init.result?.serverInfo).toEqual({ name: 'texuli', version: VERSION });
        expect(typeof init.result?.instructions).toBe('string');
        const capabilities = init.result?.capabilities as Record<string, unknown>;
        expect(capabilities.tools).toEqual({ listChanged: false });
        expect(capabilities.resources).toEqual({ subscribe: false, listChanged: false });
        expect(capabilities.prompts).toEqual({ listChanged: false });
        expect(capabilities.logging).toBeUndefined();
        // The completions capability exists from 2025-03-26.
        expect(capabilities.completions, version).toEqual(
          version === '2024-11-05' ? undefined : {}
        );

        const tools = (await rpc(handle, 'tools/list')).result?.tools as Tool[];
        const search = tools.find((tool) => tool.name === 'catalog.search') as Tool;
        const modern = version >= '2025-06-18';
        expect(search.outputSchema !== undefined, `${version} outputSchema`).toBe(modern);
        expect(search.title !== undefined, `${version} title`).toBe(modern);
        expect(search.annotations !== undefined, `${version} annotations`).toBe(
          version !== '2024-11-05'
        );

        const call = await rpc(handle, 'tools/call', {
          name: 'catalog.search',
          arguments: { query: 'card', limit: 2 },
        });
        expect(call.result?.isError).toBeUndefined();
        expect(call.result?.structuredContent !== undefined, `${version} structured`).toBe(modern);
        if (modern) expect(textOf(call)).toEqual(call.result?.structuredContent);
      }
    }
  );
  await scenario(
    'answers an unknown version with the latest and refuses a missing one',
    async () => {
      const handle = createMcpHandler({ mode: 'stateful' });
      const unknown = await rpc(handle, 'initialize', { protocolVersion: '1999-01-01' });
      expect(unknown.result?.protocolVersion).toBe(MCP_PROTOCOL_VERSION);
      for (const params of [undefined, {}, { protocolVersion: 20251125 }, []]) {
        const missing = await rpc(handle, 'initialize', params);
        expect(missing.error?.code, JSON.stringify(params)).toBe(MCP_ERROR_CODES.invalidParams);
      }
    }
  );
});

it('keeps the initialization gate on stateful handlers and never requires it on stateless ones', async () => {
  await scenario(
    'stateful: only initialize and ping before notifications/initialized',
    async () => {
      const handle = createMcpHandler({ mode: 'stateful' });
      expect((await rpc(handle, 'ping')).result).toEqual({});
      for (const method of ['tools/list', 'resources/list', 'prompts/list', 'tools/call']) {
        const early = await rpc(handle, method, { name: 'catalog.search' });
        expect(early.error?.code, method).toBe(MCP_ERROR_CODES.notInitialized);
        expect(early.error?.message).toMatch(/initialize/u);
      }
      await rpc(handle, 'initialize', { protocolVersion: MCP_PROTOCOL_VERSION });
      expect((await rpc(handle, 'tools/list')).error?.code).toBe(MCP_ERROR_CODES.notInitialized);
      expect(await handle({ jsonrpc: '2.0', method: 'notifications/initialized' })).toBeUndefined();
      expect((await rpc(handle, 'tools/list')).result?.tools).toBeDefined();
    }
  );
  await scenario(
    'stateless: every method works without a handshake; initialize still answers',
    async () => {
      const handle = createMcpHandler({ mode: 'stateless' });
      expect((await rpc(handle, 'tools/list')).result?.tools).toBeDefined();
      expect(
        (await rpc(handle, 'resources/templates/list')).result?.resourceTemplates
      ).toBeDefined();
      expect((await rpc(handle, 'prompts/list')).result?.prompts).toBeDefined();
      const read = await rpc(handle, 'resources/read', { uri: 'texuli://schema/deck' });
      expect(read.result?.contents).toHaveLength(1);
      const init = await rpc(handle, 'initialize', { protocolVersion: '2025-06-18' });
      expect(init.result?.protocolVersion).toBe('2025-06-18');
      // A stateless handler keeps nothing between requests: the next request
      // still uses its own version (the HTTP MCP-Protocol-Version header).
      const old = await rpc(handle, 'tools/list', undefined, { protocolVersion: '2025-03-26' });
      expect(((old.result?.tools ?? []) as Tool[])[0]?.outputSchema).toBeUndefined();
      const current = await rpc(handle, 'tools/list');
      expect(((current.result?.tools ?? []) as Tool[])[0]?.outputSchema).toBeDefined();
      const unsupported = await rpc(handle, 'tools/list', undefined, {
        protocolVersion: '2020-01-01',
      });
      expect(unsupported.error?.code).toBe(MCP_ERROR_CODES.invalidRequest);
      expect(unsupported.error?.message).toContain('2025-11-25');
      expect(await handle({ jsonrpc: '2.0', method: 'notifications/initialized' })).toBeUndefined();
    }
  );
});

it('lists every served operation as a tool with schemas, annotations and cursor pagination', async () => {
  await scenario(
    'generates tools from the registry, operations first, then the aliases',
    async () => {
      const { handle } = await ready();
      const listed = (await rpc(handle, 'tools/list')).result?.tools as Tool[];
      const operations = texuliOps.list({ runtimes: ['edge', 'node'] });
      expect(listed.slice(0, operations.length).map((tool) => tool.name)).toEqual(
        operations.map((operation) => operation.name)
      );
      for (const operation of operations) {
        const tool = listed.find((item) => item.name === operation.name) as Tool;
        expect(tool.title).toBe(operation.title);
        expect(tool.description).toBe(texuliOps.describe(operation.name));
        expect(tool.inputSchema).toEqual(operation.input);
        expect(tool.outputSchema).toEqual(operation.output);
        expect(tool.annotations).toEqual({
          readOnlyHint: operation.annotations.readOnly,
          destructiveHint: operation.annotations.destructive,
          idempotentHint: operation.annotations.idempotent,
          openWorldHint: operation.annotations.openWorld,
        });
      }
      const aliases = listed.slice(operations.length);
      expect(aliases.map((tool) => tool.name)).toEqual(
        texuliOps.aliases().map((alias) => alias.name)
      );
      for (const alias of aliases) {
        expect(alias.description).toMatch(/^Deprecated alias of /u);
        expect(alias.outputSchema).toBeUndefined();
      }
    }
  );
  await scenario('pages with opaque cursors and refuses forged or foreign ones', async () => {
    const full = (
      ((await rpc((await ready()).handle, 'tools/list')).result?.tools ?? []) as Tool[]
    ).map((tool) => tool.name);
    const { handle } = await ready({ pageSize: 4 });
    const { items, pages } = await walk(handle, 'tools/list', 'tools');
    expect(items.map((tool) => tool.name)).toEqual(full);
    expect(pages).toBe(Math.ceil(full.length / 4));
    const first = await rpc(handle, 'tools/list');
    const cursor = first.result?.nextCursor as string;
    expect(cursor).toMatch(/^[A-Za-z0-9_-]+$/u);
    const prompts = await ready({ pageSize: 1 });
    const foreign = (await rpc(prompts.handle, 'prompts/list')).result?.nextCursor as string;
    for (const bad of ['', 'not-a-cursor', '!!!', foreign, `${cursor}x`, 42, 'x'.repeat(5000)]) {
      const refused = await rpc(handle, 'tools/list', { cursor: bad });
      expect(refused.error?.code, String(bad).slice(0, 20)).toBe(MCP_ERROR_CODES.invalidParams);
    }
  });
});

it('returns structuredContent with a text mirror, and every operation error code as an isError result', async () => {
  await scenario('mirrors structured output in text', async () => {
    const { handle } = await ready();
    const call = await rpc(handle, 'tools/call', {
      name: 'component.get',
      arguments: { id: 'card' },
    });
    expect(call.result?.isError).toBeUndefined();
    expect(call.result?.structuredContent).toMatchObject({ component: { id: 'card' } });
    expect(textOf(call)).toEqual(call.result?.structuredContent);
    const alias = await rpc(handle, 'tools/call', { name: 'component', arguments: { id: 'card' } });
    expect(alias.result?.structuredContent).toEqual(call.result?.structuredContent);
    const noArguments = await rpc(handle, 'tools/call', { name: 'catalog.search' });
    expect(
      (noArguments.result?.structuredContent as { total: number } | undefined)?.total
    ).toBeGreaterThan(0);
  });
  await scenario('reports each stable code from a real or test operation', async () => {
    const slow = defineOperation({
      name: 'test.slow',
      title: 'Slow',
      summary: 'Never finishes in time.',
      input: { type: 'object', additionalProperties: false },
      output: { type: 'object' },
      annotations: { readOnly: true, destructive: false, idempotent: true, openWorld: false },
      runtime: 'edge',
      limits: { inputBytes: 100, timeMs: 5 },
      examples: [],
      handler: () => new Promise((resolve) => setTimeout(() => resolve({}), 200)),
    });
    const registry = createOperationRegistry(
      [
        slow,
        {
          ...slow,
          name: 'test.bad-output',
          limits: { inputBytes: 100, timeMs: 500 },
          handler: () => 'text',
        },
        {
          ...slow,
          name: 'test.throws',
          limits: { inputBytes: 100, timeMs: 500 },
          handler: () => {
            throw new Error('boom');
          },
        },
        { ...slow, name: 'test.node', runtime: 'node', handler: () => ({}) },
      ],
      [
        {
          name: 'test-alias',
          targets: ['test.slow'],
          removeIn: '0.10.0',
          route: () => ({ name: 'nowhere', input: {} }),
        },
      ]
    );
    const local = (await ready()).handle;
    const custom = (await ready({ registry, runtimes: ['edge'], resources: [], prompts: [] }))
      .handle;
    const cases: Record<OperationErrorCode, [McpHandler, string, unknown]> = {
      'unknown-operation': [custom, 'test-alias', {}],
      'invalid-input': [local, 'catalog.search', { limit: 0 }],
      'input-too-large': [local, 'component.get', { id: 'a'.repeat(2000) }],
      'not-found': [local, 'component.get', { id: 'not-in-catalog' }],
      'runtime-unavailable': [custom, 'test.node', {}],
      'invalid-output': [custom, 'test.bad-output', {}],
      timeout: [custom, 'test.slow', {}],
      'operation-failed': [custom, 'test.throws', {}],
    };
    expect(Object.keys(cases).sort()).toEqual([...OPERATION_ERROR_CODES].sort());
    for (const [code, [handle, name, args]] of Object.entries(cases)) {
      const failed = await rpc(handle, 'tools/call', { name, arguments: args });
      expect(failed.error, code).toBeUndefined();
      expect(failed.result?.isError, code).toBe(true);
      expect(failed.result?.structuredContent, code).toBeUndefined();
      const body = textOf(failed) as { code: string; error: string };
      expect(body.code, code).toBe(code);
      expect(body.error.length, code).toBeGreaterThan(0);
    }
    const nonObject = await rpc(local, 'tools/call', { name: 'catalog.search', arguments: [1] });
    expect((textOf(nonObject) as { code: string }).code).toBe('invalid-input');
    expect((textOf(nonObject) as { issues?: unknown }).issues).toBeUndefined();
    const issues = await rpc(local, 'tools/call', {
      name: 'catalog.search',
      arguments: { nope: 1 },
    });
    expect((textOf(issues) as { issues: { path: string }[] }).issues[0]?.path).toBe('$.nope');
  });
  await scenario('keeps unknown tools and malformed calls protocol errors', async () => {
    const { handle } = await ready();
    for (const params of [
      { name: 'execute' },
      {},
      { name: 42 },
      undefined,
      { name: 'x'.repeat(300) },
    ]) {
      const refused = await rpc(handle, 'tools/call', params);
      expect(refused.error?.code, JSON.stringify(params)?.slice(0, 40)).toBe(
        MCP_ERROR_CODES.invalidParams
      );
    }
  });
});

it('serves only the runtime classes a handler is given', async () => {
  const edge = (await ready({ runtimes: ['edge'] })).handle;
  const local = (await ready()).handle;
  const edgeNames = (((await rpc(edge, 'tools/list')).result?.tools ?? []) as Tool[]).map(
    (t) => t.name
  );
  const localNames = (((await rpc(local, 'tools/list')).result?.tools ?? []) as Tool[]).map(
    (t) => t.name
  );
  const nodeOnly = texuliOps.list().filter((operation) => operation.runtime === 'node');
  expect(nodeOnly.map((operation) => operation.name)).toContain('document.export');
  for (const operation of nodeOnly) {
    expect(edgeNames).not.toContain(operation.name);
    expect(localNames).toContain(operation.name);
  }
  // An alias is listed only when every target is served; `document` reaches document.export.
  expect(edgeNames).not.toContain('document');
  expect(localNames).toContain('document');
  expect(edgeNames).toContain('deck.run');
  // Calling a node operation on the edge names the runtime instead of "unknown tool".
  for (const [name, args] of [
    ['document.export', { command: 'to-pdf', document: {} }],
    ['document', { command: 'to-docx', document: {} }],
  ] as const) {
    const refused = await rpc(edge, 'tools/call', { name, arguments: args });
    expect(refused.result?.isError, name).toBe(true);
    expect((textOf(refused) as { code: string }).code, name).toBe('runtime-unavailable');
  }
  const edgeCall = await rpc(edge, 'tools/call', {
    name: 'document',
    arguments: { command: 'capabilities' },
  });
  expect(edgeCall.result?.isError).toBeUndefined();
});

it('lists and reads the Texuli resources and resource templates', async () => {
  const { handle } = await ready({ pageSize: 50 });
  const catalog = await loadOpsCatalog();
  const themes = await listFullThemeLibrary();
  await scenario('lists every concrete resource across pages', async () => {
    const { items, pages } = await walk(handle, 'resources/list', 'resources');
    const uris = items.map((item) => item.uri as string);
    expect(new Set(uris).size).toBe(uris.length);
    expect(pages).toBeGreaterThan(1);
    expect(uris.slice(0, 4)).toEqual([
      'texuli://catalog',
      'texuli://llms/full',
      'texuli://schema/deck',
      'texuli://schema/document',
    ]);
    const ids = catalog.catalog.entries.map((entry) => entry.id);
    expect(uris.filter((uri) => uri.startsWith('texuli://component/'))).toEqual(
      ids.map((id) => `texuli://component/${id}`)
    );
    expect(uris.filter((uri) => uri.startsWith('texuli://docs/'))).toEqual(
      ids.map((id) => `texuli://docs/${id}`)
    );
    expect(uris.filter((uri) => uri.startsWith('texuli://theme/'))).toEqual(
      themes.map((theme) => `texuli://theme/${theme.id}`)
    );
    // Only the fictional examples are listed; the library themes as documents are read by id.
    expect(uris.filter((uri) => uri.startsWith('texuli://design-system/'))).toEqual([
      'texuli://design-system/acme',
      'texuli://design-system/minimal',
      'texuli://design-system/quillmark',
      'texuli://design-system/ledgerline',
      'texuli://design-system/tumbletown',
    ]);
    for (const item of items) {
      expect(typeof item.name, item.uri as string).toBe('string');
      expect(typeof item.description, item.uri as string).toBe('string');
      expect(item.mimeType, item.uri as string).toMatch(/^(application\/json|text\/markdown)$/u);
    }
  });
  await scenario('lists five templates, the design-system documents among them', async () => {
    const templates = (await rpc(handle, 'resources/templates/list')).result?.resourceTemplates as {
      uriTemplate: string;
      description: string;
    }[];
    expect(templates.map((template) => template.uriTemplate)).toEqual([
      'texuli://component/{id}',
      'texuli://docs/{slug}',
      'texuli://theme/{id}',
      'texuli://design-system/{id}',
      'texuli://schema/{name}',
    ]);
    for (const template of templates) expect(template.description.length).toBeGreaterThan(40);
  });
  await scenario('reads each resource from the same source as the other doors', async () => {
    const read = async (uri: string) => {
      const response = await rpc(handle, 'resources/read', { uri });
      expect(response.error, uri).toBeUndefined();
      return response.result?.contents as { uri: string; mimeType: string; text: string }[];
    };
    const [catalogContents] = await read('texuli://catalog');
    expect(catalogContents?.text).toBe(catalog.json);
    expect(catalogContents?.mimeType).toBe('application/json');
    const [full] = await read('texuli://llms/full');
    expect(full?.mimeType).toBe('text/markdown');
    expect(full?.text).toBe(readFileSync(new URL('llms/llms-full.txt', PUBLIC), 'utf8'));
    const [doc] = await read('texuli://docs/card');
    expect(doc?.text).toBe(readFileSync(new URL('llms/components/card.md', PUBLIC), 'utf8'));
    const [component] = await read('texuli://component/card');
    expect(JSON.parse(component?.text ?? '{}')).toEqual(
      catalog.catalog.entries.find((entry) => entry.id === 'card')
    );
    const theme = await read('texuli://theme/violet');
    expect(theme.map((item) => item.mimeType)).toEqual(['application/json', 'text/css']);
    expect(JSON.parse(theme[0]?.text ?? '{}')).toMatchObject({ id: 'violet' });
    expect(theme[1]?.text).toContain('--tx-primary');
    expect(theme.every((item) => item.uri === 'texuli://theme/violet')).toBe(true);
    const [deck] = await read('texuli://schema/deck');
    expect(JSON.parse(deck?.text ?? '{}')).toEqual(runDeckCommand('schema'));
    const [documentSchema] = await read('texuli://schema/document');
    expect(JSON.parse(documentSchema?.text ?? '{}')).toEqual(await runDocumentCommand('schema'));
    // An example document, and a library theme as a document: one per read, both valid.
    for (const id of ['acme', 'ocean']) {
      const [ds] = await read(`texuli://design-system/${id}`);
      expect(ds?.mimeType).toBe('application/json');
      const outcome = await texuliOps.invoke('ds.validate', {
        document: JSON.parse(ds?.text ?? ''),
      });
      expect(outcome, id).toMatchObject({ ok: true, output: { valid: true } });
    }
  });
  await scenario(
    'answers unknown and hostile URIs with resource-not-found or invalid params',
    async () => {
      for (const uri of [
        'texuli://component/not-in-catalog',
        'texuli://component/CARD',
        'texuli://component/../catalog',
        'texuli://component/card/extra',
        'texuli://component/',
        'texuli://theme/not-a-theme',
        'texuli://schema/blueprint',
        'texuli://design-system/not-a-theme',
        'texuli://design-system/ACME',
        'texuli://docs/__proto__',
        'texuli://catalog?x=1',
        'file:///etc/passwd',
        'https://example.com/',
      ]) {
        const missing = await rpc(handle, 'resources/read', { uri });
        expect(missing.error?.code, uri).toBe(MCP_ERROR_CODES.resourceNotFound);
        expect(missing.error?.data).toEqual({ uri });
      }
      for (const params of [
        {},
        { uri: 42 },
        { uri: `texuli://docs/${'a'.repeat(3000)}` },
        undefined,
      ]) {
        const refused = await rpc(handle, 'resources/read', params);
        expect(refused.error?.code, JSON.stringify(params)?.slice(0, 40)).toBe(
          MCP_ERROR_CODES.invalidParams
        );
      }
    }
  );
});

it('lists and renders the workflow prompts with arguments an agent can complete', async () => {
  const { handle } = await ready();
  await scenario(
    'lists build-ui, theme-blueprint, create-design-system and convert-deck',
    async () => {
      const prompts = (await rpc(handle, 'prompts/list')).result?.prompts as {
        name: string;
        title: string;
        description: string;
        arguments: { name: string; description: string; required?: boolean }[];
      }[];
      expect(prompts.map((prompt) => prompt.name)).toEqual([
        'build-ui',
        'theme-blueprint',
        'create-design-system',
        'convert-deck',
      ]);
      for (const prompt of prompts) {
        expect(prompt.title.length).toBeGreaterThan(0);
        expect(prompt.description.length).toBeGreaterThan(40);
        expect(prompt.arguments.length).toBeGreaterThan(0);
        for (const argument of prompt.arguments)
          expect(argument.description.length).toBeGreaterThan(10);
      }
    }
  );
  await scenario(
    'renders each prompt with its arguments, naming only real tools and resources',
    async () => {
      const templates = (await rpc(handle, 'resources/templates/list')).result
        ?.resourceTemplates as {
        uriTemplate: string;
      }[];
      const prefixes = templates.map((template) =>
        template.uriTemplate.replace(/\{[a-z]+\}$/u, '')
      );
      const samples: Record<string, Record<string, string>> = {
        'build-ui': {
          brief: 'A pricing page for a fictional product',
          tier: 'untrusted',
          theme: 'violet',
        },
        'theme-blueprint': { brief: 'A calm analytics dashboard', mode: 'dark' },
        'create-design-system': {
          brief: 'Harborline: teal #0e7490, Inter, rounded, calm',
          base: 'ocean',
          contrast: 'AAA',
        },
        'convert-deck': { direction: 'from-markdown', source: '# Fictional deck' },
      };
      for (const prompt of TEXULI_PROMPTS) {
        const response = await rpc(handle, 'prompts/get', {
          name: prompt.name,
          arguments: samples[prompt.name],
        });
        expect(response.error, prompt.name).toBeUndefined();
        const messages = response.result?.messages as {
          role: string;
          content: { type: string; text: string };
        }[];
        expect(messages.length).toBeGreaterThan(0);
        const text = messages.map((message) => message.content.text).join('\n');
        expect(
          messages.every((message) => message.role === 'user' && message.content.type === 'text')
        ).toBe(true);
        for (const value of Object.values(samples[prompt.name] ?? {}))
          expect(text, prompt.name).toContain(value);
        const tools = [...text.matchAll(/`([a-z]+\.[a-z-]+)`/gu)].map(
          (match) => match[1] as string
        );
        expect(tools.length, prompt.name).toBeGreaterThan(0);
        for (const tool of tools)
          expect(texuliOps.get(tool), `${prompt.name}: ${tool}`).toBeDefined();
        for (const [uri] of text.matchAll(/texuli:\/\/[a-z/{}-]+[a-z}]/gu)) {
          const known =
            uri === 'texuli://catalog' ||
            uri === 'texuli://llms/full' ||
            prefixes.some((prefix) => uri.startsWith(prefix));
          expect(known, `${prompt.name}: ${uri}`).toBe(true);
        }
      }
      const buildUi = await rpc(handle, 'prompts/get', {
        name: 'build-ui',
        arguments: { brief: 'A form' },
      });
      const buildText = ((buildUi.result?.messages ?? []) as { content: { text: string } }[])[0]
        ?.content.text;
      expect(buildText).toContain('`blueprint.validate`');
      expect(buildText).not.toMatch(/no blueprint validation tool/iu);
      const minimal = await rpc(handle, 'prompts/get', {
        name: 'build-ui',
        arguments: { brief: 'A form' },
      });
      expect(minimal.error).toBeUndefined();
    }
  );
  await scenario('refuses unknown prompts and bad arguments', async () => {
    for (const params of [
      { name: 'create-design-system', arguments: {} },
      { name: 'create-design-system', arguments: { brief: 'ok', contrast: 'AAAA' } },
      { name: 'nope' },
      { name: 'build-ui' },
      { name: 'build-ui', arguments: { brief: 42 } },
      { name: 'build-ui', arguments: { brief: 'ok', extra: 'x' } },
      { name: 'build-ui', arguments: { brief: 'x'.repeat(20_000) } },
      { name: 'build-ui', arguments: [] },
      { name: 'theme-blueprint', arguments: { brief: 'ok', mode: 'sepia' } },
      {},
    ]) {
      const refused = await rpc(handle, 'prompts/get', params);
      expect(refused.error?.code, JSON.stringify(params).slice(0, 60)).toBe(
        MCP_ERROR_CODES.invalidParams
      );
    }
  });
});

it('completes template and prompt arguments from the real ids', async () => {
  const { handle } = await ready();
  const catalog = await loadOpsCatalog();
  const complete = async (ref: Record<string, unknown>, name: string, value: string) =>
    await rpc(handle, 'completion/complete', { ref, argument: { name, value } });
  const values = (response: Rpc) =>
    response.result?.completion as { values: string[]; total: number; hasMore: boolean };
  await scenario('completes component ids, doc slugs, theme ids and schema names', async () => {
    const card = values(
      await complete({ type: 'ref/resource', uri: 'texuli://component/{id}' }, 'id', 'car')
    );
    expect(card.values).toContain('card');
    expect(card.values.every((value) => value.startsWith('car'))).toBe(true);
    const all = values(
      await complete({ type: 'ref/resource', uri: 'texuli://docs/{slug}' }, 'slug', '')
    );
    expect(all.values).toHaveLength(100);
    expect(all.total).toBe(catalog.catalog.entries.length);
    expect(all.hasMore).toBe(true);
    const theme = values(
      await complete({ type: 'ref/resource', uri: 'texuli://theme/{id}' }, 'id', 'VIO')
    );
    expect(theme.values).toContain('violet');
    const designSystems = values(
      await complete({ type: 'ref/resource', uri: 'texuli://design-system/{id}' }, 'id', '')
    );
    const library = await listFullThemeLibrary();
    expect(designSystems.values.slice(0, 6)).toEqual([
      'acme',
      'minimal',
      'quillmark',
      'ledgerline',
      'tumbletown',
      library[0]?.id,
    ]);
    expect(designSystems.total).toBe(5 + library.length);
    expect(
      values(await complete({ type: 'ref/resource', uri: 'texuli://schema/{name}' }, 'name', ''))
        .values
    ).toEqual(['deck', 'document']);
    expect(
      values(await complete({ type: 'ref/resource', uri: 'texuli://schema/{name}' }, 'name', 'zzz'))
    ).toEqual({
      values: [],
      total: 0,
      hasMore: false,
    });
  });
  await scenario('completes prompt arguments', async () => {
    expect(
      values(await complete({ type: 'ref/prompt', name: 'theme-blueprint' }, 'theme', 'violet'))
        .values
    ).toContain('violet');
    expect(
      values(await complete({ type: 'ref/prompt', name: 'convert-deck' }, 'direction', '')).values
    ).toEqual(['from-markdown', 'to-markdown']);
    expect(
      values(await complete({ type: 'ref/prompt', name: 'build-ui' }, 'tier', 'u')).values
    ).toEqual(['untrusted']);
    // A free-text argument has nothing to complete.
    expect(
      values(await complete({ type: 'ref/prompt', name: 'build-ui' }, 'brief', 'a')).values
    ).toEqual([]);
  });
  await scenario('refuses unknown references and malformed requests', async () => {
    for (const params of [
      { ref: { type: 'ref/prompt', name: 'nope' }, argument: { name: 'x', value: '' } },
      {
        ref: { type: 'ref/resource', uri: 'texuli://nope/{id}' },
        argument: { name: 'id', value: '' },
      },
      {
        ref: { type: 'ref/resource', uri: 'texuli://component/{id}' },
        argument: { name: 'slug', value: '' },
      },
      { ref: { type: 'ref/other' }, argument: { name: 'id', value: '' } },
      { ref: { type: 'ref/prompt', name: 'build-ui' }, argument: { name: 'tier' } },
      { ref: { type: 'ref/prompt', name: 'build-ui' } },
      { argument: { name: 'id', value: '' } },
      undefined,
    ]) {
      const refused = await rpc(handle, 'completion/complete', params);
      expect(refused.error?.code, JSON.stringify(params)?.slice(0, 80)).toBe(
        MCP_ERROR_CODES.invalidParams
      );
    }
  });
});

it('advertises only the capabilities that exist and answers the rest as unknown methods', async () => {
  await scenario('switches capabilities off by option or by having nothing to serve', async () => {
    for (const options of [
      { capabilities: { resources: false, prompts: false, completions: false } },
      { resources: [], prompts: [] },
    ]) {
      const { handle, init } = await ready(options);
      expect(init.result?.capabilities, JSON.stringify(options)).toEqual({
        tools: { listChanged: false },
      });
      for (const method of [
        'resources/list',
        'resources/read',
        'resources/templates/list',
        'prompts/list',
        'prompts/get',
        'completion/complete',
      ]) {
        expect((await rpc(handle, method, {})).error?.code, method).toBe(
          MCP_ERROR_CODES.methodNotFound
        );
      }
    }
  });
  await scenario('keeps completions only when something can be completed', async () => {
    const provider: McpResourceProvider = {
      list: () => [
        { uri: 'test://one', name: 'one', description: 'A test resource.', mimeType: 'text/plain' },
      ],
      templates: [],
      read: async (uri) =>
        uri === 'test://one' ? [{ uri, mimeType: 'text/plain', text: '1' }] : undefined,
    };
    const { init, handle } = await ready({ resources: [provider], prompts: [] });
    expect(init.result?.capabilities).toEqual({
      tools: { listChanged: false },
      resources: { subscribe: false, listChanged: false },
    });
    expect((await rpc(handle, 'resources/read', { uri: 'test://one' })).result?.contents).toEqual([
      { uri: 'test://one', mimeType: 'text/plain', text: '1' },
    ]);
  });
  await scenario('never offers logging, subscriptions or sampling', async () => {
    const { handle } = await ready();
    for (const method of [
      'logging/setLevel',
      'resources/subscribe',
      'resources/unsubscribe',
      'sampling/createMessage',
      'nope',
    ]) {
      const refused = await rpc(handle, method, {});
      expect(refused.error?.code, method).toBe(MCP_ERROR_CODES.methodNotFound);
      expect(refused.error?.message).toContain(method);
    }
  });
});

it('answers malformed JSON-RPC with the standard error codes', async () => {
  const handle = createMcpHandler({ mode: 'stateless' });
  for (const message of [
    null,
    42,
    'text',
    [],
    {},
    { jsonrpc: '1.0', id: 1, method: 'ping' },
    { jsonrpc: '2.0', id: 1 },
    { jsonrpc: '2.0', id: 1, method: 7 },
    { jsonrpc: '2.0', id: { nested: true }, method: 'ping' },
    { jsonrpc: '2.0', id: Number.NaN, method: 'ping' },
  ]) {
    const refused = (await handle(message)) as Rpc;
    expect(refused.error?.code, JSON.stringify(message)).toBe(MCP_ERROR_CODES.invalidRequest);
  }
  expect(
    await handle({ jsonrpc: '2.0', method: 'notifications/cancelled', params: {} })
  ).toBeUndefined();
  expect(await handle({ jsonrpc: '2.0', method: 'tools/list' })).toBeUndefined();
  const throwing: McpResourceProvider = {
    list: () => {
      throw new Error('secret detail');
    },
    templates: [],
    read: async () => {
      throw new Error('secret detail');
    },
  };
  const broken = createMcpHandler({ mode: 'stateless', resources: [throwing], prompts: [] });
  for (const [method, params] of [
    ['resources/list', {}],
    ['resources/read', { uri: 'texuli://catalog' }],
  ] as const) {
    const failed = await rpc(broken, method, params);
    expect(failed.error?.code, method).toBe(MCP_ERROR_CODES.internalError);
    expect(failed.error?.message).not.toContain('secret');
  }
  expect(MCP_ERROR_CODES).toEqual({
    parseError: -32700,
    invalidRequest: -32600,
    methodNotFound: -32601,
    invalidParams: -32602,
    internalError: -32603,
    notInitialized: -32600,
    resourceNotFound: -32002,
  });
});

it('runs stdio on the stateful local handler and refuses oversized or broken lines', async () => {
  const input = new PassThrough();
  const output = new PassThrough();
  const chunks: string[] = [];
  output.setEncoding('utf8');
  output.on('data', (chunk: string) => chunks.push(chunk));
  const done = runMcpStdio(input, output);
  const line = (value: unknown) => `${JSON.stringify(value)}\n`;
  input.write(line({ jsonrpc: '2.0', id: 0, method: 'tools/list' }));
  input.write(
    line({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: MCP_PROTOCOL_VERSION },
    })
  );
  input.write(line({ jsonrpc: '2.0', method: 'notifications/initialized' }));
  input.write(
    `${JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'ping', params: { pad: 'x'.repeat(2 * 1024 * 1024) } })}\n`
  );
  input.write('{not json\n');
  input.write(line({ jsonrpc: '2.0', id: 3, method: 'tools/list' }));
  input.write(
    line({
      jsonrpc: '2.0',
      id: 4,
      method: 'resources/read',
      params: { uri: 'texuli://schema/deck' },
    })
  );
  input.end();
  await done;
  const messages = chunks
    .join('')
    .trim()
    .split('\n')
    .map((text) => JSON.parse(text) as Rpc);
  expect(messages.map((message) => message.id)).toEqual([0, 1, null, null, 3, 4]);
  expect(messages[0]?.error?.code).toBe(MCP_ERROR_CODES.notInitialized);
  expect(messages[2]?.error).toEqual({ code: -32700, message: 'Message exceeds the 2 MiB limit.' });
  expect(messages[3]?.error?.code).toBe(-32700);
  const names = ((messages[4]?.result?.tools ?? []) as Tool[]).map((tool) => tool.name);
  expect(names).toContain('document.export');
  expect(messages[5]?.result?.contents).toHaveLength(1);
  // The 0.8 entry point is a deprecated alias of the stateful local handler.
  const legacy = createTexuliMcpServer();
  expect((await rpc(legacy, 'tools/list')).error?.code).toBe(MCP_ERROR_CODES.notInitialized);
});
