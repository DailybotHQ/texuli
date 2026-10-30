// @vitest-environment node
/**
 * The WebMCP bridge (PLAN_011 T-ar-site-mcp): registration through
 * `provideContext` or `registerTool`, a no-op without `modelContext`, and
 * tools that only ever request the page's own origin. The served build is
 * checked by `tests/e2e/site-webmcp.spec.ts`.
 */
import { describe, expect, it, vi } from 'vitest';
import { MCP_PROTOCOL_VERSION } from '../../../packages/tools/src/mcp/protocol.ts';
import { twinCandidate } from '../src/components/seo/agent-discovery.ts';
import {
  type Fetcher,
  registerWebMcp,
  WEBMCP_PROTOCOL_VERSION,
  type WebMcpTool,
  webMcpTools,
  webMcpTwinPath,
} from '../src/lib/webmcp.ts';

const ORIGIN = 'https://texuli.com';
const NAMES = [
  'texuli_search_docs',
  'texuli_read_page',
  'texuli_get_component',
  'texuli_validate_blueprint',
];

function recorder(
  answer: (url: string, init?: RequestInit) => Response = () => new Response('ok')
) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fetcher: Fetcher = async (url, init) => {
    calls.push({ url, ...(init ? { init } : {}) });
    return answer(url, init);
  };
  return { calls, fetcher };
}

const tool = (tools: WebMcpTool[], name: string) =>
  tools.find((item) => item.name === name) as WebMcpTool;

describe('registration', () => {
  it('prefers provideContext, falls back to registerTool, and is a no-op without modelContext', () => {
    const provided: WebMcpTool[][] = [];
    const scope = (modelContext?: object, where: 'navigator' | 'document' = 'navigator') => ({
      [where]: modelContext ? { modelContext } : {},
      location: { origin: ORIGIN },
      fetch: vi.fn(),
    });
    expect(
      registerWebMcp(
        scope({ provideContext: (ctx: { tools: WebMcpTool[] }) => provided.push(ctx.tools) })
      )
    ).toBe('provideContext');
    expect(provided[0]?.map((item) => item.name)).toEqual(NAMES);

    const registered: string[] = [];
    expect(
      registerWebMcp(
        scope({
          provideContext: () => {
            throw new Error('not supported');
          },
          registerTool: (item: WebMcpTool) => registered.push(item.name),
        })
      )
    ).toBe('registerTool');
    expect(registered).toEqual(NAMES);
    expect(
      registerWebMcp(
        scope({ registerTool: (item: WebMcpTool) => registered.push(item.name) }, 'document')
      )
    ).toBe('registerTool');

    const none = scope();
    expect(registerWebMcp(none)).toBe('none');
    // A modelContext without either registration API is a no-op too.
    expect(registerWebMcp(scope({}))).toBe('none');
    expect(none.fetch).not.toHaveBeenCalled();
    expect(
      registerWebMcp(
        scope({
          registerTool: () => {
            throw new Error('refused');
          },
        })
      )
    ).toBe('none');
  });

  it('every tool is read-only with a closed, described object schema', () => {
    for (const item of webMcpTools(vi.fn(), ORIGIN)) {
      expect(item.annotations.readOnlyHint, item.name).toBe(true);
      expect(item.inputSchema.type, item.name).toBe('object');
      expect(item.description.length, item.name).toBeGreaterThan(60);
      expect(item.description, item.name).toMatch(/Returns/u);
    }
  });
});

