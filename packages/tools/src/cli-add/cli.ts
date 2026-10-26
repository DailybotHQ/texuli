#!/usr/bin/env node
import { resolve } from 'node:path';
/// <reference types="node" />
/**
 * `texuli add <component> [options]`
 *
 * Copies styled component source into the consumer project with a provenance
 * header. Never copies primitives. No network.
 *
 *   pnpm exec tsx packages/tools/src/cli-add/cli.ts button --cwd <app> --source-root <repo>
 *   … --json --dry-run --force --out src/ui/button
 */
import { fileURLToPath } from 'node:url';
import { addComponent } from './add.ts';
import { listAddableIds } from './registry.ts';
import type { AddResult } from './types.ts';

export type AddCliArgs = {
  id: string | null;
  cwd: string;
  sourceRoot: string;
  outDir: string | null;
  version: string | null;
  json: boolean;
  dryRun: boolean;
  force: boolean;
  list: boolean;
  help: boolean;
};

const USAGE = `Usage: texuli add <component> [options]

Copy styled Texuli component source into the current project (never primitives).

Options:
  --cwd <dir>           Consumer project root (default: process.cwd())
  --source-root <dir>   Monorepo / fixture root that holds packages/ (required in tests; default: cwd)
  --out <dir>           Destination relative to cwd (default: src/components/texuli/<id>)
  --version <semver>    Version stamped in the provenance header (default: 0.0.0)
  --force               Overwrite existing files
  --dry-run             Plan only; write nothing
  --json                Machine-readable result on stdout
  --list                Print addable component ids and exit
  --help                Show this help
`;

/** Parse argv after the process name (and optional `add` verb). */
export function parseAddArgs(
  argv: readonly string[],
  defaults?: { cwd?: string; sourceRoot?: string }
): AddCliArgs {
  const cwdDefault = defaults?.cwd ?? process.cwd();
  const sourceDefault = defaults?.sourceRoot ?? cwdDefault;
  const args: AddCliArgs = {
    id: null,
    cwd: cwdDefault,
    sourceRoot: sourceDefault,
    outDir: null,
    version: null,
    json: false,
    dryRun: false,
    force: false,
    list: false,
    help: false,
  };

  const rest = [...argv];
  // Drop a leading `add` verb when the bin routes all subcommands here.
  if (rest[0] === 'add') rest.shift();

  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    if (arg === undefined) break;
    const next = () => {
      const value = rest[i + 1];
      if (value === undefined || value.startsWith('-')) {
        throw new Error(`${arg} needs a value`);
      }
      i += 1;
      return value;
    };
    if (arg === '--help' || arg === '-h') args.help = true;
    else if (arg === '--json') args.json = true;
    else if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--force') args.force = true;
    else if (arg === '--list') args.list = true;
    else if (arg === '--cwd') args.cwd = next();
    else if (arg === '--source-root') args.sourceRoot = next();
    else if (arg === '--out') args.outDir = next();
    else if (arg === '--version') args.version = next();
    else if (arg.startsWith('-')) throw new Error(`Unknown option: ${arg}`);
    else if (args.id === null) args.id = arg;
    else throw new Error(`Unexpected argument: ${arg}`);
  }
  return args;
}

function printHuman(result: AddResult): void {
  if (!result.ok) {
    for (const error of result.errors) console.error(error);
    return;
  }
  const verb = result.dryRun ? 'would add' : 'added';
  console.log(`${verb} ${result.id} (${result.package}) → ${result.outDir}`);
  for (const file of result.files) {
    console.log(`  ${file.action.padEnd(12)} ${file.path} (${file.bytes} B)`);
  }
}

/** Run the add CLI. Returns a process exit code. */
export async function runAddCli(
  argv: readonly string[],
  defaults?: { cwd?: string; sourceRoot?: string }
): Promise<number> {
  let args: AddCliArgs;
  try {
    args = parseAddArgs(argv, defaults);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    console.error(USAGE);
    return 1;
  }

  if (args.help) {
    console.log(USAGE);
    return 0;
  }
  if (args.list) {
    const ids = listAddableIds();
    console.log(args.json ? JSON.stringify({ ids }) : ids.join('\n'));
    return 0;
  }
  if (!args.id) {
    console.error('Component id is required.');
    console.error(USAGE);
    return 1;
  }

  const result = await addComponent({
    id: args.id,
    cwd: args.cwd,
    sourceRoot: args.sourceRoot,
    ...(args.outDir ? { outDir: args.outDir } : {}),
    ...(args.version ? { version: args.version } : {}),
    dryRun: args.dryRun,
    force: args.force,
  });

  if (args.json) console.log(JSON.stringify(result));
  else printHuman(result);

  return result.ok ? 0 : 1;
}

/** True when this module is the process entry (tsx / node cli.ts). */
export function isMainModule(metaUrl: string): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return resolve(fileURLToPath(metaUrl)) === resolve(entry);
  } catch {
    return metaUrl.endsWith(entry.replace(/\\/g, '/'));
  }
}

if (isMainModule(import.meta.url)) {
  runAddCli(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}
