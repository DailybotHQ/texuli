/// <reference types="node" />
import type { Readable, Writable } from 'node:stream';
import { TOOLS_VERSION } from '../ops/version.ts';
import { runMcpStdio } from './stdio.ts';

/** The streams and labels `runMcpCli` uses (injectable for tests and the `@texuli/mcp` bin). */
export interface McpCliOptions {
  input?: Readable;
  output?: Writable;
  /** Where usage and errors go (never stdout, which carries JSON-RPC). */
  error?: Writable;
  /** The command name printed in usage (`texuli mcp` or `texuli-mcp`). */
  command?: string;
  /** The version `--version` prints (default the `@texuli/tools` version). */
  version?: string;
}

export type McpCliResult = { ok: true; served: boolean } | { ok: false; error: string };

/** Usage text for the local MCP server. */
export function mcpUsage(command = 'texuli mcp'): string {
  return [
    `Usage: ${command} [--help] [--version]`,
    '',
    'Runs the Texuli MCP server over stdio (newline-delimited JSON-RPC on stdin and stdout):',
    'every edge and node operation as a tool, plus the Texuli resources, prompts and',
    'completions. Logs go to stderr. The server exits when stdin closes.',
    '',
    'Writes: none today. Operations that write files later take an explicit path',
    'that must resolve inside the working directory.',
    '',
    'Connect a host (Claude Code): claude mcp add texuli -- npx -y @texuli/mcp',
    'Docs: https://github.com/DailybotHQ/texuli/tree/main/packages/mcp#readme',
    '',
  ].join('\n');
}

/**
 * The local MCP door: `--help` and `--version` print and return; with no
 * arguments it serves stdio until stdin closes. Any other argument is
 * refused without starting the server.
 */
export async function runMcpCli(
  argv: readonly string[] = [],
  options: McpCliOptions = {}
): Promise<McpCliResult> {
  const output = options.output ?? process.stdout;
  const error = options.error ?? process.stderr;
  const command = options.command ?? 'texuli mcp';
  const [flag, ...extra] = argv;
  if (flag === '--help' || flag === '-h') {
    output.write(mcpUsage(command));
    return { ok: true, served: false };
  }
  if (flag === '--version' || flag === '-v') {
    output.write(`${options.version ?? TOOLS_VERSION}\n`);
    return { ok: true, served: false };
  }
  if (flag !== undefined || extra.length > 0) {
    const message = `Unknown ${command} argument "${flag}". Run ${command} --help.`;
    error.write(`${message}\n`);
    process.exitCode = 1;
    return { ok: false, error: message };
  }
  await runMcpStdio(options.input ?? process.stdin, output);
  return { ok: true, served: true };
}
