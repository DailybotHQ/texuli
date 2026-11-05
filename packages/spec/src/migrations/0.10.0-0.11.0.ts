import { stampMigration } from './stamp.ts';
import type { SpecMigration } from './types.ts';

/**
 * 0.10.0 → 0.11.0 is additive (the D-G-015 to D-G-018 and C-G-007 consumer
 * gaps): the design-system document gains structured shadows per elevation
 * level (`elevation.levels`), product tokens (`extensions`) and a short
 * categorical palette (1 to 8 colors). The blueprint envelope is unchanged,
 * and every 0.10.0 design-system document stays valid, so the step only
 * stamps `spec`.
 */
export const migration0100to0110: SpecMigration = stampMigration('0.10.0', '0.11.0');
