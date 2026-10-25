<script lang="ts">
import { BulletChart, Gauge, ProgressRing, Sparkline } from '@texuli/charts/compact';

const trend = [18, 21, 19, 25, 27, 23, 31, 34] as const;
</script>

<section class="demo" aria-labelledby="compact-charts-title">
  <h2 id="compact-charts-title">Compact charts</h2>
  <p>Small data views with a textual description and an expandable data table.</p>
  <div class="themes">
    <article data-tx-mode="light" aria-labelledby="compact-light-title">
      <h3 id="compact-light-title">Light</h3>
      <div class="chart-grid">
        <div><h4>Weekly signups</h4><Sparkline values={trend} label="Weekly signups" period="eight weeks" variant="area" /></div>
        <div><h4>Quarterly target</h4><BulletChart label="Quarterly revenue" value={74} max={100} target={80} ranges={[55, 85]} /></div>
        <div><h4>Service health</h4><Gauge label="Service health" value={86} thresholds={[60, 80]} bandLabels={['Needs attention', 'Good', 'Excellent']} /></div>
        <div><h4>Project completion</h4><ProgressRing label="Project completion" value={7} max={10} /></div>
      </div>
    </article>
    <article data-tx-mode="dark" aria-labelledby="compact-dark-title">
      <h3 id="compact-dark-title">Dark</h3>
      <div class="chart-grid">
        <div><h4>Weekly signups</h4><Sparkline values={[31, 34, 29, 36, 38, 42]} label="Weekly signups" period="six weeks" /></div>
        <div><h4>Quarterly target</h4><BulletChart label="Quarterly revenue" value={63} max={100} target={80} ranges={[55, 85]} /></div>
        <div><h4>Service health</h4><Gauge label="Service health" value={69} thresholds={[60, 80]} bandLabels={['Needs attention', 'Good', 'Excellent']} /></div>
        <div><h4>Project completion</h4><ProgressRing label="Project completion" value={3} max={5} /></div>
      </div>
    </article>
  </div>
</section>

<style>
  .demo { color: var(--tx-foreground, CanvasText); }
  .themes { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(min(100%, 22rem), 1fr)); }
  article { border: 1px solid var(--tx-border, currentColor); border-radius: 0.75rem; padding: 1rem; background: var(--tx-background, Canvas); color: var(--tx-foreground, CanvasText); }
  article[data-tx-mode='dark'] { color-scheme: dark; }
  article[data-tx-mode='light'] { color-scheme: light; }
  .chart-grid { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(min(100%, 9rem), 1fr)); align-items: center; }
  .chart-grid > div { min-inline-size: 0; }
  h4 { font-size: 0.9rem; }
  @media (forced-colors: active) { article { border-color: CanvasText; } }
</style>
