#!/usr/bin/env node
/// <reference types="node" />
import { readFile, stat } from 'node:fs/promises';
import { DECK_COMMANDS, type DeckCommandName } from '../deck/index.ts';
import { isMainModule } from '../internal/is-main.ts';
import { texuliOps } from '../ops/index.ts';

const MAX_INPUT_BYTES = 2_000_000;

/** The file system calls `readDeckFile` uses (injectable for tests). */
export interface DeckFileSystem {
  stat(path: string): Promise<{ size: number; isFile(): boolean }>;
  readFile(path: string, encoding: 'utf8'): Promise<string>;
}

const NODE_FS: DeckFileSystem = { stat, readFile };

/**
 * Read a `--file` input: stat it first and refuse anything that is not a
 * regular file or is over `MAX_INPUT_BYTES` without reading it, so a huge
 * file (or a device such as `/dev/zero`) never lands in memory. The byte
 * check after reading still holds if the file grew in between.
 */
export async function readDeckFile(path: string, fs: DeckFileSystem = NODE_FS): Promise<string> {
  const info = await fs.stat(path);
  if (!info.isFile()) throw new TypeError(`--file ${path} is not a regular file.`);
  if (info.size > MAX_INPUT_BYTES)
    throw new RangeError(
      `Input exceeds ${MAX_INPUT_BYTES} bytes (${info.size}); nothing was read.`
    );
  return fs.readFile(path, 'utf8');
}

export interface DeckCliArgs {
  command: DeckCommandName;
  file?: string;
  text?: string;
  help: boolean;
}

export function parseDeckCliArgs(argv: readonly string[]): DeckCliArgs {
  const [command, ...rest] = argv;
  if (command === '--help' || command === '-h' || command === undefined)
    return { command: 'capabilities', help: true };
  if (!(DECK_COMMANDS as readonly string[]).includes(command))
    throw new TypeError(`Unknown deck command "${command}".`);
  let file: string | undefined;
  let text: string | undefined;
  for (let index = 0; index < rest.length; index++) {
    const arg = rest[index];
    if (arg === undefined) throw new TypeError('A deck CLI argument was missing.');
    if (arg === '--file' || arg === '-f') {
      const value = rest[++index];
      if (value === undefined) throw new TypeError(`Flag ${arg} needs a path.`);
      file = value;
    } else if (arg === '--text') {
      const value = rest[++index];
      if (value === undefined) throw new TypeError('Flag --text needs a value.');
      text = value;
    } else if (arg === '--help' || arg === '-h')
      return { command: command as DeckCommandName, help: true };
    else throw new TypeError(`Unknown deck flag "${arg}".`);
  }
  if (file && text !== undefined) throw new TypeError('Use either --file or --text, not both.');
  return {
    command: command as DeckCommandName,
    ...(file ? { file } : {}),
    ...(text === undefined ? {} : { text }),
    help: false,
  };
}

export async function runDeckCli(argv: readonly string[] = process.argv.slice(2)) {
  try {
    const args = parseDeckCliArgs(argv);
    if (args.help) {
      process.stdout.write(
        `${JSON.stringify({ usage: 'texuli deck <command> [--file <path> | --text <source>]', commands: DECK_COMMANDS }, null, 2)}\n`
      );
      return { ok: true };
    }
    let raw = args.text;
    if (args.file) raw = await readDeckFile(args.file);
    if (
      raw === undefined &&
      ['lint', 'inspect', 'to-markdown', 'from-markdown'].includes(args.command)
    )
      raw = await readStdin();
    if (raw !== undefined && new TextEncoder().encode(raw).byteLength > MAX_INPUT_BYTES)
      throw new RangeError(`Input exceeds ${MAX_INPUT_BYTES} bytes.`);
    const input: Record<string, unknown> = { command: args.command };
    if (args.command === 'from-markdown') input.markdown = raw ?? '';
    else if (['lint', 'inspect', 'to-markdown'].includes(args.command))
      input.deck = parseInput(raw ?? '');
    const outcome = await texuliOps.invoke('deck.run', input);
    if (!outcome.ok) throw new TypeError(outcome.error.message);
    const result = (outcome.output as { result: unknown }).result;
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    const ok =
      typeof result === 'object' && result !== null && 'ok' in result
        ? Boolean((result as { ok: unknown }).ok)
        : true;
    if (!ok) process.exitCode = 1;
    return { ok };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
    return { ok: false, error: message };
  }
}

function parseInput(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    throw new SyntaxError('Deck input must be valid JSON.');
  }
}
async function readStdin(): Promise<string> {
  const chunks: Uint8Array[] = [];
  let length = 0;
  for await (const chunk of process.stdin) {
    const bytes = typeof chunk === 'string' ? new TextEncoder().encode(chunk) : chunk;
    length += bytes.byteLength;
    if (length > MAX_INPUT_BYTES) throw new RangeError(`Input exceeds ${MAX_INPUT_BYTES} bytes.`);
    chunks.push(bytes);
  }
  const output = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(output);
}

if (isMainModule(import.meta.url))
  void runDeckCli().then((result) => {
    if (!result.ok) process.exitCode = 1;
  });
