import type { OperationAlias, RemovedOperationName } from './types.ts';

/** The release that removed the 0.8 tool names (one minor after 0.9.0 deprecated them). */
export const ALIASES_REMOVED_IN = '0.10.0';

/**
 * Deprecated aliases a door still serves. Empty in 0.10.0: the seven 0.8
 * names were removed (see {@link TEXULI_REMOVED_NAMES}). The mechanism stays
 * for the next rename, which keeps its old name as an alias for one minor
 * (ADR-017).
 */
export const TEXULI_ALIASES: readonly OperationAlias[] = Object.freeze([]);

/**
 * The seven 0.8 MCP tool names, deprecated in 0.9.0 and removed in 0.10.0.
 * They are not listed; a call is refused with a message that names the
 * operations to call instead.
 */
export const TEXULI_REMOVED_NAMES: readonly RemovedOperationName[] = Object.freeze([
  { name: 'deck', replacedBy: ['deck.run'], removedIn: ALIASES_REMOVED_IN },
  {
    name: 'document',
    replacedBy: ['document.run', 'document.export'],
    removedIn: ALIASES_REMOVED_IN,
  },
  { name: 'catalog', replacedBy: ['catalog.search'], removedIn: ALIASES_REMOVED_IN },
  { name: 'component', replacedBy: ['component.get'], removedIn: ALIASES_REMOVED_IN },
  { name: 'validate', replacedBy: ['catalog.validate'], removedIn: ALIASES_REMOVED_IN },
  { name: 'example', replacedBy: ['example.search'], removedIn: ALIASES_REMOVED_IN },
  { name: 'theme', replacedBy: ['theme.search', 'theme.get'], removedIn: ALIASES_REMOVED_IN },
]);
