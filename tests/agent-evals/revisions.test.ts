// @vitest-environment node
/**
 * The 2026-07-28 revision on both doors (T-gap-124, G124): a request that
 * names the revision in `params._meta["io.modelcontextprotocol/protocolVersion"]`
 * is answered with no `initialize`, `server/discover` included, and an
 * unknown revision is `-32022` with `error.data.supported`. The local door
 * is the real `@texuli/mcp` stdio entry (newline-delimited JSON over
 * streams, as `npx -y @texuli/mcp` serves it); the remote door is the Pages
 * Function with real `Request` objects. Both must answer alike.
 */
import { PassThrough } from 'node:stream';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { onRequest } from '../../functions/mcp.ts';
import { startTexuliMcp } from '../../packages/mcp/src/index.ts';
import {
  MCP_PROTOCOL_REVISIONS,
  MCP_SUPPORTED_PROTOCOL_VERSIONS,
} from '../../packages/tools/src/mcp/protocol.ts';
import { DOORS, isEdgeTool, type Json } from './harness.ts';

const REVISION = '2026-07-28';
const META_KEY = 'io.modelcontextprotocol/protocolVersion';
const meta = (version: unknown = REVISION) => ({ _meta: { [META_KEY]: version } });

/** The Protoyard report, byte for byte as they sent it over stdio. */
const REPRO =
  '{"jsonrpc":"2.0","id":4,"method":"server/discover","params":{"_meta":{"io.modelcontextprotocol/protocolVersion":"2026-07-28"}}}';

/** Send lines to the real stdio entry; return one parsed answer per answered line. */
async function stdioBin(lines: readonly string[]): Promise<Json[]> {
  const input = new PassThrough();
  const output = new PassThrough();
  const chunks: string[] = [];
  output.setEncoding('utf8');
  output.on('data', (chunk: string) => chunks.push(chunk));
  const done = startTexuliMcp({ input, output });
  for (const line of lines) input.write(`${line}\n`);
  input.end();
  await done;
  return chunks
    .join('')
    .split('\n')
    .filter((line) => line !== '')
    .map((line) => JSON.parse(line));
}

/** The same messages through the Pages Function, one POST each. */
async function remote(messages: readonly Json[], header?: string): Promise<Json[]> {
  const door = DOORS.remote();
  const answers: Json[] = [];
  for (const message of messages) answers.push(await door.send(message, header));
  return answers;
}

const STEPS: [string, string, Json][] = [
  ['ping', 'ping', {}],
  ['tools', 'tools/list', {}],
  ['search', 'tools/call', { name: 'catalog.search', arguments: { query: 'card', limit: 2 } }],
  ['not found', 'tools/call', { name: 'component.get', arguments: { id: 'no-such-component' } }],
  ['removed name', 'tools/call', { name: 'theme', arguments: {} }],
  ['prompts', 'prompts/list', {}],
  ['prompt', 'prompts/get', { name: 'build-ui', arguments: { brief: 'A fictional form.' } }],
  ['resources', 'resources/list', {}],
  ['templates', 'resources/templates/list', {}],
  ['read', 'resources/read', { uri: 'texuli://schema/deck' }],
  ['missing resource', 'resources/read', { uri: 'texuli://nope' }],
  [
    'complete',
    'completion/complete',
    {
      ref: { type: 'ref/resource', uri: 'texuli://theme/{id}' },
      argument: { name: 'id', value: 'a' },
    },
  ],
];

const messages = (): Json[] => [
  JSON.parse(REPRO),
  ...STEPS.map(([, method, params], index) => ({
    jsonrpc: '2.0',
    id: 10 + index,
    method,
    params: { ...params, ...meta() },
  })),
  { jsonrpc: '2.0', id: 90, method: 'tools/list', params: meta('2099-01-01') },
  { jsonrpc: '2.0', id: 91, method: 'server/discover', params: meta(42) },
];

