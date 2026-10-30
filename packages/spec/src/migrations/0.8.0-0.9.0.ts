import type { SpecMigration } from './types.ts';

/**
 * 0.8.0 → 0.9.0 is additive (PLAN_011 T-gaps-87-95): it refreshes the catalog
 * projection (the button pending note and the gap props that reach the
 * manifests) and removes nothing. Every 0.8.0 envelope is a valid 0.9.0
 * envelope, so the step only stamps `spec`.
 */
export const migration080to090: SpecMigration = Object.freeze({
  from: '0.8.0',
  to: '0.9.0',
  migrate: (envelope: Readonly<Record<string, unknown>>) => ({ ...envelope, spec: '0.9.0' }),
});
