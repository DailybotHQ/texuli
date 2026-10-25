/**
 * `texuli/layouts/marketing` — landing, pricing and marketing section layouts.
 */

export { default as LandingLayout } from './LandingLayout.svelte';
export { default as MarketingLayout } from './MarketingLayout.svelte';
export { default as MarketingSection } from './MarketingSection.svelte';
export {
  formatPriceCents,
  MARKETING_LIMITS,
  normalizeCta,
  normalizeNavLinks,
  normalizePricingTiers,
} from './model.ts';
export { default as PricingLayout } from './PricingLayout.svelte';
export type {
  MarketingCta,
  MarketingLayoutSlots,
  MarketingNavLink,
  MarketingSectionAlign,
  PricingTier,
} from './types.ts';
