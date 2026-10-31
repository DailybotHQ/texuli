/// <reference types="node" />
/**
 * The `texuli` router (ADR-017): `texuli <group> <verb>` for every operation
 * of the registry, generated from it, plus the commands kept from 0.8
 * (`deck <command>`, `document <command>`, `mcp`, `init`, `theme list |
 * preview <id> | apply <id>`, `add`, `diff`, `update`). `texuli help` and
 * `texuli <group> --help` are written from the registry too.
 *
 * Parsing is pure ({@link parseRouterArgs}): `scripts/check-skill.ts` uses
 * it to refuse any `texuli …` command the skill cites that this router
 * would not accept. Running ({@link runRouter}) reads the input (stdin,
 * `--json` or `--file`), invokes the operation through the registry and
 * prints JSON, or writes it with `--out` through the local write policy.
 */
import { readFile, stat } from 'node:fs/promises';
import { parseAddArgs, runAddCli } from '../cli-add/cli.ts';
import { parseInitArgs, runInitCli } from '../cli-init/cli.ts';
import { parseUpdateArgs, runUpdateCli } from '../cli-update/cli.ts';
import { parseDsCliArgs, runDsCli } from '../ds-check/cli.ts';
import { writeLocalFile } from '../internal/local-write.ts';
import { runMcpCli } from '../mcp/cli.ts';
import { LOCAL_RUNTIMES, type OperationRegistry, texuliOps } from '../ops/index.ts';
import type { JsonSchema } from '../ops/schema.ts';
import type { Operation } from '../ops/types.ts';
import { parseDeckCliArgs, runDeckCli } from './deck.ts';
import { parseDocumentCliArgs, runDocumentCli } from './document.ts';

/** One operation as a router command. */
export interface RouterOperation {
  group: string;
  verb: string;
  operation: Operation;
}

/** A command kept from 0.8, routed to its own parser. */
export interface LegacyCommand {
  /** The words after `texuli` (`deck <command>`, `theme list`). */
  usage: string;
  summary: string;
}

/** The 0.8 commands the router keeps, in help order. */
export const LEGACY_COMMANDS: readonly LegacyCommand[] = Object.freeze([
  {
    usage: 'deck <command>',
    summary:
      'The deck commands (capabilities, schema, layouts, lint, inspect, from-markdown, to-markdown)',
  },
  {
    usage: 'document <command>',
    summary: 'The document commands (validate, patch, from-markdown, to-pdf … with --out)',
  },
  {
    usage: 'ds check <file>',
    summary:
      'Check a design-system document: codes, guarantees, contrast report (--json, --render, --mode, --variant)',
  },
  { usage: 'mcp', summary: 'Run the local MCP server over stdio (every operation)' },
  { usage: 'init', summary: 'Wire Texuli tokens and CSS into a Vite, Astro or SvelteKit project' },
  { usage: 'theme list', summary: 'List the theme library' },
  { usage: 'theme preview <id>', summary: "Show a theme's key tokens and its WCAG AA report" },
  { usage: 'theme apply <id>', summary: 'Switch an initialized project to another theme' },
  { usage: 'add <component>', summary: "Copy a styled component's source into the app" },
  { usage: 'diff <component>', summary: 'Show what an update of a copied component would change' },
  { usage: 'update <component>', summary: 'Three-way merge a copied component with a new source' },
]);

/** The first word of each kept command. */
const LEGACY_HEADS = new Set([
  'deck',
  'document',
  'ds',
  'mcp',
  'init',
  'theme',
  'add',
  'diff',
  'update',
]);

/**
 * Every operation the CLI runs as `{ group, verb }`, in registry order: the
 * local runtimes only (`site` operations read the built texuli.com and are
 * served by the remote MCP alone).
 */
export function routerOperations(registry: OperationRegistry = texuliOps): RouterOperation[] {
  return registry.list({ runtimes: LOCAL_RUNTIMES }).map((operation) => {
    const dot = operation.name.indexOf('.');
    return {
      group: operation.name.slice(0, dot),
      verb: operation.name.slice(dot + 1),
      operation,
    };
  });
}

