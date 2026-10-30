/// <reference types="node" />
// @vitest-environment node
/**
 * The local MCP door (ADR-019): `texuli mcp` in the tools CLI router, and
 * `runMcpCli`, which the `@texuli/mcp` bin (`texuli-mcp`) runs too.
 */
import { PassThrough } from 'node:stream';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { runTexuliCli } from '../src/cli/texuli.ts';
import { MCP_PROTOCOL_VERSION, mcpUsage, runMcpCli } from '../src/mcp/index.ts';
import { TOOLS_VERSION } from '../src/ops/index.ts';

type Rpc = { id?: number | string | null; result?: Record<string, unknown>; error?: unknown };

function streams() {
  const input = new PassThrough();
  const output = new PassThrough();
  const error = new PassThrough();
  const out: string[] = [];
  const err: string[] = [];
  output.setEncoding('utf8');
  error.setEncoding('utf8');
  output.on('data', (chunk: string) => out.push(chunk));
  error.on('data', (chunk: string) => err.push(chunk));
  return { input, output, error, out, err };
}

afterEach(() => {
  vi.restoreAllMocks();
  process.exitCode = undefined;
});

describe('runMcpCli', () => {
  it('prints usage and the version without starting the server', async () => {
    for (const flag of ['--help', '-h']) {
      const io = streams();
      expect(await runMcpCli([flag], { ...io, command: 'texuli-mcp' })).toEqual({
        ok: true,
        served: false,
      });
      expect(io.out.join('')).toBe(mcpUsage('texuli-mcp'));
      expect(io.out.join('')).toContain('claude mcp add texuli -- npx -y @texuli/mcp');
    }
    for (const flag of ['--version', '-v']) {
      const io = streams();
      expect(await runMcpCli([flag], io)).toEqual({ ok: true, served: false });
      expect(io.out.join('')).toBe(`${TOOLS_VERSION}\n`);
    }
    const io = streams();
    await runMcpCli(['--version'], { ...io, version: '9.9.9' });
    expect(io.out.join('')).toBe('9.9.9\n');
  });

  it('refuses unknown arguments on stderr, never on the JSON-RPC stream', async () => {
    for (const argv of [['--port', '80'], ['serve'], ['--help', 'extra']]) {
      const io = streams();
      const result = await runMcpCli(argv, io);
      if (argv[0] === '--help') {
        expect(result.ok).toBe(true);
        continue;
      }
      expect(result.ok, argv.join(' ')).toBe(false);
      expect(io.out).toEqual([]);
      expect(io.err.join('')).toMatch(/Unknown texuli mcp argument/u);
      expect(process.exitCode).toBe(1);
    }
  });

  it('serves stdio with every edge and node operation until stdin closes', async () => {
    const io = streams();
    const done = runMcpCli([], io);
    const line = (value: unknown) => `${JSON.stringify(value)}\n`;
    io.input.write(
      line({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: { protocolVersion: MCP_PROTOCOL_VERSION, capabilities: {} },
      })
    );
    io.input.write(line({ jsonrpc: '2.0', method: 'notifications/initialized' }));
    io.input.write(line({ jsonrpc: '2.0', id: 2, method: 'tools/list' }));
    io.input.end();
    expect(await done).toEqual({ ok: true, served: true });
    const messages = io.out
      .join('')
      .trim()
      .split('\n')
      .map((text) => JSON.parse(text) as Rpc);
    expect(messages.map((message) => message.id)).toEqual([1, 2]);
    expect(messages[0]?.result?.serverInfo).toEqual({ name: 'texuli', version: TOOLS_VERSION });
    const names = ((messages[1]?.result?.tools ?? []) as { name: string }[]).map(
      (tool) => tool.name
    );
    // An edge operation and a node operation are both served locally.
    expect(names).toContain('catalog.search');
    expect(names).toContain('document.export');
    expect(io.err).toEqual([]);
  });
});

describe('texuli mcp', () => {
  it('routes to the MCP door and lists it among the commands', async () => {
    const write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const error = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    expect(await runTexuliCli(['mcp', '--help'])).toEqual({ ok: true, served: false });
    expect(String(write.mock.calls.at(-1)?.[0])).toBe(mcpUsage('texuli mcp'));
    expect(await runTexuliCli(['nope'])).toMatchObject({ ok: false });
    expect(String(error.mock.calls.at(-1)?.[0])).toContain('Available: deck, document, mcp.');
  });
});
