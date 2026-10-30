// @vitest-environment node
import { readFileSync } from 'node:fs';
import { PassThrough } from 'node:stream';
import { expect, it } from 'vitest';
import {
  createTexuliMcpServer,
  MCP_ERROR_CODES,
  MCP_PROTOCOL_VERSION,
  runMcpStdio,
} from '../src/mcp/index.ts';
import { TEXULI_OPERATIONS } from '../src/ops/index.ts';
import { scenario } from './scenario.ts';

type Response = {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: Record<string, unknown>;
  error?: { code: number; message: string };
};

async function initializedServer() {
  const handle = createTexuliMcpServer();
  const init = (await handle({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: 'test', version: '1' },
    },
  })) as Response;
  await handle({ jsonrpc: '2.0', method: 'notifications/initialized' });
  return { handle, init };
}

async function callTool(
  handle: (message: unknown) => Promise<unknown>,
  name: string,
  args: Record<string, unknown> = {}
): Promise<Response> {
  return (await handle({
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: { name, arguments: args },
  })) as Response;
}

function toolData(response: Response): Record<string, unknown> {
  const result = response.result;
  expect(result).toBeDefined();
  const content = result?.content as { type: string; text: string }[];
  expect(content[0]?.type).toBe('text');
  return JSON.parse(content[0]?.text ?? 'null') as Record<string, unknown>;
}

