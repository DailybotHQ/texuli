import { stampMigration } from './stamp.ts';
import type { SpecMigration } from './types.ts';

/**
 * 0.11.0 → 0.12.0 is additive (the D-G-022, D-G-024, D-G-023 and D-G-027 to
 * D-G-029 consumer gaps): the catalog gains the app-tier `avatar-group-grid`
 * and `code-field` ids and the `srcDark` and `darkMode`
 * props of `media-image`, and the design-system document gains a layer's
 * optional `darkOpacity` and the `aa-non-text` issue code. The blueprint
 * envelope is unchanged, and every 0.11.0 blueprint and design-system
 * document stays valid, so the step only stamps `spec`.
 */
export const migration0110to0120: SpecMigration = stampMigration('0.11.0', '0.12.0');
