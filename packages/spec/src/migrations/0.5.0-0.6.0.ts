import type { SpecMigration } from './types.ts';

/**
 * 0.5.0 → 0.6.0 is additive (PLAN_010 T-motion-spec, ADR-012 and ADR-013):
 * nodes gain an optional closed `motion` (enter and exit presets, `layout`,
 * `stagger` and `duration` in token steps) and the envelope an optional
 * `motion.level`. Every 0.5.0 envelope is a valid 0.6.0 envelope, so the
 * step only stamps `spec`.
 */
export const migration050to060: SpecMigration = Object.freeze({
  from: '0.5.0',
  to: '0.6.0',
  migrate: (envelope: Readonly<Record<string, unknown>>) => ({ ...envelope, spec: '0.6.0' }),
});