/** Every command name the router accepts (`catalog search`, `deck lint`, `theme list`, `help` …). */
export function routerCommandNames(registry: OperationRegistry = texuliOps): Set<string> {
  const names = new Set<string>(['help']);
  for (const { group, verb } of routerOperations(registry)) {
    names.add(group);
    names.add(`${group} ${verb}`);
  }
  for (const command of LEGACY_COMMANDS) {
    const words = command.usage.split(' ').filter((word) => !word.startsWith('<'));
    names.add(words[0] as string);
    if (words[1]) names.add(`${words[0]} ${words[1]}`);
  }
  return names;
}

/** Where an operation's JSON input comes from. */
export type RouterInput =
  | { from: 'stdin' }
  | { from: 'json'; text: string }
  | { from: 'file'; path: string };

export type RouterParse =
  | { kind: 'help'; group?: string }
  | { kind: 'operation-help'; operation: string }
  | {
      kind: 'operation';
      operation: string;
      input: RouterInput;
      out?: string;
      overwrite: boolean;
    }
  | {
      kind: 'legacy';
      command: 'deck' | 'document' | 'ds' | 'mcp' | 'init' | 'theme' | 'add' | 'update';
      argv: string[];
    }
  | { kind: 'error'; message: string };

const HELP_FLAGS = new Set(['--help', '-h']);

function parseOperationFlags(
  name: string,
  rest: readonly string[]
): Extract<RouterParse, { kind: 'operation' | 'operation-help' | 'error' }> {
  let input: RouterInput = { from: 'stdin' };
  let sources = 0;
  let out: string | undefined;
  let overwrite = false;
  for (let index = 0; index < rest.length; index++) {
    const arg = rest[index] as string;
    const value = () => {
      const next = rest[++index];
      if (next === undefined) throw new TypeError(`Flag ${arg} needs a value.`);
      return next;
    };
    if (HELP_FLAGS.has(arg)) return { kind: 'operation-help', operation: name };
    if (arg === '--json') {
      const text = value();
      input = text === '-' ? { from: 'stdin' } : { from: 'json', text };
      sources++;
    } else if (arg === '--file' || arg === '-f') {
      input = { from: 'file', path: value() };
      sources++;
    } else if (arg === '--out' || arg === '-o') out = value();
    else if (arg === '--overwrite') overwrite = true;
    else throw new TypeError(`Unknown flag "${arg}" for texuli ${name.replace('.', ' ')}.`);
  }
  if (sources > 1) throw new TypeError('Use one of --json or --file, not both.');
  if (overwrite && out === undefined) throw new TypeError('Flag --overwrite needs --out.');
  return {
    kind: 'operation',
    operation: name,
    input,
    overwrite,
    ...(out === undefined ? {} : { out }),
  };
}

/**
 * Parse `texuli` arguments without running anything. Kept commands are
 * checked by their own parsers, so an invalid flag is refused here too.
 */
