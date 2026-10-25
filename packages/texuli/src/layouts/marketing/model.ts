import type { MarketingCta, MarketingNavLink, PricingTier } from './types.ts';

export const MARKETING_LIMITS = Object.freeze({
  maxNavLinks: 12,
  maxTiers: 6,
  maxFeaturesPerTier: 24,
  maxFeatureChars: 120,
});

/** Format integer cents as a whole-currency string (no floating money). */
export function formatPriceCents(cents: number, currency = 'USD', locale = 'en-US'): string {
  if (!Number.isFinite(cents)) return '';
  const amount = Math.trunc(cents) / 100;
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    }).format(amount);
  } catch {
    return `${amount}`;
  }
}

/** Keep at most `max` nav links with non-empty labels and hrefs. */
export function normalizeNavLinks(
  links: readonly MarketingNavLink[] | undefined
): MarketingNavLink[] {
  if (!Array.isArray(links)) return [];
  const out: MarketingNavLink[] = [];
  for (const link of links) {
    if (out.length >= MARKETING_LIMITS.maxNavLinks) break;
    if (!link || typeof link !== 'object') continue;
    const label = typeof link.label === 'string' ? link.label.trim() : '';
    const href = typeof link.href === 'string' ? link.href.trim() : '';
    const id = typeof link.id === 'string' && link.id.trim() ? link.id.trim() : `nav-${out.length}`;
    if (!label || !href) continue;
    out.push({
      id: id.slice(0, 64),
      label: label.slice(0, 80),
      href,
      hrefTrust: link.hrefTrust,
    });
  }
  return out;
}

/** Sanitize pricing tiers for display. */
export function normalizePricingTiers(tiers: readonly PricingTier[] | undefined): PricingTier[] {
  if (!Array.isArray(tiers)) return [];
  const out: PricingTier[] = [];
  for (const tier of tiers) {
    if (out.length >= MARKETING_LIMITS.maxTiers) break;
    if (!tier || typeof tier !== 'object') continue;
    const name = typeof tier.name === 'string' ? tier.name.trim() : '';
    if (!name) continue;
    const id =
      typeof tier.id === 'string' && tier.id.trim() ? tier.id.trim() : `tier-${out.length}`;
    const priceCents =
      typeof tier.priceCents === 'number' && Number.isFinite(tier.priceCents)
        ? Math.max(0, Math.trunc(tier.priceCents))
        : 0;
    const rawFeatures = Array.isArray(tier.features) ? tier.features : [];
    const features = rawFeatures
      .filter((f: unknown): f is string => typeof f === 'string' && f.trim().length > 0)
      .slice(0, MARKETING_LIMITS.maxFeaturesPerTier)
      .map((f: string) => f.trim().slice(0, MARKETING_LIMITS.maxFeatureChars));
    const featureList = features.length > 0 ? features : undefined;
    const cta = normalizeCta(tier.cta);
    out.push({
      id: id.slice(0, 64),
      name: name.slice(0, 80),
      priceCents,
      period: typeof tier.period === 'string' ? tier.period.slice(0, 40) : undefined,
      description:
        typeof tier.description === 'string' ? tier.description.slice(0, 240) : undefined,
      features: featureList,
      highlighted: tier.highlighted === true,
      cta,
      currency: typeof tier.currency === 'string' ? tier.currency.slice(0, 8) : 'USD',
    });
  }
  return out;
}

export function normalizeCta(cta: MarketingCta | undefined): MarketingCta | undefined {
  if (!cta || typeof cta !== 'object') return undefined;
  const label = typeof cta.label === 'string' ? cta.label.trim() : '';
  if (!label) return undefined;
  const id = typeof cta.id === 'string' && cta.id.trim() ? cta.id.trim() : 'cta';
  return {
    id: id.slice(0, 64),
    label: label.slice(0, 80),
    href: typeof cta.href === 'string' ? cta.href : undefined,
    hrefTrust: cta.hrefTrust,
    variant: cta.variant,
    onSelect: typeof cta.onSelect === 'function' ? cta.onSelect : undefined,
  };
}
