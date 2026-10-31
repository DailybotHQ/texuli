/// <reference types="node" />
/**
 * `texuli ds <command>` (T-ds-agent-tools): the design-system commands with
 * files as arguments, each running one registry operation, so the CLI, the
 * local MCP and the remote MCP give the same results:
 *
 *     texuli ds init <file> [--brand "<one-liner>"] [--id <id>] [--name <name>] [--overwrite]
 *     texuli ds validate <file> [--trust t] [--variant v] [--base <file>]...
 *     texuli ds compile <file> [--format f] [--mode m] [--variant v] [--base <file>]... [--out <path> [--overwrite]]
 *     texuli ds export <file> --format css|tailwind|dtcg|tokens-studio --out <path> [--selector s] [--dark d] [--overwrite]
 *     texuli ds preview <file> [--format svg|html] [--mode m] [--variant v] [--out <path> [--overwrite]]
 *     texuli ds diff <before> <after> [--mode m] [--base <file>]...
 *     texuli ds import <file|text> --from brand|dtcg|tokens-studio|role-palette|theme [--id] [--name] [--version] [--out <path> [--overwrite]]
 *     texuli ds check <file> …                       (the conformance check, ds-check/cli.ts)
 *
 * Output is the operation's JSON on stdout; with `--out`, the content
 * (CSS, preset, token file, preview or document) is written through the
 * local write policy instead, and a short receipt is printed. Exit codes:
 * 0 valid, 1 refused (`valid: false` or a refused write), 2 could not run.
 * `texuli ds <verb> --json <object>` (the operation's own input) is the
 * router's operation form and stays available.
 */
import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { DS_CHECK_MAX_BYTES, DS_CHECK_USAGE, parseDsCliArgs, runDsCli } from '../ds-check/cli.ts';
import { localFiles } from '../internal/local-write.ts';
import { LOCAL_RUNTIMES, texuliOps } from '../ops/index.ts';

/** The `ds` commands, in help order. */
export const DS_COMMANDS = [
  'init',
  'validate',
  'compile',
  'export',
  'preview',
  'diff',
  'import',
  'check',
] as const;
export type DsCommand = (typeof DS_COMMANDS)[number];

export const DS_USAGE = [
  'Usage: texuli ds init <file> [--brand "<one-liner>"] [--id <id>] [--name <name>] [--overwrite]',
  '       texuli ds validate <file> [--trust developer|untrusted] [--variant <name>] [--base <file>]...',
  '       texuli ds compile <file> [--format json|css|tailwind|dtcg|tokens-studio] [--mode light|dark] [--variant <name>] [--base <file>]... [--out <path> [--overwrite]]',
  '       texuli ds export <file> --format css|tailwind|dtcg|tokens-studio --out <path> [--selector <s>] [--dark class|attribute|media] [--overwrite]',
  '       texuli ds preview <file> [--format svg|html] [--mode light|dark] [--variant <name>] [--out <path> [--overwrite]]',
  '       texuli ds diff <before> <after> [--mode light|dark] [--base <file>]...',
  '       texuli ds import <file|text> --from brand|dtcg|tokens-studio|role-palette|theme [--id <id>] [--name <name>] [--version <x.y.z>] [--out <path> [--overwrite]]',
  `       ${DS_CHECK_USAGE.replace('Usage: ', '')}`,
].join('\n');

export interface DsCommandArgs {
  command: Exclude<DsCommand, 'check'>;
  /** Positional arguments: files, or the one-liner or theme id of `import`. */
  args: string[];
  flags: Record<string, string>;
  bases: string[];
  overwrite: boolean;
}

