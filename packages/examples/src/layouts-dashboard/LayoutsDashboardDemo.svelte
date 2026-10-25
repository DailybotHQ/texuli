<script lang="ts">
import { AnalyticsGrid, DashboardGridLayout } from 'texuli/layouts/dashboard';
import type { NavModel } from 'texuli/layouts/host';

const nav: NavModel = {
  brand: { label: 'PebbleStat', href: '#/' },
  sections: [
    {
      id: 'main',
      items: [
        { id: 'overview', label: 'Overview', href: '#/' },
        { id: 'funnels', label: 'Funnels', href: '#/funnels', badge: 2 },
        { id: 'cohorts', label: 'Cohorts', href: '#/cohorts' },
      ],
    },
  ],
  actions: [{ id: 'share', label: 'Share', href: '#/share' }],
  user: { name: 'Marta Ruiz', href: '#/me' },
};

let direction = $state<'ltr' | 'rtl'>('ltr');
let dense = $state(false);
let path = $state('#/');

function mountDemo(target: HTMLElement): void {
  target.replaceChildren();
  const grid = document.createElement('div');
  grid.setAttribute('data-demo-widgets', '');
  grid.style.display = 'contents';
  // Widgets as direct grid children via a light DOM shell the layout grid styles.
  const widgets = [
    { span: '1', title: 'Active users', body: '12.4k', tone: 'kpi' },
    { span: '1', title: 'Conversion', body: '4.8%', tone: 'kpi' },
    { span: '1', title: 'Revenue', body: '$82k', tone: 'kpi' },
    {
      span: '2',
      title: 'Traffic',
      body: 'Week-over-week sessions stay steady across regions.',
      tone: 'panel',
    },
    { span: '2', title: 'Alerts', body: 'Two funnels need review before Friday.', tone: 'panel' },
  ];
  for (const widget of widgets) {
    const article = document.createElement('article');
    article.dataset.span = widget.span;
    article.dataset.tone = widget.tone;
    article.className = 'demo-card';
    const heading = document.createElement('h3');
    heading.textContent = widget.title;
    const body = document.createElement('p');
    body.textContent = widget.body;
    article.append(heading, body);
    target.append(article);
  }
}
</script>

<section data-example="layouts-dashboard" aria-labelledby="layouts-dashboard-title" dir={direction}>
  <header class="head">
    <div>
      <h2 id="layouts-dashboard-title">Dashboard grid</h2>
      <p>
        Top chrome with primary nav, container-query spans (<code>data-span</code>), and a nested
        analytics auto-fit grid. Toggle direction and density.
      </p>
    </div>
    <div class="controls" role="group" aria-label="Dashboard demo controls">
      <button type="button" onclick={() => (direction = direction === 'ltr' ? 'rtl' : 'ltr')}>
        Direction: {direction}
      </button>
      <button type="button" onclick={() => (dense = !dense)}>
        Density: {dense ? 'dense' : 'comfortable'}
      </button>
      <button type="button" onclick={() => (path = path === '#/' ? '#/funnels' : '#/')}>
        Path: {path}
      </button>
    </div>
  </header>

  <div class="frame" dir={direction}>
    <DashboardGridLayout
      {nav}
      {path}
      options={{ dense, title: 'Overview', gap: dense ? '0.75rem' : '1rem' }}
      mountScreen={mountDemo}
    />
  </div>

  <section class="analytics" aria-labelledby="analytics-grid-title">
    <h3 id="analytics-grid-title">Analytics grid (screen helper)</h3>
    <AnalyticsGrid label="Quarterly metrics" columns={3} minItem={180} dense={dense}>
      <article class="demo-card" data-tone="kpi"><h3>North</h3><p>38%</p></article>
      <article class="demo-card" data-tone="kpi"><h3>South</h3><p>27%</p></article>
      <article class="demo-card" data-tone="kpi"><h3>West</h3><p>35%</p></article>
    </AnalyticsGrid>
  </section>

  <section class="rtl-fixed" aria-labelledby="layouts-dashboard-rtl-title" dir="rtl">
    <h3 id="layouts-dashboard-rtl-title">Right-to-left fixed preview</h3>
    <div class="frame" dir="rtl">
      <DashboardGridLayout
        {nav}
        path="#/cohorts"
        options={{ dense: true, title: 'Cohorts' }}
        mountScreen={mountDemo}
      />
    </div>
  </section>
</section>

<style>
  section[data-example='layouts-dashboard'] {
    max-inline-size: 56rem;
    color: var(--tx-text, var(--tx-foreground, CanvasText));
  }

  .head {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    margin-block-end: 1rem;
  }

  .head h2,
  .analytics h3,
  .rtl-fixed h3 {
    margin: 0;
  }

  .head p {
    margin-block: 0.35rem 0;
    max-inline-size: 40rem;
  }

  .controls {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .controls button {
    min-block-size: 2.5rem;
    padding-inline: 0.75rem;
    border: 1px solid var(--tx-border, CanvasText);
    border-radius: 0.5rem;
    background: var(--tx-surface, var(--tx-background, Canvas));
    color: inherit;
    cursor: pointer;
  }

  .frame {
    border: 1px solid var(--tx-border, CanvasText);
    border-radius: 0.75rem;
    overflow: hidden;
    min-block-size: 18rem;
  }

  .analytics,
  .rtl-fixed {
    margin-block-start: 2rem;
  }

  .analytics h3,
  .rtl-fixed h3 {
    margin-block-end: 0.75rem;
  }

  :global(.demo-card) {
    margin: 0;
    padding: 1rem;
    border: 1px solid var(--tx-border, CanvasText);
    border-radius: 0.75rem;
    background: var(--tx-surface, var(--tx-background, Canvas));
  }

  :global(.demo-card h3) {
    margin: 0 0 0.35rem;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--tx-muted-foreground, GrayText);
  }

  :global(.demo-card p) {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
  }

  :global(.demo-card[data-tone='panel'] p) {
    font-size: 0.9375rem;
    font-weight: 400;
  }
</style>
