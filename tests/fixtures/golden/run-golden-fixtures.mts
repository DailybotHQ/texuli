/**
 * CI-shaped runner for the golden fixture suite (tests/fixtures/golden).
 *
 * Builds the catalog from the frozen manifests, recomputes every pinned
 * expectation in `golden-expectations.json` through `suite.ts` — including
 * the tools-side guidance check that the catalog gate test does not run —
 * and exits non-zero on any drift.
 *
 * Usage (repository root):
 *   pnpm exec tsx tests/fixtures/golden/run-golden-fixtures.mts
 */
import { buildCatalog, verifyCatalog } from '../../../packages/catalog/src/build/index.ts';
import { discoverManifestGroups } from '../../../packages/catalog/src/build/node.ts';
import { renderCatalogFromBuild } from '../../../packages/catalog/src/render/renderer/index.ts';
import { checkGuidance } from '../../../packages/tools/src/golden/index.ts';
import { compareGoldenFixtures } from './suite.ts';

const groups = await discoverManifestGroups();
const build = await buildCatalog(groups);
const verified = await verifyCatalog(build.fileName, build.json);
if (!verified) throw new Error(`catalog build failed verifyCatalog: ${build.fileName}`);
const catalog = renderCatalogFromBuild(verified);
console.log(
  `golden fixtures: catalog ${build.fileName} (${String(build.catalog.entries.length)} entries)`
);

const drift = compareGoldenFixtures(catalog, {
  checkGuidance: (tree) => checkGuidance(tree),
  catalogEntries: build.catalog.entries.length,
});

if (drift.length === 0) {
  console.log('golden fixtures: no drift — every pinned expectation holds');
  process.exit(0);
}
for (const line of drift) console.error(`DRIFT ${line}`);
console.error(
  `golden fixtures: ${String(drift.length)} drift finding(s). If the behavior change is intended, update golden-expectations.json deliberately (and its $comment); never silence a finding.`
);
process.exit(1);
