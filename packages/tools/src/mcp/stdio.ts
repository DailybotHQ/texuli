import { resolve } from 'node:path';
import { createInterface } from 'node:readline';
import type { Readable, Writable } from 'node:stream';
import { pathToFileURL } from 'node:url';
import { createTexuliMcpServer } from './server.ts';

const MAX_MESSAGE_BYTES = 2 * 1024 * 1024;

/** Run the MCP newline-delimited JSON-RPC transport over the supplied streams. */
export async function runMcpStdio(
  input: Readable = process.stdin,
  output: Writable = process.stdout
): Promise<void> {
  const handle = createTexuliMcpServer();
  const lines = createInterface({ input, crlfDelay: Infinity });
  for await (const line of lines) {
    if (Buffer.byteLength(line, 'utf8') > MAX_MESSAGE_BYTES) {
      output.write(
        `${JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Message exceeds the 2 MiB limit.' } })}\n`
      );
      continue;
    }
    let message: unknown;
    try {
      message = JSON.parse(line) as unknown;
    } catch {
      output.write(
        `${JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } })}\n`
      );
      continue;
    }
    const result = await handle(message);
    if (result) output.write(`${JSON.stringify(result)}\n`);
  }
}

const entryPath = process.argv[1];
if (entryPath && pathToFileURL(resolve(entryPath)).href === import.meta.url) {
  runMcpStdio().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'MCP server failed.');
    process.exitCode = 1;
  });
}
