/**
 * `pnpm visual` / `pnpm visual:update`: the visual regression suite
 * (tests/visual/visual.spec.ts) with a summary of the examples that changed.
 *
 *   tsx scripts/visual.ts [--update] [--project chromium|mobile] [-g <title>]
 *
 * It runs Playwright with a JSON report in tmp/visual/report.json, then
 * prints the changed examples, the missing baselines and any other failure.
 * `--update` writes new baselines (`--update-snapshots`); review them before
 * committing. Exit 0 when nothing changed (or after an update), 1 otherwise
 * (including a run where no test matched),
 * 2 on a usage error. The fixture app port comes from TEXULI_E2E_PORT, as for
 * every browser check.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  formatVisualSummary,
  summarizeVisualReport,
  VISUAL_PROJECTS,
} from '../tests/visual/visual-lib.ts';

export const VISUAL_SPEC = 'tests/visual/visual.spec.ts';
export const VISUAL_REPORT = 'tmp/visual/report.json';

export interface VisualArgs {
  update: boolean;
  projects: string[];
  grep: string | null;
}

export const VISUAL_USAGE =
  'Usage: tsx scripts/visual.ts [--update] [--project chromium|mobile] [-g <title>]';

/** Parses the runner's arguments; throws with the usage line on anything unknown. */
export function parseVisualArgs(argv: readonly string[]): VisualArgs {
  const args: VisualArgs = { update: false, projects: [], grep: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const value = () => {
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('-'))
        throw new Error(`${arg} needs a value. ${VISUAL_USAGE}`);
      i += 1;
      return next;
    };
    if (arg === '--update' || arg === '-u') args.update = true;
    else if (arg === '--project') {
      const project = value();
      if (!VISUAL_PROJECTS.includes(project)) {
        throw new Error(`Unknown project "${project}": use ${VISUAL_PROJECTS.join(' or ')}.`);
      }
      args.projects.push(project);
    } else if (arg === '-g' || arg === '--grep') args.grep = value();
    else throw new Error(`Unknown argument "${arg}". ${VISUAL_USAGE}`);
  }
  return args;
}

/** The `playwright test` arguments for a run. */
export function playwrightArgs(args: VisualArgs): string[] {
  const projects = args.projects.length > 0 ? args.projects : [...VISUAL_PROJECTS];
  return [
    'exec',
    'playwright',
    'test',
    VISUAL_SPEC,
    ...projects.flatMap((project) => ['--project', project]),
    '--reporter=list,json',
    ...(args.update ? ['--update-snapshots'] : []),
    ...(args.grep ? ['-g', args.grep] : []),
  ];
}

/** True when the run captured nothing (a `-g` that matched no test): never report that as clean. */
export function ranNothing(summary: {
  passed: number;
  changed: readonly unknown[];
  missing: readonly unknown[];
  errors: readonly unknown[];
}): boolean {
  return (
    summary.passed + summary.changed.length + summary.missing.length + summary.errors.length === 0
  );
}

function main(): number {
  let args: VisualArgs;
  try {
    args = parseVisualArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 2;
  }
  const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
  const report = join(root, VISUAL_REPORT);
  mkdirSync(join(root, 'tmp', 'visual'), { recursive: true });
  rmSync(report, { force: true });
  const run = spawnSync('pnpm', playwrightArgs(args), {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_NAME: report },
  });
  if (!existsSync(report)) {
    console.error(`Playwright wrote no report (${VISUAL_REPORT}); exit code ${run.status}.`);
    return run.status || 1;
  }
  const summary = summarizeVisualReport(JSON.parse(readFileSync(report, 'utf8')));
  if (ranNothing(summary)) {
    console.error(
      `\nVisual suite: no test matched${args.grep ? ` "${args.grep}"` : ''}; nothing was captured${args.update ? ' or updated' : ''}.`
    );
    return 1;
  }
  console.log(`\n${formatVisualSummary(summary, args.update)}`);
  if (args.update) return summary.errors.length > 0 ? 1 : 0;
  return summary.changed.length + summary.missing.length + summary.errors.length > 0 ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main());
}
