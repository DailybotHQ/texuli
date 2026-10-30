/// <reference types="node" />
// @vitest-environment node
/**
 * `@texuli/mcp` (ADR-019): the package entry serves the local MCP server
 * from `@texuli/tools` with every edge and node operation, and its version
 * equals the exactly pinned `@texuli/tools` version.
 */
import { PassThrough } from 'node:stream';
import { MCP_PROTOCOL_VERSION } from '@texuli/tools/mcp';
import { TOOLS_VERSION } from '@texuli/tools/ops';
import { afterEach, describe, expect, it } from 'vitest';
import manifest from '../package.json' with { type: 'json' };
import { runTexuliMcpCli, startTexuliMcp, TEXULI_MCP_VERSION } from '../src/index.ts';

type Rpc = { id?: number | null; result?: Record<string, unknown>; error?: { code: number } };

function collect(stream: PassThrough): string[] {
  const chunks: string[] = [];
  stream.setEncoding('utf8');
  stream.on('data', (chunk: string) => chunks.push(chunk));
  return chunks;
}

afterEach(() => {
  process.exitCode = undefined;
});

describe('@texuli/mcp', () => {
  it('pins @texuli/tools exactly to its own version and ships the texuli-mcp bin', () => {
    expect(TEXULI_MCP_VERSION).toBe(manifest.version);
    expect(manifest.dependencies).toEqual({ '@texuli/tools': manifest.version });
    expect(TOOLS_VERSION).toBe(manifest.version);
    expect(manifest.bin).toEqual({ 'texuli-mcp': './src/bin.ts' });
  });

  it('prints help and version, and refuses unknown arguments without serving', async () => {
    const output = new PassThrough();
    const error = new PassThrough();
    const out = collect(output);
    const err = collect(error);
    expect(await runTexuliMcpCli(['--version'], { output, error })).toEqual({
      ok: true,
      served: false,
    });
    expect(await runTexuliMcpCli(['--help'], { output, error })).toEqual({
      ok: true,
      served: false,
    });
    expect(out.join('')).toMatch(/^0\.\d+\.\d+\nUsage: texuli-mcp \[--help\] \[--version\]/u);
    expect(out.join('')).toContain(`${TEXULI_MCP_VERSION}\n`);
    expect((await runTexuliMcpCli(['--stdio'], { output, error })).ok).toBe(false);
    expect(err.join('')).toContain('Unknown texuli-mcp argument "--stdio"');
    expect(process.exitCode).toBe(1);
  });

  it('serves the handshake, tools/list and a catalog.search call until input ends', async () => {
    const input = new PassThrough();
    const output = new PassThrough();
    const out = collect(output);
    const done = startTexuliMcp({ input, output });
    const send = (value: unknown) => input.write(`${JSON.stringify(value)}\n`);
    send({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
    send({
      jsonrpc: '2.0',
      id: 2,
      method: 'initialize',
      params: { protocolVersion: MCP_PROTOCOL_VERSION, capabilities: {} },
    });
    send({ jsonrpc: '2.0', method: 'notifications/initialized' });
    send({ jsonrpc: '2.0', id: 3, method: 'tools/list' });
    send({
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: { name: 'catalog.search', arguments: { query: 'button' } },
    });
    input.end();
    await done;
    const messages = out
      .join('')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line) as Rpc);
    expect(messages.map((message) => message.id)).toEqual([1, 2, 3, 4]);
    // The stdio door keeps the initialization gate.
    expect(messages[0]?.error?.code).toBe(-32600);
    expect(messages[1]?.result?.serverInfo).toEqual({ name: 'texuli', version: TOOLS_VERSION });
    const tools = ((messages[2]?.result?.tools ?? []) as { name: string }[]).map(
      (tool) => tool.name
    );
    expect(tools).toEqual(expect.arrayContaining(['catalog.search', 'document.export']));
    expect(messages[3]?.result?.isError).toBeFalsy();
    expect(JSON.stringify(messages[3]?.result?.structuredContent)).toContain('button');
  });
});
