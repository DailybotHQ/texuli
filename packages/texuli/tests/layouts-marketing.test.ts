import { cleanup, render } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LAYOUT_REGISTRY, unregisterLayout } from '../src/layouts/host/registry.ts';
import LandingLayout from '../src/layouts/marketing/LandingLayout.svelte';
import MarketingLayout from '../src/layouts/marketing/MarketingLayout.svelte';
import MarketingSection from '../src/layouts/marketing/MarketingSection.svelte';
import {
  formatPriceCents,
  normalizeNavLinks,
  normalizePricingTiers,
} from '../src/layouts/marketing/model.ts';
import PricingLayout from '../src/layouts/marketing/PricingLayout.svelte';
import {
  registerMarketingLayouts,
  unregisterMarketingLayouts,
} from '../src/layouts/marketing/register.ts';

afterEach(() => {
  cleanup();
  unregisterMarketingLayouts();
  unregisterLayout('marketing');
});

const snippet = (html: string) => createRawSnippet(() => ({ render: () => html }));

describe('marketing model', () => {
  it('formats cents and normalizes tiers and nav links', () => {
    expect(formatPriceCents(2900, 'USD', 'en-US')).toMatch(/\$29/);
    expect(formatPriceCents(Number.NaN)).toBe('');
    expect(
      normalizeNavLinks([
        { id: 'a', label: 'Features', href: '#/features' },
        { id: 'b', label: '  ', href: '#/x' },
        { id: 'c', label: 'Bad', href: '' },
      ])
    ).toEqual([{ id: 'a', label: 'Features', href: '#/features' }]);
    const tiers = normalizePricingTiers([
      {
        id: 'pro',
        name: 'Pro',
        priceCents: 4900,
        features: ['A', '', 'B'],
        highlighted: true,
        cta: { id: 'buy', label: 'Buy', href: '#/buy' },
      },
      { id: 'x', name: '', priceCents: 0 },
    ]);
    expect(tiers).toHaveLength(1);
    expect(tiers[0]?.features).toEqual(['A', 'B']);
    expect(tiers[0]?.highlighted).toBe(true);
  });
});

describe('MarketingLayout', () => {
  it('composes navigation, hero, sections and footer slots', () => {
    const view = render(MarketingLayout, {
      props: {
        brand: snippet('<a href="#/">Northstar</a>'),
        navigation: snippet('<a href="#/features">Features</a>'),
        actions: snippet('<a href="#/signin">Sign in</a>'),
        hero: snippet('<h1>Build with confidence</h1>'),
        sections: snippet('<section aria-label="Features">Useful tools</section>'),
        footer: snippet('<p>Northstar example company</p>'),
      },
    });

    expect(view.container.querySelector('[data-tx-marketing-layout]')).toBeTruthy();
    expect(view.getByRole('navigation', { name: 'Main navigation' }).textContent).toContain(
      'Features'
    );
    expect(view.getByRole('heading', { name: 'Build with confidence' })).toBeTruthy();
    expect(view.getByLabelText('Features').textContent).toContain('Useful tools');
    expect(view.container.querySelector('footer')?.textContent).toContain(
      'Northstar example company'
    );
  });

  it('mounts the LayoutHost screen target when mountScreen is set', () => {
    const mountScreen = vi.fn();
    render(MarketingLayout, { props: { mountScreen } });
    expect(mountScreen).toHaveBeenCalled();
    const target = mountScreen.mock.calls[0]?.[0] as HTMLElement;
    expect(target.getAttribute('data-tx-layout-screen-target')).toBe('');
  });

  it('registers the marketing layout with the host registry', () => {
    registerMarketingLayouts();
    expect(LAYOUT_REGISTRY.marketing?.load).toBeTypeOf('function');
  });
});

describe('LandingLayout', () => {
  it('renders hero, CTAs and nav in LTR and RTL', () => {
    const view = render(LandingLayout, {
      props: {
        brandLabel: 'Harbor Notes',
        title: 'Ship calmer product reviews',
        lede: 'A fictional landing for the demo.',
        heroAlign: 'center',
        navLinks: [
          { id: 'features', label: 'Features', href: '#/features' },
          { id: 'pricing', label: 'Pricing', href: '#/pricing' },
        ],
        primaryCta: { id: 'start', label: 'Start free', href: '#/start' },
        secondaryCta: { id: 'tour', label: 'Tour', href: '#/tour', variant: 'outline' },
      },
    });
    expect(view.getByRole('heading', { name: 'Ship calmer product reviews' })).toBeTruthy();
    expect(view.getAllByRole('link', { name: 'Start free' }).length).toBeGreaterThanOrEqual(1);
    expect(view.getByRole('link', { name: 'Harbor Notes' })).toBeTruthy();
    expect(view.container.querySelector('[data-tx-landing-hero]')?.getAttribute('data-align')).toBe(
      'center'
    );

    view.unmount();
    const rtl = document.createElement('div');
    rtl.dir = 'rtl';
    document.body.append(rtl);
    const rtlView = render(LandingLayout, {
      target: rtl,
      props: {
        brandLabel: 'Harbor',
        title: 'RTL landing',
        primaryCta: { id: 'go', label: 'Go', href: '#/go' },
      },
    });
    expect(rtlView.container.closest('[dir="rtl"]') || rtl.dir).toBeTruthy();
    expect(rtl.getAttribute('dir')).toBe('rtl');
    rtlView.unmount();
    rtl.remove();
  });
});

describe('PricingLayout', () => {
  it('renders pricing tiers with cents formatting', () => {
    const view = render(PricingLayout, {
      props: {
        brandLabel: 'Harbor',
        title: 'Simple pricing',
        lede: 'Fictional plans only.',
        tiers: [
          {
            id: 'starter',
            name: 'Starter',
            priceCents: 0,
            period: '/ mo',
            features: ['3 boards'],
            cta: { id: 's', label: 'Choose Starter', href: '#/starter' },
          },
          {
            id: 'pro',
            name: 'Pro',
            priceCents: 2900,
            period: '/ mo',
            highlighted: true,
            features: ['Unlimited boards', 'Priority support'],
            cta: { id: 'p', label: 'Choose Pro', href: '#/pro' },
          },
        ],
      },
    });
    expect(view.getByRole('heading', { name: 'Simple pricing' })).toBeTruthy();
    expect(
      view.container.querySelector('[data-tx-pricing-tier="pro"]')?.getAttribute('data-highlighted')
    ).toBe('true');
    expect(view.getByRole('link', { name: 'Choose Pro' })).toBeTruthy();
    expect(view.container.textContent).toMatch(/\$29/);
    // Tiers are list items; <article> may not take role="listitem".
    const tiers = view
      .getAllByRole('listitem')
      .filter((el) => el.hasAttribute('data-tx-pricing-tier'));
    expect(tiers).toHaveLength(2);
    expect(view.container.querySelector('article[data-tx-pricing-tier]')).toBeNull();
  });
});

describe('MarketingSection', () => {
  it('exposes a labelled section with title and body', () => {
    const view = render(MarketingSection, {
      props: {
        title: 'Features',
        description: 'What you get.',
        eyebrow: 'Product',
        children: snippet('<p>Boards and timelines</p>'),
      },
    });
    expect(view.getByRole('heading', { name: 'Features' })).toBeTruthy();
    expect(view.getByLabelText('Features').textContent).toContain('Boards and timelines');
  });
});
