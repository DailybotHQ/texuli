<script lang="ts">
import { type HrefTrust, safeHref } from '@texuli/core/url-policy';
import type { Snippet } from 'svelte';
import { Button } from '../../components/button/index.ts';
import { useMessages } from '../../i18n/use-messages.ts';
import { type ClassValue, cx } from '../../internal/cx.ts';
import MarketingLayout from './MarketingLayout.svelte';
import MarketingSection from './MarketingSection.svelte';
import { formatPriceCents, normalizeNavLinks, normalizePricingTiers } from './model.ts';
import type { MarketingCta, MarketingNavLink, PricingTier } from './types.ts';
import './marketing.css';

/**
 * Pricing page: marketing chrome plus a responsive tier grid.
 * Prices are integer cents.
 */
type Props = {
  brandLabel: string;
  brandHref?: string;
  navLinks?: readonly MarketingNavLink[];
  title?: string;
  lede?: string;
  tiers: readonly PricingTier[];
  locale?: string;
  headerCta?: MarketingCta;
  sections?: Snippet;
  footer?: Snippet;
  class?: ClassValue;
};

let {
  brandLabel,
  brandHref = '#/',
  navLinks,
  title: titleProp,
  lede,
  tiers,
  locale = 'en-US',
  headerCta,
  sections,
  footer,
  class: className,
}: Props = $props();
const msg = useMessages();
const title = $derived(titleProp ?? msg('texuli.pricing-layout.title', 'Pricing'));

const links = $derived(normalizeNavLinks(navLinks));
const safeTiers = $derived(normalizePricingTiers(tiers));
const cta = $derived(headerCta);
const safeBrandHref = $derived(safeHref(brandHref, 'developer' as HrefTrust) ?? '#/');
</script>

<MarketingLayout class={cx(className)} {footer}>
  {#snippet brand()}
    <a class="tx-marketing-layout__nav-link" href={safeBrandHref} data-tx-pricing-brand="">{brandLabel}</a>
  {/snippet}

  {#snippet navigation()}
    {#if links.length > 0}
      <ul class="tx-marketing-layout__nav-list">
        {#each links as link (link.id)}
          <li>
            <a class="tx-marketing-layout__nav-link" href={safeHref(link.href, link.hrefTrust ?? 'developer') ?? undefined}>{link.label}</a>
          </li>
        {/each}
      </ul>
    {/if}
  {/snippet}

  {#snippet actions()}
    {#if cta}
      <Button
        size="sm"
        href={cta.href}
        hrefTrust={cta.hrefTrust}
        variant={cta.variant ?? 'outline'}
        onclick={cta.onSelect ? () => cta?.onSelect?.() : undefined}
      >
        {cta.label}
      </Button>
    {/if}
  {/snippet}

  {#snippet hero()}
    <div class="tx-landing-hero" data-tx-pricing-hero="" data-align="center">
      <h1 class="tx-landing-hero__title">{title}</h1>
      {#if lede}
        <p class="tx-landing-hero__lede">{lede}</p>
      {/if}
    </div>
  {/snippet}

  {#snippet sections()}
    <MarketingSection align="center" label="Plans">
      <ul
        class="tx-pricing-grid"
        data-tx-pricing-grid=""
        data-count={String(safeTiers.length)}
      >
        {#each safeTiers as tier (tier.id)}
          <li
            class="tx-pricing-tier"
            data-tx-pricing-tier={tier.id}
            data-highlighted={tier.highlighted ? 'true' : 'false'}
          >
            <h2 class="tx-pricing-tier__name">{tier.name}</h2>
            <p class="tx-pricing-tier__price">
              {formatPriceCents(tier.priceCents, tier.currency ?? 'USD', locale)}
              {#if tier.period}
                <span class="tx-pricing-tier__period">{tier.period}</span>
              {/if}
            </p>
            {#if tier.description}
              <p class="tx-pricing-tier__description">{tier.description}</p>
            {/if}
            {#if tier.features?.length}
              <ul class="tx-pricing-tier__features">
                {#each tier.features as feature, i (`${tier.id}-f-${i}`)}
                  <li class="tx-pricing-tier__feature">
                    <span class="tx-pricing-tier__feature-mark" aria-hidden="true">✓</span>
                    <span>{feature}</span>
                  </li>
                {/each}
              </ul>
            {/if}
            {#if tier.cta}
              <div class="tx-pricing-tier__cta">
                <Button
                  href={tier.cta.href}
                  hrefTrust={tier.cta.hrefTrust}
                  variant={tier.cta.variant ?? (tier.highlighted ? 'default' : 'outline')}
                  onclick={tier.cta.onSelect ? () => tier.cta?.onSelect?.() : undefined}
                >
                  {tier.cta.label}
                </Button>
              </div>
            {/if}
          </li>
        {/each}
      </ul>
    </MarketingSection>
    {@render sections?.()}
  {/snippet}
</MarketingLayout>
