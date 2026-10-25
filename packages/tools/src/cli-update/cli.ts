#!/usr/bin/env node
/// <reference types="node" />
/**
 * `texuli diff <component>` and `texuli update <component>`
 *
 * Three-way merge of a copied component against the installed version and the
 * new source. No network.
 *
 *   pnpm exec tsx packages/tools/src/cli-update/cli.ts diff button --cwd <app> \
 *     --source-root <new repo> --base-root <repo at the installed version>
 *   … update button … [--dry-run] [--prune] [--conflicts markers] [--json]
 */
import { isMainModule } from '../cli-add/cli.ts';
import type { UpdateResult } from './types.ts';
import { diffComponent, updateComponent } from './update.ts';

export type UpdateCliArgs = {
  command: 'diff' | 'update' | null;
  id: string | null;
  cwd: string;
  sourceRoot: string;
  baseRoot: string | null;
  baseVersion: string | null;
  outDir: string | null;
  version: string | null;
  conflicts: 'refuse' | 'markers';
  json: boolean;
  dryRun: boolean;
  prune: boolean;
  help: boolean;
};

const USAGE = `Usage: texuli diff <component> [options]
       texuli update <component> [options]

Three-way merge of a copied component (texuli add) with a new Texuli source.

Options:
  --cwd <dir>             Consumer project root (default: process.cwd())
  --source-root <dir>     Root that holds the new source under packages/ (default: cwd)
  --base-root <dir>       Root that holds the source at the installed version (the merge base)
  --base-version <ver>    Refuse unless the installed version (from the headers) equals this
  --out <dir>             Component directory relative to cwd (default: src/components/texuli/<id>)
  --version <semver>      Version stamped in the new headers (default: 0.0.0)
  --conflicts <mode>      refuse (default: write nothing) or markers (write conflict markers)
  --prune                 Delete files removed upstream that were not edited locally
  --dry-run               update: plan only; write nothing
  --json                  Machine-readable result on stdout
  --help                  Show this help
`;

/** Parse argv after the process name: a `diff` or `update` verb, then the id. */
export function parseUpdateArgs(
  argv: readonly string[],
  defaults?: { cwd?: string; sourceRoot?: string }
): UpdateCliArgs {
  const cwd = defaults?.cwd ?? process.cwd();
  const args: UpdateCliArgs = {
    command: null,
    id: null,
    cwd,
    sourceRoot: defaults?.sourceRoot ?? cwd,
    baseRoot: null,
    baseVersion: null,
    outDir: null,
    version: null,
    conflicts: 'refuse',
    json: false,
    dryRun: false,
    prune: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === undefined) break;
    const next = () => {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith('-')) throw new Error(`${arg} needs a value`);
      i += 1;
      return value;
    };
    if (arg === '--help' || arg === '-h') args.help = true;
    else if (arg === '--json') args.json = true;
    else if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--prune') args.prune = true;
    else if (arg === '--cwd') args.cwd = next();
    else if (arg === '--source-root') args.sourceRoot = next();
    else if (arg === '--base-root') args.baseRoot = next();
    else if (arg === '--base-version') args.baseVersion = next();
    else if (arg === '--out') args.outDir = next();
    else if (arg === '--version') args.version = next();
    else if (arg === '--conflicts') {
      const mode = next();
      if (mode !== 'refuse' && mode !== 'markers') {
        throw new Error(`--conflicts is refuse or markers (got ${mode})`);
      }
      args.conflicts = mode;
    } else if (arg.startsWith('-')) throw new Error(`Unknown option: ${arg}`);
    else if (args.command === null) {
      if (arg !== 'diff' && arg !== 'update') throw new Error(`Unknown command: ${arg}`);
      args.command = arg;
    } else if (args.id === null) args.id = arg;
    else throw new Error(`Unexpected argument: ${arg}`);
  }
  return args;
}

function printHuman(result: UpdateResult, command: 'diff' | 'update'): void {
  for (const error of result.errors) console.error(error);
  const from = result.installedVersion ?? '(not installed)';
  console.log(
    `${command} ${result.id} (${result.package}) ${from} → ${result.version}: ${result.outDir}`
  );
  for (const file of result.files) {
    const note = file.conflicts > 0 ? ` (${file.conflicts} conflict(s))` : '';
    console.log(`  ${file.status.padEnd(16)} ${file.action.padEnd(12)} ${file.path}${note}`);
  }
  if (command === 'diff') {
    for (const file of result.files) if (file.diff) process.stdout.write(file.diff);
  }
}

/** Run the diff/update CLI. Returns a process exit code. */
export async function runUpdateCli(
  argv: readonly string[],
  defaults?: { cwd?: string; sourceRoot?: string }
): Promise<number> {
  let args: UpdateCliArgs;
  try {
    args = parseUpdateArgs(argv, defaults);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    console.error(USAGE);
    return 1;
  }
  if (args.help) {
    console.log(USAGE);
    return 0;
  }
  if (!args.command || !args.id) {
    console.error('A command (diff or update) and a component id are required.');
    console.error(USAGE);
    return 1;
  }
  const options = {
    id: args.id,
    cwd: args.cwd,
    sourceRoot: args.sourceRoot,
    ...(args.baseRoot ? { baseRoot: args.baseRoot } : {}),
    ...(args.baseVersion ? { baseVersion: args.baseVersion } : {}),
    ...(args.outDir ? { outDir: args.outDir } : {}),
    ...(args.version ? { version: args.version } : {}),
    conflicts: args.conflicts,
    dryRun: args.dryRun,
    prune: args.prune,
  };
  const result =
    args.command === 'diff' ? await diffComponent(options) : await updateComponent(options);
  if (args.json) console.log(JSON.stringify(result));
  else printHuman(result, args.command);
  return result.ok ? 0 : 1;
}

if (isMainModule(import.meta.url)) {
  runUpdateCli(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}