it('negotiates MCP with read-only tools and serves the real catalog, manifests, validation and themes', async () => {
  await scenario(
    'negotiates MCP, announces only read-only tools and waits for initialized',
    async () => {
      const handle = createTexuliMcpServer();
      const early = (await callTool(handle, 'catalog')) as Response;
      expect(early.error?.code).toBe(MCP_ERROR_CODES.notInitialized);

      const init = (await handle({
        jsonrpc: '2.0',
        id: 'init',
        method: 'initialize',
        params: { protocolVersion: MCP_PROTOCOL_VERSION },
      })) as Response;
      expect(init.result?.protocolVersion).toBe(MCP_PROTOCOL_VERSION);
      expect(init.result?.capabilities).toEqual({
        tools: { listChanged: false },
        resources: { subscribe: false, listChanged: false },
        prompts: { listChanged: false },
        completions: {},
      });
      await handle({ jsonrpc: '2.0', method: 'notifications/initialized' });

      const listed = (await handle({ jsonrpc: '2.0', id: 2, method: 'tools/list' })) as Response;
      const tools = listed.result?.tools as {
        name: string;
        annotations: Record<string, unknown>;
      }[];
      expect(tools.map(({ name }) => name)).toEqual([
        'catalog.search',
        'catalog.validate',
        'component.get',
        'example.search',
        'blueprint.validate',
        'block.list',
        'block.schema',
        'theme.search',
        'theme.get',
        'theme.preview',
        'deck.run',
        'document.run',
        'document.export',
        'deck',
        'document',
        'catalog',
        'component',
        'validate',
        'example',
        'theme',
      ]);
      const described = tools as unknown as { name: string; description: string }[];
      for (const legacy of described.slice(TEXULI_OPERATIONS.length)) {
        expect(legacy.description, legacy.name).toMatch(/^Deprecated alias of [a-z]+\.[a-z-]+/u);
      }
      expect(tools.every(({ annotations }) => annotations.readOnlyHint === true)).toBe(true);
      expect(tools.every(({ annotations }) => annotations.destructiveHint === false)).toBe(true);
    }
  );
  await scenario('builds the real catalog and reads component manifests and examples', async () => {
    const { handle } = await initializedServer();
    const catalog = toolData(await callTool(handle, 'catalog', { query: 'card' }));
    expect(catalog.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(catalog.fileName).toBe(`catalog-${catalog.hash}.json`);
    expect((catalog.entries as { id: string }[]).some(({ id }) => id === 'card')).toBe(true);

    const component = toolData(await callTool(handle, 'component', { id: 'card' }));
    expect(component.component).toMatchObject({ id: 'card', group: 'display' });
    const manifest = (component.component as { examples: unknown[] }).examples;
    expect(manifest.length).toBeGreaterThan(0);

    const examples = toolData(await callTool(handle, 'example', { componentId: 'card' }));
    expect(examples.total).toBeGreaterThan(0);
    expect(
      (examples.examples as { componentId: string }[]).every((item) => item.componentId === 'card')
    ).toBe(true);
  });
  await scenario(
    'validates one untrusted manifest and a set, returning actionable diagnostics',
    async () => {
      const { handle } = await initializedServer();
      const validManifest = {
        id: 'notice-card',
        package: 'texuli',
        label: 'Notice card',
        summary: 'A sample content card.',
        tier: 'content',
        agentEmittable: true,
        useWhen: ['Show a short notice.'],
        dontUseWhen: ['Application navigation.'],
        a11y: 'Keep the heading descriptive.',
        props: [{ name: 'title', kind: 'string' }],
        examples: [{ id: 'basic', title: 'Basic', props: { title: 'Hello' } }],
      };
      expect(
        toolData(await callTool(handle, 'validate', { manifest: validManifest }))
      ).toMatchObject({
        valid: true,
        diagnostics: [],
      });
      const duplicate = toolData(
        await callTool(handle, 'validate', { manifests: [validManifest, validManifest] })
      );
      expect(duplicate.valid).toBe(false);
      expect(
        (duplicate.diagnostics as { code: string }[]).some(({ code }) => code === 'duplicate-id')
      ).toBe(true);
      const invalid = toolData(await callTool(handle, 'validate', { manifest: { id: 'bad id' } }));
      expect(invalid.valid).toBe(false);
      expect(
        (invalid.diagnostics as { jsonPath: string }[]).some(({ jsonPath }) => jsonPath === '$.id')
      ).toBe(true);
    }
  );
  await scenario('searches theme metadata and reads a real full theme definition', async () => {
    const { handle } = await initializedServer();
    const matches = toolData(await callTool(handle, 'theme', { query: 'violet' }));
    expect((matches.themes as { id: string }[]).some(({ id }) => id === 'violet')).toBe(true);
    const theme = toolData(await callTool(handle, 'theme', { id: 'violet' }));
    expect(theme.theme).toMatchObject({ id: 'violet' });
  });
});

it('reports tool and protocol errors and speaks newline-delimited JSON-RPC on stdio', async () => {
  await scenario(
    'reports invalid arguments as tool errors and unknown tools as protocol errors',
    async () => {
      const { handle } = await initializedServer();
      const badArgs = await callTool(handle, 'catalog', { limit: 0 });
      expect(badArgs.result?.isError).toBe(true);
      expect(toolData(badArgs).error).toContain('limit');
      expect(toolData(badArgs).code).toBe('invalid-input');
      const missing = await callTool(handle, 'component', { id: 'not-in-catalog' });
      expect(missing.result?.isError).toBe(true);
      expect(toolData(missing).code).toBe('not-found');
      const renamed = await callTool(handle, 'component.get', { id: 'card' });
      expect(toolData(renamed)).toEqual(
        toolData(await callTool(handle, 'component', { id: 'card' }))
      );
      const unknown = await callTool(handle, 'execute', {});
      expect(unknown.error?.code).toBe(-32602);
    }
  );
  await scenario(
    'speaks newline-delimited JSON-RPC on stdio without logging to stdout',
    async () => {
      const input = new PassThrough();
      const output = new PassThrough();
      const chunks: string[] = [];
      output.setEncoding('utf8');
      output.on('data', (chunk: string) => chunks.push(chunk));
      const done = runMcpStdio(input, output);
      input.end(
        `${[
          JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'initialize',
            params: { protocolVersion: MCP_PROTOCOL_VERSION },
          }),
          JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }),
          JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' }),
        ].join('\n')}\n`
      );
      await done;
      const messages = chunks
        .join('')
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line) as Response);
      expect(messages.map(({ id }) => id)).toEqual([1, 2]);
      const { version } = JSON.parse(
        readFileSync(new URL('../package.json', import.meta.url), 'utf8')
      ) as { version: string };
      expect(messages[0]?.result?.serverInfo).toEqual({ name: 'texuli', version });
      expect(version).not.toBe('0.0.0');
      expect(messages[1]?.result?.tools).toHaveLength(20);
    }
  );
});
