import type { SpecMigration } from './types.ts';

/**
 * 0.9.0 → 0.10.0 is additive (PLAN_011 T-ds-spec, ADR-021): it adds the
 * design-system document schema (`schemas/design-system.schema.json`, the
 * `@texuli/spec/design-system` subpath) and `$defs.designSystemReference`,
 * which the envelope does not carry yet. Every 0.9.0 envelope is a valid
 * 0.10.0 envelope, so the step only stamps `spec`.
 */
export const migration090to0100: SpecMigration = Object.freeze({
  from: '0.9.0',
  to: '0.10.0',
  migrate: (envelope: Readonly<Record<string, unknown>>) => ({ ...envelope, spec: '0.10.0' }),
});
