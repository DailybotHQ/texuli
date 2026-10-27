/// <reference types="node" />
/**
 * Node side of the catalog build: finds every manifest group folder and
 * writes the content-addressed file. Groups are discovered from the folders
 * of `src/manifests/` (each with an `index.ts`, or the `index.js` the
 * published package ships), so a new group is picked up without changing
 * the build.
 */
import { existsSync } from 'node:fs';
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { CatalogManifest } from '../manifest/types.ts';
import { buildCatalog, type CatalogBuild, type ManifestGroup } from './build.ts';

/** The package's own manifest folders. */
export const MANIFESTS_DIR = fileURLToPath(new URL('../manifests/', import.meta.url));

const looksLikeManifest = (value: unknown): value is CatalogManifest =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as { id?: unknown }).id === 'string' &&
  typeof (value as { package?: unknown }).package === 'string' &&
  Array.isArray((value as { props?: unknown }).props);

/**
 * Every manifest a module exports, from its exported manifest lists and
 * single manifests, each once (by identity).
 */
export function manifestsOf(module: Record<string, unknown>): CatalogManifest[] {
  const found = new Set<CatalogManifest>();
  for (const value of Object.values(module)) {
    if (looksLikeManifest(value)) found.add(value);
    else if (Array.isArray(value) && value.length > 0 && value.every(looksLikeManifest)) {
      for (const manifest of value) found.add(manifest);
    }
  }
  return [...found];
}

/** A group folder's entry: `index.ts` in the source tree, `index.js` in the published package. */
function groupEntry(dir: string, name: string): string | undefined {
  return ['index.ts', 'index.js']
    .map((file) => join(dir, name, file))
    .find((path) => existsSync(path));
}

/** Imports each `<dir>/<group>/index.(ts|js)` and collects its manifests, groups sorted by name. */
export async function discoverManifestGroups(
  dir: string = MANIFESTS_DIR
): Promise<ManifestGroup[]> {
  const folders = (await readdir(dir, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() && groupEntry(dir, entry.name))
    .map((entry) => entry.name)
    .sort();
  return Promise.all(
    folders.map(async (name) => ({
      name,
      manifests: manifestsOf(
        (await import(pathToFileURL(groupEntry(dir, name) as string).href)) as Record<
          string,
          unknown
        >
      ),
    }))
  );
}

/** Builds from every discovered group and writes `catalog-<sha256>.json` into `outDir`. */
export async function writeCatalog(
  outDir: string,
  dir: string = MANIFESTS_DIR
): Promise<CatalogBuild & { path: string }> {
  const build = await buildCatalog(await discoverManifestGroups(dir));
  await mkdir(outDir, { recursive: true });
  const path = join(outDir, build.fileName);
  await writeFile(path, build.json);
  return { ...build, path };
}
