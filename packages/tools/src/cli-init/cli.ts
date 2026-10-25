#!/usr/bin/env node
/// <reference types="node" />
/**
 * `texuli init` and `texuli theme`. No network.
 *
 *   pnpm exec tsx packages/tools/src/cli-init/cli.ts init [--cwd <app>] [--framework vite|astro|sveltekit]
 *     [--theme <id>] [--css <path>] [--namespace <id>] [--force] [--dry-run] [--json]
 *   pnpm exec tsx packages/tools/src/cli-init/cli.ts theme list [--search <words>] [--json]
 *   pnpm exec tsx packages/tools/src/cli-init/cli.ts theme preview <id> [--mode light|dark] [--json]
 *   pnpm exec tsx packages/tools/src/cli-init/cli.ts theme apply <id> [--cwd <app>] [--force] [--dry-run] [--json]
 */
import { fileURLToPath } from 'node:url';
import { FRAMEWORKS } from './detect.ts';
import { initProject } from './init.ts';
import { applyProjectTheme } from './theme-apply.ts';
import { listThemes, previewTheme } from './themes.ts';
import type { CommandResult, Framework } from './types.ts';

export const USAGE = `Usage:
  texuli init [options]              Wire Texuli tokens and CSS into a Vite, Astro or SvelteKit project
  texuli theme list [--search <q>]   List the theme library
  texuli theme preview <id>          Show a theme's key tokens and its WCAG AA report
  texuli theme apply <id>            Switch an initialized project to another theme

Options:
  --cwd <dir>          Project root (default: current directory)
  --framework <name>   vite | astro | sveltekit (default: detected from package.json)
  --theme <id>         Theme for init (default: enterprise-neutral)
  --css <path>         Stylesheet path, relative to the project (default per framework)
  --namespace <id>     No-flash appearance namespace (default: app)
  --mode <light|dark>  Preview mode (default: light)
  --search <words>     Filter theme list
  --force              Replace a stylesheet or config texuli did not generate (never follows symlinks)
  --dry-run            Plan only; write nothing
  --json               Machine-readable output
  --help               Show this help
`;

export interface InitCliArgs {
  command: 'init' | 'theme-list' | 'theme-preview' | 'theme-apply' | 'help';
  id: string | null;
  cwd: string;
  framework: Framework | null;
  theme: string | null;
  css: string | null;
  namespace: string | null;
  mode: 'light' | 'dark';
  search: string | null;
  force: boolean;
  dryRun: boolean;
  json: boolean;
}

/** Parses `init …` or `theme <list|preview|apply> …`. Throws on bad input. */
export function parseInitArgs(argv: readonly string[], cwd = process.cwd()): InitCliArgs {
  const rest = [...argv];
  const args: InitCliArgs = {
    command: 'help',
    id: null,
    cwd,
    framework: null,
    theme: null,
    css: null,
    namespace: null,
    mode: 'light',
    search: null,
    force: false,
    dryRun: false,
    json: false,
  };
  const verb = rest.shift();
  if (verb === 'init') args.command = 'init';
  else if (verb === 'theme') {
    const sub = rest.shift();
    if (sub === 'list') args.command = 'theme-list';
    else if (sub === 'preview') args.command = 'theme-preview';
    else if (sub === 'apply') args.command = 'theme-apply';
    else throw new Error(`Unknown theme command: ${sub ?? '(none)'}`);
  } else if (verb !== undefined && verb !== '--help' && verb !== '-h') {
    throw new Error(`Unknown command: ${verb}`);
  }
  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index] as string;
    const value = () => {
      const next = rest[index + 1];
      if (next === undefined || next.startsWith('--')) throw new Error(`${arg} needs a value`);
      index += 1;
      return next;
    };
    if (arg === '--help' || arg === '-h') args.command = 'help';
    else if (arg === '--json') args.json = true;
    else if (arg === '--force') args.force = true;
    else if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--cwd') args.cwd = value();
    else if (arg === '--theme') args.theme = value();
    else if (arg === '--css') args.css = value();
    else if (arg === '--namespace') args.namespace = value();
    else if (arg === '--search') args.search = value();
    else if (arg === '--framework') {
      const name = value();
      if (!FRAMEWORKS.includes(name as Framework))
        throw new Error(`--framework must be one of ${FRAMEWORKS.join(', ')}`);
      args.framework = name as Framework;
    } else if (arg === '--mode') {
      const mode = value();
      if (mode !== 'light' && mode !== 'dark') throw new Error('--mode must be light or dark');
      args.mode = mode;
    } else if (arg.startsWith('-')) throw new Error(`Unknown option: ${arg}`);
    else if (
      args.id === null &&
      (args.command === 'theme-preview' || args.command === 'theme-apply')
    )
      args.id = arg;
    else throw new Error(`Unexpected argument: ${arg}`);
  }
  if ((args.command === 'theme-preview' || args.command === 'theme-apply') && !args.id) {
    throw new Error('A theme id is required.');
  }
  return args;
}

