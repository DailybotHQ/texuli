// @vitest-environment node
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createMcpHandler } from '../../packages/tools/src/mcp/handler.ts';

const SCRIPT = join(import.meta.dirname, '../mcp-remote-smoke.sh');
let server: Server | undefined;
afterEach(() => {
  server?.close();
  server = undefined;
});

/** A local stand-in for texuli.com/mcp that answers with `names`, recording each request. */
async function serve(names: () => Promise<string[]>): Promise<{ url: string; seen: string[] }> {
  const seen: string[] = [];
  server = createServer((request, response) => {
    let body = '';
    request.on('data', (chunk) => {
      body += chunk;
    });
    request.on('end', async () => {
      seen.push(`${request.method} ${request.headers['mcp-protocol-version']} ${body}`);
      const tools = (await names()).map((name) => ({ name }));
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({ jsonrpc: '2.0', id: 1, result: { tools } }));
    });
  });
  await new Promise<void>((resolve) => server?.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return { url: `http://127.0.0.1:${port}/mcp`, seen };
}

function run(url: string): Promise<{ code: number; out: string }> {
  return new Promise((resolve) => {
    const child = spawn('bash', [SCRIPT], {
      env: { ...process.env, MCP_SMOKE_URL: url, MCP_SMOKE_ATTEMPTS: '2', MCP_SMOKE_DELAY: '0' },
    });
    let out = '';
    child.stdout.on('data', (chunk) => {
      out += chunk;
    });
    child.stderr.on('data', (chunk) => {
      out += chunk;
    });
    child.on('close', (code) => resolve({ code: code ?? -1, out }));
  });
}

const edgeNames = async () => {
  const handler = createMcpHandler({ mode: 'stateless', runtimes: ['edge'] });
  const response = (await handler({ jsonrpc: '2.0', id: 1, method: 'tools/list' })) as {
    result: { tools: { name: string }[] };
  };
  return response.result.tools.map((tool) => tool.name);
};

describe('scripts/mcp-remote-smoke.sh', () => {
  it('passes when tools/list equals the edge handler (the registry), posting a read-only tools/list with the card protocol version', async () => {
    const { url, seen } = await serve(edgeNames);
    const { code, out } = await run(url);
    expect(code, out).toBe(0);
    expect(out).toContain('mcp-remote-smoke ✓');
    const card = JSON.parse(
      readFileSync(
        join(import.meta.dirname, '../../apps/website/public/.well-known/mcp/server-card.json'),
        'utf8'
      )
    ) as { protocolVersion: string };
    expect(seen).toEqual([
      `POST ${card.protocolVersion} {"jsonrpc":"2.0","id":1,"method":"tools/list"}`,
    ]);
  }, 30_000);

  it('retries, then fails with an error annotation when the live list drifts (a missing tool, a node-only tool)', async () => {
    for (const drift of [
      async () => (await edgeNames()).slice(1),
      async () => [...(await edgeNames()), 'document.export'],
    ]) {
      const { url, seen } = await serve(drift);
      const { code, out } = await run(url);
      expect(code).toBe(1);
      expect(seen).toHaveLength(2);
      expect(out).toContain('::error title=Remote MCP drift::');
      server?.close();
    }
  }, 30_000);
});
