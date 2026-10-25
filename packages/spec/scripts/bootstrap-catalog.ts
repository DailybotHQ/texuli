/**
 * Bootstrap (or refresh) catalog/components.json from the built catalog:
 *   pnpm exec tsx packages/spec/scripts/bootstrap-catalog.ts
 * Capability comes from the reviewed catalog/capabilities.json (empty until
 * an id is audited portable).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildCatalog } from '@texuli/catalog/build';
import { discoverManifestGroups } from '@texuli/catalog/build/node';
import { type Capability, projectCatalog } from '../src/catalog.ts';
import { formatJson } from '../src/format.ts';
import { SPEC_ROOT } from './files.ts';

export async function projectLiveCatalog(root = SPEC_ROOT) {
  const build = await buildCatalog(await discoverManifestGroups());
  const capabilities = JSON.parse(
    readFileSync(join(root, 'catalog/capabilities.json'), 'utf8')
  ) as Record<string, Capability>;
  return projectCatalog(build.catalog, build.hash, capabilities);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const catalog = await projectLiveCatalog();
  writeFileSync(join(SPEC_ROOT, 'catalog/components.json'), formatJson(catalog));
  console.log(`catalog/components.json: ${catalog.components.length} components`);
}