function printResult(
  result: CommandResult,
  out: (line: string) => void,
  err: (line: string) => void
): void {
  for (const error of result.errors) err(error);
  for (const file of result.files) {
    out(
      `  ${(result.dryRun && file.action !== 'unchanged' ? `would ${file.action}` : file.action).padEnd(14)} ${file.path}`
    );
  }
  for (const note of result.notes) out(`note: ${note}`);
}

/** Runs the CLI; returns the exit code. `io` defaults to the console. */
export async function runInitCli(
  argv: readonly string[],
  io: { cwd?: string; out?: (line: string) => void; err?: (line: string) => void } = {}
): Promise<number> {
  const out = io.out ?? ((line: string) => console.log(line));
  const err = io.err ?? ((line: string) => console.error(line));
  let args: InitCliArgs;
  try {
    args = parseInitArgs(argv, io.cwd);
  } catch (error) {
    err(error instanceof Error ? error.message : String(error));
    err(USAGE);
    return 1;
  }
  switch (args.command) {
    case 'help':
      out(USAGE);
      return 0;
    case 'theme-list': {
      const themes = await listThemes(args.search ?? undefined);
      if (args.json) out(JSON.stringify({ themes }));
      else
        for (const theme of themes)
          out(
            `${theme.id.padEnd(28)} ${theme.name} (${theme.collection}, ${theme.contrastLevel}${theme.darkFirst ? ', dark-first' : ''})`
          );
      return 0;
    }
    case 'theme-preview': {
      const preview = await previewTheme(args.id as string, args.mode);
      if (!preview) {
        err(`Unknown theme: ${args.id}. Run \`texuli theme list\`.`);
        return 1;
      }
      if (args.json) out(JSON.stringify(preview));
      else {
        out(`${preview.name} (${preview.id}), ${preview.mode}: ${preview.description}`);
        for (const [name, value] of Object.entries(preview.tokens))
          out(`  ${name.padEnd(26)} ${value}`);
        out(
          `WCAG AA: ${preview.aa.pass ? 'pass' : `${preview.aa.issues} issue(s)`} (${preview.aa.modes.map((mode) => `${mode.mode} ${mode.pass ? 'pass' : `${mode.issues} issue(s)`}`).join(', ')})`
        );
      }
      return 0;
    }
    case 'theme-apply':
    case 'init': {
      const result =
        args.command === 'init'
          ? await initProject({
              cwd: args.cwd,
              ...(args.framework ? { framework: args.framework } : {}),
              ...(args.theme ? { theme: args.theme } : {}),
              ...(args.css ? { css: args.css } : {}),
              ...(args.namespace ? { namespace: args.namespace } : {}),
              force: args.force,
              dryRun: args.dryRun,
            })
          : await applyProjectTheme({
              cwd: args.cwd,
              theme: args.id as string,
              force: args.force,
              dryRun: args.dryRun,
            });
      if (args.json) out(JSON.stringify(result));
      else printResult(result, out, err);
      return result.ok ? 0 : 1;
    }
  }
}

function isMain(metaUrl: string): boolean {
  const entry = process.argv[1];
  try {
    return entry !== undefined && fileURLToPath(metaUrl) === entry;
  } catch {
    return false;
  }
}

if (isMain(import.meta.url)) {
  runInitCli(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}