describe('the tools', () => {
  it('search and validate POST one tools/call to the same-origin /mcp with the handler protocol version', async () => {
    expect(WEBMCP_PROTOCOL_VERSION).toBe(MCP_PROTOCOL_VERSION);
    const { calls, fetcher } = recorder(() =>
      Response.json({
        jsonrpc: '2.0',
        id: 1,
        result: { content: [{ type: 'text', text: '{"total":1}' }] },
      })
    );
    const tools = webMcpTools(fetcher, ORIGIN);
    expect(
      await tool(tools, 'texuli_search_docs').execute({ query: 'theming', limit: 3, extra: 1 })
    ).toEqual({
      content: [{ type: 'text', text: '{"total":1}' }],
    });
    await tool(tools, 'texuli_validate_blueprint').execute({
      draft: { id: 'card' },
      tier: 'root',
      fragment: true,
    });
    expect(calls.map((call) => call.url)).toEqual([`${ORIGIN}/mcp`, `${ORIGIN}/mcp`]);
    const bodies = calls.map((call) => JSON.parse(String(call.init?.body)));
    expect(bodies[0].params).toEqual({
      name: 'site.search',
      arguments: { query: 'theming', limit: 3 },
    });
    expect(bodies[1].params).toEqual({
      name: 'blueprint.validate',
      arguments: { draft: { id: 'card' }, fragment: true },
    });
    const headers = calls[0]?.init?.headers as Record<string, string>;
    expect(headers['mcp-protocol-version']).toBe(MCP_PROTOCOL_VERSION);
    expect(calls[0]?.init?.credentials).toBe('same-origin');
  });

  it('passes tool errors, JSON-RPC errors and HTTP failures through as isError', async () => {
    const answers = [
      Response.json({ result: { content: [{ text: '{"code":"invalid-input"}' }], isError: true } }),
      Response.json({ error: { code: -32602, message: 'Unknown tool' } }),
      new Response('limit', { status: 429 }),
    ];
    const { fetcher } = recorder(() => answers.shift() as Response);
    const search = tool(webMcpTools(fetcher, ORIGIN), 'texuli_search_docs');
    expect(await search.execute({ query: 'x' })).toEqual({
      content: [{ type: 'text', text: '{"code":"invalid-input"}' }],
      isError: true,
    });
    expect((await search.execute({ query: 'x' })).content[0]?.text).toBe('Unknown tool');
    expect((await search.execute({ query: 'x' })).content[0]?.text).toMatch(/HTTP 429/u);
    const broken = tool(
      webMcpTools(async () => {
        throw new Error('offline');
      }, ORIGIN),
      'texuli_search_docs'
    );
    expect(await broken.execute({ query: 'x' })).toMatchObject({ isError: true });
  });

  it('read_page and get_component GET same-origin Markdown and refuse anything else before a request', async () => {
    const { calls, fetcher } = recorder((url) =>
      url.endsWith('/missing.md') ? new Response('', { status: 404 }) : new Response('# Page\n')
    );
    const tools = webMcpTools(fetcher, ORIGIN);
    const read = tool(tools, 'texuli_read_page');
    expect(await read.execute({ path: '/guides/theming/' })).toEqual({
      content: [{ type: 'text', text: '# Page\n' }],
    });
    await read.execute({ path: '/' });
    expect((await read.execute({ path: '/missing/' })).isError).toBe(true);
    await tool(tools, 'texuli_get_component').execute({ id: 'card' });
    expect(calls.map((call) => call.url)).toEqual([
      `${ORIGIN}/guides/theming.md`,
      `${ORIGIN}/index.md`,
      `${ORIGIN}/missing.md`,
      `${ORIGIN}/llms/components/card.md`,
    ]);
    const before = calls.length;
    for (const path of [
      '/../_headers',
      '//evil.example/x',
      'https://evil.example/',
      '/a/./b',
      '/a\\b',
      '',
      7,
    ])
      expect((await read.execute({ path })).isError, String(path)).toBe(true);
    for (const id of ['../x', 'Card', '', 'a/b', 'a'.repeat(200)])
      expect((await tool(tools, 'texuli_get_component').execute({ id })).isError, id).toBe(true);
    expect(calls.length).toBe(before);
  });

  it('maps paths to twins as the site does', () => {
    for (const route of ['/', '/guides/theming/', '/showcase/kanban/', '/a/b/c/'])
      expect(webMcpTwinPath(route), route).toBe(twinCandidate(route));
    expect(webMcpTwinPath('/guides/theming')).toBe('/guides/theming.md');
    expect(webMcpTwinPath('/guides/theming.md')).toBe('/guides/theming.md');
    expect(webMcpTwinPath('/guides/theming/?x=1#y')).toBe('/guides/theming.md');
    expect(webMcpTwinPath('/..')).toBeUndefined();
  });
});