/** The value flags each command accepts (`--base` repeats and `--overwrite` takes none). */
const FLAGS: Record<DsCommandArgs['command'], readonly string[]> = {
  init: ['brand', 'id', 'name'],
  validate: ['trust', 'variant', 'base'],
  compile: ['format', 'mode', 'variant', 'trust', 'base', 'out', 'selector', 'dark'],
  export: ['format', 'mode', 'variant', 'trust', 'base', 'out', 'selector', 'dark'],
  preview: ['format', 'mode', 'variant', 'trust', 'base', 'out', 'title'],
  diff: ['mode', 'variant', 'trust', 'base'],
  import: ['from', 'id', 'name', 'version', 'trust', 'out'],
};
const POSITIONALS: Record<DsCommandArgs['command'], number> = {
  init: 1,
  validate: 1,
  compile: 1,
  export: 1,
  preview: 1,
  diff: 2,
  import: 1,
};
const CHOICES: Record<string, readonly string[]> = {
  trust: ['developer', 'untrusted'],
  mode: ['light', 'dark'],
  dark: ['class', 'attribute', 'media'],
  from: ['brand', 'dtcg', 'tokens-studio', 'role-palette', 'theme'],
};
const FORMATS: Partial<Record<DsCommandArgs['command'], readonly string[]>> = {
  compile: ['json', 'css', 'tailwind', 'dtcg', 'tokens-studio'],
  export: ['css', 'tailwind', 'dtcg', 'tokens-studio'],
  preview: ['svg', 'html'],
};

/**
 * Parse `ds <command> …` (the words after `texuli`). `check` and `--help`
 * go to the conformance check's parser; everything else is checked here.
 * Throws a `TypeError` on bad input.
 */
export function parseDsArgs(
  argv: readonly string[]
): DsCommandArgs | { command: 'check'; argv: string[] } | { command: 'help'; argv: string[] } {
  const [command, ...rest] = argv;
  if (command === undefined || command === '--help' || command === '-h')
    return { command: 'help', argv: [...argv] };
  if (command === 'check') {
    parseDsCliArgs(argv);
    return { command: 'check', argv: [...argv] };
  }
  if (!(DS_COMMANDS as readonly string[]).includes(command))
    throw new TypeError(`Unknown ds command "${command}". Run texuli ds --help.`);
  const name = command as DsCommandArgs['command'];
  const parsed: DsCommandArgs = { command: name, args: [], flags: {}, bases: [], overwrite: false };
  for (let index = 0; index < rest.length; index++) {
    const arg = rest[index] as string;
    if (arg === '--help' || arg === '-h') return { command: 'help', argv: [...argv] };
    if (arg === '--overwrite') {
      parsed.overwrite = true;
      continue;
    }
    if (arg.startsWith('--')) {
      const flag = arg.slice(2);
      if (!FLAGS[name].includes(flag))
        throw new TypeError(`Unknown ds ${name} flag "${arg}". Run texuli ds --help.`);
      const value = rest[++index];
      if (value === undefined || value.startsWith('--'))
        throw new TypeError(`Flag ${arg} needs a value.`);
      const choices = flag === 'format' ? FORMATS[name] : CHOICES[flag];
      if (choices && !choices.includes(value))
        throw new TypeError(`Flag ${arg} is one of ${choices.join(', ')}.`);
      if (flag === 'base') parsed.bases.push(value);
      else parsed.flags[flag] = value;
      continue;
    }
    parsed.args.push(arg);
  }
  const want = POSITIONALS[name];
  if (parsed.args.length !== want)
    throw new TypeError(
      `ds ${name} takes ${want === 1 ? 'one argument' : `${want} arguments`}; got ${parsed.args.length}. Run texuli ds --help.`
    );
  if (name === 'export' && (!parsed.flags.format || !parsed.flags.out))
    throw new TypeError('ds export needs --format and --out.');
  if (name === 'import' && !parsed.flags.from) throw new TypeError('ds import needs --from.');
  if (parsed.overwrite && name !== 'init' && parsed.flags.out === undefined)
    throw new TypeError('Flag --overwrite needs --out.');
  return parsed;
}

