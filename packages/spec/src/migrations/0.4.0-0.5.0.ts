import type { SpecMigration } from './types.ts';

/**
 * 0.4.0 → 0.5.0 is additive (PLAN_009 catalog coverage): the catalog gains
 * the data-cohort-table, data-notification-inbox and data-filter-builder
 * ids and the app-tier time-field id. Every 0.4.0 envelope is a valid 0.5.0
 * envelope, so the step only stamps `spec`.
 */
export const migration040to050: SpecMigration = Object.freeze({
  from: '0.4.0',
  to: '0.5.0',
  migrate: (envelope: Readonly<Record<string, unknown>>) => ({ ...envelope, spec: '0.5.0' }),
});
