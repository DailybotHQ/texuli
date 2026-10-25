import { canonicalJson, sha256Hex } from '../build/canonical.ts';
import type { CatalogTreeInput } from '../render/renderer/types.ts';

/**
 * The blueprint's canonical JSON, the catalog build's rule: keys sorted at
 * every depth, no whitespace, `undefined` dropped. Export → import → export
 * gives the same bytes. Throws on values JSON cannot carry exactly.
 */
export function canonicalBlueprintJson(tree: CatalogTreeInput): string {
  return canonicalJson(tree);
}

/**
 * Lowercase hex SHA-256 of the canonical JSON. Two trees with the same data
 * have the same digest whatever their key order, so a host can check that
 * what the owner reviewed is what gets activated.
 */
export function blueprintDigest(tree: CatalogTreeInput): Promise<string> {
  return sha256Hex(canonicalBlueprintJson(tree));
}
