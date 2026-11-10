/// <reference types="node" />
/**
 * `texuli ds <command>` (T-ds-agent-tools): the design-system commands with
 * files as arguments, each running one registry operation, so the CLI, the
 * local MCP and the remote MCP give the same results:
 *
 *     texuli ds init <file> [--brand "<one-liner>"] [--id <id>] [--name <name>] [--locked [--preset all|minimal|<allow.json>]] [--overwrite]
 *     texuli ds validate <file> [--trust t] [--variant v] [--base <file>]... [--locked] [--prototype <dir>] [--catalog <file>] [--json] [--render [--url <page>] [--sheet <page.html>] [--known <file>] [--strict]] [--report]
 *     texuli ds compile <file> [--format f] [--mode m] [--variant v] [--base <file>]... [--out <path> [--overwrite]]
 *     texuli ds export <file> --format css|tailwind|dtcg|tokens-studio --out <path> [--selector s] [--dark d] [--overwrite]
 *     texuli ds preview <file> [--format svg|html] [--mode m] [--variant v] [--out <path> [--overwrite]]
 *     texuli ds diff <before> <after> [--mode m] [--base <file>]...
 *     texuli ds import <file|text> --from brand|dtcg|tokens-studio|role-palette|theme [--id] [--name] [--version] [--out <path> [--overwrite]]
 *     texuli ds generate [--brief <text>] [--from-tokens <file>] [--from-css <file>] [--from-logo <pixels.json>] [--from-theme <file>] [-o <file>]
 *     texuli ds approve <file> --by <name> [--version <x.y.z>] [--trust t] [--base <file>]...
 *     texuli ds hash <file>
 *     texuli ds pack <file> --out <bundle.json> [--sources <file>] [--history <file>] [--overwrite]
 *     texuli ds unpack <bundle.json> [--out <path> [--overwrite]]
 *     texuli ds check <file> …                       (the conformance check, ds-check/cli.ts)
 *
 * `init --locked` adds an `allow` section from a preset (ADR-032; `all` and
 * `minimal` come from the catalog, see ds-create/presets.ts). `approve`
 * validates the document first, refuses an invalid one, then stamps
 * `approval` with its `contentHash` in place; `hash` prints the content hashes
 * and exits 1 when a stored one does not match. Neither proves who approved:
 * a reviewed commit (CODEOWNERS) is the guarantee.
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
import { canonicalJson, packBundle, unpackBundle } from '@texuli/spec/design-system';
import { generateDesignSystem } from '@texuli/tokens/design-system/generate';
import { DESIGN_SYSTEM_IMPORT_LIMITS } from '@texuli/tokens/design-system/import';
import { type DesignSystem, validateDesignSystem } from '@texuli/tokens/design-system/validate';
import { DS_CHECK_MAX_BYTES, DS_CHECK_USAGE, parseDsCliArgs, runDsCli } from '../ds-check/cli.ts';
import {
  APPROVAL_NOTE,
  allowFromJson,
  allowPreset,
  hashReport,
  PRESET_NAMES,
  type PresetName,
  presetComponentsFromBuild,
  stampApproval,
} from '../ds-create/index.ts';
import { localFiles } from '../internal/local-write.ts';
import { loadOpsCatalog } from '../ops/catalog.ts';
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
  'generate',
  'approve',
  'hash',
  'pack',
  'unpack',
  'check',
] as const;
export type DsCommand = (typeof DS_COMMANDS)[number];

export const DS_USAGE = [
  'Usage: texuli ds init <file> [--brand "<one-liner>"] [--id <id>] [--name <name>] [--locked [--preset all|minimal|<allow.json>]] [--overwrite]',
  '       texuli ds validate <file> [--trust developer|untrusted] [--variant <name>] [--base <file>]... [--locked] [--prototype <dir> [--scan-workspace]] [--catalog <components.json>] [--json] [--render [--url <page>] [--sheet builtin|<page.html>] [--known <file>] [--strict]] [--report]',
  '       texuli ds compile <file> [--format json|css|tailwind|dtcg|tokens-studio] [--mode light|dark] [--variant <name>] [--base <file>]... [--out <path> [--overwrite]]',
  '       texuli ds export <file> --format css|tailwind|dtcg|tokens-studio --out <path> [--selector <s>] [--dark class|attribute|media] [--overwrite]',
  '       texuli ds preview <file> [--format svg|html] [--mode light|dark] [--variant <name>] [--out <path> [--overwrite]]',
  '       texuli ds diff <before> <after> [--mode light|dark] [--base <file>]...',
  '       texuli ds import <file|text> --from brand|dtcg|tokens-studio|role-palette|theme [--id <id>] [--name <name>] [--version <x.y.z>] [--out <path> [--overwrite]]',
  '       texuli ds generate [--brief <text>] [--from-tokens <file>] [--from-css <file>] [--from-logo <pixels.json>] [--from-theme <file>] [-o <file> [--overwrite]]',
  '       texuli ds approve <file> --by <name> [--version <x.y.z>] [--trust developer|untrusted] [--base <file>]...',
  '       texuli ds hash <file>',
  '       texuli ds pack <file> --out <bundle.json> [--sources <file>] [--history <file>] [--overwrite]',
  '       texuli ds unpack <bundle.json> [--out <path> [--overwrite]]',
  `       ${DS_CHECK_USAGE.replace('Usage: ', '')}`,
].join('\n');

export interface DsCommandArgs {
  command: Exclude<DsCommand, 'check'>;
  /** Positional arguments: files, or the one-liner or theme id of `import`. */
  args: string[];
  flags: Record<string, string>;
  bases: string[];
  overwrite: boolean;
  /** `init --locked`: add an `allow` section (ADR-032). */
  locked: boolean;
}

