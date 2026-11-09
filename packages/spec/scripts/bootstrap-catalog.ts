/**
 * Bootstrap (or refresh) catalog/components.json from the built catalog:
 *   pnpm exec tsx packages/spec/scripts/bootstrap-catalog.ts
 * Capability comes from the reviewed catalog/capabilities.json (empty until
 * an id is audited portable). Variants, sizes and states (ADR-032) come from
 * the manifests' own `axes` and `states` merged with the per-group files in
 * catalog/variants/*.json (read in name order, each id declared once).
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildCatalogWithImports } from '@texuli/catalog/build';
import { discoverManifestGroups } from '@texuli/catalog/build/node';
import { type Capability, projectCatalog } from '../src/catalog.ts';
import { formatJson } from '../src/format.ts';
import { SPEC_ROOT } from './files.ts';

export async function projectLiveCatalog(root = SPEC_ROOT) {
  const build = await buildCatalogWithImports(await discoverManifestGroups());
  const capabilities = JSON.parse(
    readFileSync(join(root, 'catalog/capabilities.json'), 'utf8')
  ) as Record<string, Capability>;
  return projectCatalog(build.catalog, build.hash, capabilities, readVariantsFiles(root));
}

/** The per-group variants files (`catalog/variants/*.json`), in name order, as untrusted data. */
export function readVariantsFiles(root = SPEC_ROOT): unknown[] {
  const dir = join(root, 'catalog/variants');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => JSON.parse(readFileSync(join(dir, name), 'utf8')) as unknown);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const catalog = await projectLiveCatalog();
  writeFileSync(join(SPEC_ROOT, 'catalog/components.json'), formatJson(catalog));
  console.log(`catalog/components.json: ${catalog.components.length} components`);
}
