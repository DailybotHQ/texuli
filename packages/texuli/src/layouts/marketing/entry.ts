/**
 * Backward-compatible marketing entry. Prefer:
 * - `texuli/layouts/marketing` for components
 * - `texuli/layouts/marketing/register` for LayoutHost registration only
 *
 * This module no longer auto-registers on import (bundle hygiene).
 */

export * from './index.ts';
export {
  loadMarketing,
  MARKETING_LAYOUT_IDS,
  registerMarketingLayouts,
  unregisterMarketingLayouts,
} from './register.ts';
