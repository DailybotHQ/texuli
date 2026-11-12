<section class="dashboard-preview" aria-label="Sample dashboard preview" data-tx-dashboard-preview>
  <div class="dashboard-preview__header">
    <p>Product analytics</p>
    <span>Mar 1–10, 2026</span>
  </div>
  <div class="dashboard-preview__grid">
    <article><h3>Active users</h3><p class="dashboard-preview__value">4,670</p><p class="dashboard-preview__trend">↑ 8.4% vs. previous period</p><svg role="img" aria-label="Active users trend" viewBox="0 0 100 24"><path d="M2 20 18 17 31 19 46 12 59 14 73 7 86 9 98 2" /></svg></article>
    <article><h3>Activation rate</h3><p class="dashboard-preview__value">42.0%</p><p class="dashboard-preview__trend">↑ 2.1 pts vs. previous period</p><svg role="img" aria-label="Activation rate trend" viewBox="0 0 100 24"><path d="M2 19 18 15 31 16 46 10 59 13 73 8 86 6 98 2" /></svg></article>
    <article><h3>Returning users</h3><p class="dashboard-preview__value">31.0%</p><p class="dashboard-preview__trend">→ 0.3 pts vs. previous period</p><svg role="img" aria-label="Returning users trend" viewBox="0 0 100 24"><path d="M2 17 18 18 31 14 46 12 59 14 73 8 86 10 98 6" /></svg></article>
    <article><h3>Support tickets</h3><p class="dashboard-preview__value">163</p><p class="dashboard-preview__trend">↓ 5.2% vs. previous period</p><svg role="img" aria-label="Support ticket trend" viewBox="0 0 100 24"><path d="M2 3 18 7 31 6 46 11 59 12 73 16 86 14 98 20" /></svg></article>
  </div>
</section>

<style>
  .dashboard-preview { display: grid; gap: 1rem; padding: clamp(0.75rem, 3vw, 1.5rem); border: 1px solid var(--tx-border, GrayText); border-radius: 0.75rem; background: var(--tx-background, Canvas); color: var(--tx-foreground, CanvasText); }
  .dashboard-preview__header { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 0.75rem; }
  .dashboard-preview__header p { margin: 0; font-size: 1.1rem; font-weight: 700; }
  .dashboard-preview__header span, .dashboard-preview__trend { color: var(--tx-muted-foreground, GrayText); font-size: 0.8125rem; }
  .dashboard-preview__grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0.75rem; }
  .dashboard-preview article { min-inline-size: 0; padding: 0.75rem; border: 1px solid var(--tx-border, GrayText); border-radius: 0.6rem; }
  .dashboard-preview h3, .dashboard-preview__value, .dashboard-preview__trend { margin: 0; }
  .dashboard-preview h3 { font-size: 0.8rem; }
  .dashboard-preview__value { margin-block: 0.4rem; font-size: clamp(1.2rem, 3vw, 1.75rem); font-weight: 750; font-variant-numeric: tabular-nums; }
  .dashboard-preview svg { inline-size: 100%; block-size: 2rem; overflow: visible; color: var(--tx-chart-1, #6d4aff); }
  .dashboard-preview path { fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  @media (max-width: 42rem) { .dashboard-preview__grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
</style>