export interface DsIo {
  stdout?: { write(chunk: string): unknown };
  stderr?: { write(chunk: string): unknown };
  /** Where files are read from relatively and written to (default the working directory). */
  cwd?: string;
}

export type DsResult = { ok: true; out?: string } | { ok: false; error: string };

async function readText(path: string): Promise<string> {
  const info = await stat(path);
  if (!info.isFile()) throw new TypeError(`${path} is not a regular file.`);
  if (info.size > DS_CHECK_MAX_BYTES)
    throw new RangeError(`${path} exceeds ${DS_CHECK_MAX_BYTES} bytes; nothing was read.`);
  return readFile(path, 'utf8');
}

async function readJsonFile(path: string): Promise<unknown> {
  const text = await readText(path);
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new SyntaxError(`${path} is not valid JSON.`);
  }
}

async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

/** The bases `--base` names, keyed by `id@version` as `extends` refers to them. */
async function readBases(paths: readonly string[]): Promise<Record<string, unknown>> {
  const bases: Record<string, unknown> = {};
  for (const path of paths) {
    const base = (await readJsonFile(path)) as { id?: unknown; version?: unknown } | null;
    if (typeof base?.id !== 'string' || typeof base.version !== 'string')
      throw new TypeError(`The base ${path} has no id and version.`);
    bases[`${base.id}@${base.version}`] = base;
  }
  return bases;
}

/** The compile options every compiling command passes. */
function compileFlags(args: DsCommandArgs, bases: Record<string, unknown>) {
  const { flags } = args;
  return {
    ...(flags.trust ? { trust: flags.trust } : {}),
    ...(flags.variant ? { variant: flags.variant } : {}),
    ...(flags.mode ? { mode: flags.mode } : {}),
    ...(Object.keys(bases).length > 0 ? { bases } : {}),
  };
}

/** The operation and input one command runs. */
async function plan(
  args: DsCommandArgs,
  cwd: string
): Promise<{ operation: string; input: Record<string, unknown>; content?: string }> {
  const { flags } = args;
  const at = (path: string) => resolve(cwd, path);
  const readJson = (path: string) => readJsonFile(at(path));
  const bases = await readBases(args.bases.map(at));
  const file = args.args[0] as string;
  switch (args.command) {
    case 'init':
      return {
        operation: 'ds.import',
        input: {
          from: 'brand',
          input: flags.brand ?? '',
          ...(flags.id ? { id: flags.id } : {}),
          ...(flags.name ? { name: flags.name } : {}),
        },
        content: 'document',
      };
    case 'validate':
      return {
        operation: 'ds.validate',
        input: { document: await readJson(file), ...compileFlags(args, bases) },
      };
    case 'compile':
    case 'export': {
      const { mode: _mode, ...rest } = compileFlags(args, bases);
      return {
        operation: 'ds.compile',
        input: {
          document: await readJson(file),
          format: flags.format ?? 'json',
          ...(flags.selector ? { selector: flags.selector } : {}),
          ...(flags.dark ? { dark: flags.dark } : {}),
          ...(flags.mode ? { mode: flags.mode } : {}),
          ...rest,
        },
        content: 'content',
      };
    }
    case 'preview':
      return {
        operation: 'ds.preview',
        input: {
          document: await readJson(file),
          format: flags.format ?? 'svg',
          ...(flags.title ? { title: flags.title } : {}),
          ...compileFlags(args, bases),
        },
        content: 'content',
      };
    case 'diff':
      return {
        operation: 'ds.diff',
        input: {
          before: await readJson(file),
          after: await readJson(args.args[1] as string),
          ...compileFlags(args, bases),
        },
      };
    default: {
      // brand: the argument is the one-liner; theme: a library id unless it names a file.
      const from = flags.from as string;
      const source =
        from === 'brand' || (from === 'theme' && !(await isFile(at(file))))
          ? file
          : await readText(at(file));
      return {
        operation: 'ds.import',
        input: {
          from,
          input: source,
          ...(flags.id ? { id: flags.id } : {}),
          ...(flags.name ? { name: flags.name } : {}),
          ...(flags.version ? { version: flags.version } : {}),
          ...(flags.trust ? { trust: flags.trust } : {}),
        },
        content: 'document',
      };
    }
  }
}

