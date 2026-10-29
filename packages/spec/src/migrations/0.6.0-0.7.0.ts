import type { SpecMigration } from './types.ts';

/**
 * 0.6.0 → 0.7.0 is additive (PLAN_010 T-doc-agents, ADR-011, ADR-012 and
 * ADR-014): nodes gain an optional `key` (a stable instance id, unique in
 * the tree), the catalog gains the `document` id whose `doc` prop carries a
 * Texuli document, and edit ops gain `patchDocument` (a bounded RFC 6902
 * patch) and key addressing. Every 0.6.0 envelope is a valid 0.7.0
 * envelope, so the step only stamps `spec`.
 */
export const migration060to070: SpecMigration = Object.freeze({
  from: '0.6.0',
  to: '0.7.0',
  migrate: (envelope: Readonly<Record<string, unknown>>) => ({ ...envelope, spec: '0.7.0' }),
});
