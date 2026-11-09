import { stampMigration } from './stamp.ts';
import type { SpecMigration } from './types.ts';

/**
 * 0.12.0 → 0.13.0 is additive (ADR-032, locked design systems): the
 * design-system document gains the optional `allow`, `library` and
 * `approval` sections, and a catalog component gains the optional `axes`
 * (variant, size, tone, density) and `states`. The blueprint envelope is
 * unchanged, and every 0.12.0 blueprint and design-system document stays
 * valid, so the step only stamps `spec`.
 */
export const migration0120to0130: SpecMigration = stampMigration('0.12.0', '0.13.0');
