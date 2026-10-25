/// <reference types="node" />
/**
 * `pnpm exec tsx packages/catalog/src/build/cli.ts [--out <dir>] [--json]`
 * builds the catalog from every manifest group and writes
 * `catalog-<sha256>.json` (default `packages/catalog/dist/`, git-ignored).
 */
import { fileURLToPath } from 'node:url';
import { CatalogBuildError } from './build.ts';
import { writeCatalog } from './node.ts';

const args = process.argv.slice(2);
const outIndex = args.indexOf('--out');
const out =
  outIndex >= 0 ? args[outIndex + 1] : fileURLToPath(new URL('../../dist/', import.meta.url));

try {
  if (!out) throw new Error('--out needs a directory');
  const { path, hash, catalog } = await writeCatalog(out);
  const summary = {
    path,
    hash,
    entries: catalog.entries.length,
    groups: Object.fromEntries(
      Object.entries(catalog.groups).map(([name, ids]) => [name, ids.length])
    ),
    developer: catalog.tiers.developer.length,
    untrusted: catalog.tiers.untrusted.length,
  };
  console.log(
    args.includes('--json')
      ? JSON.stringify(summary)
      : `catalog: ${path}\n${JSON.stringify(summary, null, 2)}`
  );
} catch (error) {
  console.error(error instanceof CatalogBuildError ? error.message : String(error));
  process.exitCode = 1;
}
