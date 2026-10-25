<!-- Lazily loaded: carry the styles with the component (Astro attaches lazily
     imported component CSS only to some pages). -->
<svelte:options css="injected" />

<script lang="ts">
/**
 * App and content layouts, the layout host and its parts. Each layout mounts
 * for real with a fictional nav model and screen; full layouts render page
 * landmarks, so the gallery shows them in an isolated preview document.
 */
import type { Component } from 'svelte';
import { Button } from 'texuli/button';
import { Card, CardContent, CardHeader, CardTitle } from 'texuli/card';
import { LayoutChrome, NavIcon } from 'texuli/layouts/host/chrome';
import { LayoutDrawer } from 'texuli/layouts/host/drawer';
import { APP_SCREEN, ARTICLE_SCREEN, DEMO_NAV } from './screens.ts';
import { readers, type StageValues } from './values.ts';

type Props = { componentId: string; values: StageValues };

let { componentId, values }: Props = $props();

const { str, num, bool, pick } = readers(() => values);

type AnyComponent = Component<Record<string, unknown>>;

const HOST_LAYOUTS = [
  'sidebar',
  'rail',
  'top-nav',
  'dual-sidebar',
  'master-detail',
  'dashboard-grid',
  'docs',
  'blog',
  'editorial',
  'marketing',
  'mobile-tabs',
  'mobile-drawer',
  'wizard',
  'auth-split',
  'custom',
] as const;

/** Registers every layout family on the host, then returns the host. */
async function loadHost(): Promise<AnyComponent> {
  const [host, app, mobile, auth, dashboard] = await Promise.all([
    import('texuli/layouts/host'),
    import('texuli/layouts/app'),
    import('texuli/layouts/mobile'),
    import('texuli/layouts/auth-settings'),
    import('texuli/layouts/dashboard'),
    import('texuli/layouts/content/docs'),
    import('texuli/layouts/content/blog'),
    import('texuli/layouts/content/editorial'),
    import('texuli/layouts/marketing'),
  ]);
  app.registerAppLayouts();
  mobile.registerMobileLayouts();
  auth.registerAuthSettingsLayouts();
  void dashboard;
  return host.LayoutHost as AnyComponent;
}

