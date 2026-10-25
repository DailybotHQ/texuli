// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { compareGoldenFixtures } from '../../../tests/fixtures/golden/suite.ts';
import { buildCatalog } from '../src/build/index.ts';
import { discoverManifestGroups } from '../src/build/node.ts';
import { renderCatalogFromBuild } from '../src/render/renderer/index.ts';

/**
 * Gate coverage for the golden fixture suite (tests/fixtures/golden): the
 * PLAN_002 expressiveness audit screens 01-08 must keep behaving exactly as
 * pinned in golden-expectations.json. The standalone runner
 * (`pnpm exec tsx tests/fixtures/golden/run-golden-fixtures.mts`) pins the
 * same file plus the tools-side guidance check; this test pins the catalog
 * side inside the formal gate.
 */
describe('golden fixtures (PLAN_002 audit screens 01-08)', () => {
  it('matches every pinned expectation in tests/fixtures/golden', async () => {
    const build = await buildCatalog(await discoverManifestGroups());
    const catalog = renderCatalogFromBuild(build.catalog);
    expect(
      compareGoldenFixtures(catalog, { catalogEntries: build.catalog.entries.length })
    ).toEqual([]);
  });
});
