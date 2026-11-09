import { stampMigration } from './stamp.ts';
import type { SpecMigration } from './types.ts';

/**
 * 0.13.0 → 0.14.0 is additive (ADR-032, locked design systems after the
 * 0.15.0 release): a catalog component's axes gain `color`, the
 * design-system `allow` section gains `colors`, the allow-manifest and
 * bundle schemas carry them, and the catalog gains new ids. The blueprint
 * envelope is unchanged, and every 0.13.0 blueprint and design-system
 * document stays valid, so the step only stamps `spec`.
 */
export const migration0130to0140: SpecMigration = stampMigration('0.13.0', '0.14.0');