/** The value flags each command accepts (`--base` repeats and `--overwrite` takes none). */
const FLAGS: Record<DsCommandArgs['command'], readonly string[]> = {
  init: ['brand', 'id', 'name', 'preset'],
  validate: ['trust', 'variant', 'base', 'prototype', 'catalog', 'url', 'sheet', 'known'],
  compile: ['format', 'mode', 'variant', 'trust', 'base', 'out', 'selector', 'dark'],
  export: ['format', 'mode', 'variant', 'trust', 'base', 'out', 'selector', 'dark'],
  preview: ['format', 'mode', 'variant', 'trust', 'base', 'out', 'title'],
  diff: ['mode', 'variant', 'trust', 'base'],
  import: ['from', 'id', 'name', 'version', 'trust', 'out'],
  generate: [
    'brief',
    'from-tokens',
    'from-css',
    'from-logo',
    'from-theme',
    'id',
    'name',
    'version',
    'trust',
    'out',
  ],
  approve: ['by', 'version', 'trust', 'base'],
  hash: [],
  pack: ['sources', 'history', 'out'],
  unpack: ['out'],
};
const POSITIONALS: Record<DsCommandArgs['command'], number> = {
  init: 1,
  validate: 1,
  compile: 1,
  export: 1,
  preview: 1,
  diff: 2,
  import: 1,
  generate: 0,
  approve: 1,
  hash: 1,
  pack: 1,
  unpack: 1,
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
  const parsed: DsCommandArgs = {
    command: name,
    args: [],
    flags: {},
    bases: [],
    overwrite: false,
    locked: false,
  };
  for (let index = 0; index < rest.length; index++) {
    const arg = rest[index] as string;
    if (arg === '--help' || arg === '-h') return { command: 'help', argv: [...argv] };
    if (arg === '--overwrite') {
      parsed.overwrite = true;
      continue;
    }
    if (arg === '-o') {
      if (name !== 'generate') throw new TypeError('Flag -o belongs to ds generate.');
      const value = rest[++index];
      if (value === undefined || value.startsWith('--'))
        throw new TypeError('Flag -o needs a value.');
      parsed.flags.out = value;
      continue;
    }
    if (arg === '--locked') {
      if (name !== 'init' && name !== 'validate')
        throw new TypeError('Flag --locked belongs to ds init or ds validate.');
      parsed.locked = true;
      continue;
    }
    if (['--json', '--render', '--strict', '--report', '--scan-workspace'].includes(arg)) {
      if (name !== 'validate') throw new TypeError(`Flag ${arg} belongs to ds validate.`);
      parsed.flags[arg.slice(2)] = 'true';
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
  if (name === 'approve' && !parsed.flags.by?.trim())
    throw new TypeError('ds approve needs --by <name>.');
  if (name === 'validate' && parsed.flags.report === 'true' && !parsed.locked)
    throw new TypeError('Flag --report needs --locked.');
  if (name === 'validate' && parsed.flags['scan-workspace'] === 'true' && !parsed.flags.prototype)
    throw new TypeError('Flag --scan-workspace needs --prototype.');
  if (name === 'validate' && parsed.flags.strict === 'true' && parsed.flags.render !== 'true')
    throw new TypeError('Flag --strict needs --render.');
  for (const flag of ['url', 'sheet', 'known'])
    if (name === 'validate' && parsed.flags[flag] !== undefined && parsed.flags.render !== 'true')
      throw new TypeError(`Flag --${flag} needs --render.`);
  if (name === 'pack' && !parsed.flags.out) throw new TypeError('ds pack needs --out.');
  if (parsed.flags.preset !== undefined && !parsed.locked)
    throw new TypeError('Flag --preset needs --locked.');
  if (parsed.overwrite && name !== 'init' && name !== 'approve' && parsed.flags.out === undefined)
    throw new TypeError('Flag --overwrite needs --out.');
  return parsed;
}

export interface DsIo {
  stdout?: { write(chunk: string): unknown };
  stderr?: { write(chunk: string): unknown };
  /** Where files are read from relatively and written to (default the working directory). */
  cwd?: string;
  /** How `--render` loads Playwright and axe (default: from the project in `cwd`); tests stub the browser here. */
  load?: (specifier: string) => Promise<unknown>;
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
    case 'approve':
    case 'hash':
    case 'pack':
    case 'unpack':
      throw new TypeError(`ds ${args.command} does not run one operation.`);
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
      `${DS_USAGE}\n\nAuthor and check design-system documents. Import, validate, compile, preview and diff print their operation JSON; --out writes the result through the local file policy. generate composes the available inputs and writes the document plus <out>.report.json; -o is its output shorthand. check is the conformance check (texuli ds check --help). Locked validation accepts --prototype <dir>, --catalog <components.json>, --json, and --render; with --locked, --render runs the locked render check (chart, map and canvas marks are exempt from the per-pixel color check, and a page you serve with --url, your prototype with @texuli/tools/ds-check/host installed, is mapped against the allow set: unmapped, not-allowed); --report lists findings and exits 0 for migration tracking.\nExit 0 valid or report-only, 1 refused/finding, 2 could not run. The check cannot prove who approved a document.\n`
    );
    return { ok: true };
  }
  if (args.command === 'check') {
    const result = await runDsCli(args.argv, io);
    return result.ok ? { ok: true } : { ok: false, error: result.error };
  }
  if (
    args.command === 'validate' &&
    (args.locked ||
      [
        'catalog',
        'json',
        'render',
        'strict',
        'report',
        'prototype',
        'url',
        'sheet',
        'known',
        'scan-workspace',
      ].some((flag) => args.flags[flag] !== undefined))
  ) {
    const cwd = io.cwd ?? process.cwd();
    const result = await runDsCli(
      [
        'check',
        resolve(cwd, args.args[0] as string),
        '--locked',
        ...(args.flags.trust ? ['--trust', args.flags.trust] : []),
        ...(args.flags.variant ? ['--variant', args.flags.variant] : []),
        ...args.bases.flatMap((base) => ['--base', resolve(cwd, base)]),
        ...(args.flags.catalog ? ['--catalog', resolve(cwd, args.flags.catalog)] : []),
        ...(args.flags.prototype ? ['--prototype', resolve(cwd, args.flags.prototype)] : []),
        ...(args.flags['scan-workspace'] === 'true' ? ['--scan-workspace'] : []),
        ...(args.flags.json === 'true' ? ['--json'] : []),
        ...(args.flags.render === 'true' ? ['--render'] : []),
        ...(args.flags.url ? ['--url', args.flags.url] : []),
        ...(args.flags.sheet
          ? ['--sheet', args.flags.sheet === 'builtin' ? 'builtin' : resolve(cwd, args.flags.sheet)]
          : []),
        ...(args.flags.known ? ['--known', resolve(cwd, args.flags.known)] : []),
        ...(args.flags.strict === 'true' ? ['--strict'] : []),
        ...(args.flags.report === 'true' ? ['--report'] : []),
      ],
      io
    );
    return result.ok ? { ok: true } : { ok: false, error: result.error };
  }
  if (args.command === 'generate') {
    try {
      return await runGenerate(args, io);
    } catch (error) {
      return cannotRun(error instanceof Error ? error.message : String(error));
    }
  }
  if (args.command === 'approve' || args.command === 'hash') {
    try {
      return args.command === 'hash' ? await runHash(args, io) : await runApprove(args, io);
    } catch (error) {
      return cannotRun(error instanceof Error ? error.message : String(error));
    }
  }
  if (args.command === 'pack' || args.command === 'unpack') {
    try {
      return args.command === 'pack' ? await runPack(args, io) : await runUnpack(args, io);
    } catch (error) {
      return cannotRun(error instanceof Error ? error.message : String(error));
    }
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
    let document = output.document as Record<string, unknown>;
    if (args.locked) {
      try {
        document = { ...document, allow: await lockedAllow(args, io.cwd ?? process.cwd()) };
      } catch (error) {
        return cannotRun(error instanceof Error ? error.message : String(error));
      }
    }
    const saved = await texuliOps.invoke(
      'ds.save',
      { path: out, document, overwrite: args.overwrite },
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

/** Run the local, bounded design-system generation pipeline and save its loss/repair report. */
async function runGenerate(args: DsCommandArgs, io: DsIo): Promise<DsResult> {
  const cwd = io.cwd ?? process.cwd();
  const stdout = io.stdout ?? process.stdout;
  const stderr = io.stderr ?? process.stderr;
  const readInput = async (flag: string) => {
    const path = args.flags[flag];
    return path === undefined ? undefined : await readText(resolve(cwd, path));
  };
  const [tokens, css, logoText, theme] = await Promise.all([
    readInput('from-tokens'),
    readInput('from-css'),
    readInput('from-logo'),
    readInput('from-theme'),
  ]);
  let logoPixels: unknown;
  if (logoText !== undefined) {
    try {
      logoPixels = JSON.parse(logoText) as unknown;
    } catch {
      throw new SyntaxError('--from-logo must be JSON containing pixel data `{ "data": [...] }`.');
    }
  }
  const generated = generateDesignSystem(
    {
      ...(args.flags.brief !== undefined ? { brief: args.flags.brief } : {}),
      ...(tokens !== undefined ? { tokens } : {}),
      ...(css !== undefined ? { css } : {}),
      ...(logoPixels !== undefined
        ? { logoPixels: logoPixels as { data: ArrayLike<number> } }
        : {}),
      ...(theme !== undefined ? { theme } : {}),
    },
    {
      ...(args.flags.id ? { id: args.flags.id } : {}),
      ...(args.flags.name ? { name: args.flags.name } : {}),
      ...(args.flags.version ? { version: args.flags.version } : {}),
      ...(args.flags.trust === 'developer' ? { trust: 'developer' as const } : {}),
      maxBytes: DESIGN_SYSTEM_IMPORT_LIMITS.bytes,
    }
  );
  if (!generated.ok) {
    const refusal = {
      ok: false,
      operation: 'ds.generate',
      errors: generated.errors,
      report: generated.report,
    };
    stdout.write(`${JSON.stringify(refusal, null, 2)}\n`);
    process.exitCode = 1;
    return { ok: false, error: `Generation refused: ${JSON.stringify(generated.errors)}` };
  }
  const result = {
    ok: true,
    operation: 'ds.generate',
    document: generated.document,
    report: generated.report,
  };
  const outputPath = args.flags.out;
  if (outputPath === undefined) {
    stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return { ok: true };
  }
  const files = localFiles(io.cwd ? { cwd: io.cwd } : {});
  const reportPath = `${outputPath}.report.json`;
  const reportWrite = await files.write(
    reportPath,
    `${JSON.stringify(generated.report, null, 2)}\n`,
    {
      overwrite: args.overwrite,
    }
  );
  if (!reportWrite.ok) {
    stderr.write(`${reportWrite.error} (${reportWrite.code})\n`);
    process.exitCode = 1;
    return { ok: false, error: reportWrite.error };
  }
  const documentWrite = await files.write(
    outputPath,
    `${JSON.stringify(generated.document, null, 2)}\n`,
    { overwrite: args.overwrite }
  );
  if (!documentWrite.ok) {
    stderr.write(`${documentWrite.error} (${documentWrite.code})\n`);
    process.exitCode = 1;
    return { ok: false, error: documentWrite.error };
  }
  stdout.write(
    `${JSON.stringify({ ok: true, operation: 'ds.generate', out: documentWrite.relative, report: reportWrite.relative }, null, 2)}\n`
  );
  return { ok: true, out: documentWrite.relative };
}

/** The `allow` section `init --locked` writes: a catalog preset (default `minimal`) or a JSON file. */
async function lockedAllow(args: DsCommandArgs, cwd: string): Promise<Record<string, unknown>> {
  const preset = args.flags.preset ?? 'minimal';
  if ((PRESET_NAMES as readonly string[]).includes(preset)) {
    const build = await loadOpsCatalog();
    return allowPreset(presetComponentsFromBuild(build.catalog.entries), preset as PresetName);
  }
  return allowFromJson(await readJsonFile(resolve(cwd, preset)));
}

/** `ds approve`: validate, refuse an invalid document, then stamp `approval` in place through ds.save. */
async function runApprove(args: DsCommandArgs, io: DsIo): Promise<DsResult> {
  const stdout = io.stdout ?? process.stdout;
  const cwd = io.cwd ?? process.cwd();
  const file = args.args[0] as string;
  const bases = await readBases(args.bases.map((path) => resolve(cwd, path)));
  const read = (await readJsonFile(resolve(cwd, file))) as Record<string, unknown>;
  const document = args.flags.version ? { ...read, version: args.flags.version } : read;
  const runtime = { runtimes: LOCAL_RUNTIMES, files: localFiles({ cwd }) };
  const refuse = (body: Record<string, unknown>, error: string): DsResult => {
    stdout.write(`${JSON.stringify({ ok: false, operation: 'ds.approve', ...body }, null, 2)}\n`);
    process.exitCode = 1;
    return { ok: false, error };
  };
  const checked = await texuliOps.invoke(
    'ds.validate',
    { document, ...compileFlags(args, bases) },
    runtime
  );
  if (!checked.ok) return refuse({ error: checked.error }, checked.error.message);
  const verdict = checked.output as Record<string, unknown>;
  if (verdict.valid !== true)
    return refuse(
      {
        valid: false,
        errors: verdict.errors ?? [],
        note: 'Nothing was approved: fix the document first.',
      },
      `Refused: ${JSON.stringify(verdict.errors ?? [])}`
    );
  const stamped = stampApproval(document as unknown as DesignSystem, {
    by: args.flags.by as string,
    ...(args.flags.version ? { version: args.flags.version } : {}),
  });
  const again = validateDesignSystem(
    stamped,
    args.flags.trust === 'developer' ? { trust: 'developer' } : {}
  );
  if (!again.ok)
    return refuse(
      { valid: false, errors: again.errors },
      `Refused: ${JSON.stringify(again.errors)}`
    );
  // The one human door that may write an approved document (ADR-032).
  const saved = await texuliOps.invoke(
    'ds.save',
    { path: file, document: stamped, overwrite: true },
    { ...runtime, approve: true }
  );
  const result = saved.ok ? (saved.output as Record<string, unknown>) : undefined;
  if (result?.saved !== true)
    return refuse(
      { saved: false, errors: result?.errors ?? saved },
      `Not saved: ${JSON.stringify(result?.errors ?? saved)}`
    );
  stdout.write(
    `${JSON.stringify({ ok: true, operation: 'ds.approve', path: result.path, approval: stamped.approval, note: APPROVAL_NOTE }, null, 2)}\n`
  );
  return { ok: true, out: result.path as string };
}

function prettyCanonical(value: unknown): string {
  return `${JSON.stringify(JSON.parse(canonicalJson(value)), null, 2)}\n`;
}

function asList(value: unknown, label: string): unknown[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new TypeError(`${label} must be a JSON array.`);
  return value;
}

/** `ds pack`: document + optional sources and history into one bundle JSON file. */
async function runPack(args: DsCommandArgs, io: DsIo): Promise<DsResult> {
  const stdout = io.stdout ?? process.stdout;
  const stderr = io.stderr ?? process.stderr;
  const cwd = io.cwd ?? process.cwd();
  const at = (path: string) => resolve(cwd, path);
  const document = await readJsonFile(at(args.args[0] as string));
  const sources = args.flags.sources
    ? asList(await readJsonFile(at(args.flags.sources)), '--sources')
    : [];
  const history = args.flags.history
    ? asList(await readJsonFile(at(args.flags.history)), '--history')
    : [];
  const packed = packBundle({
    document,
    librarySources: sources as { id: string; version: string; source: string; language?: string }[],
    history: history as {
      version: string;
      contentHash: string;
      changelog?: string;
      approvedAt?: string;
      approvedBy?: string;
      status?: 'approved' | 'draft';
    }[],
  });
  if (!packed.ok) {
    stdout.write(
      `${JSON.stringify({ ok: false, operation: 'ds.pack', errors: packed.errors }, null, 2)}\n`
    );
    process.exitCode = 1;
    return { ok: false, error: `Refused: ${JSON.stringify(packed.errors)}` };
  }
  const files = localFiles(io.cwd ? { cwd: io.cwd } : {});
  const written = await files.write(args.flags.out as string, prettyCanonical(packed.bundle), {
    overwrite: args.overwrite,
  });
  if (!written.ok) {
    stderr.write(`${written.error} (${written.code})\n`);
    process.exitCode = 1;
    return { ok: false, error: written.error };
  }
  stdout.write(
    `${JSON.stringify({ ok: true, operation: 'ds.pack', out: written.relative, bytes: written.bytes }, null, 2)}\n`
  );
  return { ok: true, out: written.relative };
}

/** `ds unpack`: validate a bundle and write (or print) its parts. Sources are never executed. */
async function runUnpack(args: DsCommandArgs, io: DsIo): Promise<DsResult> {
  const stdout = io.stdout ?? process.stdout;
  const stderr = io.stderr ?? process.stderr;
  const cwd = io.cwd ?? process.cwd();
  const unpacked = unpackBundle(await readJsonFile(resolve(cwd, args.args[0] as string)));
  if (!unpacked.ok) {
    stdout.write(
      `${JSON.stringify({ ok: false, operation: 'ds.unpack', errors: unpacked.errors }, null, 2)}\n`
    );
    process.exitCode = 1;
    return { ok: false, error: `Refused: ${JSON.stringify(unpacked.errors)}` };
  }
  const body = {
    document: unpacked.document,
    allowManifest: unpacked.allowManifest,
    librarySources: unpacked.librarySources,
    history: unpacked.history,
  };
  const out = args.flags.out;
  if (out === undefined) {
    stdout.write(`${JSON.stringify({ ok: true, operation: 'ds.unpack', ...body }, null, 2)}\n`);
    return { ok: true };
  }
  const files = localFiles(io.cwd ? { cwd: io.cwd } : {});
  const written = await files.write(out, prettyCanonical(body), { overwrite: args.overwrite });
  if (!written.ok) {
    stderr.write(`${written.error} (${written.code})\n`);
    process.exitCode = 1;
    return { ok: false, error: written.error };
  }
  stdout.write(
    `${JSON.stringify({ ok: true, operation: 'ds.unpack', out: written.relative, bytes: written.bytes }, null, 2)}\n`
  );
  return { ok: true, out: written.relative };
}

/** `ds hash`: the content hashes, checked against the stored ones; exit 1 on a mismatch. */
async function runHash(args: DsCommandArgs, io: DsIo): Promise<DsResult> {
  const stdout = io.stdout ?? process.stdout;
  const cwd = io.cwd ?? process.cwd();
  const report = hashReport(await readJsonFile(resolve(cwd, args.args[0] as string)));
  stdout.write(`${JSON.stringify({ operation: 'ds.hash', ...report }, null, 2)}\n`);
  if (!report.ok) {
    process.exitCode = 1;
    return { ok: false, error: 'A stored contentHash does not match the document.' };
  }
  return { ok: true };
}