export function parseRouterArgs(
  argv: readonly string[],
  registry: OperationRegistry = texuliOps
): RouterParse {
  try {
    const [head, second, ...rest] = argv;
    if (head === undefined || head === 'help' || HELP_FLAGS.has(head)) {
      const group = head === 'help' ? second : undefined;
      if (group !== undefined && !routerCommandNames(registry).has(group))
        return { kind: 'error', message: `Unknown texuli group "${group}". Run texuli help.` };
      return { kind: 'help', ...(group ? { group } : {}) };
    }
    // `theme preview <id>` (an id, not a flag) is the 0.8 command; `theme
    // preview` with JSON input is the theme.preview operation.
    if (
      head === 'theme' &&
      second === 'preview' &&
      rest[0] !== undefined &&
      !rest[0].startsWith('-')
    ) {
      parseInitArgs(argv, '.');
      return { kind: 'legacy', command: 'theme', argv: [...argv] };
    }
    const operations = routerOperations(registry).filter((entry) => entry.group === head);
    const match = operations.find((entry) => entry.verb === second);
    if (match) return parseOperationFlags(match.operation.name, rest);
    if (operations.length > 0 && (second === undefined || HELP_FLAGS.has(second)))
      return { kind: 'help', group: head };
    if (LEGACY_HEADS.has(head)) {
      const tail = argv.slice(1);
      switch (head) {
        case 'deck':
          parseDeckCliArgs(tail);
          return { kind: 'legacy', command: 'deck', argv: tail };
        case 'document':
          parseDocumentCliArgs(tail);
          return { kind: 'legacy', command: 'document', argv: tail };
        case 'ds':
          parseDsCliArgs(tail);
          return { kind: 'legacy', command: 'ds', argv: tail };
        case 'mcp': {
          const [flag, ...extra] = tail;
          if (
            extra.length > 0 ||
            (flag !== undefined && !/^(?:--help|-h|--version|-v)$/.test(flag))
          )
            throw new TypeError(`Unknown texuli mcp argument "${flag}". Run texuli mcp --help.`);
          return { kind: 'legacy', command: 'mcp', argv: tail };
        }
        case 'theme':
          // `theme list` and `theme apply <id>`.
          parseInitArgs(argv, '.');
          return { kind: 'legacy', command: 'theme', argv: [...argv] };
        case 'init':
          parseInitArgs(argv, '.');
          return { kind: 'legacy', command: 'init', argv: [...argv] };
        case 'add':
          parseAddArgs(argv, { cwd: '.' });
          return { kind: 'legacy', command: 'add', argv: [...argv] };
        default:
          parseUpdateArgs(argv, { cwd: '.' });
          return { kind: 'legacy', command: 'update', argv: [...argv] };
      }
    }
    if (operations.length > 0)
      return {
        kind: 'error',
        message: `Unknown verb "${second}" for texuli ${head}. Run texuli ${head} --help.`,
      };
    return { kind: 'error', message: `Unknown texuli command "${head}". Run texuli help.` };
  } catch (error) {
    return { kind: 'error', message: error instanceof Error ? error.message : String(error) };
  }
}

// ─── Help, written from the registry ──────────────────────────────────────

const INPUT_LINE =
  'Input: one JSON object from stdin, --json <object> (--json - reads stdin) or --file <path>.';
const OUTPUT_LINE =
  'Output: JSON on stdout (exit 1 on a refusal), or --out <path> to write it to a new file inside the working directory (--overwrite replaces one).';

function pad(text: string, width: number): string {
  return text.length >= width ? `${text}  ` : text.padEnd(width);
}

/** `texuli help`: every operation and kept command. */
export function routerHelp(registry: OperationRegistry = texuliOps): string {
  const operations = routerOperations(registry);
  const width = Math.max(
    ...operations.map(({ group, verb }) => `${group} ${verb}`.length),
    ...LEGACY_COMMANDS.map((command) => command.usage.length)
  );
  const lines = [
    'Usage: texuli <group> <verb> [--json <object> | --file <path>] [--out <path> [--overwrite]]',
    '       texuli <command> [options]',
    '       texuli help [<group>]',
    '',
    'Operations (the @texuli/tools registry; the same names are MCP tools):',
    ...operations.map(
      ({ group, verb, operation }) =>
        `  ${pad(`${group} ${verb}`, width + 2)}${operation.title}${operation.runtime === 'edge' ? '' : ` (${operation.runtime} only)`}`
    ),
    '',
    'Commands:',
    ...LEGACY_COMMANDS.map((command) => `  ${pad(command.usage, width + 2)}${command.summary}`),
    '',
    INPUT_LINE,
    OUTPUT_LINE,
    'Run texuli <group> --help or texuli <group> <verb> --help for details.',
    '',
  ];
  return lines.join('\n');
}

