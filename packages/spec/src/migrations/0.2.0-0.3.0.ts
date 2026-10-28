import type { SpecMigration } from './types.ts';

/**
 * 0.2.0 → 0.3.0 is additive (ADR-008): every 0.2.0 envelope is a valid
 * 0.3.0 envelope, so the step only stamps `spec`. Object spread keeps a
 * parsed `__proto__` key as an own property, so validation still refuses it.
 */
export const migration020to030: SpecMigration = Object.freeze({
  from: '0.2.0',
  to: '0.3.0',
  migrate: (envelope: Readonly<Record<string, unknown>>) => ({ ...envelope, spec: '0.3.0' }),
});
