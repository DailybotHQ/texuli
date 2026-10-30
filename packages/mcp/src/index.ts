/// <reference types="node" />
/**
 * `@texuli/mcp`: the local Texuli MCP server (ADR-019). The server, the
 * operations registry, the resources and the prompts live in
 * `@texuli/tools`; this package is the one-word install MCP hosts document
 * (`npx -y @texuli/mcp`) and its bin, `texuli-mcp`.
 */
import type { Readable, Writable } from 'node:stream';
import { type McpCliResult, runMcpCli } from '@texuli/tools/mcp';
import { TEXULI_MCP_VERSION } from './version.ts';

export { TEXULI_MCP_VERSION };

/** The streams `startTexuliMcp` serves (default stdin and stdout). */
export interface TexuliMcpOptions {
  input?: Readable;
  output?: Writable;
}

/**
 * Serve the Texuli MCP protocol over newline-delimited JSON-RPC on `input`
 * and `output` (stdin and stdout by default) with every `edge` and `node`
 * operation, until `input` ends.
 */
export async function startTexuliMcp(options: TexuliMcpOptions = {}): Promise<void> {
  await runMcpCli([], options);
}

/**
 * The `texuli-mcp` command: `--help` and `--version` print and return;
 * with no arguments it serves stdio until stdin closes.
 */
export function runTexuliMcpCli(
  argv: readonly string[] = process.argv.slice(2),
  options: TexuliMcpOptions & { error?: Writable } = {}
): Promise<McpCliResult> {
  return runMcpCli(argv, { ...options, command: 'texuli-mcp', version: TEXULI_MCP_VERSION });
}
