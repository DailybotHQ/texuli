<!-- Lazily loaded: carry the styles with the component (Astro attaches lazily
     imported component CSS only to some pages). -->
<svelte:options css="injected" />

<script lang="ts">
/**
 * Page layouts (landing, marketing, pricing, auth split, wizard, settings)
 * and the content layouts agents emit (card, page, doc, deck, grid).
 *
 * The content layouts are abstract tree nodes with no component of their
 * own; each is shown with the Texuli parts that render that frame: a Card,
 * a CardGrid, the docs layout with its contents, a paged deck of cards and
 * a plain page under LayoutHost.
 */
import type { Component } from 'svelte';
import { Button } from 'texuli/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardGrid,
  CardHeader,
  CardTitle,
} from 'texuli/card';
import { Input } from 'texuli/input';
import { Pagination } from 'texuli/navigation';
import type { StepperStep } from 'texuli/stepper';
import { ARTICLE_SCREEN, DEMO_NAV } from './screens.ts';
import { readers, type StageValues } from './values.ts';

type Props = { componentId: string; values: StageValues };

let { componentId, values }: Props = $props();

const { str, num, bool } = readers(() => values);

type AnyComponent = Component<Record<string, unknown>>;

async function loadPage(): Promise<AnyComponent> {
  const host = await import('texuli/layouts/host');
  return host.LayoutHost as AnyComponent;
}

const LOADERS: Record<string, () => Promise<AnyComponent>> = {
  'layout-landing': async () =>
    (await import('texuli/layouts/marketing/landing')).LandingLayout as AnyComponent,
  'layout-marketing': async () =>
    (await import('texuli/layouts/marketing')).MarketingLayout as AnyComponent,
  'layout-pricing': async () =>
    (await import('texuli/layouts/marketing/pricing')).PricingLayout as AnyComponent,
  'layout-auth-split': async () =>
    (await import('texuli/layouts/auth-settings')).AuthSplitLayout as AnyComponent,
  'layout-wizard': async () =>
    (await import('texuli/layouts/auth-settings')).WizardLayout as AnyComponent,
  'layout-settings': async () =>
    (await import('texuli/layouts/auth-settings')).SettingsLayout as AnyComponent,
  'layout-doc': async () =>
    (await (await import('texuli/layouts/content/docs')).loadDocsLayout()).default as AnyComponent,
  'layout-page': loadPage,
};

let Layout = $state<AnyComponent | null>(null);
let failed = $state(false);

$effect(() => {
  const load = LOADERS[componentId];
  if (!load) return;
  let alive = true;
  load().then(
    (component) => {
      if (alive) Layout = component;
    },
    () => {
      if (alive) failed = true;
    }
  );
  return () => {
    alive = false;
  };
});

const NAV_LINKS = [
  { id: 'features', label: 'Features', href: '#features' },
  { id: 'pricing', label: 'Pricing', href: '#pricing' },
  { id: 'docs', label: 'Docs', href: 'https://example.com/docs' },
];
const TIERS = [
  {
    id: 'free',
    name: 'Free',
    priceCents: 0,
    period: 'month',
    description: 'For one person.',
    features: ['One workspace', '100 notes'],
    cta: { id: 'free-cta', label: 'Start free', href: '#start' },
  },
  {
    id: 'team',
    name: 'Team',
    priceCents: 1200,
    period: 'seat / month',
    description: 'For small teams.',
    features: ['Unlimited notes', 'Shared folders', 'Offline sync'],
    highlighted: true,
    cta: { id: 'team-cta', label: 'Try Team', href: '#trial' },
  },
  {
    id: 'org',
    name: 'Organization',
    priceCents: 2900,
    period: 'seat / month',
    features: ['SSO (simulated)', 'Audit log'],
    cta: { id: 'org-cta', label: 'Contact sales', href: '#sales', variant: 'outline' as const },
  },
];
const STEPS: StepperStep[] = [
  { id: 'profile', label: 'Profile' },
  { id: 'workspace', label: 'Workspace' },
  { id: 'invite', label: 'Invite' },
];
const SECTIONS = [
  { id: 'profile', label: 'Profile', description: 'Name and avatar' },
  { id: 'security', label: 'Security', description: 'Password and sessions' },
  { id: 'notifications', label: 'Notifications' },
];
const SLIDES = [
  { title: 'Harbor Notes', text: 'Notes that stay with the team.' },
  { title: 'The problem', text: 'Drafts scatter across tools and devices.' },
  { title: 'The plan', text: 'One home for drafts, synced offline.' },
];

