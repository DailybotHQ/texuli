import { stampMigration } from './stamp.ts';
import type { SpecMigration } from './types.ts';

/**
 * 0.14.0 → 0.15.0 is additive (ADR-032, Texuli 0.17.0): the catalog projection
 * gains props that a patch release could not carry, starting with the
 * `data-virtual-list` `mode` (listbox or feed) and `selectable`. The blueprint
 * envelope is unchanged, and every 0.14.0 blueprint and design-system document
 * stays valid, so the step only stamps `spec`.
 */
export const migration0140to0150: SpecMigration = stampMigration('0.14.0', '0.15.0');
