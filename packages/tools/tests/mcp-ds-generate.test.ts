import { expect, it } from 'vitest';
import { createMcpHandler, MCP_PROTOCOL_VERSION, type McpHandler } from '../src/mcp/index.ts';

type Rpc = {
  jsonrpc: '2.0';
  id: number;
  result?: Record<string, unknown>;
  error?: { code: number; message: string };
};

async function rpc(handle: McpHandler, method: string, params?: unknown): Promise<Rpc> {
  return (await handle({ jsonrpc: '2.0', id: 1, method, ...(params ? { params } : {}) })) as Rpc;
}

async function ready() {
  const handle = createMcpHandler({ mode: 'stateful' });
  const initialized = await rpc(handle, 'initialize', {
    protocolVersion: MCP_PROTOCOL_VERSION,
    capabilities: {},
    clientInfo: { name: 'ds-generate-test', version: '1' },
  });
  expect(initialized.error).toBeUndefined();
  await handle({ jsonrpc: '2.0', method: 'notifications/initialized' });
  return handle;
}

it('lists a read-only draft generator and reports losses, AA repairs and guarantees', async () => {
  const handle = await ready();
  const listed = await rpc(handle, 'tools/list');
  const tools = listed.result?.tools as {
    name: string;
    annotations?: Record<string, boolean>;
  }[];
  const generator = tools.find((tool) => tool.name === 'design_system.generate');
  expect(generator?.annotations).toMatchObject({ readOnlyHint: true, destructiveHint: false });

  const called = await rpc(handle, 'tools/call', {
    name: 'design_system.generate',
    arguments: {
      brief: 'Fictional Harborline, teal #0e7490, rounded, compact',
      css: ':root { --brand: #0e7490; --radius: 10px; --space: 4px; }',
    },
  });
  expect(called.error).toBeUndefined();
  expect(called.result?.isError).toBeUndefined();
  const content = called.result?.content as { text: string }[];
  const output = JSON.parse(content[0]?.text ?? '{}') as {
    ok: boolean;
    document?: Record<string, unknown>;
    report: {
      losses: unknown[];
      repairs: unknown[];
      guarantees: { passed: boolean };
    };
  };
  expect(output.ok).toBe(true);
  expect(output.document).toBeDefined();
  expect(output.document?.approval).toBeUndefined();
  expect(output.report).toMatchObject({
    losses: expect.any(Array),
    repairs: expect.any(Array),
    guarantees: { passed: expect.any(Boolean) },
  });
});

it('refuses oversized input at the MCP operation boundary', async () => {
  const handle = await ready();
  const called = await rpc(handle, 'tools/call', {
    name: 'design_system.generate',
    arguments: { css: 'x'.repeat(1_048_577) },
  });
  expect(called.error).toBeUndefined();
  expect(called.result?.isError).toBe(true);
  expect(called.result?.content).toMatchObject([
    { text: expect.stringContaining('input-too-large') },
  ]);
});