let step = $state(0);
let finished = $state(false);
let active = $state('profile');
let slide = $state(1);
let email = $state('ada@example.com');

$effect(() => {
  if (componentId === 'layout-wizard')
    step = Math.min(STEPS.length - 1, Math.max(0, Math.round(num('current', 0))));
});
$effect(() => {
  if (componentId === 'layout-settings') active = str('active', 'profile');
});
</script>

{#snippet brandMark()}<strong>Harbor Notes</strong>{/snippet}

<div class="stage" data-tx-page-layout-stage={componentId}>
  {#if componentId === 'layout-card'}
    <Card>
      <CardHeader>
        <CardTitle level={2}>{str('title', 'Summary')}</CardTitle>
        <CardDescription>A content layout groups one topic in a card.</CardDescription>
      </CardHeader>
      <CardContent>Twelve drafts were reviewed this week; three are ready to publish.</CardContent>
      <CardFooter><Button size="sm">Publish three</Button></CardFooter>
    </Card>
  {:else if componentId === 'layout-grid'}
    <CardGrid minItemWidth={`${Math.max(8, 30 / Math.max(1, num('columns', 2)))}rem`} gap="md">
      {#each ['Inbox', 'Notes', 'Archive', 'People'] as item (item)}
        <Card variant="flat">
          <CardHeader><CardTitle level={3}>{item}</CardTitle></CardHeader>
          <CardContent>Open the {item.toLowerCase()} view.</CardContent>
        </Card>
      {/each}
    </CardGrid>
  {:else if componentId === 'deck-slide'}
    <Card>
      <CardHeader>
        <CardTitle level={2}>{str('title', 'The plan')}</CardTitle>
        <CardDescription>One slide of a deck (slide 3 of 3)</CardDescription>
      </CardHeader>
      <CardContent>One home for drafts, synced offline.</CardContent>
    </Card>
  {:else if componentId === 'layout-deck'}
    {@const current = SLIDES[slide - 1] ?? SLIDES[0]}
    <section class="deck" aria-roledescription="slide deck" aria-label={str('title', 'Pitch')}>
      <Card>
        <CardHeader>
          <CardTitle level={2}>{current?.title}</CardTitle>
          <CardDescription>Slide {slide} of {SLIDES.length}</CardDescription>
        </CardHeader>
        <CardContent>{current?.text}</CardContent>
      </Card>
      <Pagination.Root bind:page={slide} pageCount={SLIDES.length} size="sm" label="Slides" />
    </section>
  {:else if failed}
    <p role="alert">The layout failed to load.</p>
  {:else if !Layout}
    <p class="note" role="status">Loading layout…</p>
  {:else if componentId === 'layout-landing'}
    <Layout
      brandLabel="Harbor Notes"
      navLinks={NAV_LINKS}
      title="Notes that stay with the team"
      lede="Drafts sync across devices and keep working offline."
      primaryCta={{ id: 'start', label: 'Start free', href: '#start' }}
      secondaryCta={{ id: 'tour', label: 'Take the tour', href: '#tour', variant: 'outline' }}
    >
      {#snippet sections()}
        <section id="features" class="note-section">
          <h2>Features</h2>
          <p>Offline sync, shared folders and a calm editor.</p>
        </section>
      {/snippet}
    </Layout>
  {:else if componentId === 'layout-marketing'}
    <Layout
      navigationLabel={str('navigationLabel', 'Main navigation')}
      heroLabel={str('heroLabel', 'Introduction')}
      contentLabel={str('contentLabel', 'Page content')}
    >
      {#snippet brand()}{@render brandMark()}{/snippet}
      {#snippet navigation()}
        <ul class="inline-links">
          {#each NAV_LINKS as link (link.id)}<li><a href={link.href}>{link.label}</a></li>{/each}
        </ul>
      {/snippet}
      {#snippet actions()}<Button size="sm">Sign up</Button>{/snippet}
      {#snippet hero()}
        <h1 class="hero-title">Notes that stay with the team</h1>
        <p>Drafts sync across devices and keep working offline.</p>
      {/snippet}
      {#snippet sections()}
        <section class="note-section"><h2>Why teams switch</h2><p>Nothing gets lost between devices.</p></section>
      {/snippet}
      {#snippet footer()}<p>© 2026 Harbor Notes (fictional)</p>{/snippet}
    </Layout>
  {:else if componentId === 'layout-pricing'}
    <Layout
      brandLabel="Harbor Notes"
      navLinks={NAV_LINKS}
      title={str('title', 'Plans')}
      lede={str('description', 'Simple pricing for teams of every size.')}
      tiers={TIERS}
    />
  {:else if componentId === 'layout-auth-split'}
    <Layout
      brandTitle={str('brandTitle', 'Harbor')}
      brandDescription={str('brandDescription', 'A clearer way for the team to ship together.')}
      brandEyebrow={str('brandEyebrow', 'Workspace')}
      formLabel={str('formLabel', 'Sign in')}
      panelLabel={str('panelLabel', 'About this workspace')}
    >
      {#snippet brand()}Harbor{/snippet}
      {#snippet form()}
        <div class="form">
          <label class="field">
            <span>Email</span>
            <Input type="email" autocomplete="username" bind:value={email} />
          </label>
          <Button>Continue</Button>
        </div>
      {/snippet}
    </Layout>
  {:else if componentId === 'layout-wizard'}
    {#if finished}
      <p role="status">Workspace ready. <Button size="sm" variant="outline" onclick={() => { finished = false; step = 0; }}>Start over</Button></p>
    {:else}
      <Layout
        bind:current={step}
        steps={STEPS}
        title={str('title', 'Welcome')}
        description={str('description', 'Three short steps to open the workspace.')}
        backLabel={str('backLabel', 'Back')}
        nextLabel={str('nextLabel', 'Continue')}
        finishLabel={str('finishLabel', 'Open workspace')}
        onFinish={() => {
          finished = true;
        }}
      >
        {#snippet content({ step: s }: { step: StepperStep })}
          <p>You are on <strong>{s.label}</strong>.</p>
        {/snippet}
      </Layout>
    {/if}
  {:else if componentId === 'layout-settings'}
    <Layout
      bind:active
      title={str('title', 'Settings')}
      description={str('description', 'Workspace preferences.')}
      sections={SECTIONS}
      startWithList={bool('startWithList', false)}
      navLabel={str('navLabel', 'Settings sections')}
      backLabel={str('backLabel', 'Settings')}
    >
      {#snippet children(id: string)}
        <p>
          {id === 'profile' ? 'Profile for Ada Park.' : id === 'security' ? 'Password and active sessions.' : 'Email and in-app notices.'}
        </p>
      {/snippet}
    </Layout>
  {:else if componentId === 'layout-doc'}
    <Layout
      mountScreen={ARTICLE_SCREEN}
      nav={DEMO_NAV}
      path="/overview"
      options={{ title: str('title', 'Guide'), summary: 'A short guide with its contents beside it.', toc: bool('toc', true) }}
    />
  {:else}
    <Layout layout="custom" nav={DEMO_NAV}>
      <header class="page-head">
        <h2 class="hero-title">{str('title', 'Overview')}</h2>
        <p>{str('description', 'Quarterly update')}</p>
      </header>
      <p>The page layout gives one title, a description and the content below.</p>
    </Layout>
  {/if}
</div>

<style>
  .stage {
    display: grid;
    gap: 0.75rem;
  }
  .deck {
    display: grid;
    gap: 0.75rem;
  }
  .form,
  .field {
    display: grid;
    gap: 0.5rem;
  }
  .inline-links {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .hero-title {
    margin: 0;
    font-size: 1.75rem;
  }
  .page-head {
    display: grid;
    gap: 0.25rem;
  }
  .note-section {
    padding-block: 1rem;
  }
  .note {
    margin: 0;
    font-size: 0.875rem;
  }
</style>
