/**
 * Reports the behavior suite's recorded results against its absolute limits:
 *
 *   pnpm exec tsx tests/behavior/harness/limits-cli.ts [<primitive>] [--measure]
 *
 * For each primitive and project: rows passed, and the open-to-focus p75 next
 * to the primitive's limit. `--measure` prints a suggested limit table (the
 * worst p75 across projects, doubled and rounded up to 10 ms, 50 ms floor).
 * Exit 1 when a row failed or a p75 is over its limit. Size is checked by
 * `pnpm size` against `texuli.budgets.json`.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { checkOpenToFocus } from './limits.ts';

interface Recorded {
  id: string;
  passed: boolean;
  primitive: string;
  project: string;
  openToFocusMs?: number[];
}

const RESULTS = join(process.cwd(), 'tmp', 'behavior-results');

export function readResults(dir = RESULTS): Recorded[] {
  let projects: string[];
  try {
    projects = readdirSync(dir);
  } catch {
    return [];
  }
  return projects.flatMap((project) =>
    readdirSync(join(dir, project))
      .filter((file) => file.endsWith('.json'))
      .map((file) => JSON.parse(readFileSync(join(dir, project, file), 'utf8')) as Recorded)
  );
}

function main(argv: readonly string[]): number {
  const only = argv.find((arg) => !arg.startsWith('--'));
  const rows = readResults().filter((row) => !only || row.primitive === only);
  if (rows.length === 0) {
    console.error('No results in tmp/behavior-results: run the behavior suite first.');
    return 1;
  }
  let failed = 0;
  const worst = new Map<string, number>();
  const primitives = [...new Set(rows.map((row) => row.primitive))].sort();
  for (const primitive of primitives) {
    for (const project of [...new Set(rows.map((row) => row.project))].sort()) {
      const mine = rows.filter((row) => row.primitive === primitive && row.project === project);
      if (mine.length === 0) continue;
      const passed = mine.filter((row) => row.passed).length;
      const samples = mine.flatMap((row) => row.openToFocusMs ?? []);
      let timing = '';
      if (samples.length > 0) {
        const check = checkOpenToFocus(primitive, samples);
        worst.set(primitive, Math.max(worst.get(primitive) ?? 0, check.p75));
        timing = `  open-to-focus p75 ${check.p75.toFixed(1)} ms / ${check.limit} ms ${check.ok ? 'ok' : 'OVER'}`;
        if (!check.ok) failed += 1;
      }
      failed += mine.length - passed;
      console.log(
        `${primitive.padEnd(18)} ${project.padEnd(9)} ${passed}/${mine.length} rows${timing}`
      );
    }
  }
  if (argv.includes('--measure')) {
    console.log('\nSuggested OPEN_TO_FOCUS_P75_MS:');
    for (const [primitive, value] of [...worst].sort()) {
      console.log(`  '${primitive}': ${Math.max(50, Math.ceil((value * 2) / 10) * 10)},`);
    }
  }
  return failed === 0 ? 0 : 1;
}

process.exitCode = main(process.argv.slice(2));
