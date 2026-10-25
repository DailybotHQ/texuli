/**
 * Structural guard for outline moves: the same `validateDraft` check the
 * player runs, against the player's catalog. A move is refused when it adds
 * structural errors (composition grammar, tree structure). Block-content and
 * envelope errors never change on a move, so they are not counted.
 */
import type { CatalogTreeInput } from '@texuli/catalog/render/renderer';
import { validateDraft } from '@texuli/catalog/validate';
import { createPlayerCatalog } from '@texuli/player';

const catalog = createPlayerCatalog();

export function structuralErrors(tree: CatalogTreeInput): number {
  const result = validateDraft(tree, { catalog, tier: 'untrusted' });
  return result.diagnostics.filter(
    (diagnostic) =>
      diagnostic.severity === 'error' &&
      diagnostic.check !== 'blocks' &&
      diagnostic.check !== 'envelope'
  ).length;
}

/** True when `next` has no more structural errors than `current`. */
export function moveKeepsStructure(current: CatalogTreeInput, next: CatalogTreeInput): boolean {
  return structuralErrors(next) <= structuralErrors(current);
}