/** Keep the edge tools only: the one part of a tool list both doors share. */
const edgeTools = (tools: Json[]) => tools.filter((tool) => isEdgeTool(tool.name));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('the 2026-07-28 revision on the stdio bin and the remote Function', () => {
  it('answers the Protoyard repro on both doors with no initialize', async () => {
    const [local] = await stdioBin([REPRO]);
    const [far] = await remote([JSON.parse(REPRO)]);
    for (const answer of [local, far]) {
      expect(answer.error).toBeUndefined();
      expect(answer.id).toBe(4);
      expect(answer.result.protocolVersion).toBe(REVISION);
      expect(answer.result.supportedVersions).toEqual([
        REVISION,
        ...MCP_SUPPORTED_PROTOCOL_VERSIONS,
      ]);
      expect(answer.result.serverInfo.name).toBe('texuli');
    }
  });

  it('answers every message identically, except the tools each door serves', async () => {
    const sent = messages();
    const local = await stdioBin(sent.map((message) => JSON.stringify(message)));
    const far = await remote(sent);
    expect(local).toHaveLength(sent.length);
    expect(far).toHaveLength(sent.length);
    let compared = 0;
    sent.forEach((message, index) => {
      const label = `${message.method} #${message.id}`;
      const a = local[index];
      const b = far[index];
      expect(a.id, label).toBe(message.id);
      expect(b.id, label).toBe(message.id);
      // The revision is served on its own: never the initialization gate.
      expect(a.error?.code, label).not.toBe(-32600);
      if (message.method === 'server/discover' && a.result) {
        const { tools: localTools, ...localRest } = a.result;
        const { tools: farTools, ...farRest } = b.result;
        expect(farRest, label).toEqual(localRest);
        // Each door's summary names exactly the tools its tools/list returns.
        const listed = (answers: Json[]) =>
          answers[sent.findIndex((item) => item.method === 'tools/list')].result.tools.map(
            ({ name, title }: Json) => ({ name, title })
          );
        expect(localTools, label).toEqual(listed(local));
        expect(farTools, label).toEqual(listed(far));
        expect(edgeTools(localTools), label).toEqual(edgeTools(farTools));
      } else if (message.method === 'tools/list' && a.result) {
        expect(edgeTools(a.result.tools), label).toEqual(edgeTools(b.result.tools));
        expect(a.result.tools.map((tool: Json) => tool.name)).toContain('ds.save');
        expect(b.result.tools.map((tool: Json) => tool.name)).toContain('site.read');
      } else {
        expect(b, label).toEqual(a);
      }
      compared++;
    });
    expect(compared).toBe(sent.length);
    // The unknown revisions: -32022 with the supported list, on both doors.
    for (const answers of [local, far]) {
      const [unknown, notString] = answers.slice(-2);
      expect(unknown.error).toEqual({
        code: -32022,
        message: `Unsupported protocol version; supported: ${MCP_PROTOCOL_REVISIONS.join(', ')}.`,
        data: { supported: [...MCP_PROTOCOL_REVISIONS], requested: '2099-01-01' },
      });
      expect(notString.error.code).toBe(-32022);
      expect(notString.error.data).toEqual({ supported: [...MCP_PROTOCOL_REVISIONS] });
    }
  });

  it('accepts the 2026-07-28 MCP-Protocol-Version header when _meta agrees, and refuses a mismatch', async () => {
    const sent = messages();
    const plain = await remote(sent);
    const withHeader = await remote(sent, REVISION);
    expect(withHeader).toEqual(plain);
    const [mismatch] = await remote(
      [{ jsonrpc: '2.0', id: 1, method: 'tools/list', params: meta() }],
      '2025-11-25'
    );
    expect(mismatch.error.code).toBe(-32600);
    expect(mismatch.error.message).toMatch(/disagree/u);
    // The header alone does not select the revision: it travels in _meta.
    const [headerOnly] = await remote([{ jsonrpc: '2.0', id: 2, method: 'tools/list' }], REVISION);
    expect(headerOnly.error.code).toBe(-32600);
    expect(headerOnly.error.message).toContain(META_KEY);
  });

  it('keeps the initialize-based behavior on both doors for a request without the _meta version', async () => {
    const plain = { jsonrpc: '2.0', id: 1, method: 'server/discover' };
    // stdio keeps its initialization gate (-32600); the remote door is stateless and has no such method.
    const [local] = await stdioBin([JSON.stringify(plain)]);
    expect(local.error.code).toBe(-32600);
    const [far] = await remote([plain]);
    expect(far.error).toEqual({ code: -32601, message: 'Method not found: server/discover' });
  });

  it('counts server/discover under its own label on the remote door', async () => {
    const sentEvents: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        sentEvents.push(await (input as Request).text());
        return new Response('{}', { status: 200 });
      })
    );
    const waited: Promise<unknown>[] = [];
    const response = await onRequest({
      request: new Request('https://texuli.com/mcp', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
          'cf-connecting-ip': '192.0.2.124',
        },
        body: REPRO,
      }),
      env: { PUBLIC_UMAMI_WEBSITE_ID: 'site-id' },
      waitUntil: (promise) => waited.push(promise),
    });
    expect(response.status).toBe(200);
    await Promise.all(waited);
    expect(sentEvents).toHaveLength(1);
    expect(JSON.parse(sentEvents[0] ?? '{}').payload.data.operation).toBe('server/discover');
  });
});