/** `texuli <group> --help`: the group's operations, plus its kept commands. */
export function groupHelp(group: string, registry: OperationRegistry = texuliOps): string {
  const operations = routerOperations(registry).filter((entry) => entry.group === group);
  const legacy = LEGACY_COMMANDS.filter((command) => command.usage.split(' ')[0] === group);
  const width = Math.max(
    0,
    ...operations.map(({ verb }) => `${group} ${verb}`.length),
    ...legacy.map((command) => command.usage.length)
  );
  const lines = [
    `Usage: texuli ${group} <verb> [--json <object> | --file <path>] [--out <path>]`,
    '',
  ];
  if (operations.length > 0) {
    lines.push('Operations:');
    for (const { verb, operation } of operations)
      lines.push(`  ${pad(`${group} ${verb}`, width + 2)}${operation.title} [${operation.name}]`);
    lines.push('');
  }
  if (legacy.length > 0) {
    lines.push('Commands kept from 0.8:');
    for (const command of legacy)
      lines.push(`  ${pad(command.usage, width + 2)}${command.summary}`);
    lines.push('');
  }
  lines.push(INPUT_LINE, OUTPUT_LINE, '');
  return lines.join('\n');
}

function schemaType(schema: JsonSchema): string {
  if (Array.isArray(schema.enum))
    return schema.enum.map((value) => JSON.stringify(value)).join(' | ');
  const type = schema.type;
  return Array.isArray(type) ? type.join(' | ') : String(type ?? 'any');
}

/** `texuli <group> <verb> --help`: the operation's summary, arguments, limits and an example. */
export function operationHelp(name: string, registry: OperationRegistry = texuliOps): string {
  const operation = registry.get(name);
  if (!operation) throw new TypeError(`Unknown operation "${name}".`);
  const [group, verb] = [name.slice(0, name.indexOf('.')), name.slice(name.indexOf('.') + 1)];
  const properties = (operation.input.properties ?? {}) as Record<string, JsonSchema>;
  const required = new Set((operation.input.required as string[] | undefined) ?? []);
  const lines = [
    `Usage: texuli ${group} ${verb} [--json <object> | --file <path>] [--out <path>]`,
    '',
    `${operation.title} (${operation.name}, runtime ${operation.runtime})`,
    operation.summary,
    '',
    'Arguments (JSON object keys):',
  ];
  for (const [key, schema] of Object.entries(properties)) {
    const description = typeof schema.description === 'string' ? ` ${schema.description}` : '';
    lines.push(
      `  ${key}${required.has(key) ? ' (required)' : ''}: ${schemaType(schema)}.${description}`
    );
  }
  if (Object.keys(properties).length === 0) lines.push('  (none)');
  const limits = [`input up to ${operation.limits.inputBytes} bytes`];
  if (operation.limits.items !== undefined) limits.push(`at most ${operation.limits.items} items`);
  limits.push(`${operation.limits.timeMs} ms budget`);
  lines.push('', `Limits: ${limits.join(', ')}.`);
  const example = operation.examples[0];
  if (example) {
    const json = JSON.stringify(example.input);
    if (json.length <= 200)
      lines.push(`Example (${example.title}): texuli ${group} ${verb} --json '${json}'`);
  }
  lines.push('');
  return lines.join('\n');
}

// ─── Running ───────────────────────────────────────────────────────────────

/** The streams and directory `runRouter` uses (injectable for tests). */
export interface RouterIo {
  stdin?: NodeJS.ReadableStream & { isTTY?: boolean };
  stdout?: { write(chunk: string): unknown };
  stderr?: { write(chunk: string): unknown };
  /** Where `--out` writes are confined (default the working directory). */
  cwd?: string;
}

export type RouterResult = { ok: true; [key: string]: unknown } | { ok: false; error: string };

