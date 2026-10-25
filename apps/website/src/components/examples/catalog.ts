/**
 * Catalog of every registered `@texuli/examples` entry.
 * Data is precomputed into `generated/catalog.json` (node script at build)
 * so Astro SSR does not depend on live side-effect registration order.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import generated from './generated/catalog.json';

export interface ExampleCatalogItem {
  id: string;
  title: string;
  description: string;
  tags: readonly string[];
  component: string;
  /** First segment of `component` (texuli, media, data, …). */
  packageId: string;
  /** Primary kind tag for filtering (first non-package tag, else package). */
  kind: string;
  props: readonly string[];
  /** Demo source when found under packages/examples (plain text). */
  source: string | null;
  sourcePath: string | null;
}

function loadGenerated(): readonly ExampleCatalogItem[] {
  // Prefer the JSON module import; fall back to filesystem for node unit tests.
  if (Array.isArray(generated) && generated.length > 0) {
    return generated as ExampleCatalogItem[];
  }
  try {
    const path = join(dirname(fileURLToPath(import.meta.url)), 'generated/catalog.json');
    return JSON.parse(readFileSync(path, 'utf8')) as ExampleCatalogItem[];
  } catch {
    return [];
  }
}

let cached: readonly ExampleCatalogItem[] | null = null;

/** Full catalog from the generated snapshot. */
export function buildExampleCatalog(): readonly ExampleCatalogItem[] {
  if (cached) return cached;
  cached = Object.freeze(loadGenerated().map((item) => Object.freeze({ ...item })));
  return cached;
}

export function getExampleCatalogItem(id: string): ExampleCatalogItem | undefined {
  return buildExampleCatalog().find((item) => item.id === id);
}

export function listExamplePackages(
  items: readonly ExampleCatalogItem[] = buildExampleCatalog()
): readonly string[] {
  return [...new Set(items.map((i) => i.packageId))].sort();
}

export function listExampleKinds(
  items: readonly ExampleCatalogItem[] = buildExampleCatalog()
): readonly string[] {
  return [...new Set(items.map((i) => i.kind))].sort();
}
