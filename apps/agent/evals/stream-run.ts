/**
 * Local streaming eval runner (no CI wiring): streams every golden case
 * through the agent endpoint with the fake replay provider on a virtual
 * clock (deterministic, offline, CI-like) and writes the report to
 * `tmp/agent-evals/stream-report.json` at the repository root (git-ignored,
 * never committed). Exits 1 when a case with a pinned outcome misses it.
 *
 * Usage (repository root):
 *   pnpm exec tsx apps/agent/evals/stream-run.ts            # virtual clock
 *   pnpm exec tsx apps/agent/evals/stream-run.ts --wall     # real timers
 *
 * It never builds a real provider and reads no key. A developer who wants
 * real-provider numbers calls `runStreamEval({ provider })` from their own
 * script with an adapter they construct (docs/providers.md).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { loadCatalog } from '../src/catalog.ts';
import { formatStreamReport, runStreamEval } from './stream-harness.ts';

const root = join(import.meta.dirname, '../../..');
const out = join(root, 'tmp', 'agent-evals', 'stream-report.json');

const build = await loadCatalog();
const report = await runStreamEval({
  catalog: build.catalog,
  catalogHash: build.hash,
  clock: process.argv.includes('--wall') ? 'wall' : 'virtual',
});
mkdirSync(join(root, 'tmp', 'agent-evals'), { recursive: true });
writeFileSync(out, formatStreamReport(report));

for (const score of report.cases) {
  const verdict = score.pass === null ? 'MEASURED' : score.pass ? 'PASS' : 'FAIL';
  const first =
    score.timeToFirstNodeMs === null ? 'no node' : `first node ${score.timeToFirstNodeMs} ms`;
  console.log(
    `${verdict} ${score.id}: ${score.status}${score.expected ? ` (expected ${score.expected})` : ''}, ${score.nodesReady} ready, ${score.nodesRefused} held, ${first}, total ${score.totalMs} ms`
  );
}
const { totals } = report;
console.log(
  `stream evals: validity ${totals.valid}/${totals.cases} (${totals.validityRate}), pinned ${totals.matched}/${totals.pinned}, first node median ${totals.timeToFirstNodeMs.median} ms, total median ${totals.totalMs.median} ms (${report.clock} clock), report ${relative(root, out)}`
);
process.exit(totals.matched === totals.pinned ? 0 : 1);
