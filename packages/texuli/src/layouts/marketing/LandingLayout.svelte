<script lang="ts">
import { type HrefTrust, safeHref } from '@texuli/core/url-policy';
import type { Snippet } from 'svelte';
import { Button } from '../../components/button/index.ts';
import { type ClassValue, cx } from '../../internal/cx.ts';
import MarketingLayout from './MarketingLayout.svelte';
import { normalizeCta, normalizeNavLinks } from './model.ts';
import type { MarketingCta, MarketingNavLink } from './types.ts';
import './marketing.css';

/**
 * Landing page composition on MarketingLayout: brand, nav links, hero with
 * CTAs, optional sections and footer.
 */
type Props = {
  brandLabel: string;
  brandHref?: string;
  navLinks?: readonly MarketingNavLink[];
  primaryCta?: MarketingCta;
  secondaryCta?: MarketingCta;
  title: string;
  lede?: string;
  heroAlign?: 'start' | 'center';
  navigationLabel?: string;
  sections?: Snippet;
  footer?: Snippet;
  brandSlot?: Snippet;
  actionsSlot?: Snippet;
  class?: ClassValue;
};

let {
  brandLabel,
  brandHref = '#/',
  navLinks,
  primaryCta,
  secondaryCta,
  title,
  lede,
  heroAlign = 'start',
  navigationLabel = 'Main navigation',
  sections,
  footer,
  brandSlot,
  actionsSlot,
  class: className,
}: Props = $props();

const links = $derived(normalizeNavLinks(navLinks));
const primary = $derived(normalizeCta(primaryCta));
const secondary = $derived(normalizeCta(secondaryCta));
const safeBrandHref = $derived(safeHref(brandHref, 'developer' as HrefTrust) ?? '#/');
</script>

<MarketingLayout class={cx(className)} {navigationLabel} {sections} {footer}>
  {#snippet brand()}
    {#if brandSlot}
      {@render brandSlot()}
    {:else}
      <a class="tx-marketing-layout__nav-link" href={safeBrandHref} data-tx-landing-brand="">{brandLabel}</a>
    {/if}
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
    {#if actionsSlot}
      {@render actionsSlot()}
    {:else if primary}
      <Button
        size="sm"
        href={primary.href}
        hrefTrust={primary.hrefTrust}
        variant={primary.variant ?? 'default'}
        onclick={primary.onSelect ? () => primary?.onSelect?.() : undefined}
      >
        {primary.label}
      </Button>
    {/if}
  {/snippet}

  {#snippet hero()}
    <div class="tx-landing-hero" data-tx-landing-hero="" data-align={heroAlign}>
      <h1 class="tx-landing-hero__title">{title}</h1>
      {#if lede}
        <p class="tx-landing-hero__lede">{lede}</p>
      {/if}
      {#if primary || secondary}
        <div class="tx-landing-hero__ctas">
          {#if primary}
            <Button
              href={primary.href}
              hrefTrust={primary.hrefTrust}
              variant={primary.variant ?? 'default'}
              onclick={primary.onSelect ? () => primary?.onSelect?.() : undefined}
            >
              {primary.label}
            </Button>
          {/if}
          {#if secondary}
            <Button
              href={secondary.href}
              hrefTrust={secondary.hrefTrust}
              variant={secondary.variant ?? 'outline'}
              onclick={secondary.onSelect ? () => secondary?.onSelect?.() : undefined}
            >
              {secondary.label}
            </Button>
          {/if}
        </div>
      {/if}
    </div>
  {/snippet}
</MarketingLayout>