const LOADERS: Record<string, () => Promise<AnyComponent>> = {
  'layout-host': loadHost,
  'content-layout': loadHost,
  'screen-outlet': loadHost,
  'layout-sidebar': async () =>
    (await import('texuli/layouts/app/sidebar')).default as AnyComponent,
  'layout-top-nav': async () =>
    (await import('texuli/layouts/app/top-nav')).default as AnyComponent,
  'layout-dual-sidebar': async () =>
    (await import('texuli/layouts/app/dual-sidebar')).default as AnyComponent,
  'split-view': async () => (await import('texuli/layouts/app/split-view')).default as AnyComponent,
  'layout-dashboard-grid': async () =>
    (await import('texuli/layouts/dashboard')).DashboardGridLayout as AnyComponent,
  'analytics-grid': async () =>
    (await import('texuli/layouts/dashboard')).AnalyticsGrid as AnyComponent,
  'layout-docs': async () =>
    (await (await import('texuli/layouts/content/docs')).loadDocsLayout()).default as AnyComponent,
  'layout-blog': async () =>
    (await (await import('texuli/layouts/content/blog')).loadBlogLayout()).default as AnyComponent,
  'layout-editorial': async () =>
    (await (await import('texuli/layouts/content/editorial')).loadEditorialLayout())
      .default as AnyComponent,
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

const ARTICLE_OPTIONS: Record<string, Record<string, string>> = {
  docs: {
    title: 'A guide to calm workspaces',
    summary: 'A practical guide to a clear home for complex work.',
    eyebrow: 'Product guide',
  },
  blog: {
    title: 'Designing for the next small step',
    summary: 'How small, steady improvements make a tool easier to trust.',
    author: 'Mira Chen',
    date: 'October 14, 2026',
    readingTime: '6 minute read',
  },
  editorial: {
    title: 'The quiet craft of useful software',
    summary: 'A long read about details that help teams find their way.',
    eyebrow: 'Field report · 08',
    author: 'Mira Chen',
    date: 'October 14, 2026',
  },
};

let outletLayout = $state<'sidebar' | 'top-nav'>('sidebar');

const hostLayout = $derived(
  componentId === 'content-layout'
    ? pick('kind', ['docs', 'blog', 'editorial'] as const, 'docs')
    : componentId === 'screen-outlet'
      ? outletLayout
      : pick('layout', HOST_LAYOUTS, 'sidebar')
);
const labels = $derived({
  skipLabel: str('skipLabel', 'Skip to content'),
  menuLabel: str('menuLabel', 'Open navigation'),
  closeLabel: str('closeLabel', 'Close navigation'),
});

let drawerOpen = $state(false);
let selected = $state('');
let detailActive = $state(false);
let outletReady = $state(0);

const THREADS = ['Release notes', 'Launch checklist', 'Design review'];
</script>

<div class="stage" data-tx-layout-stage={componentId}>
  {#if componentId === 'layout-chrome'}
    {@const part = pick('part', ['skip', 'brand', 'actions', 'user'] as const, 'brand')}
    <div class="chrome">
      <LayoutChrome
        {part}
        nav={DEMO_NAV}
        mainId="layout-chrome-main"
        compact={bool('compact')}
        skipLabel={str('skipLabel', 'Skip to content')}
      />
    </div>
    <div class="chrome" aria-label="Every chrome part" role="group">
      {#each ['brand', 'actions', 'user'] as const as other (other)}
        <LayoutChrome part={other} nav={DEMO_NAV} />
      {/each}
    </div>
    <p id="layout-chrome-main" tabindex="-1" class="note">The skip link moves focus here.</p>
  {:else if componentId === 'nav-icon'}
    <p class="icons">
      {#each ['home', 'inbox', 'file-text', 'archive', 'users', 'help'] as const as icon (icon)}
        <span class="icon"><NavIcon {icon} label={icon === 'home' ? str('label', 'Home') : icon} /></span>
      {/each}
    </p>
  {:else if componentId === 'layout-drawer'}
    <Button onclick={() => (drawerOpen = true)}>Open navigation</Button>
    <LayoutDrawer
      bind:open={drawerOpen}
      label={str('label', 'Navigation')}
      closeLabel={str('closeLabel', 'Close navigation')}
    >
      <ul class="links">
        <li><a href="#/inbox">Inbox</a></li>
        <li><a href="#/notes">Notes</a></li>
        <li><a href="#/archive">Archive</a></li>
      </ul>
    </LayoutDrawer>
  {:else if failed}
    <p role="alert">The layout failed to load.</p>
  {:else if !Layout}
    <p class="note" role="status">Loading layout…</p>
  {:else if componentId === 'analytics-grid'}
    <Layout
      label={str('label', 'Key metrics')}
      columns={Math.min(4, Math.max(1, Math.round(num('columns', 3))))}
      minItem={num('minItem', 160)}
      gap={str('gap', '1rem')}
      dense={bool('dense')}
    >
      {#each [['North', '38%'], ['South', '27%'], ['West', '35%'], ['East', '22%']] as [region, share] (region)}
        <Card variant="flat">
          <CardHeader><CardTitle level={3}>{region}</CardTitle></CardHeader>
          <CardContent>{share} of orders</CardContent>
        </Card>
      {/each}
    </Layout>
  {:else if componentId === 'split-view'}
    <div class="split">
      <Layout
        listLabel={str('listLabel', 'Inbox')}
        detailLabel={str('detailLabel', 'Thread')}
        bind:detailActive
      >
        {#snippet list()}
          <ul class="links">
            {#each THREADS as thread (thread)}
              <li>
                <button
                  type="button"
                  class="thread"
                  aria-current={selected === thread ? 'true' : undefined}
                  onclick={() => {
                    selected = thread;
                    detailActive = true;
                  }}
                >
                  {thread}
                </button>
              </li>
            {/each}
          </ul>
        {/snippet}
        {#snippet detail()}
          {#if selected}
            <div class="detail">
              <p class="detail__title">{selected}</p>
              <p>The detail pane sits beside the list on wide screens.</p>
              <Button size="sm" variant="outline" onclick={() => (detailActive = false)}>Back to list</Button>
            </div>
          {/if}
        {/snippet}
        {#snippet empty()}
          <p>Select a thread to see it here.</p>
        {/snippet}
      </Layout>
    </div>
  {:else if componentId === 'layout-host' || componentId === 'content-layout' || componentId === 'screen-outlet'}
    <Layout
      layout={hostLayout}
      nav={DEMO_NAV}
      path="/inbox/mentions"
      options={ARTICLE_OPTIONS[hostLayout] ?? { title: 'Overview' }}
      loadingLabel={str('loadingLabel', 'Loading layout')}
    >
      {#if hostLayout === 'docs' || hostLayout === 'blog' || hostLayout === 'editorial'}
        <p>Useful interfaces give people a clear next step and enough context to act.</p>
        <h2 id="start-with-a-map">Start with a map</h2>
        <p>A good structure gives each topic a home and keeps the route back easy to find.</p>
        <h2 id="make-progress-visible">Make progress visible</h2>
        <p>A short summary and a clear section title help readers know where they are.</p>
      {:else}
        <h1 class="screen-title">Inbox</h1>
        <p>The screen keeps its state while the layout around it changes.</p>
        {#if componentId === 'screen-outlet'}
          <p class="chrome" role="group" aria-label="Switch the layout around the outlet">
            {#each ['sidebar', 'top-nav'] as const as id (id)}
              <Button
                size="sm"
                variant="outline"
                aria-pressed={outletLayout === id}
                onclick={() => (outletLayout = id)}
              >
                {id}
              </Button>
            {/each}
          </p>
        {/if}
        <Button size="sm" onclick={() => (outletReady += 1)}>Count clicks: {outletReady}</Button>
      {/if}
    </Layout>
  {:else if componentId === 'layout-docs' || componentId === 'layout-blog' || componentId === 'layout-editorial'}
    <Layout
      mountScreen={ARTICLE_SCREEN}
      nav={DEMO_NAV}
      path="/overview"
      options={ARTICLE_OPTIONS[componentId.replace('layout-', '')]}
    />
  {:else}
    <Layout mountScreen={APP_SCREEN} nav={DEMO_NAV} path="/inbox/mentions" options={{ title: 'Overview' }} {...labels}>
      {#snippet aside()}
        <p class="note">Related notes stay beside the screen on wide layouts.</p>
      {/snippet}
    </Layout>
  {/if}
</div>

<style>
  .stage {
    display: grid;
    gap: 0.75rem;
  }
  .chrome {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 1rem;
  }
  .icons {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    margin: 0;
  }
  .icon {
    display: inline-grid;
    place-items: center;
    inline-size: 2.5rem;
    block-size: 2.5rem;
    border: 1px solid var(--tx-border, ButtonBorder);
    border-radius: var(--tx-radius, 0.5rem);
  }
  .links {
    display: grid;
    gap: 0.25rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .thread {
    inline-size: 100%;
    min-block-size: 2.25rem;
    padding-inline: 0.75rem;
    border: 0;
    border-radius: var(--tx-radius, 0.375rem);
    background: transparent;
    color: inherit;
    font: inherit;
    text-align: start;
    cursor: pointer;
  }
  .thread[aria-current='true'] {
    background: var(--tx-accent, Highlight);
    color: var(--tx-accent-foreground, HighlightText);
  }
  .thread:focus-visible {
    outline: 2px solid var(--tx-ring, Highlight);
    outline-offset: 1px;
  }
  .split {
    min-block-size: 16rem;
    border: 1px solid var(--tx-border, ButtonBorder);
    border-radius: var(--tx-radius, 0.5rem);
  }
  .detail {
    display: grid;
    gap: 0.5rem;
    padding: 1rem;
  }
  .detail__title,
  .screen-title {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
  }
  .note {
    margin: 0;
    font-size: 0.875rem;
  }
</style>
