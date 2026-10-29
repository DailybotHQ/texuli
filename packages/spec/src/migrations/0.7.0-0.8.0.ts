import type { SpecMigration } from './types.ts';

/**
 * 0.7.0 → 0.8.0 is additive (PLAN_010 wave 4–6, ADR-012 and ADR-015): it
 * adds vocabulary (data-source bindings and the other 0.8.0 additions) and
 * removes nothing. Every 0.7.0 envelope is a valid 0.8.0 envelope, so the
 * step only stamps `spec`.
 */
export const migration070to080: SpecMigration = Object.freeze({
  from: '0.7.0',
  to: '0.8.0',
  migrate: (envelope: Readonly<Record<string, unknown>>) => ({ ...envelope, spec: '0.8.0' }),
});
