#!/usr/bin/env node
/// <reference types="node" />
import { writeFile } from 'node:fs/promises';
import { DOCUMENT_COMMANDS, type DocumentCommandName } from '../document/index.ts';
import { isMainModule } from '../internal/is-main.ts';
import { texuliOps } from '../ops/index.ts';
import { readDeckFile } from './deck.ts';

const MAX_INPUT_BYTES = 2_000_000;
/** Commands that read a document (JSON); `from-markdown` reads Markdown. */
const READS_DOCUMENT = new Set<DocumentCommandName>([
  'validate',
  'inspect',
  'patch',
  'to-markdown',
  'to-blueprint',
  'to-docx',
  'to-pdf',
]);
/** Commands whose output `--out` writes as a file. */
const WRITES_FILE = new Set<DocumentCommandName>(['to-markdown', 'to-docx', 'to-pdf']);

export interface DocumentCliArgs {
  command: DocumentCommandName;
  file?: string;
  text?: string;
  patch?: string;
  out?: string;
  tier?: 'developer' | 'untrusted';
  key?: string;
  help: boolean;
}

export function parseDocumentCliArgs(argv: readonly string[]): DocumentCliArgs {
  const [command, ...rest] = argv;
  if (command === '--help' || command === '-h' || command === undefined)
    return { command: 'capabilities', help: true };
  if (!(DOCUMENT_COMMANDS as readonly string[]).includes(command))
    throw new TypeError(`Unknown document command "${command}".`);
  const name = command as DocumentCommandName;
  const args: DocumentCliArgs = { command: name, help: false };
  const value = (flag: string, index: number) => {
    const next = rest[index];
    if (next === undefined) throw new TypeError(`Flag ${flag} needs a value.`);
    return next;
  };
  for (let index = 0; index < rest.length; index++) {
    const arg = rest[index];
    if (arg === '--file' || arg === '-f') args.file = value(arg, ++index);
    else if (arg === '--text') args.text = value(arg, ++index);
    else if (arg === '--patch') args.patch = value(arg, ++index);
    else if (arg === '--out' || arg === '-o') args.out = value(arg, ++index);
    else if (arg === '--key') args.key = value(arg, ++index);
    else if (arg === '--tier') {
      const tier = value(arg, ++index);
      if (tier !== 'developer' && tier !== 'untrusted')
        throw new TypeError('Flag --tier is "developer" or "untrusted".');
      args.tier = tier;
    } else if (arg === '--help' || arg === '-h') return { command: name, help: true };
    else throw new TypeError(`Unknown document flag "${String(arg)}".`);
  }
  if (args.file && args.text !== undefined)
    throw new TypeError('Use either --file or --text, not both.');
  if (args.patch !== undefined && name !== 'patch')
    throw new TypeError('Flag --patch is only for the patch command.');
  if (name === 'patch' && args.patch === undefined)
    throw new TypeError('The patch command needs --patch <file>.');
  if (args.out !== undefined && !WRITES_FILE.has(name))
    throw new TypeError('Flag --out is only for to-markdown, to-docx and to-pdf.');
  if (args.key !== undefined && name !== 'to-blueprint')
    throw new TypeError('Flag --key is only for to-blueprint.');
  return args;
}

function parseJson(value: string, what: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    throw new SyntaxError(`${what} must be valid JSON.`);
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

/** `texuli document <command>`: prints JSON; `--out` writes Markdown, DOCX or PDF to a new file. */
export async function runDocumentCli(argv: readonly string[] = process.argv.slice(2)) {
  try {
    const args = parseDocumentCliArgs(argv);
    if (args.help) {
      process.stdout.write(
        `${JSON.stringify(
          {
            usage:
              'texuli document <command> [--file <path> | --text <source>] [--tier developer|untrusted] [--patch <file>] [--key <key>] [--out <new file>]',
            commands: DOCUMENT_COMMANDS,
          },
          null,
          2
        )}\n`
      );
      return { ok: true };
    }
    let raw = args.text;
    if (args.file) raw = await readDeckFile(args.file);
    const reads = READS_DOCUMENT.has(args.command) || args.command === 'from-markdown';
    if (raw === undefined && reads) raw = await readStdin();
    if (raw !== undefined && new TextEncoder().encode(raw).byteLength > MAX_INPUT_BYTES)
      throw new RangeError(`Input exceeds ${MAX_INPUT_BYTES} bytes.`);
    const input: Record<string, unknown> = {
      command: args.command,
      ...(args.tier ? { tier: args.tier } : {}),
      ...(args.key ? { key: args.key } : {}),
    };
    if (args.command === 'from-markdown') input.markdown = raw ?? '';
    else if (READS_DOCUMENT.has(args.command))
      input.document = parseJson(raw ?? '', 'Document input');
    if (args.patch !== undefined)
      input.patch = parseJson(await readDeckFile(args.patch), 'The patch');
    // PDF and DOCX run through document.export (node); the rest through document.run (edge).
    const exporting = args.command === 'to-docx' || args.command === 'to-pdf';
    const outcome = await texuliOps.invoke(
      exporting ? 'document.export' : 'document.run',
      exporting
        ? {
            format: args.command === 'to-docx' ? 'docx' : 'pdf',
            document: input.document,
            ...(args.tier ? { tier: args.tier } : {}),
          }
        : input
    );
    if (!outcome.ok) throw new TypeError(outcome.error.message);
    const result = (outcome.output as { result: Record<string, unknown> }).result;
    const ok =
      typeof result === 'object' && result !== null && 'ok' in result ? Boolean(result.ok) : true;
    if (ok && args.out !== undefined) {
      const data =
        typeof result.markdown === 'string'
          ? result.markdown
          : Buffer.from(String(result.base64 ?? ''), 'base64');
      // `wx`: never overwrite an existing file.
      await writeFile(args.out, data, { flag: 'wx' });
      const { base64: _base64, markdown: _markdown, ...summary } = result;
      process.stdout.write(`${JSON.stringify({ ...summary, out: args.out }, null, 2)}\n`);
    } else {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    }
    if (!ok) process.exitCode = 1;
    return { ok };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
    return { ok: false, error: message };
  }
}

if (isMainModule(import.meta.url))
  void runDocumentCli().then((result) => {
    if (!result.ok) process.exitCode = 1;
  });
