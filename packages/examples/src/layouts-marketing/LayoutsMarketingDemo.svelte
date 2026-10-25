<script lang="ts">
import { LandingLayout, MarketingSection, PricingLayout } from 'texuli/layouts/marketing';

const navLinks = [
  { id: 'features', label: 'Features', href: '#features' },
  { id: 'pricing', label: 'Pricing', href: '#pricing' },
];

const tiers = [
  {
    id: 'starter',
    name: 'Starter',
    priceCents: 0,
    period: '/ month',
    description: 'For a fictional solo reviewer.',
    features: ['3 boards', 'Basic export'],
    cta: { id: 's', label: 'Start free', href: '#/start' },
  },
  {
    id: 'team',
    name: 'Team',
    priceCents: 2900,
    period: '/ month',
    description: 'For a small product squad.',
    highlighted: true,
    features: ['Unlimited boards', 'Shared comments', 'Priority support'],
    cta: { id: 't', label: 'Choose Team', href: '#/team' },
  },
  {
    id: 'scale',
    name: 'Scale',
    priceCents: 9900,
    period: '/ month',
    description: 'For larger fictional orgs.',
    features: ['SSO simulation', 'Audit export', 'Dedicated success'],
    cta: { id: 'sc', label: 'Contact sales', href: '#/sales', variant: 'outline' as const },
  },
];
</script>

<article class="demo" data-example="layouts-marketing" aria-labelledby="layouts-marketing-title">
  <h2 id="layouts-marketing-title">Marketing layouts</h2>
  <p>
    Landing, pricing and section layouts. Fictional Harbor Notes product copy. Prices are integer
    cents.
  </p>

  <section aria-labelledby="landing-title" class="panel">
    <h3 id="landing-title">Landing</h3>
    <LandingLayout
      brandLabel="Harbor Notes"
      title="Ship calmer product reviews"
      lede="Collect feedback on real-feeling prototypes without standing up infrastructure."
      heroAlign="center"
      {navLinks}
      primaryCta={{ id: 'start', label: 'Start free', href: '#/start' }}
      secondaryCta={{ id: 'tour', label: 'See pricing', href: '#pricing', variant: 'outline' }}
    >
      {#snippet sections()}
        <MarketingSection
          eyebrow="Product"
          title="Built for review loops"
          description="Boards, comments and exports that stay deterministic in demos."
          align="center"
        >
          <ul class="feature-list">
            <li>Scenario-backed sample data</li>
            <li>Keyboard-first chrome</li>
            <li>Light and dark themes</li>
          </ul>
        </MarketingSection>
      {/snippet}
      {#snippet footer()}
        <p>© Harbor Notes — fictional demo company</p>
      {/snippet}
    </LandingLayout>
  </section>

  <section aria-labelledby="pricing-title" class="panel" id="pricing">
    <h3 id="pricing-title">Pricing</h3>
    <PricingLayout
      brandLabel="Harbor Notes"
      title="Simple pricing"
      lede="Pick a fictional plan. No real billing."
      {navLinks}
      {tiers}
      headerCta={{ id: 'signin', label: 'Sign in', href: '#/signin', variant: 'ghost' }}
    >
      {#snippet footer()}
        <p>Prices shown in USD. Demo only.</p>
      {/snippet}
    </PricingLayout>
  </section>
</article>

<style>
  .demo {
    display: grid;
    gap: 2rem;
    padding: 1rem;
  }

  .demo h2,
  .demo h3,
  .demo p {
    margin: 0;
  }

  .panel {
    display: grid;
    gap: 0.75rem;
    border: 1px solid var(--tx-border, currentColor);
    border-radius: 0.75rem;
    overflow: hidden;
  }

  .panel h3 {
    padding: 0.75rem 1rem 0;
  }

  .feature-list {
    list-style: none;
    margin: 0 auto;
    padding: 0;
    display: grid;
    gap: 0.5rem;
    max-inline-size: 24rem;
    text-align: start;
  }

  .feature-list li {
    padding: 0.5rem 0.75rem;
    border-radius: 0.5rem;
    background: color-mix(in oklab, var(--tx-muted, currentColor) 12%, transparent);
  }
</style>