/** Run `texuli ds …`; sets `process.exitCode` (1 refused, 2 could not run); never throws. */
export async function runDs(argv: readonly string[], io: DsIo = {}): Promise<DsResult> {
  const stdout = io.stdout ?? process.stdout;
  const stderr = io.stderr ?? process.stderr;
  const cannotRun = (message: string): DsResult => {
    stderr.write(`${message}\n`);
    process.exitCode = 2;
    return { ok: false, error: message };
  };
  let args: ReturnType<typeof parseDsArgs>;
  try {
    args = parseDsArgs(argv);
  } catch (error) {
    return cannotRun(error instanceof Error ? error.message : String(error));
  }
  if (args.command === 'help') {
    stdout.write(
      `${DS_USAGE}\n\nAuthor and check design-system documents. Each command runs a registry operation (ds.import, ds.validate, ds.compile, ds.preview, ds.diff) and prints its JSON; --out writes the content instead (a new file inside the working directory; --overwrite replaces one). check is the conformance check (texuli ds check --help).\nExit 0 valid, 1 refused, 2 could not run.\n`
    );
    return { ok: true };
  }
  if (args.command === 'check') {
    const result = await runDsCli(args.argv, io);
    return result.ok ? { ok: true } : { ok: false, error: result.error };
  }
  let step: Awaited<ReturnType<typeof plan>>;
  try {
    step = await plan(args, io.cwd ?? process.cwd());
  } catch (error) {
    return cannotRun(error instanceof Error ? error.message : String(error));
  }
  const files = localFiles(io.cwd ? { cwd: io.cwd } : {});
  const outcome = await texuliOps.invoke(step.operation, step.input, {
    runtimes: LOCAL_RUNTIMES,
    files,
  });
  if (!outcome.ok) {
    stdout.write(
      `${JSON.stringify({ ok: false, operation: step.operation, error: outcome.error }, null, 2)}\n`
    );
    process.exitCode = 1;
    return { ok: false, error: outcome.error.message };
  }
  const output = outcome.output as Record<string, unknown>;
  const out = args.command === 'init' ? args.args[0] : args.flags.out;
  if (output.valid !== true || out === undefined || step.content === undefined) {
    stdout.write(`${JSON.stringify(output, null, 2)}\n`);
    if (output.valid !== true) {
      process.exitCode = 1;
      return { ok: false, error: `Refused: ${JSON.stringify(output.errors ?? [])}` };
    }
    return { ok: true };
  }
  // A document goes through ds.save (validated again, written as two-space JSON).
  if (step.content === 'document') {
    const saved = await texuliOps.invoke(
      'ds.save',
      { path: out, document: output.document, overwrite: args.overwrite },
      { runtimes: LOCAL_RUNTIMES, files }
    );
    const result = saved.ok ? (saved.output as Record<string, unknown>) : undefined;
    stdout.write(
      `${JSON.stringify(result ? { ...result, warnings: output.warnings } : saved, null, 2)}\n`
    );
    if (result?.saved !== true) {
      process.exitCode = 1;
      return { ok: false, error: `Not saved: ${JSON.stringify(result?.errors ?? saved)}` };
    }
    return { ok: true, out: result.path as string };
  }
  const written = await files.write(out, output.content as string, {
    overwrite: args.overwrite,
  });
  if (!written.ok) {
    stderr.write(`${written.error} (${written.code})\n`);
    process.exitCode = 1;
    return { ok: false, error: written.error };
  }
  stdout.write(
    `${JSON.stringify({ ok: true, operation: step.operation, format: output.format, out: written.relative, bytes: written.bytes }, null, 2)}\n`
  );
  return { ok: true, out: written.relative };
}
