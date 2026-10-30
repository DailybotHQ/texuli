// @vitest-environment node
import { readdirSync } from 'node:fs';
import { expect, it } from 'vitest';
import { buildCatalog } from '../src/build/index.ts';
import { discoverManifestGroups, MANIFESTS_DIR } from '../src/build/node.ts';
import { ALL_MANIFEST_GROUPS } from '../src/manifests/all.ts';
import { scenario } from './scenario.ts';

/**
 * `@texuli/catalog/manifests/all`: the static, edge-safe list of every
 * manifest group. It must build the same content-addressed catalog as
 * file-system discovery, so a Worker and the site agree on the hash.
 */
it('lists every manifest group statically, with the same catalog hash as fs discovery', async () => {
  await scenario('one group per manifest folder, sorted by name', () => {
    const folders = readdirSync(MANIFESTS_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    expect(ALL_MANIFEST_GROUPS.map((group) => group.name)).toEqual(folders);
    expect(Object.isFrozen(ALL_MANIFEST_GROUPS)).toBe(true);
  });
  await scenario('each group carries the same manifests, and the hash matches', async () => {
    const discovered = await discoverManifestGroups();
    expect(
      ALL_MANIFEST_GROUPS.map((group) => [group.name, group.manifests.map(({ id }) => id).sort()])
    ).toEqual(discovered.map((group) => [group.name, group.manifests.map(({ id }) => id).sort()]));
    const [fromList, fromFs] = await Promise.all([
      buildCatalog(ALL_MANIFEST_GROUPS),
      buildCatalog(discovered),
    ]);
    expect(fromList.hash).toBe(fromFs.hash);
    expect(fromList.hash).toMatch(/^[0-9a-f]{64}$/u);
  });
});
