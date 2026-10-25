/**
 * Local eval runner (no CI wiring): drives the agent service with the replay
 * provider across the golden audit fixtures and writes the summary to
 * `tmp/agent-evals/golden-summary.json` at the repository root (git-ignored,
 * never committed). Exits 1 when any fixture fails.
 *
 * Usage (repository root):
 *   pnpm exec tsx apps/agent/evals/run.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { loadCatalog } from '../src/catalog.ts';
import { formatSummary, runGoldenEval } from './harness.ts';

const root = join(import.meta.dirname, '../../..');
const out = join(root, 'tmp', 'agent-evals', 'golden-summary.json');

const build = await loadCatalog();
const summary = await runGoldenEval({ catalog: build.catalog, catalogHash: build.hash });
mkdirSync(join(root, 'tmp', 'agent-evals'), { recursive: true });
writeFileSync(out, formatSummary(summary));

for (const score of summary.fixtures) {
  const counts =
    score.nodes.actual === null
      ? 'no draft'
      : `nodes ${score.nodes.actual}/${score.nodes.expected}`;
  console.log(
    `${score.pass ? 'PASS' : 'FAIL'} ${score.id}: ${score.status} (expected ${score.expected}), ${score.diagnostics} diagnostics, ${counts}`
  );
}
console.log(
  `agent evals: ${summary.totals.passed}/${summary.totals.fixtures} passed, provider ${summary.provider}, summary ${relative(root, out)}`
);
process.exit(summary.totals.failed === 0 ? 0 : 1);
