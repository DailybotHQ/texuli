import type { HrefTrust } from '@texuli/core/url-policy';
import type { Snippet } from 'svelte';

/** A primary or secondary call-to-action on marketing pages. */
export type MarketingCta = {
  id: string;
  label: string;
  href?: string;
  /** Trust for `href` (default `developer` for app-authored links). */
  hrefTrust?: HrefTrust;
  variant?: 'default' | 'secondary' | 'outline' | 'ghost';
  onSelect?: () => unknown;
};

/** One pricing tier shown on PricingLayout. Money is integer cents. */
export type PricingTier = {
  id: string;
  name: string;
  /** Price in integer cents (e.g. 2900 → $29). */
  priceCents: number;
  /** Billing period label, e.g. "per month". */
  period?: string;
  description?: string;
  features?: readonly string[];
  highlighted?: boolean;
  cta?: MarketingCta;
  /** Currency display code for formatting (default USD). */
  currency?: string;
};

export type MarketingSectionAlign = 'start' | 'center';

export type MarketingNavLink = {
  id: string;
  label: string;
  href: string;
  hrefTrust?: HrefTrust;
};

export type MarketingLayoutSlots = {
  brand?: Snippet;
  navigation?: Snippet;
  actions?: Snippet;
  hero?: Snippet;
  sections?: Snippet;
  footer?: Snippet;
};
