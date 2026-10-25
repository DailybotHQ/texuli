// @vitest-environment node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildCatalog } from '../../packages/catalog/src/build/build.ts';
import { discoverManifestGroups } from '../../packages/catalog/src/build/node.ts';
import { buildLlmsBundle } from '../../packages/tools/src/llms/bundle.ts';

/**
 * The agents page serves committed snapshots from apps/website/public: the
 * catalog JSON and the llms files. They must match the live manifests, or
 * the page documents components that are not what the packages ship.
 * Regenerate with the commands in apps/website/docs/site-agents-page.md.
 */
const PUBLIC = join(import.meta.dirname, '../../apps/website/public');

describe('agents page snapshots', async () => {
  const build = await buildCatalog(await discoverManifestGroups());

  it('public/catalog/catalog.json is the current catalog, and its README names its hash', () => {
    const snapshot = JSON.parse(readFileSync(join(PUBLIC, 'catalog/catalog.json'), 'utf8'));
    expect(snapshot).toEqual(build.catalog);
    expect(readFileSync(join(PUBLIC, 'catalog/README.md'), 'utf8')).toContain(
      `catalog-${build.hash}.json`
    );
  });

  it('public/llms is the current llms bundle', () => {
    const bundle = buildLlmsBundle({ catalog: build.catalog });
    for (const file of bundle.files) {
      expect(readFileSync(join(PUBLIC, 'llms', file.path), 'utf8'), file.path).toBe(file.body);
    }
  });
});