async function readStream(stream: NodeJS.ReadableStream, max: number): Promise<string> {
  const chunks: Uint8Array[] = [];
  let length = 0;
  for await (const chunk of stream) {
    const bytes =
      typeof chunk === 'string' ? new TextEncoder().encode(chunk) : (chunk as Uint8Array);
    length += bytes.byteLength;
    if (length > max) throw new RangeError(`Input exceeds ${max} bytes; nothing was run.`);
    chunks.push(bytes);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function readInput(input: RouterInput, max: number, io: RouterIo): Promise<unknown> {
  let text: string;
  if (input.from === 'json') text = input.text;
  else if (input.from === 'file') {
    const info = await stat(input.path);
    if (!info.isFile()) throw new TypeError(`--file ${input.path} is not a regular file.`);
    if (info.size > max)
      throw new RangeError(`Input exceeds ${max} bytes (${info.size}); nothing was read.`);
    text = await readFile(input.path, 'utf8');
  } else {
    const stdin = io.stdin ?? process.stdin;
    // An interactive terminal with no input: run with an empty object.
    if ((stdin as { isTTY?: boolean }).isTTY) return {};
    text = await readStream(stdin, max);
    if (text.trim() === '') return {};
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new SyntaxError('The input must be one JSON object.');
  }
}

/**
 * Run `texuli …`. Returns `{ ok }` and sets `process.exitCode` to 1 on any
 * refusal; never throws.
 */
export async function runRouter(
  argv: readonly string[],
  io: RouterIo = {},
  registry: OperationRegistry = texuliOps
): Promise<RouterResult> {
  const stdout = io.stdout ?? process.stdout;
  const stderr = io.stderr ?? process.stderr;
  const refuse = (message: string): RouterResult => {
    stderr.write(`${message}\n`);
    process.exitCode = 1;
    return { ok: false, error: message };
  };
  const parsed = parseRouterArgs(argv, registry);
  switch (parsed.kind) {
    case 'error':
      return refuse(parsed.message);
    case 'help': {
      if (argv.length === 0) {
        stderr.write(routerHelp(registry));
        process.exitCode = 1;
        return { ok: false, error: 'Expected a texuli command.' };
      }
      const known =
        parsed.group !== undefined &&
        routerOperations(registry).some((e) => e.group === parsed.group);
      stdout.write(known ? groupHelp(parsed.group as string, registry) : routerHelp(registry));
      return { ok: true };
    }
    case 'operation-help':
      stdout.write(operationHelp(parsed.operation, registry));
      return { ok: true };
    case 'legacy':
      return runLegacy(parsed);
    case 'operation':
      break;
  }
  const operation = registry.get(parsed.operation) as Operation;
  let input: unknown;
  try {
    input = await readInput(parsed.input, operation.limits.inputBytes, io);
  } catch (error) {
    return refuse(error instanceof Error ? error.message : String(error));
  }
  const outcome = await registry.invoke(operation.name, input, { runtimes: LOCAL_RUNTIMES });
  if (!outcome.ok) {
    stdout.write(
      `${JSON.stringify({ ok: false, operation: operation.name, error: outcome.error }, null, 2)}\n`
    );
    process.exitCode = 1;
    return { ok: false, error: outcome.error.message };
  }
  const json = `${JSON.stringify(outcome.output, null, 2)}\n`;
  if (parsed.out === undefined) {
    stdout.write(json);
    return { ok: true };
  }
  const written = await writeLocalFile(parsed.out, json, {
    overwrite: parsed.overwrite,
    ...(io.cwd ? { cwd: io.cwd } : {}),
  });
  if (!written.ok) return refuse(`${written.error} (${written.code})`);
  stdout.write(
    `${JSON.stringify({ ok: true, operation: operation.name, out: written.relative, bytes: written.bytes }, null, 2)}\n`
  );
  return { ok: true, out: written.relative };
}

async function runLegacy(parsed: Extract<RouterParse, { kind: 'legacy' }>): Promise<RouterResult> {
  switch (parsed.command) {
    case 'deck':
      return (await runDeckCli(parsed.argv)) as RouterResult;
    case 'document':
      return (await runDocumentCli(parsed.argv)) as RouterResult;
    case 'ds': {
      const result = await runDsCli(parsed.argv);
      return result.ok ? { ok: true } : { ok: false, error: result.error };
    }
    case 'mcp':
      return (await runMcpCli(parsed.argv)) as RouterResult;
    default: {
      const run =
        parsed.command === 'add'
          ? runAddCli
          : parsed.command === 'update'
            ? runUpdateCli
            : runInitCli;
      const code = await run(parsed.argv);
      if (code !== 0) {
        process.exitCode = code;
        return { ok: false, error: `texuli ${parsed.argv.join(' ')} exited with ${code}.` };
      }
      return { ok: true };
    }
  }
}
