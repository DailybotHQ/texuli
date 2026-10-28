import type { SpecMigration } from './types.ts';

/**
 * 0.3.0 → 0.4.0 is additive (PLAN_008 T-catalog-player / ADR-009 deck encoding):
 * layout-deck and deck-slide gain optional model-v2 props (aspect 9:16,
 * transitions slide/zoom/morph, motion, navigation, outline, layout, background,
 * steps, component). Every 0.3.0 envelope is a valid 0.4.0 envelope, so the
 * step only stamps `spec`.
 */
export const migration030to040: SpecMigration = Object.freeze({
  from: '0.3.0',
  to: '0.4.0',
  migrate: (envelope: Readonly<Record<string, unknown>>) => ({ ...envelope, spec: '0.4.0' }),
});
